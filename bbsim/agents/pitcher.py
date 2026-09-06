"""Pitcher agent v0.3: body chain + grip + spin model + own intent.

The pitcher decides from what a pitcher knows:
    * its own body (PitcherProfile -> release point, arm angle, velocity chain)
    * today's feel per pitch (sampled at game start, drifts with results)
    * fatigue (pitch count)
    * its own memory of the previous pitches to this batter
    * a *blurred* scouting read of the batter (scouting_accuracy)
It then hears the catcher's sign and accepts or shakes it off.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..physics.body import PARAMS, chain_efficiency, release_pose, spin_from_card
from ..physics.pitch import GRIPS, PitchSpec, build_spec
from .base import (BatterTendencies, CatcherSign, GameContext, PitchCall, PitchIntent,
                   PitcherAgent)
from .intent import (BREAKING, Candidate, FASTBALLS, count_prior, noisy_tendencies,
                     tendency_bonus, zone_prior, zone_targets)

_FAT = PARAMS["fatigue"]


@dataclass
class PitcherProfile:
    name: str = "B"
    hand: str = "R"
    height: float = 1.85
    abd: float = 92.0
    tilt: float = 30.0
    lean: float = 30.0
    stride: float = 0.84
    fwd: float = 35.0
    eff: float = 0.92                      # spin efficiency of the arm/wrist
    cmd: float = 0.14                      # base command sigma (m)
    mph: float = 94.0                      # base fastball velocity before chain/grip factors
    wrist_speed: float = 60.0
    finger_len: float = 0.5
    grip_force: float = 60.0
    grip_skill: float = 60.0
    repertoire: Tuple[str, ...] = ("FF", "SI", "SL", "CH")
    release_sigma: Tuple[float, float] = (0.035, 0.025)
    axis_sigma_deg: float = 4.0
    trust_catcher: float = 0.90
    scouting_accuracy: float = 0.6
    feel_sigma: float = 0.12
    aggression: float = 0.6
    fatigue: float = 0.0                   # pre-game fatigue 0..1
    core: float = 0.7                      # core / rotational strength 0..1 (realises the posture's chain)

    @classmethod
    def from_params(cls, pid: str) -> "PitcherProfile":
        for p in PARAMS["profiles"]:
            if p["id"] == pid:
                return cls(name=p["name"], hand=p["hand"], height=p["height"], abd=p["abd"], tilt=p["tilt"],
                           lean=p["lean"], stride=p["stride"], fwd=p["fwd"], eff=p["eff"], cmd=p["cmd"],
                           mph=p["mph"], wrist_speed=p["wrist_speed"], finger_len=p["finger_len"],
                           grip_force=p["grip_force"], grip_skill=p["grip_skill"],
                           repertoire=tuple(p["repertoire"]), release_sigma=tuple(p["release_sigma"]),
                           axis_sigma_deg=p["axis_sigma_deg"], core=p.get("core", 0.7))
        raise KeyError(pid)

    @classmethod
    def from_card(cls, card, repertoire=("FF", "SL", "CH")) -> "PitcherProfile":
        """Map a game-layer PlayerCard onto the physical profile."""
        f, fm, s = card.fixed, card.form, card.skills
        traits = card.derive_pitch_traits()
        return cls(name=card.name, hand=card.hand, height=f["height"], abd=fm["abd"], tilt=fm["tilt"],
                   lean=fm["lean"], stride=fm["stride"], fwd=fm["fwd"],
                   eff=0.75 + 0.25 * card.semi["wrist_rom"], cmd=traits["sigma_m"],
                   mph=traits["mph"], wrist_speed=s["wrist_speed"], finger_len=f["finger_len"],
                   grip_force=s["grip_force"], grip_skill=s["grip_skill"], repertoire=tuple(repertoire),
                   release_sigma=(0.06 - 0.03 * s["repeatability"] / 100.0, 0.045 - 0.025 * s["repeatability"] / 100.0),
                   scouting_accuracy=0.4 + 0.4 * s["focus"] / 100.0, fatigue=card.state["fatigue"],
                   core=(0.5 * s["core_rotation"] + 0.5 * s["leg_power"]) / 100.0)


class HeuristicPitcher(PitcherAgent):
    def __init__(self, profile: PitcherProfile = None):
        self.profile = profile or PitcherProfile()
        p = self.profile
        self.hand, self.name = p.hand, p.name
        self.repertoire_codes = tuple(p.repertoire)
        self.pose = release_pose(p.height, p.hand, p.abd, p.tilt, p.lean, p.stride, p.fwd)
        self.chain = chain_efficiency(p.abd, p.tilt, p.lean, p.stride, self.pose.arm_angle_deg, p.core)
        self.pose.velocity_mult = self.chain["velocity_mult"]
        self.pitch_count = 0
        self.feel: Dict[str, float] = {c: 0.0 for c in self.repertoire_codes}
        self.memory: List[Tuple[str, str]] = []
        self.scouted: Optional[BatterTendencies] = None
        self.last_intent: Optional[PitchIntent] = None

    # ---- game state ------------------------------------------------------
    def begin_game(self, rng: np.random.Generator) -> None:
        self.pitch_count = 0
        self.feel = {c: float(rng.normal(0.0, self.profile.feel_sigma)) for c in self.repertoire_codes}
        self.memory = []

    def scout(self, tendencies: BatterTendencies, rng: np.random.Generator) -> None:
        self.scouted = noisy_tendencies(tendencies, self.profile.scouting_accuracy, rng)
        self.memory = []

    def note_pitch(self, code: str, result: str) -> None:
        self.pitch_count += 1
        self.memory.append((code, result))
        d = {"swinging_strike": +0.02, "called_strike": +0.01, "foul": 0.0, "ball": -0.015, "in_play": -0.01}.get(result, 0.0)
        self.feel[code] = float(np.clip(self.feel.get(code, 0.0) + d, -0.4, 0.4))

    # ---- physical derivations ---------------------------------------------
    def fatigue_level(self) -> float:
        extra = max(0, self.pitch_count - _FAT["free_pitches"])
        return float(np.clip(self.profile.fatigue + extra / 60.0, 0.0, 1.5))

    def traits(self, code: str, effort: float = 1.0) -> Dict[str, float]:
        p, g = self.profile, GRIPS[code]
        extra = max(0, self.pitch_count - _FAT["free_pitches"])
        mph = p.mph * g["spd"] * self.pose.velocity_mult * effort * (max(0.90, 1.0 - _FAT["mph_per_pitch"] * extra)) \
            * (1.0 - 0.02 * p.fatigue)
        sp = spin_from_card(mph, p.wrist_speed, p.finger_len, p.grip_force, p.grip_skill, code)
        rpm = sp["rpm"] * (max(0.85, 1.0 - _FAT["spin_per_pitch"] * extra))
        eff_total = p.eff * g["eff"]
        return {"mph": mph, "rpm": rpm, "eff_total": eff_total, "bauer": sp["bauer"], "f_force": sp["f_force"]}

    def spec_for(self, code: str, effort: float = 1.0, rng: np.random.Generator = None) -> PitchSpec:
        """PitchSpec for one pitch, including per-pitch release / axis / spin wobble."""
        t = self.traits(code, effort)
        rel = self.pose.release.copy()
        arm = self.pose.arm_angle_deg
        eff = t["eff_total"]
        rpm = t["rpm"]
        if rng is not None:
            sx, sz = self.profile.release_sigma
            rel[0] += rng.normal(0, sx)
            rel[2] += rng.normal(0, sz)
            arm += rng.normal(0, self.profile.axis_sigma_deg)
            eff = float(np.clip(eff + rng.normal(0, 0.03), 0.1, 1.0))
            rpm *= float(np.clip(1.0 + rng.normal(0, 0.03), 0.8, 1.2))
            mph = t["mph"] + rng.normal(0, 0.9)                     # v1.0.1: pitch-to-pitch velocity spread (~1 mph)
        else:
            mph = t["mph"]
        return build_spec(code, self.hand, mph, rpm, eff, arm, rel)

    def command_sigma(self, code: str) -> float:
        p = self.profile
        extra = max(0, self.pitch_count - _FAT["free_pitches"])
        base = p.cmd * (1.25 if code in BREAKING else 1.0) * self.pose.command_mult
        return base * min(1.6, 1.0 + _FAT["sigma_per_pitch"] * extra) * (1.0 - 0.5 * self.feel.get(code, 0.0))   # v0.7 clamp (audit 01 #12)

    # ---- intent -----------------------------------------------------------
    def intent(self, ctx: GameContext, rng: np.random.Generator) -> PitchIntent:
        zones = zone_targets(ctx)
        cands: List[Candidate] = []
        fat = self.fatigue_level()
        prev = [c for c, _ in self.memory[-2:]] or ctx.previous_pitch_codes[-2:]
        for code in self.repertoire_codes:
            for zone, xz in zones.items():
                c = Candidate(code, zone, xz)
                s = count_prior(ctx, code) + zone_prior(ctx, code, zone)
                f = self.feel.get(code, 0.0)
                s += 2.0 * f
                if f > 0.08:
                    c.reasons.append("오늘 감이 좋은 구종")
                if f < -0.08:
                    c.reasons.append("오늘 감이 나쁜 구종")
                if prev.count(code) == 2:
                    s -= 0.9
                    c.reasons.append("같은 구종 3연속 회피")
                elif prev and prev[-1] == code:
                    s -= 0.2
                if fat > 0.5 and code == "FF" and zone.startswith("chase"):
                    s -= 0.4
                if fat > 0.7 and code in FASTBALLS:
                    s -= 0.3
                    c.reasons.append("피로: 구속 의존 회피")
                if f < -0.1 and zone.startswith("chase"):
                    s -= 0.3           # bad feel: do not try fine location
                if zone == "middle" and f < -0.1 and ctx.strikes < 2:
                    s += 0.3
                    c.reasons.append("제구 불안: 존 안으로")
                tb, why = tendency_bonus(ctx, self.scouted, code, zone)
                s += 0.8 * tb
                c.reasons += why
                s += 0.4 * (self.profile.aggression - 0.5) * (1.0 if not zone.startswith("chase") else -1.0)
                c.score = s + rng.normal(0, 0.15)
                cands.append(c)
        cands.sort(key=lambda c: -c.score)
        best = cands[0]
        effort = 1.0 + (0.02 if ctx.strikes == 2 else 0.0) - 0.01 * (ctx.balls == 3) - 0.03 * max(0.0, fat - 0.5)
        it = PitchIntent(best.code, best.zone, best.target_xz, effort, best.score, best.reasons,
                         [(c.code, c.zone, c.score) for c in cands[:6]])
        self.last_intent = it
        return it

    def decide(self, ctx: GameContext, sign: Optional[CatcherSign], rng: np.random.Generator) -> PitchCall:
        """Legacy single-step decision: accept the sign if it is close to own intent."""
        it = self.last_intent or self.intent(ctx, rng)
        if sign is None:
            return PitchCall(it.code, it.target_xz, it.effort, zone=it.zone, reasons=it.reasons,
                             pitcher_choice=it.code, catcher_choice="")
        accept = self.accepts(it, sign, rng)
        if accept:
            return PitchCall(sign.code, sign.target_xz, it.effort, zone=sign.zone, reasons=sign.reasons,
                             pitcher_choice=it.code, catcher_choice=sign.code, agreed=sign.code == it.code)
        return PitchCall(it.code, it.target_xz, it.effort, zone=it.zone, reasons=it.reasons + ["사인 거부"],
                         pitcher_choice=it.code, catcher_choice=sign.code, shake_offs=1, agreed=False)

    def accepts(self, it: PitchIntent, sign: CatcherSign, rng: np.random.Generator, rapport: float = 0.5) -> bool:
        if sign.code == it.code:
            return True
        own = {c: s for c, _, s in it.ranked}
        gap = it.score - own.get(sign.code, min(own.values()) - 0.5 if own else it.score - 2.0)
        trust = float(np.clip(self.profile.trust_catcher * (0.7 + 0.6 * rapport), 0.05, 0.98))
        p = trust * float(np.exp(-max(0.0, gap) / 1.5))
        if self.feel.get(sign.code, 0.0) < -0.15:
            p *= 0.5
        return bool(rng.random() < p)
