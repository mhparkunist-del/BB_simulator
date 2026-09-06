"""Catcher agent v0.6: the pitcher's view plus the wider field, plus the batter's mind.

What the catcher does that nobody else does
    * carries the pitcher's stated intent (weight `pitcher_weight`)
    * reads the situation: runners (wild-pitch risk, steal threat), outs, inning,
      score -> leverage; the umpire's zone today; the fielders' alignment
    * keeps a BatterBook: in-game observations of THIS batter (swing/take,
      whiff, contact quality by zone and by pitch family) blended with the
      scouting prior -> exploitable weaknesses
    * tunnels: after a pitch, asks for a pitch whose early flight matches the
      previous one but whose late break differs (the batter's read is made
      early and degrades late -> the pair is hard to separate)
    * frames (edge calls), blocks (dirt pitches with runners), and its arm
      shapes what it dares to call

Catcher attributes (CatcherProfile, 0..1 unless noted)
    game_iq            weight of situational terms
    scouting_accuracy  how clean the pre-game book is
    observation        how fast in-game observations overwrite the book
    umpire_read        how well it uses the umpire's zone
    pitcher_weight     how much of the pitcher's intent it carries (0..1)
    sequencing         tunnelling / sequence bonuses
    framing            edge strikes it steals
    blocking           dirt pitches it keeps in front
    arm                steal deterrence -> freedom to call slow pitches
    rapport            communication with the pitcher -> fewer shake-offs
    composure          keeps the plan under pressure
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..physics.constants import PLATE_FRONT_Y, STRIKE_ZONE_HALF_WIDTH
from .base import BatterTendencies, CatcherAgent, CatcherSign, GameContext, PitchIntent
from .batter_perception import pressure_index
from .intent import (BREAKING, Candidate, DIRT_RISK, FASTBALLS, OFFSPEED, count_prior,
                     noisy_tendencies, tendency_bonus, zone_prior, zone_targets)

TUNNEL_PAIRS = {("FF", "CH"), ("FF", "SL"), ("FF", "SP"), ("SI", "CH"), ("CT", "SL"), ("FF", "CU"), ("SI", "SL")}
FAMILY = {c: ("FB" if c in FASTBALLS else "BR") for c in ("FF", "SI", "CT", "SL", "CU", "CH", "SP")}
TUNNEL_Y = 9.0          # m from the plate: where the batter's early read is made (~40 % of the flight)


@dataclass
class CatcherProfile:
    name: str = "C"
    game_iq: float = 0.7
    scouting_accuracy: float = 0.85
    observation: float = 0.6
    umpire_read: float = 0.7
    pitcher_weight: float = 0.6
    sequencing: float = 0.6
    framing: float = 0.5
    blocking: float = 0.5
    arm: float = 0.5
    rapport: float = 0.5
    composure: float = 0.6


# ---------------------------------------------------------------- batter book
def _zone_of(x: float, z: float, ctx: GameContext) -> str:
    """Coarse cell: (in|mid|away) x (high|mid|low) + 'chase' outside the zone."""
    away = 1.0 if ctx.batter_hand.upper().startswith("R") else -1.0
    if abs(x) > STRIKE_ZONE_HALF_WIDTH + 0.02 or z < ctx.zone_bottom - 0.02 or z > ctx.zone_top + 0.02:
        return "chase_low" if z < ctx.zone_bottom else ("chase_away" if x * away > 0 else "chase_in")
    col = "away" if x * away > STRIKE_ZONE_HALF_WIDTH / 3 else ("in" if x * away < -STRIKE_ZONE_HALF_WIDTH / 3 else "mid")
    thirds = (ctx.zone_top - ctx.zone_bottom) / 3
    row = "high" if z > ctx.zone_top - thirds else ("low" if z < ctx.zone_bottom + thirds else "mid")
    return "%s_%s" % (row, col)


@dataclass
class BatterBook:
    """What the catcher has seen this batter do (counts) + the scouting prior."""
    prior: Optional[BatterTendencies] = None
    seen: int = 0
    swings: Dict[str, List[int]] = field(default_factory=dict)     # zone -> [swings, pitches]
    whiff_fam: Dict[str, List[int]] = field(default_factory=lambda: {"FB": [0, 0], "BR": [0, 0]})   # [whiffs, swings]
    contact_fam: Dict[str, List[float]] = field(default_factory=lambda: {"FB": [0.0, 0], "BR": [0.0, 0]})  # [sum quality, n]
    first_pitch: List[int] = field(default_factory=lambda: [0, 0])  # [swings, pitches]
    two_strike_chase: List[int] = field(default_factory=lambda: [0, 0])

    def note(self, ctx: GameContext, code: str, plate_xz, swung: bool, result: str, quality: float) -> None:
        self.seen += 1
        z = _zone_of(plate_xz[0], plate_xz[1], ctx)
        s = self.swings.setdefault(z, [0, 0])
        s[1] += 1
        s[0] += int(swung)
        fam = FAMILY.get(code, "BR")
        if swung:
            self.whiff_fam[fam][1] += 1
            self.whiff_fam[fam][0] += int(result == "swinging_strike")
            if result == "in_play":
                self.contact_fam[fam][0] += quality
                self.contact_fam[fam][1] += 1
        if ctx.balls == 0 and ctx.strikes == 0:
            self.first_pitch[1] += 1
            self.first_pitch[0] += int(swung)
        if ctx.strikes == 2 and z.startswith("chase"):
            self.two_strike_chase[1] += 1
            self.two_strike_chase[0] += int(swung)

    # blended estimates (prior pseudo-count k: observation skill sets how quickly data wins)
    def _blend(self, prior: float, num: float, den: float, k: float) -> float:
        return float((prior * k + num) / (k + den))

    def whiff_rate(self, fam: str, k: float) -> float:
        p = (self.prior.whiff_breaking if fam == "BR" else 0.45 * self.prior.whiff_high_ff + 0.15) if self.prior else 0.25
        w, n = self.whiff_fam[fam]
        return self._blend(p, w, n, k)

    def chase_rate(self, zone: str, k: float) -> float:
        p = {"chase_low": self.prior.chase_low, "chase_away": self.prior.chase_away, "chase_in": self.prior.chase_in}.get(zone, 0.3) if self.prior else 0.3
        s, n = self.swings.get(zone, [0, 0])
        return self._blend(p, s, n, k)

    def swing_rate(self, zone: str, k: float) -> float:
        s, n = self.swings.get(zone, [0, 0])
        return self._blend(0.65, s, n, k)

    def weak_family(self, k: float) -> Tuple[str, float]:
        fb, br = self.whiff_rate("FB", k), self.whiff_rate("BR", k)
        return ("BR", br - fb) if br >= fb else ("FB", fb - br)


class HeuristicCatcher(CatcherAgent):
    def __init__(self, profile: CatcherProfile = None, breaking_bias: float = 1.0):
        self.profile = profile or CatcherProfile()
        self.breaking_bias = breaking_bias
        self.scouted: Optional[BatterTendencies] = None
        self.working: Dict[str, float] = {}
        self.last_sign: Optional[CatcherSign] = None
        self.books: Dict[str, BatterBook] = {}
        self.book: Optional[BatterBook] = None
        self.tunnel_table: Dict[Tuple[str, str], Tuple[float, float]] = {}
        self.pitcher_breaks: Dict[str, Tuple[float, float]] = {}
        self.last_pitch: Optional[Dict[str, float]] = None        # previous pitch of this PA: code, plate x/z

    # ---- game / pa state --------------------------------------------------
    def scout(self, tendencies: BatterTendencies, rng: np.random.Generator, batter_id: str = "B") -> None:
        self.scouted = noisy_tendencies(tendencies, self.profile.scouting_accuracy, rng)
        if batter_id not in self.books:
            self.books[batter_id] = BatterBook(prior=self.scouted)
        self.book = self.books[batter_id]
        self.last_pitch = None

    def learn_pitcher(self, pitcher, rng: np.random.Generator = None, sigma: float = 0.03) -> None:
        """Battery practice: for each pair (A, B) thrown on A's release direction, how close the early
        flights are (at TUNNEL_Y) and how far apart they end up at the plate.

        v1.1 (audit 01 #6c): the catcher *watches* the flights; every position it stores carries
        observation noise (sigma, m) and the pitch itself has the pitcher's own per-pitch wobble.
        """
        from ..physics.pitch import fly_direction, throw_spec
        rng = rng or np.random.default_rng(0)
        def noisy(xz):
            return (float(xz[0] + rng.normal(0, sigma)), float(xz[1] + rng.normal(0, sigma)))
        specs = {c: pitcher.spec_for(c, 1.0, rng) for c in pitcher.repertoire_codes}
        self.pitcher_breaks, self.tunnel_table = {}, {}
        ref = {}
        for a, sa in specs.items():
            res = throw_spec(sa, (0.0, 0.75))
            if res.plate is None:
                continue
            d_hat = res.initial.vel / np.linalg.norm(res.initial.vel)
            ea = res.trajectory.crossing(1, TUNNEL_Y)
            ref[a] = (d_hat, noisy((res.plate.pos[0], res.plate.pos[2])),
                      noisy((ea.pos[0], ea.pos[2])) if ea is not None else (0.0, 0.0))
            self.pitcher_breaks[a] = ref[a][1]
        for a, (d_hat, pa, ea) in ref.items():
            for b, sb in specs.items():
                if a == b:
                    continue
                tr = fly_direction(sb, d_hat)
                pb, eb = tr.crossing(1, PLATE_FRONT_Y), tr.crossing(1, TUNNEL_Y)
                if pb is None or eb is None:
                    continue
                pbn, ebn = noisy((pb.pos[0], pb.pos[2])), noisy((eb.pos[0], eb.pos[2]))
                plate_sep = float(np.hypot(pbn[0] - pa[0], pbn[1] - pa[1]))
                early_sep = float(np.hypot(ebn[0] - ea[0], ebn[1] - ea[1]))
                offset = (float(pbn[0] - pa[0]), float(pbn[1] - pa[1]))
                self.tunnel_table[(a, b)] = (plate_sep, early_sep, offset)

    def note_pitch(self, code: str, result: str) -> None:
        d = {"swinging_strike": +0.25, "called_strike": +0.10, "foul": +0.05, "ball": -0.12, "in_play": -0.10}.get(result, 0.0)
        self.working[code] = 0.8 * self.working.get(code, 0.0) + d

    def observe_swing(self, ctx: GameContext, code: str, plate_xz, swung: bool, result: str, quality: float) -> None:
        if self.book is not None:
            self.book.note(ctx, code, plate_xz, swung, result, quality)
        self.last_pitch = {"code": code, "x": float(plate_xz[0]), "z": float(plate_xz[1]), "result": result}

    # ---- receiving skills used by the engine -------------------------------
    def framing(self) -> float:
        return self.profile.framing

    def blocking(self) -> float:
        return self.profile.blocking

    def rapport(self) -> float:
        return self.profile.rapport

    # ---- sign ---------------------------------------------------------------
    def tunnel_target(self, prev_code: str, code: str, prev_xz) -> Optional[Tuple[float, float]]:
        """Aim `code` so its early flight overlays the previous pitch's; None if the pair does not tunnel."""
        if (prev_code, code) not in self.tunnel_table:
            return None
        plate_sep, early_sep, offset = self.tunnel_table[(prev_code, code)]
        if plate_sep < 0.20 or early_sep > 0.12:
            return None
        # previous pitch crossed at prev_xz; `code` thrown on the same early path crosses at prev + offset
        return (prev_xz[0] + offset[0], prev_xz[1] + offset[1])

    def sign(self, ctx: GameContext, repertoire_codes: Tuple[str, ...], rng: np.random.Generator,
             pitcher_intent: Optional[PitchIntent] = None, exclude: Tuple[str, ...] = ()) -> CatcherSign:
        pr = self.profile
        zones = zone_targets(ctx)
        prior = {(c, z): s for c, z, s in (pitcher_intent.ranked if pitcher_intent else [])}
        prior_code: Dict[str, float] = {}
        for (c, z), s in prior.items():
            prior_code[c] = max(prior_code.get(c, -9), s)
        r1, r2, r3 = ctx.runners
        prev = self.last_pitch["code"] if self.last_pitch else (ctx.previous_pitch_codes[-1] if ctx.previous_pitch_codes else None)
        lev = ctx.leverage
        press = pressure_index(ctx)
        panic = (1.0 - pr.composure) * press
        k_obs = 12.0 * (1.0 - 0.7 * pr.observation) + 2.0        # prior pseudo-count: sharp observers trust data sooner
        book = self.book
        weak_fam, weak_gap = book.weak_family(k_obs) if book else ("BR", 0.0)
        cands: List[Candidate] = []
        for code in repertoire_codes:
            if code in exclude:
                continue
            fam = FAMILY.get(code, "BR")
            for zone, xz in list(zones.items()) + [("tunnel", None)]:
                if zone == "tunnel":
                    if prev is None or self.last_pitch is None:
                        continue
                    xz = self.tunnel_target(prev, code, (self.last_pitch["x"], self.last_pitch["z"]))
                    if xz is None:
                        continue
                    # only tunnel to a location that makes sense: inside or just off the zone
                    if abs(xz[0]) > STRIKE_ZONE_HALF_WIDTH + 0.20 or xz[1] < ctx.zone_bottom - 0.25 or xz[1] > ctx.zone_top + 0.15:
                        continue
                c = Candidate(code, zone, xz)
                s = count_prior(ctx, code) + (zone_prior(ctx, code, zone) if zone != "tunnel" else 0.3)
                # --- the pitcher's view ------------------------------------------
                if pitcher_intent is not None:
                    s += pr.pitcher_weight * (prior.get((code, zone), prior_code.get(code, -1.0) - 0.5))
                    if pitcher_intent.code == code:
                        c.reasons.append("투수 의도 반영")
                # --- what is working today ----------------------------------------
                w = self.working.get(code, 0.0)
                s += (0.8 + 0.8 * lev) * w
                if w > 0.3:
                    c.reasons.append("오늘 잘 통하는 구종")
                # --- batter book: in-game learning --------------------------------
                if book is not None and book.seen >= 2:
                    if fam == weak_fam and weak_gap > 0.08 and ctx.strikes >= 1:
                        s += pr.game_iq * 2.0 * weak_gap
                        c.reasons.append("이 타자, %s에 헛스윙 %.0f%%" % ("변화구" if fam == "BR" else "직구", 100 * book.whiff_rate(fam, k_obs)))
                    if zone.startswith("chase"):
                        ch = book.chase_rate(zone, k_obs)
                        s += pr.game_iq * 1.5 * (ch - 0.30)
                        if ch > 0.4:
                            c.reasons.append("추격 %.0f%% (%s)" % (100 * ch, zone))
                    elif zone != "tunnel":
                        sr = book.swing_rate(zone, k_obs)
                        if sr < 0.4 and ctx.strikes < 2:
                            s += pr.game_iq * 0.5
                            c.reasons.append("이 코스는 잘 안 침 → 카운트 잡기")
                    if ctx.balls == 0 and ctx.strikes == 0 and book.first_pitch[1] >= 2:
                        fp = book.first_pitch[0] / book.first_pitch[1]
                        if fp < 0.2 and zone in ("middle", "away", "in"):
                            s += pr.game_iq * 0.6
                            c.reasons.append("초구 안 침 → 존 안 스트라이크")
                # --- tunnelling: exploit the batter's early read ----------------------
                if zone == "tunnel":
                    plate_sep, early_sep, _ = self.tunnel_table[(prev, code)]
                    bonus = pr.sequencing * (1.0 + 2.0 * min(plate_sep, 0.5)) * (1.0 - early_sep / 0.12)
                    if self.last_pitch and self.last_pitch["result"] in ("called_strike", "foul", "swinging_strike"):
                        bonus *= 1.3
                    s += bonus
                    c.reasons.append("%s와 같은 궤적으로 터널링 (플레이트 분리 %.0f cm)" % (prev, 100 * plate_sep))
                elif prev is not None and ((prev, code) in TUNNEL_PAIRS or (code, prev) in TUNNEL_PAIRS):
                    s += pr.sequencing * 0.3
                # --- runners ---------------------------------------------------------
                if r3 and ctx.outs < 2:
                    pen = DIRT_RISK[code] * (2.0 if zone in ("chase_low", "low") else 1.0) * (1.4 - 0.8 * pr.blocking)
                    s -= pr.game_iq * 3.0 * pen
                    if pen > 0.2:
                        c.reasons.append("3루 주자: 폭투 위험 회피")
                if r1 and not r2 and ctx.runner_speed > 0.6:
                    deter = 0.4 * (1.4 - 0.8 * pr.arm)
                    if code in FASTBALLS:
                        s += pr.game_iq * deter
                        c.reasons.append("도루 위협: 빠른 공")
                    if code in ("CU", "SP"):
                        s -= pr.game_iq * deter
                # --- umpire ----------------------------------------------------------
                if ctx.umpire_low_shift > 0.02:
                    if zone in ("low", "low_away", "low_in", "chase_low"):
                        s += pr.umpire_read * 1.5
                        c.reasons.append("심판: 낮은 존 후함")
                    elif zone in ("high", "high_in", "chase_high"):
                        s -= pr.umpire_read * 0.5
                if ctx.umpire_low_shift < -0.02 and zone in ("high", "high_in"):
                    s += pr.umpire_read * 0.8
                # --- framing: an edge pitch is worth more to a good framer ---------------
                if zone in ("away", "in", "low_away", "low_in", "high_in") and ctx.strikes < 2:
                    s += 0.4 * (pr.framing - 0.5)
                # --- fielders ---------------------------------------------------------
                if ctx.fielder_shift == "pull" and zone in ("in", "high_in", "low_in"):
                    s += pr.game_iq * 0.3
                if ctx.fielder_shift == "opposite" and zone in ("away", "low_away"):
                    s += pr.game_iq * 0.3
                # --- bench plan (v1.8): the manager asks for an inside battle or an outside chase set-up ----
                if ctx.fielder_shift == "inside":
                    if zone != "tunnel" and ("_in" in zone or zone == "in"):
                        s += 2.5
                        c.reasons.append("벤치: 몸쪽 승부")
                    elif zone != "tunnel" and "away" in zone:
                        s -= 1.2
                if ctx.fielder_shift == "outside":
                    if zone != "tunnel" and ("away" in zone or zone == "chase_low"):
                        s += 2.0 + (0.8 if code in BREAKING else 0.0) + (1.2 if zone.startswith("chase") else 0.0)
                        c.reasons.append("벤치: 바깥쪽 유인구")
                    elif zone != "tunnel" and ("_in" in zone or zone == "in" or zone == "middle"):
                        s -= 1.2
                # --- scouting prior ----------------------------------------------------
                tb, why = tendency_bonus(ctx, self.scouted, code, zone if zone != "tunnel" else "middle")
                s += 1.0 * tb
                c.reasons += why
                if lev > 0.7 and ctx.strikes == 2 and code in BREAKING:
                    s += 0.3 * self.breaking_bias
                c.score = s + rng.normal(0, 0.12 + 0.5 * panic)
                cands.append(c)
        cands.sort(key=lambda c: -c.score)
        best = cands[0]
        sg = CatcherSign(best.code, best.target_xz, best.zone, best.score, best.reasons,
                         [(c.code, c.zone, c.score) for c in cands[:6]])
        self.last_sign = sg
        return sg
