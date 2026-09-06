"""Heuristic batter: extrapolates noisy sightings, decides swing, plans bat path.

Prediction = blend of two estimators the batter's brain can run:
    quad   : least-squares constant-acceleration fit of the sightings
    naive  : constant-velocity from the last few sightings + gravity only
    pred   = recognition * quad + (1 - recognition) * naive

Release reading (v0.3): the batter remembers where this pitcher usually
releases the ball. A release point far from that memory is a tip that
raises recognition for this pitch (pitch tipping / broken tunnel).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

import numpy as np

from ..physics.constants import PLATE_FRONT_Y, G, STRIKE_ZONE_HALF_WIDTH
from ..physics.bat import BatSpec
from .base import (BatterAgent, BatterObservation, BatterTendencies, ExecutionProfile,
                   SwingDecision)
from .batter_perception import Judgment, PitcherMemory, default_clusters, judge, late_read, learn_from_flight, pressure_index, visibility


@dataclass
class BatterProfile:
    name: str = "B"
    hand: str = "R"
    height: float = 1.85
    recognition: float = 0.6
    discipline: float = 0.6
    bat_speed: float = 33.0          # m/s (73.8 mph); ~71 mph at contact after contact-mode/fatigue (MLB avg 71.5)
    attack_angle_deg: float = 8.0
    undercut_intent: float = 0.020
    reaction_time: float = 0.15
    execution: ExecutionProfile = field(default_factory=ExecutionProfile)
    contact_offset_y: float = 0.15
    release_read: float = 0.5          # 0..1 how well it reads release-point tips
    power_zone: str = "middle"         # in | away | low | high | middle
    tracking: float = 0.5              # 타구판단능력: eye noise, how far the clean-tracking region extends
    composure: float = 0.5             # 침착성: keeps judgment/plan under pressure
    reaction: float = 0.5              # 순발력: how much the swing can be corrected after commit
    boldness: float = 0.5              # 과감성(1)/신중성(0): swing big at a read strike vs take borderline pitches to learn
    # --- swing mechanics (0..1) ---
    barrel_placement: float = 0.5      # 배트 초기 위치 선정: vertical/horizontal placement accuracy of the barrel on the read point
    timing: float = 0.5                # 타이밍: timing sigma
    swing_quickness: float = 0.5       # 스윙 길이/빠르기: shorter swing -> later commit (reaction_time)
    path_control: float = 0.5          # 스윙 궤도 조절: attack angle adapts to pitch height
    barrel_accuracy: float = 0.5       # 배럴 정확도: axial (along-bat) offset sigma -> sweet-spot hits
    power: float = 0.5                 # 힘: bat mass / effective mass at impact (separate from bat speed)
    spray_control: float = 0.5         # 스프레이 제어: executes pull / opposite intent
    guess_hitting: float = 0.5         # 노림수: sharpens the prior on count/sequence
    zone_map: Tuple[float, ...] = (1.0,) * 9    # 존 지도: 3x3 (rows high->low, cols in->away) bat-speed / swing multipliers
    stamina: float = 0.5               # 체력: keeps sigma and bat speed late in the game
    focus: float = 0.5                 # 집중: constant multiplier on execution noise
    game_sense: float = 0.5            # 실전 감각: in-game feel variable s responds to events
    split_vs_L: float = 0.5            # 좌투 상대: recognition/timing vs LHP (0.5 neutral)
    split_vs_R: float = 0.5            # 우투 상대
    bunt_skill: float = 0.3            # 번트
    speed: float = 0.5                 # 주력: sprint speed on the bases (engine/baserunning.py)
    run_iq: float = 0.5                # 타구 판단: reads the throw vs. the extra base; low -> runs into outs (engine/fielding.py _hit_bases)
    bat_mass: float = 0.879            # kg, bat choice (heavier = more power, slower swing)

    @classmethod
    def from_card(cls, card, zone_map=None) -> "BatterProfile":
        """Map a game-layer PlayerCard (batter skills) onto the perception/mechanics profile."""
        t = card.derive_bat_traits()
        keys = ("tracking", "discipline", "boldness", "guess_hitting", "barrel_placement", "timing", "swing_quickness",
                "path_control", "barrel_accuracy", "power", "spray_control", "bunt_skill", "speed", "run_iq", "split_vs_L", "split_vs_R",
                "composure", "reaction", "game_sense", "stamina", "focus", "recognition", "release_read")
        kw = {k: float(t[k]) for k in keys if k in t}
        return cls(name=card.name, hand=card.hand, height=card.fixed["height"], bat_speed=float(t["bat_speed"]),
                   zone_map=tuple(zone_map) if zone_map else (1.0,) * 9, **kw)

    # ---- derived mechanics -------------------------------------------------
    def derived_execution(self, fatigue: float = 0.0, feel: float = 0.0) -> ExecutionProfile:
        """Skill -> execution noise. Reference sigma at skill 0.5 = (8 ms, 15 mm, 25 mm)."""
        k_focus = 1.15 - 0.30 * self.focus
        k_fat = 1.0 + 0.4 * fatigue * (1.0 - 0.7 * self.stamina)
        k_feel = 1.0 - 0.12 * feel                   # feel s in [-1, 1]: hot streak tightens
        k = k_focus * k_fat * k_feel
        # v0.7 floors (audit 02 #12): timing 8..18 ms, vertical 12..26 mm, horizontal 16..40 mm
        # timing: 5..11 ms (bat moves ~5 m/s vertically at contact, so 10 ms = 5 cm; MLB timing windows ~ +-7 ms)
        return ExecutionProfile(timing_sigma=(0.009 - 0.005 * self.timing) * k,
                                vertical_sigma=(0.022 - 0.012 * self.barrel_placement) * k,
                                horizontal_sigma=(0.040 - 0.024 * self.barrel_placement) * k)

    def derived_reaction_time(self) -> float:
        """Swing quickness: 0.18 s (long swing) .. 0.12 s (short, quick) before contact."""
        return 0.18 - 0.06 * self.swing_quickness

    def derived_bat_speed(self, fatigue: float = 0.0) -> float:
        heavy = (self.bat_mass - 0.879) / 0.879
        # v0.7: power feeds bat speed (audit 02 #2), not the collision's effective mass
        return self.bat_speed * (0.94 + 0.12 * self.power) * (1.0 - 0.25 * heavy) * (1.0 - 0.05 * fatigue * (1.0 - 0.7 * self.stamina))

    def zone_multiplier(self, x: float, z: float, zone_top: float, zone_bottom: float, hand: str) -> float:
        """3x3 hot/cold map lookup at plate location (in/away follow the batter's hand)."""
        side = -1.0 if hand.upper().startswith("R") else 1.0        # 'in' is toward -x for RHB
        col = int(np.clip((x * -side + STRIKE_ZONE_HALF_WIDTH) / (2 * STRIKE_ZONE_HALF_WIDTH) * 3, 0, 2))
        row = int(np.clip((zone_top - z) / max(zone_top - zone_bottom, 1e-6) * 3, 0, 2))
        return float(self.zone_map[row * 3 + col])


class HeuristicBatter(BatterAgent):
    def __init__(self, profile: BatterProfile = None):
        self.profile = profile or BatterProfile()
        self.hand = self.profile.hand
        self.height = self.profile.height
        self.reaction_time = self.profile.derived_reaction_time()
        self.name = self.profile.name
        self.release_memory: Dict[str, Tuple[np.ndarray, int]] = {}    # pitcher_id -> (mean, n)
        self.pitches_seen = 0            # in-game fatigue counter
        self.feel = 0.0                  # in-game feel s in [-1, 1]

    # ---- state used by the engine ----------------------------------------------
    def bat_spec(self) -> BatSpec:
        """Effective mass at the sweet spot follows the bat only (~0.75 x bat mass -> q ~ 0.2, Nathan); power lives in bat speed."""
        p = self.profile
        m_eff = 0.75 * p.bat_mass
        return BatSpec(mass=p.bat_mass, m_eff_sweet=float(np.clip(m_eff, 0.45, 0.85)))

    def fatigue(self) -> float:
        return float(np.clip((self.pitches_seen - 12) / 30.0, 0.0, 1.0))

    def note_result(self, result: str, quality: float = 0.0) -> None:
        """Engine feedback after each pitch: feel s moves with game_sense, decays toward 0."""
        self.pitches_seen += 1
        d = {"swinging_strike": -0.15, "foul": -0.03, "called_strike": -0.05, "ball": +0.03, "in_play": 0.10 * quality}.get(result, 0.0)
        g = 0.4 + 0.8 * self.profile.game_sense
        self.feel = float(np.clip(self.feel * 0.85 + g * d, -1.0, 1.0))

    def begin_game(self) -> None:
        self.pitches_seen = 0
        self.feel = 0.0

    # ---- perception hooks used by the engine --------------------------------
    def eye_sigma_factor(self) -> float:
        """Multiplier on the engine's visual noise: 1.3 (poor tracking) .. 0.7 (elite)."""
        return 1.3 - 0.6 * float(np.clip(self.profile.tracking, 0, 1))

    def late_window(self) -> float:
        """Seconds before contact until which the batter still gets sightings for a late correction.

        v0.7: the body is already moving after commit; 순발력(reaction) decides how late the
        hitter can still take information into the swing: 0.10 s (slow) .. 0.06 s (quick).
        """
        return 0.10 - 0.04 * float(np.clip(self.profile.reaction, 0, 1))

    def late_blur(self, frac: float) -> float:
        """Eyes lose the ball late: noise x (1 + (1 - visibility)); tracking extends the clean region."""
        return 1.0 + 1.0 * (1.0 - visibility(frac, self.profile.tracking))

    # ---- public facts a scout could gather ----------------------------------
    def tendencies(self) -> BatterTendencies:
        p = self.profile
        chase = float(np.clip(1.0 - p.discipline, 0, 1))
        return BatterTendencies(hand=p.hand, chase_low=chase, chase_away=chase * 0.9, chase_in=chase * 0.7,
                                whiff_breaking=float(np.clip(1.0 - p.recognition, 0, 1)),
                                whiff_high_ff=float(np.clip(0.3 + 0.03 * (p.attack_angle_deg - 8.0), 0, 1)),
                                first_pitch_swing=float(np.clip(0.2 + 0.45 * p.boldness, 0, 1)), power_zone=p.power_zone,
                                contact_vs_offspeed=float(np.clip(0.3 + 0.5 * p.recognition, 0, 1)))

    # ---- interface -----------------------------------------------------------
    def decide(self, obs: BatterObservation, rng: np.random.Generator) -> SwingDecision:
        p = self.profile
        seen = [s for s in obs.sightings if s.t <= obs.t_deadline]       # commit: nothing after the deadline
        if len(seen) < 4:
            return SwingDecision(False, note="not enough sightings")
        t = np.array([s.t for s in seen])
        pos = np.array([s.pos for s in seen])

        # release-point read against memory of this pitcher
        tipped = False
        rec = p.recognition
        if obs.release_seen is not None:
            key = obs.context.pitcher_id
            mean, n = self.release_memory.get(key, (obs.release_seen.copy(), 0))
            if n >= 3:
                dev = np.hypot(obs.release_seen[0] - mean[0], obs.release_seen[2] - mean[2])
                if dev > 0.06 and rng.random() < p.release_read:
                    tipped = True
                    rec = min(1.0, rec + 0.25)
            mean = (mean * n + obs.release_seen) / (n + 1)
            self.release_memory[key] = (mean, n + 1)

        t_q, x_q, z_q = self._predict_quadratic(t, pos, obs.contact_y)
        t_n, x_n, z_n = self._predict_naive(t, pos, obs.contact_y)
        if t_q is None and t_n is None:
            return SwingDecision(False, note="cannot extrapolate")
        if t_q is None:
            t_q, x_q, z_q = t_n, x_n, z_n
        if t_n is None:
            t_n, x_n, z_n = t_q, x_q, z_q
        t_c = rec * t_q + (1 - rec) * t_n
        x_c = rec * x_q + (1 - rec) * x_n
        z_c = rec * z_q + (1 - rec) * z_n

        ctx = obs.context
        d_out = max(0.0, abs(x_c) - STRIKE_ZONE_HALF_WIDTH, ctx.zone_bottom - z_c, z_c - ctx.zone_top)
        if ctx.strikes == 2:
            p_zone = 0.92
        elif ctx.balls == 0 and ctx.strikes == 0:
            p_zone = 0.45
        elif ctx.balls == 3:
            p_zone = 0.30
        else:
            p_zone = 0.75
        chase_scale = 0.04 + 0.14 * (1.0 - p.discipline)
        p_swing = p_zone * np.exp(-d_out / chase_scale)
        if rng.random() >= p_swing:
            return SwingDecision(False, predicted_xz=(x_c, z_c), note="take", tipped=tipped)

        side = -1.0 if self.hand.upper().startswith("R") else 1.0
        inside_frac = float(np.clip(-side * x_c / STRIKE_ZONE_HALF_WIDTH, -1, 1))
        spray_plan = side * (10.0 + 15.0 * inside_frac)
        attack = p.attack_angle_deg + 4.0 * (0.8 - z_c) / 0.5
        return SwingDecision(True, t_contact=float(t_c), x_bat=float(x_c), z_bat=float(z_c - p.undercut_intent),
                             spray_plan_deg=float(spray_plan), attack_angle_deg=float(attack),
                             bat_speed=p.bat_speed, execution=p.execution,
                             predicted_xz=(float(x_c), float(z_c)), note="swing", tipped=tipped)

    # ---- estimators ------------------------------------------------------
    @staticmethod
    def _solve_arrival(coef_y, t_after: float, y_target: float):
        a, b, c = coef_y
        roots = np.roots([a, b, c - y_target])
        roots = [float(r.real) for r in roots if abs(r.imag) < 1e-9 and r.real > t_after]
        return min(roots) if roots else None

    def _predict_quadratic(self, t, pos, y_c):
        cy = np.polyfit(t, pos[:, 1], 2)
        cx = np.polyfit(t, pos[:, 0], 2)
        cz = np.polyfit(t, pos[:, 2], 2)
        t_c = self._solve_arrival(cy, t[-1], y_c)
        if t_c is None:
            return None, None, None
        return t_c, float(np.polyval(cx, t_c)), float(np.polyval(cz, t_c))

    def _predict_naive(self, t, pos, y_c, n_last: int = 5):
        tt, pp = t[-n_last:], pos[-n_last:]
        vel = np.polyfit(tt, pp, 1)[0]
        p_last = pp.mean(axis=0)
        t_last = tt.mean()
        if vel[1] >= 0:
            return None, None, None
        dt = (y_c - p_last[1]) / vel[1]
        if dt <= 0:
            return None, None, None
        x = p_last[0] + vel[0] * dt
        z = p_last[2] + vel[2] * dt - 0.5 * G * dt * dt
        return float(t_last + dt), float(x), float(z)


COMMIT_LEAD = 0.04        # s before the swing starts at which the swing decision is locked
ZONE_SWING_BY_COUNT = {(0, 0): 0.47, (0, 1): 0.67, (0, 2): 0.83, (1, 0): 0.61, (1, 1): 0.71, (1, 2): 0.85,
                       (2, 0): 0.65, (2, 1): 0.75, (2, 2): 0.87, (3, 0): 0.15, (3, 1): 0.67, (3, 2): 0.90}


class PerceptiveBatter(HeuristicBatter):
    """Batter that judges the pitch in stages (batter_perception.judge) and learns the pitcher.

    Swing style follows the judgment:
        confident (sigma small) & favourable count -> power swing (full bat speed, undercut intent)
        uncertain or two strikes                   -> contact swing (bat speed x0.92, flat, later commit)
    """
    def __init__(self, profile: BatterProfile = None):
        super().__init__(profile)
        self.memory: Dict[str, PitcherMemory] = {}
        self.last_judgment: Optional[Judgment] = None
        self.watching = False          # took the pitch on purpose -> learn it with extra attention

    def _mem(self, pid: str, hand: str = "R") -> PitcherMemory:
        if pid not in self.memory:
            self.memory[pid] = PitcherMemory(clusters=default_clusters(hand))
        return self.memory[pid]

    def effective_recognition(self, pitcher_hand: str) -> float:
        """Platoon split: recognition shifts by +-0.15 depending on the pitcher's hand."""
        p = self.profile
        split = p.split_vs_L if pitcher_hand.upper().startswith("L") else p.split_vs_R
        return float(np.clip(p.recognition + 0.3 * (split - 0.5), 0.05, 1.0))

    def scout_pitcher(self, pitcher, rng: np.random.Generator, n_per_pitch: int = 3, sigma_deg: float = 0.05) -> int:
        """Pre-game video / on-deck study (v0.7): watch each of the pitcher's pitches a few times through the
        same noisy eyes and store the shapes. Only flights are seen (information boundary), never spin or grip."""
        from ..physics import throw_spec
        from .perception import observe
        contact_y = PLATE_FRONT_Y + self.profile.contact_offset_y
        eye = self.eye_position(contact_y)
        pid = getattr(pitcher, "name", "P")
        mem = self._mem(pid, getattr(pitcher, "hand", "R"))
        seen = 0
        for code in getattr(pitcher, "repertoire_codes", ()):
            for _ in range(n_per_pitch):
                spec = pitcher.spec_for(code, 1.0, rng)
                res = throw_spec(spec, (0.15 * (rng.random() - 0.5), 0.55 + 0.4 * rng.random()))
                arr = res.trajectory.crossing(1, contact_y)
                if arr is None:
                    continue
                full = observe(res.trajectory, eye, arr.t, rng, 60.0, sigma_deg * self.eye_sigma_factor(), t_end=arr.t)
                if learn_from_flight(mem, full, contact_y, None, None, self.profile.recognition, 0.8) is not None:
                    seen += 1
        return seen

    def learn(self, obs_full: BatterObservation) -> None:
        attention = 1.0 + 0.8 * (1.0 - self.profile.boldness) if self.watching else 1.0
        learn_from_flight(self._mem(obs_full.context.pitcher_id, obs_full.context.pitcher_hand), obs_full.sightings, obs_full.contact_y,
                          obs_full.release_seen, obs_full.context, self.profile.recognition, attention)
        self.watching = False

    def decide(self, obs: BatterObservation, rng: np.random.Generator) -> SwingDecision:
        p = self.profile
        ctx = obs.context
        mem = self._mem(ctx.pitcher_id, ctx.pitcher_hand)
        # --- commit read: samples up to the commit deadline (reaction_time before contact) ---
        vel0 = np.polyfit([s.t for s in obs.sightings[:6]], [s.pos[1] for s in obs.sightings[:6]], 1)[0] if len(obs.sightings) >= 6 else -38.0
        t_arr0 = obs.sightings[0].t + (obs.contact_y - obs.sightings[0].pos[1]) / min(vel0, -1.0)
        # v0.7: go/no-go is decided COMMIT_LEAD before the swing itself starts (reaction_time = swing duration);
        # after that the body is moving and only 순발력-scaled corrections (late_read) remain
        t_commit = t_arr0 - (p.reaction_time + COMMIT_LEAD)
        rec_eff = self.effective_recognition(ctx.pitcher_hand)
        j = judge(obs.sightings, ctx, mem, obs.contact_y, rec_eff, obs.release_seen, p.release_read, rng,
                  t_now=t_commit, tracking=p.tracking, composure=p.composure, guess=p.guess_hitting)
        self.last_judgment = j
        if j is None:
            return SwingDecision(False, note="cannot judge")
        x_c, z_c = j.pred_xz
        sx, sz = j.sigma_xz
        unc = float(np.hypot(sx, sz))
        press = j.pressure
        panic = (1.0 - p.composure) * press
        d_out = max(0.0, abs(x_c) - STRIKE_ZONE_HALF_WIDTH, ctx.zone_bottom - z_c, z_c - ctx.zone_top)
        d_edge = min(STRIKE_ZONE_HALF_WIDTH - abs(x_c), z_c - ctx.zone_bottom, ctx.zone_top - z_c)   # + inside, distance to nearest edge
        bold = float(np.clip(p.boldness, 0, 1))
        # v0.7: in-zone swing probability by count (MLB Z-swing by count), boldness shifts it +-0.10
        p_zone = ZONE_SWING_BY_COUNT.get((ctx.balls, ctx.strikes), 0.65) + 0.20 * (bold - 0.5)
        if ctx.strikes < 2:
            p_zone *= float(np.clip(1.10 - 1.0 * unc * (1.2 - 0.6 * bold), 0.6, 1.0))   # patient: waits when unsure
        chase_scale = 0.06 + 0.20 * (1.0 - p.discipline) + ((0.06 + 0.05 * unc) if ctx.strikes == 2 else 0.0)   # 2 strikes: protect
        chase_scale *= 1.0 + 0.25 * panic                       # pressure + low composure -> chasing
        chase_scale *= 0.8 + 0.4 * bold
        zm = p.zone_multiplier(x_c, z_c, ctx.zone_top, ctx.zone_bottom, self.hand)   # hot/cold zone
        p_zone *= float(np.clip(0.6 + 0.4 * zm, 0.3, 1.2))
        p_swing = p_zone * np.exp(-d_out / chase_scale)
        # situational: sacrifice bunt when asked (ctx.fielder_shift == 'bunt' flag) or classic spot for a weak bat
        want_bunt = (ctx.fielder_shift == "bunt") or (ctx.runners[0] and not ctx.runners[1] and ctx.outs < 2
                                                       and p.power < 0.3 and p.bunt_skill > 0.6 and ctx.strikes < 2)
        if want_bunt and d_out < 0.05:
            ex = ExecutionProfile(0.010, 0.020 - 0.012 * p.bunt_skill, 0.03)
            return SwingDecision(True, t_contact=float(j.t_arrival), x_bat=float(x_c), z_bat=float(z_c + 0.01),
                                 spray_plan_deg=(-1.0 if self.hand.upper().startswith("R") else 1.0) * 35.0,
                                 attack_angle_deg=-4.0, bat_speed=6.0, execution=ex, predicted_xz=(float(x_c), float(z_c)),
                                 note="bunt", tipped=j.tipped, pressure=press)
        deliberate_take = False
        # bench calls (v1.3): "take" = do not swing until a strike is on the board; "power" = swing big
        if ctx.fielder_shift == "take" and ctx.strikes == 0:
            p_swing = 0.0
        if ctx.fielder_shift == "power":
            bold = min(1.0, bold + 0.3)
        if ctx.strikes < 2 and d_out > 0.0 and rng.random() < 0.35 * (1.0 - bold):
            p_swing, deliberate_take = 0.0, True               # patient: lets the ball off the plate go and watches it
        swing = rng.random() < p_swing
        self.watching = (not swing) and (deliberate_take or bold < 0.5)
        # --- late read: after commit the eyes keep reporting until late_window before contact ---
        t_late = t_arr0 - self.late_window()
        lr = late_read(obs.sightings, obs.contact_y, t_late, mem, j)
        adjusted = checked = False
        shift = (0.0, 0.0)
        t_c = j.t_arrival
        if lr is not None:
            lx, lz, lt = lr
            gain = float(np.clip(p.reaction * (1.0 - 0.5 * panic), 0.0, 1.0))
            max_shift = 0.05 * gain                             # up to 5 cm of bat-path correction (audit 02 #22)
            dx, dz = float(np.clip(lx - x_c, -max_shift, max_shift)), float(np.clip(lz - z_c, -max_shift, max_shift))
            if abs(dx) > 0.005 or abs(dz) > 0.005:
                adjusted = True
            x_c, z_c = x_c + dx, z_c + dz
            t_c = j.t_arrival + gain * (lt - j.t_arrival)
            shift = (dx, dz)
            d_late = max(0.0, abs(lx) - STRIKE_ZONE_HALF_WIDTH, ctx.zone_bottom - lz, lz - ctx.zone_top)
            if swing and d_late > 0.08 and rng.random() < 0.5 * gain:
                swing, checked = False, True                    # check swing: bat held back
        if not swing:
            return SwingDecision(False, predicted_xz=(x_c, z_c),
                                 note="check swing" if checked else ("take to learn" if deliberate_take else "take"),
                                 tipped=j.tipped, adjusted=adjusted, checked=checked, late_shift=shift, pressure=press)
        contact_mode = ctx.strikes == 2 or unc > (0.14 + 0.08 * bold)        # bold: swings big more often
        side = -1.0 if self.hand.upper().startswith("R") else 1.0
        inside_frac = float(np.clip(-side * x_c / STRIKE_ZONE_HALF_WIDTH, -1, 1))
        spray_plan = side * (10.0 + 15.0 * inside_frac) * (0.6 + 0.8 * p.spray_control)
        attack = p.attack_angle_deg + (2.0 + 4.0 * p.path_control) * (0.8 - z_c) / 0.5    # path control adapts to height
        fat = self.fatigue()
        bat_speed = p.derived_bat_speed(fat) * (0.95 if contact_mode else 1.0 + 0.04 * (bold - 0.5)) * float(np.clip(0.85 + 0.15 * zm, 0.7, 1.15))
        undercut = 0.0 if contact_mode else p.undercut_intent * (1.0 + 0.6 * (bold - 0.5))
        base_ex = p.derived_execution(fat, self.feel)
        k_ex = (0.85 if contact_mode else 1.0) * (1.0 + 0.15 * panic)
        axial_k = 1.4 - 0.8 * p.barrel_accuracy                                    # along-bat error -> sweet spot
        ex = ExecutionProfile(base_ex.timing_sigma * k_ex, base_ex.vertical_sigma * k_ex * (0.9 if contact_mode else 1.0),
                              base_ex.horizontal_sigma * k_ex * axial_k * (0.9 if contact_mode else 1.0))
        return SwingDecision(True, t_contact=float(t_c), x_bat=float(x_c), z_bat=float(z_c - undercut),
                             spray_plan_deg=float(spray_plan), attack_angle_deg=float(attack - (3.0 if contact_mode else 0.0)),
                             bat_speed=bat_speed, execution=ex, predicted_xz=(float(x_c), float(z_c)),
                             note="contact swing" if contact_mode else "power swing", tipped=j.tipped,
                             adjusted=adjusted, checked=False, late_shift=shift, pressure=press)
