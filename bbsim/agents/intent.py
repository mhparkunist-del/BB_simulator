"""Shared intent scoring for the battery (pitcher and catcher think separately).

Both agents score every (pitch code, location) candidate with their own
information and weights; the engine reconciles the two through the sign /
shake-off protocol (engine.plate_appearance.reconcile).

Locations are named zones in plate-front coordinates (x: + first-base side,
z: height). `side` flips x so that "in"/"away" follow the batter's hand.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..physics.constants import STRIKE_ZONE_HALF_WIDTH
from .base import BatterTendencies, GameContext

FASTBALLS = ("FF", "SI", "CT")
BREAKING = ("SL", "CU")
OFFSPEED = ("CH", "SP")
DIRT_RISK = {"CU": 0.30, "SP": 0.35, "SL": 0.15, "CH": 0.12, "SI": 0.08, "FF": 0.03, "CT": 0.05}


@dataclass
class Candidate:
    code: str
    zone: str
    target_xz: Tuple[float, float]
    score: float = 0.0
    reasons: List[str] = field(default_factory=list)


def zone_targets(ctx: GameContext) -> Dict[str, Tuple[float, float]]:
    """Named locations for the current batter (in/away follow the batter's hand)."""
    away = 1.0 if ctx.batter_hand.upper().startswith("R") else -1.0     # +x is away from a RHB
    top, bot = ctx.zone_top, ctx.zone_bottom
    mid = 0.5 * (top + bot)
    e = STRIKE_ZONE_HALF_WIDTH * 0.65
    return {
        "middle": (0.0, mid),
        "away": (away * e, mid),
        "in": (-away * e, mid),
        "low_away": (away * e, bot + 0.06),
        "low_in": (-away * e, bot + 0.06),
        "low": (0.0, bot + 0.05),
        "high": (0.0, top - 0.04),
        "high_in": (-away * e * 0.8, top - 0.04),
        "chase_low": (away * e * 0.6, bot - 0.08),         # v0.7: shadow zone (3-8 cm off), not 15 cm
        "chase_away": (away * (e + 0.08), mid - 0.1),
        "chase_high": (0.0, top + 0.08),
    }


def count_prior(ctx: GameContext, code: str) -> float:
    """Count-based base weight, shared by both agents (baseball common sense)."""
    b, s = ctx.balls, ctx.strikes
    fb = code in FASTBALLS
    w = 0.15 if fb else 0.0          # v0.7: fastballs are the default pitch (MLB FF+SI ~ 50 %)
    if b > s:
        w += 0.6 if fb else -0.2
    if s > b:
        w += -0.2 if fb else 0.35
    if b == 3 and s < 2:
        w += 1.2 if fb else -0.8
    if s == 2:
        w += 0.3 if code in BREAKING + OFFSPEED else 0.0
    if b == 0 and s == 0:
        w += 0.05 if fb else 0.0        # v1.0.1: first-pitch fastball ~60 %, not 99 %
    return w


def zone_prior(ctx: GameContext, code: str, zone: str) -> float:
    b, s = ctx.balls, ctx.strikes
    w = 0.0
    chase = zone.startswith("chase")
    if chase:
        w += 0.05 if s == 2 else (-0.9 if b >= 2 else -0.3)     # v0.7: 2-strike chase 0.7 -> 0.05 (2S Zone% 25 -> 40-50)
        if code in FASTBALLS and zone != "chase_high":
            w -= 0.4
    if zone == "middle":                                   # v0.7: behind in the count -> attack the zone
        w += 0.8 if b == 3 else (0.4 if b > s else (-0.4 if s > b else 0.0))
    if zone in ("low_away", "low_in", "high_in") and b > s:
        w -= 0.4                                           # corners are for when ahead (miss ~17 cm radial)
    if code in BREAKING + OFFSPEED and zone in ("low", "low_away", "low_in", "chase_low"):
        w += 0.3
    if code in BREAKING + OFFSPEED and zone in ("away", "in"):
        w += 0.15
    if code == "FF" and zone in ("high", "high_in", "chase_high"):
        w += 0.5
    if code == "SI" and zone in ("low", "low_away", "low_in"):
        w += 0.3
    return w


def tendency_bonus(ctx: GameContext, t: Optional[BatterTendencies], code: str, zone: str) -> Tuple[float, List[str]]:
    """How a (noisy) scouting read changes the score."""
    if t is None:
        return 0.0, []
    w, why = 0.0, []
    if code in BREAKING and t.whiff_breaking > 0.55 and ctx.strikes >= 1:
        w += 0.8 * (t.whiff_breaking - 0.5) * 2
        why.append("변화구 헛스윙 많음")
    if code == "FF" and zone in ("high", "chase_high", "high_in") and t.whiff_high_ff > 0.55:
        w += 0.6 * (t.whiff_high_ff - 0.5) * 2
        why.append("하이 패스트볼에 약함")
    if zone in ("chase_low", "low", "low_away") and t.chase_low > 0.55:
        w += 0.5 * (t.chase_low - 0.5) * 2
        why.append("낮은 공 추격")
    if zone in ("chase_away", "away", "low_away") and t.chase_away > 0.55:
        w += 0.5 * (t.chase_away - 0.5) * 2
        why.append("바깥쪽 추격")
    if zone in ("in", "low_in", "high_in") and t.power_zone == "in":
        w -= 0.8
        why.append("몸쪽 강타자 회피")
    if zone in ("away", "low_away") and t.power_zone == "away":
        w -= 0.6
        why.append("바깥쪽 강타자 회피")
    if zone in ("low", "low_away", "low_in") and t.power_zone == "low":
        w -= 0.5
        why.append("낮은 공 강타자 회피")
    if ctx.balls == 0 and ctx.strikes == 0 and t.first_pitch_swing > 0.5 and zone.startswith("chase"):
        w += 0.5
        why.append("초구 스윙 성향")
    if code in OFFSPEED and t.contact_vs_offspeed < 0.45:
        w += 0.4
        why.append("오프스피드에 약함")
    return w, why


def noisy_tendencies(t: BatterTendencies, accuracy: float, rng: np.random.Generator) -> BatterTendencies:
    """A scouting copy: each rate blurred with sigma = 0.3*(1-accuracy); power zone may be misread."""
    sig = 0.3 * (1.0 - accuracy)
    def n(v):
        return float(np.clip(v + rng.normal(0, sig), 0.0, 1.0))
    pz = t.power_zone
    if rng.random() > accuracy:
        pz = str(rng.choice(["in", "away", "low", "high", "middle"]))
    return BatterTendencies(t.hand, n(t.chase_low), n(t.chase_away), n(t.chase_in), n(t.whiff_breaking),
                            n(t.whiff_high_ff), n(t.first_pitch_swing), pz, n(t.contact_vs_offspeed))
