"""Plate-appearance orchestration (v0.3).

One pitch:
    pitcher.intent   (own body, feel, fatigue, memory, blurred scouting)
    catcher.sign     (carries the intent + runners, umpire, sequencing, fielders, accurate scouting)
    reconcile        (sign / shake-off protocol, max 2 rounds)
    pitcher.spec_for (body chain + grip + spin model + per-pitch wobble)
    command error -> physics.throw_spec (drag, Magnus, seam-shifted wake, spin decay, environment)
    batter's eye     (noisy sightings + release point) -> batter.decide
    [take]  umpire (with personal zone shifts)
    [swing] motor noise -> contact geometry -> physics.collide -> miss | foul | fly + outcome

The engine holds ground truth; agents never receive the Trajectory object.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np

from ..agents.base import (BatterAgent, BatterObservation, CatcherAgent, CatcherSign,
                           GameContext, PitchCall, PitchIntent, PitcherAgent, SwingDecision)
from ..agents.perception import observe, observe_release
from ..physics.ball import AeroModel, BallState
from ..physics.bat import BatSpec
from ..physics.collision import BatContact, CollisionResult, CORModel, bat_frame, collide
from ..physics.constants import PLATE_FRONT_Y
from ..physics.pitch import DEFAULT_REPERTOIRE, PitchResult, PitchType, throw, throw_spec
from .outcome import BattedBall, Park, PlayResult, fly, resolve
from .rules import StrikeZone, Umpire


@dataclass
class EngineConfig:
    aero: AeroModel = field(default_factory=AeroModel)
    bat: BatSpec = field(default_factory=BatSpec)
    cor: CORModel = field(default_factory=CORModel)
    park: Park = field(default_factory=Park)
    umpire: Umpire = field(default_factory=Umpire)
    repertoire: Dict[str, PitchType] = field(default_factory=lambda: dict(DEFAULT_REPERTOIRE))
    eye_fps: float = 60.0
    eye_sigma_deg: float = 0.05       # v0.7: visual position noise (~3 arcmin); tracking scales it 1.3..0.7
    bat_angular_speed: float = 30.0
    dt: float = 4e-3                  # v0.7: scalar RK4, 4 ms step (plate error < 0.1 mm)
    max_shake_offs: int = 2
    fielders: Optional[list] = None     # v1.2: list[Fielder]; None -> probability table (outcome.resolve)


@dataclass
class PitchRecord:
    index: int
    context_before: GameContext
    intent: Optional[PitchIntent]
    sign: Optional[CatcherSign]
    call: PitchCall
    pitch: PitchResult
    observation: BatterObservation
    decision: SwingDecision
    result: str
    umpire_call: Optional[str] = None
    collision: Optional[CollisionResult] = None
    contact_offsets: Optional[Dict[str, float]] = None
    batted: Optional[BattedBall] = None
    play: Optional[PlayResult] = None
    sigma_used: float = 0.0
    wild_pitch: bool = False                   # dirt ball that got past the catcher with runners on
    fielding: Optional[object] = None          # v1.2: FieldingPlay when fielders are configured
    in_dirt: bool = False


@dataclass
class PlateAppearanceResult:
    outcome: str
    pitches: List[PitchRecord]
    final_context: GameContext


def reconcile(pitcher: PitcherAgent, catcher: CatcherAgent, ctx: GameContext, rng: np.random.Generator,
              max_shake_offs: int = 2, rng_catcher: np.random.Generator = None):
    """Sign / shake-off protocol. Both agents keep their own reasoning; the record keeps both."""
    rng_c = rng_catcher if rng_catcher is not None else rng          # v1.1: each agent draws from its own stream
    it = pitcher.intent(ctx, rng)
    sign = catcher.sign(ctx, pitcher.repertoire_codes, rng_c, pitcher_intent=it)
    first_sign = sign
    shakes = 0
    excluded = []
    rapport = catcher.rapport() if hasattr(catcher, "rapport") else 0.5
    while True:
        accepts = pitcher.accepts(it, sign, rng, rapport) if hasattr(pitcher, "accepts") else True
        if accepts:
            call = PitchCall(sign.code, sign.target_xz, it.effort, zone=sign.zone,
                             reasons=list(dict.fromkeys(sign.reasons + it.reasons)),
                             pitcher_choice=it.code, catcher_choice=first_sign.code,
                             shake_offs=shakes, agreed=(first_sign.code == it.code))
            return it, first_sign, call
        shakes += 1
        excluded.append(sign.code)
        if shakes > max_shake_offs:
            break
        sign = catcher.sign(ctx, pitcher.repertoire_codes, rng_c, pitcher_intent=it, exclude=tuple(excluded))
    call = PitchCall(it.code, it.target_xz, it.effort, zone=it.zone, reasons=it.reasons + ["사인 거부 후 자기 선택"],
                     pitcher_choice=it.code, catcher_choice=first_sign.code, shake_offs=shakes, agreed=False)
    return it, first_sign, call


class PlateAppearance:
    def __init__(self, pitcher: PitcherAgent, catcher: CatcherAgent, batter: BatterAgent,
                 config: EngineConfig = None, seed: int = 0, new_game: bool = True):
        self.pitcher, self.catcher, self.batter = pitcher, catcher, batter
        self.cfg = config or EngineConfig()
        # v1.1 (audit 01 #7): four independent random streams - physics/umpire, pitcher, catcher, batter -
        # so one agent's extra draw never changes another agent's noise or decision
        streams = np.random.SeedSequence(seed).spawn(4)
        self.rng, self.rng_pitcher, self.rng_catcher, self.rng_batter = (np.random.default_rng(x) for x in streams)
        self.zone = StrikeZone.for_height(batter.height)
        if new_game:
            self.pitcher.begin_game(self.rng_pitcher)
            self.batter.begin_game()
        tend = batter.tendencies()
        self.pitcher.scout(tend, self.rng_pitcher)
        self.catcher.scout(tend, self.rng_catcher, getattr(batter, "name", "B"))
        if new_game and hasattr(self.pitcher, "spec_for"):
            self.catcher.learn_pitcher(self.pitcher, self.rng_catcher)
            if hasattr(self.batter, "scout_pitcher"):
                self.batter.scout_pitcher(self.pitcher, self.rng_batter)

    # ------------------------------------------------------------------ public
    def run(self, ctx: GameContext = None, max_pitches: int = 20) -> PlateAppearanceResult:
        ctx = ctx or GameContext()
        ctx.batter_hand = self.batter.hand
        ctx.pitcher_hand = self.pitcher.hand
        ctx.pitcher_id = getattr(self.pitcher, "name", "P")
        ctx.batter_id = getattr(self.batter, "name", "B")
        ctx.zone_top, ctx.zone_bottom = self.zone.top, self.zone.bottom
        ctx.pitch_count = getattr(self.pitcher, "pitch_count", ctx.pitch_count)
        ctx.umpire_low_shift = self.cfg.umpire.low_shift - self.cfg.umpire.high_shift * 0.0
        records: List[PitchRecord] = []
        for i in range(max_pitches):
            rec = self.pitch_once(ctx, i)
            records.append(rec)
            self._batter_learns(rec)
            ctx = self._advance(ctx, rec)
            if rec.play is not None and rec.play.kind != "foul":
                return PlateAppearanceResult(rec.play.kind, records, ctx)
            if ctx.strikes >= 3:
                return PlateAppearanceResult("strikeout", records, ctx)
            if rec.result == "hbp":
                return PlateAppearanceResult("hbp", records, ctx)
            if ctx.balls >= 4:
                return PlateAppearanceResult("walk", records, ctx)
        return PlateAppearanceResult("unresolved", records, ctx)

    def pitch_once(self, ctx: GameContext, index: int = 0) -> PitchRecord:
        cfg, rng = self.cfg, self.rng
        # --- battery: two minds, one pitch ------------------------------------
        intent, sign, call = reconcile(self.pitcher, self.catcher, ctx, self.rng_pitcher, cfg.max_shake_offs, self.rng_catcher)
        sigma = self.pitcher.command_sigma(call.code)
        actual_target = (call.target_xz[0] + rng.normal(0, sigma), call.target_xz[1] + rng.normal(0, sigma))
        if hasattr(self.pitcher, "spec_for"):
            spec = self.pitcher.spec_for(call.code, call.effort, self.rng_pitcher)
            pitch = throw_spec(spec, actual_target, cfg.aero, dt=cfg.dt)
        else:
            pt = cfg.repertoire[call.code]
            pitch = throw(pt, self.pitcher.hand, actual_target, cfg.aero, speed_scale=call.effort, dt=cfg.dt)

        # --- batter perceives & decides ------------------------------------
        contact_y = PLATE_FRONT_Y + getattr(getattr(self.batter, "profile", None), "contact_offset_y", 0.15)
        arrival = pitch.trajectory.crossing(1, contact_y)
        t_arrive = arrival.t if arrival is not None else pitch.trajectory.final.t
        eye = self.batter.eye_position(contact_y)
        sig = cfg.eye_sigma_deg * self.batter.eye_sigma_factor()
        t_seen = t_arrive - min(self.batter.reaction_time, self.batter.late_window())
        rng_b = self.rng_batter
        sightings = observe(pitch.trajectory, eye, t_seen, rng_b, cfg.eye_fps, sig, blur_fn=self.batter.late_blur, t_end=t_arrive)
        rel_seen = observe_release(pitch.trajectory, eye, rng_b, sig)
        obs = BatterObservation(batter_view(ctx), eye, sightings, t_arrive - self.batter.reaction_time, contact_y, rel_seen)
        decision = self.batter.decide(obs, rng_b)

        rec = PitchRecord(index, _copy_ctx(ctx), intent, sign, call, pitch, obs, decision, "", sigma_used=sigma)
        plate_xz = (float(pitch.plate.pos[0]), float(pitch.plate.pos[2])) if pitch.plate is not None else (0.0, -0.1)
        rec.in_dirt = pitch.plate is None or pitch.plate.pos[2] < 0.12
        if not decision.swing:
            plate = pitch.plate
            side = -1.0 if self.batter.hand.upper().startswith("R") else 1.0      # batter's body is on this x side
            if plate is not None and plate.pos[0] * side > 0.55 and 0.3 < plate.pos[2] < 1.5 and rng.random() < 0.35:
                rec.result, rec.umpire_call = "hbp", "hit by pitch"                  # v1.0.1: 사구
                self.catcher.observe_swing(ctx, call.code, plate_xz, False, rec.result, 0.0)
                self._notify(call.code, rec.result)
                return rec
            if plate is None:
                rec.result, rec.umpire_call = "ball", "ball"
            else:
                rec.umpire_call = cfg.umpire.call(self.zone, plate.pos, rng, self.catcher.framing())
                rec.result = "called_strike" if rec.umpire_call == "strike" else "ball"
            if rec.in_dirt and any(ctx.runners):
                rec.wild_pitch = bool(rng.random() < 0.35 * (1.0 - 0.8 * self.catcher.blocking()))
            self.catcher.observe_swing(ctx, call.code, plate_xz, False, rec.result, 0.0)
            self._notify(call.code, rec.result)
            return rec

        if arrival is None:
            rec.result = "swinging_strike"
            rec.collision = CollisionResult(False, reason="ball never reached contact plane")
            self.catcher.observe_swing(ctx, call.code, plate_xz, True, rec.result, 0.0)
            self._notify(call.code, rec.result)
            return rec
        ex = decision.execution
        # v0.7: the planned contact time now matters (audit 03 #4): plan - actual + execution noise
        dt_err = float(np.clip((decision.t_contact - arrival.t) if decision.t_contact > 0.0 else 0.0, -0.03, 0.03)) + rng.normal(0, ex.timing_sigma)
        x_bat = decision.x_bat + rng.normal(0, ex.horizontal_sigma)
        z_bat = decision.z_bat + rng.normal(0, ex.vertical_sigma)
        hand_sign = 1.0 if self.batter.hand.upper().startswith("R") else -1.0
        spray_eff = decision.spray_plan_deg + hand_sign * np.degrees(cfg.bat_angular_speed * dt_err)
        alpha = np.radians(decision.attack_angle_deg)
        z_bat_eff = z_bat - decision.bat_speed * np.sin(alpha) * dt_err
        ball = arrival
        offset_v = float(ball.pos[2] - z_bat_eff)
        offset_a = float(hand_sign * (ball.pos[0] - x_bat))
        bat_vel, bat_axis = bat_frame(self.batter.hand, spray_eff, decision.attack_angle_deg, decision.bat_speed)
        bat_spec = self.batter.bat_spec() or cfg.bat
        col = collide(ball.vel, ball.spin, BatContact(bat_vel, bat_axis, offset_v, offset_a), bat_spec, cfg.cor)
        rec.collision = col
        rec.contact_offsets = {"timing_error_s": float(dt_err), "vertical_m": offset_v, "axial_m": offset_a,
                               "spray_eff_deg": float(spray_eff), "t_contact_plan": decision.t_contact,
                               "t_arrival": float(ball.t)}
        if not col.hit:
            rec.result = "swinging_strike"
            if rec.in_dirt and any(ctx.runners):
                rec.wild_pitch = bool(rng.random() < 0.35 * (1.0 - 0.8 * self.catcher.blocking()))
            self.catcher.observe_swing(ctx, call.code, plate_xz, True, rec.result, 0.0)
            self._notify(call.code, rec.result)
            return rec
        start = BallState(ball.t, ball.pos.copy(), col.vel_out.copy(), col.spin_out.copy())
        bb = fly(start, cfg.aero)
        rec.batted = bb
        if cfg.fielders:
            from .fielding import align, resolve_fielding
            align(cfg.fielders, ctx.fielder_shift, self.batter.hand)
            rec.play, rec.fielding = resolve_fielding(bb, cfg.fielders, cfg.park, rng, batter_speed=float(getattr(getattr(self.batter, "profile", None), "speed", 0.5)), batter_hand=self.batter.hand,
                                                     pressure=ctx.leverage)
        else:
            rec.play = resolve(bb, cfg.park, rng)
        rec.result = "foul" if rec.play.kind == "foul" else "in_play"
        quality = float(np.clip((col.exit_speed * 2.237 - 80.0) / 25.0, -1.0, 1.0)) if rec.result == "in_play" else 0.0
        self.catcher.observe_swing(ctx, call.code, plate_xz, True, rec.result, quality)
        self._notify(call.code, rec.result, quality)
        return rec

    # ------------------------------------------------------------------ private
    def _notify(self, code: str, result: str, quality: float = 0.0) -> None:
        self.pitcher.note_pitch(code, result)
        self.catcher.note_pitch(code, result)
        self.batter.note_result(result, quality)

    def _batter_learns(self, rec: "PitchRecord") -> None:
        cfg, rng = self.cfg, self.rng
        traj = rec.pitch.trajectory
        t_end = rec.pitch.plate.t if rec.pitch.plate is not None else traj.final.t
        full = observe(traj, rec.observation.eye_pos, t_end, self.rng_batter, cfg.eye_fps, cfg.eye_sigma_deg * self.batter.eye_sigma_factor(),
                       blur_fn=self.batter.late_blur, t_end=t_end)
        self.batter.learn(BatterObservation(rec.context_before, rec.observation.eye_pos, full, t_end,
                                            rec.observation.contact_y, rec.observation.release_seen))

    @staticmethod
    def _advance(ctx: GameContext, rec: PitchRecord) -> GameContext:
        new = _copy_ctx(ctx)
        new.previous_pitch_codes = list(ctx.previous_pitch_codes) + [rec.call.code]
        new.previous_results = list(ctx.previous_results) + [rec.result]
        new.pitch_count = ctx.pitch_count + 1
        if rec.result == "ball":
            new.balls += 1
        elif rec.result in ("called_strike", "swinging_strike"):
            new.strikes += 1
        elif rec.result == "foul":
            new.strikes = min(2, new.strikes + 1)
        return new


def batter_view(ctx: GameContext) -> GameContext:
    """What the hitter is allowed to know about the situation (v1.1, audit 01 #6b): count, outs, runners,
    inning, score, hands, zone - but not the battery's umpire read or the steal-threat estimate."""
    v = _copy_ctx(ctx)
    v.umpire_low_shift = 0.0
    v.runner_speed = 0.5
    return v


def _copy_ctx(ctx: GameContext) -> GameContext:
    return GameContext(ctx.balls, ctx.strikes, ctx.outs, ctx.inning, ctx.batter_hand, ctx.pitcher_hand,
                       tuple(ctx.runners), ctx.score_diff, list(ctx.previous_pitch_codes),
                       list(ctx.previous_results), ctx.zone_top, ctx.zone_bottom, ctx.pitch_count,
                       ctx.pitcher_id, ctx.batter_id, ctx.runner_speed, ctx.umpire_low_shift, ctx.fielder_shift)
