"""Batted-ball flight and a placeholder play-outcome model.

Flight is physics (drag + Magnus, same integrator as the pitch). The
conversion of a landing point into a play result is a *placeholder*
probability table (v0.1); it is isolated here so that fielder agents can
replace it without touching physics or batter/pitcher agents.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

from ..physics.ball_fast import integrate_fast
from ..physics.ball import AeroModel, BallState, Trajectory, integrate
from ..physics.constants import MS_TO_MPH


@dataclass
class Park:
    """Fence distance (m) as a function of spray angle and a flat fence height."""
    line_distance: float = 100.0
    center_distance: float = 122.0
    fence_height: float = 2.6
    foul_angle_deg: float = 45.0

    def fence_distance(self, spray_deg: float) -> float:
        f = np.cos(np.radians(spray_deg)) ** 2
        return self.line_distance + (self.center_distance - self.line_distance) * f


@dataclass
class BattedBall:
    trajectory: Trajectory
    exit_speed: float             # m/s
    launch_angle: float           # deg
    spray_angle: float            # deg (+x = first-base side)
    spin_rpm: float
    landing_distance: float       # m from home plate (horizontal)
    hang_time: float              # s
    apex: float                   # m

    @property
    def exit_speed_mph(self) -> float:
        return self.exit_speed * MS_TO_MPH


@dataclass
class PlayResult:
    kind: str                     # HR | foul | out | single | double | triple
    bases: int
    detail: str = ""
    p_hit: float = 0.0


BATTED_CD = 0.39      # v1.4: batted-ball drag (Nathan: C_D ~0.38-0.40 at 90-110 mph); pitch keeps 0.35. Matches Statcast 95/25 -> ~107 m, 100/28 -> ~119 m


def fly(contact: BallState, aero: AeroModel = None, dt: float = 4e-3) -> BattedBall:
    base = aero or AeroModel()
    aero = AeroModel(env=base.env, cd=lambda speed, s: BATTED_CD, cl=base.cl, spin_decay_tau=base.spin_decay_tau, ssw_scale=0.0)
    traj = integrate_fast(contact, aero, dt=dt, t_max=12.0, min_t=0.05)
    p = traj.pos
    land = traj.final
    dist = float(np.hypot(land.pos[0], land.pos[1]))
    v0 = contact.vel
    la = float(np.degrees(np.arctan2(v0[2], np.hypot(v0[0], v0[1]))))
    spray = float(np.degrees(np.arctan2(v0[0], v0[1])))
    return BattedBall(traj, float(np.linalg.norm(v0)), la, spray,
                      float(np.linalg.norm(contact.spin)) * 60 / (2 * np.pi),
                      dist, float(land.t - contact.t), float(p[:, 2].max()))


def _height_at_distance(traj: Trajectory, dist: float) -> Optional[float]:
    p = traj.pos
    r = np.hypot(p[:, 0], p[:, 1])
    idx = np.where(r >= dist)[0]
    if len(idx) == 0:
        return None
    i = int(idx[0])
    if i == 0:
        return float(p[0, 2])
    f = (dist - r[i - 1]) / max(r[i] - r[i - 1], 1e-9)
    return float(p[i - 1, 2] + f * (p[i, 2] - p[i - 1, 2]))


def foul_probability(bb: BattedBall, park: Park) -> float:
    """v0.7 foul model (audit 03 #5). Statcast: ~37 % of swings are fouls; most are mis-hits:
    topped balls (LA < -15), pop-ups behind/beside (LA > 50), and balls sliced/hooked down the lines."""
    la, sp = bb.launch_angle, abs(bb.spray_angle)
    if sp > park.foul_angle_deg:
        return 1.0
    p = 0.0
    if la < -15:
        p = 0.55 + 0.01 * min(0.0, la + 15)          # chopped into the ground near the plate
    elif la > 50:
        p = 0.45 + 0.010 * (la - 50)                   # popped straight up / behind
    if sp > 30:
        p = max(p, 0.35 + 0.02 * (sp - 30))            # down the line: often hooks/slices foul
    return float(np.clip(p, 0.0, 0.95))


def resolve(bb: BattedBall, park: Park, rng: np.random.Generator) -> PlayResult:
    """Outcome table without fielder agents (v0.7 calibration; replace with fielders later).

    Targets (audit 03 gates): BABIP .290-.300, XBH/H 22-28 %, HR/PA 2.5-3.5 % for MLB-like input.
    """
    pf = foul_probability(bb, park)
    if pf >= 1.0 or rng.random() < pf:
        return PlayResult("foul", 0, "foul", pf)
    fence = park.fence_distance(bb.spray_angle)
    h = _height_at_distance(bb.trajectory, fence)
    if h is not None and h > park.fence_height:
        return PlayResult("HR", 4, "over the fence (%.0f m)" % bb.landing_distance, 1.0)

    ev = bb.exit_speed_mph
    la = bb.launch_angle
    dist = bb.landing_distance
    sp = abs(bb.spray_angle)
    if la < 0:
        p = 0.20 + 0.007 * (ev - 85)
        kind, bases = "single", 1
    elif la < 10:
        p = 0.33 + 0.010 * (ev - 85)
        kind, bases = ("double", 2) if dist > 80 and sp > 20 else ("single", 1)
    elif la < 25:
        p = 0.55 + 0.010 * (ev - 85)
        kind, bases = ("double", 2) if dist > 85 or (sp > 25 and dist > 75) else ("single", 1)
    elif la < 45:
        p = 0.05 + 0.30 * max(0.0, (dist - 80.0) / (fence - 80.0 + 1e-9))
        kind, bases = ("triple", 3) if sp > 30 and dist > 95 else ("double", 2)
    else:
        p = 0.02
        kind, bases = "single", 1
    p = float(np.clip(p, 0.01, 0.92))
    if rng.random() < p:
        return PlayResult(kind, bases, "in play, hit", p)
    return PlayResult("out", 0, "in play, out", p)
