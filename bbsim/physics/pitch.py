"""Pitch construction: grip -> spin vector / seam-shifted wake, aim solver -> trajectory.

Two entry points
    throw(PitchType, hand, target)      legacy fixed pitch types (tests, quick demos)
    throw_spec(PitchSpec, target)       per-pitcher spec built from the body chain,
                                        grip table and spin model (pitching_params.json)

Spin axis convention (RHP, seen from the catcher; x = catcher's right):
    tilt = 0    pure backspin        (Magnus up)            omega = -x
    tilt = 90   arm-side sidespin    (Magnus toward -x)     omega = -z
    tilt = 180  pure topspin         (Magnus down)          omega = +x
    tilt = 270  glove-side sidespin  (Magnus toward +x)     omega = +z
Active axis  a(tilt) = (-cos tilt, 0, -sin tilt);  LHP mirrors x.
gyro_frac (0..1) is the fraction of |omega| aligned with the velocity
(bullet spin), which produces no Magnus force.

Per-pitcher axis rule:  tilt_axis = grip.tilt0 + grip.pron + axis_k*(90 - arm_angle), axis_k=0.6 (Statcast 2024 regression)
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Dict, Optional, Tuple

import numpy as np

from .ball_fast import integrate_fast
from .ball import AeroModel, BallState, Trajectory, integrate
from .body import PARAMS
from .constants import (G, MPH_TO_MS, PLATE_FRONT_Y, RELEASE_Y, RPM_TO_RADS)

Vec3 = np.ndarray
GRIPS = PARAMS["grips"]


@dataclass(frozen=True)
class PitchType:
    code: str
    name: str
    speed_mph: float
    spin_rpm: float
    tilt_deg: float
    gyro_frac: float


# Typical MLB right-hander values (Statcast league medians, 2023-2025). Legacy table.
DEFAULT_REPERTOIRE: Dict[str, PitchType] = {
    "FF": PitchType("FF", "four-seam fastball", 94.0, 2300, 25, 0.15),
    "SI": PitchType("SI", "sinker", 93.0, 2150, 60, 0.30),
    "CT": PitchType("CT", "cutter", 89.0, 2350, 300, 0.80),
    "SL": PitchType("SL", "slider", 85.0, 2450, 260, 0.85),
    "CU": PitchType("CU", "curveball", 79.0, 2550, 170, 0.30),
    "CH": PitchType("CH", "changeup", 85.0, 1700, 60, 0.40),
}


def spin_axis_vector(tilt_deg: float, gyro: float, handedness: str, vel_dir: Vec3,
                     omega: float) -> Vec3:
    tilt = np.radians(tilt_deg)
    a = np.array([-np.cos(tilt), 0.0, -np.sin(tilt)])
    if handedness.upper().startswith("L"):
        a[2] = -a[2]          # mirror the side component only; backspin axis is the same for both hands
    v_hat = vel_dir / np.linalg.norm(vel_dir)
    a = a - np.dot(a, v_hat) * v_hat
    a = a / max(np.linalg.norm(a), 1e-12)
    g = float(np.clip(gyro, 0.0, 0.999))
    return omega * (np.sqrt(1.0 - g * g) * a + g * v_hat)


def spin_vector(pt: PitchType, handedness: str, vel_dir: Vec3, spin_scale: float = 1.0) -> Vec3:
    return spin_axis_vector(pt.tilt_deg, pt.gyro_frac, handedness, vel_dir,
                            pt.spin_rpm * spin_scale * RPM_TO_RADS)


def default_release(handedness: str) -> Vec3:
    x = -0.55 if handedness.upper().startswith("R") else 0.55
    return np.array([x, RELEASE_Y, 1.80])


@dataclass
class PitchSpec:
    """Everything the physics needs for one pitch from one pitcher."""
    code: str
    hand: str
    speed_mps: float
    rpm: float
    tilt_axis_deg: float
    gyro: float
    release: Vec3
    ssw: Vec3                      # world-frame seam-shifted-wake coefficient vector
    arm_angle_deg: float = 40.0
    name: str = ""

    @property
    def speed_mph(self) -> float:
        return self.speed_mps / MPH_TO_MS


def build_spec(code: str, hand: str, mph: float, rpm: float, eff_total: float,
               arm_angle_deg: float, release: Vec3) -> PitchSpec:
    """Grip table + arm angle -> spin axis, gyro and seam-shifted wake."""
    g = GRIPS[code]
    tilt_axis = g["tilt0"] + g["pron"] + PARAMS["spin_model"].get("axis_k", 1.0) * (90.0 - arm_angle_deg)
    eff = float(np.clip(eff_total, 0.05, 1.0))
    gyro = float(np.sqrt(max(0.0, 1.0 - eff * eff)))
    sx, sz = g["ssw"]
    if hand.upper().startswith("L"):
        sx = -sx
    return PitchSpec(code, hand, mph * MPH_TO_MS, rpm, tilt_axis, gyro, np.asarray(release, float),
                     np.array([sx, 0.0, sz]), arm_angle_deg, g["name"])


@dataclass
class PitchResult:
    pitch_type: PitchType
    initial: BallState
    trajectory: Trajectory
    target_xz: Tuple[float, float]
    plate: Optional[BallState]
    spec: Optional[PitchSpec] = None

    @property
    def miss_xz(self) -> Tuple[float, float]:
        if self.plate is None:
            return (np.nan, np.nan)
        return (float(self.plate.pos[0] - self.target_xz[0]),
                float(self.plate.pos[2] - self.target_xz[1]))


def _stop_past_plate(s: BallState) -> bool:
    return s.pos[1] <= -0.3 or s.pos[2] <= 0.0


def _aim_and_throw(release: Vec3, speed: float, spin_fn, ssw: Vec3, target_xz, aero: AeroModel,
                   aim_iterations: int, dt: float):
    aim = np.array([target_xz[0], PLATE_FRONT_Y, target_xz[1]])
    t_flight = np.linalg.norm(aim - release) / speed
    aim[2] += 0.5 * G * t_flight ** 2
    traj = None
    for _ in range(max(1, aim_iterations)):
        d = aim - release
        d_hat = d / np.linalg.norm(d)
        s0 = BallState(0.0, release.copy(), speed * d_hat, spin_fn(d_hat), ssw.copy())
        traj = integrate_fast(s0, aero, dt=dt, t_max=2.0, stop_y=-0.3)
        cross = traj.crossing(1, PLATE_FRONT_Y)
        if cross is None:
            aim[2] += 0.3
            continue
        miss = cross.pos - np.array([target_xz[0], PLATE_FRONT_Y, target_xz[1]])
        aim = aim - np.array([miss[0], 0.0, miss[2]])
    return traj


def throw(pt: PitchType, handedness: str, target_xz: Tuple[float, float],
          aero: AeroModel = None, release: Vec3 = None,
          speed_scale: float = 1.0, spin_scale: float = 1.0,
          aim_iterations: int = 3, dt: float = 4e-3) -> PitchResult:
    """Legacy: throw a fixed PitchType with perfect command at target_xz."""
    aero = aero or AeroModel()
    release = default_release(handedness) if release is None else np.asarray(release, float)
    speed = pt.speed_mph * speed_scale * MPH_TO_MS
    traj = _aim_and_throw(release, speed, lambda d: spin_vector(pt, handedness, d, spin_scale),
                          np.zeros(3), target_xz, aero, aim_iterations, dt)
    return PitchResult(pt, traj.states[0], traj, tuple(target_xz), traj.crossing(1, PLATE_FRONT_Y))


def throw_spec(spec: PitchSpec, target_xz: Tuple[float, float], aero: AeroModel = None,
               aim_iterations: int = 3, dt: float = 4e-3) -> PitchResult:
    """Throw a per-pitcher PitchSpec with perfect command at target_xz (noise is the caller's job)."""
    aero = aero or AeroModel()
    omega = spec.rpm * RPM_TO_RADS
    traj = _aim_and_throw(spec.release, spec.speed_mps,
                          lambda d: spin_axis_vector(spec.tilt_axis_deg, spec.gyro, spec.hand, d, omega),
                          spec.ssw, target_xz, aero, aim_iterations, dt)
    pt = PitchType(spec.code, spec.name or spec.code, spec.speed_mph, spec.rpm, spec.tilt_axis_deg, spec.gyro)
    return PitchResult(pt, traj.states[0], traj, tuple(target_xz), traj.crossing(1, PLATE_FRONT_Y), spec)


def fly_direction(spec: PitchSpec, d_hat: Vec3, aero: AeroModel = None, dt: float = 4e-3) -> Trajectory:
    """Integrate `spec` released along a fixed unit direction (no aim correction): used for tunnelling analysis."""
    aero = aero or AeroModel()
    omega = spec.rpm * RPM_TO_RADS
    d_hat = np.asarray(d_hat, float) / np.linalg.norm(d_hat)
    s0 = BallState(0.0, spec.release.copy(), spec.speed_mps * d_hat,
                   spin_axis_vector(spec.tilt_axis_deg, spec.gyro, spec.hand, d_hat, omega), spec.ssw.copy())
    return integrate_fast(s0, aero, dt=dt, t_max=2.0, stop_y=-0.3)


def scaled(pt: PitchType, **changes) -> PitchType:
    return replace(pt, **changes)
