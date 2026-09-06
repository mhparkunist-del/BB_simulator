"""Bat–ball collision: 3-D rigid-body impulse model with friction.

Inputs are the ball's ground-truth state and the bat's state at the
instant of contact; output is the ball's post-impact velocity and spin.

Geometry
--------
    u   unit bat velocity at the impact point (includes attack angle)
    b   unit bat axis (handle -> barrel)
    w   "up" in the plane normal to b:  w = b x u  (sign-fixed so w_z >= 0)
    E   vertical offset of the ball centre above the bat axis (m).
        E > 0  : undercut  -> backspin, fly ball
        E < 0  : topped    -> topspin, ground ball
    n   collision normal (bat axis -> ball centre):
            sin(theta) = E / (r_ball + r_bat)
            n = cos(theta) u + sin(theta) w
    d   impact point along the axis, measured from the sweet spot (m)

Impulse
-------
    v_rel  = (v_ball + omega x (-r n)) - v_bat        (contact-point relative velocity)
    J_n    = -(1 + e) (v_rel . n) m_red_n,   1/m_red_n = 1/m + 1/M_eff
    J_t    = -min(|v_t| m_red_t, mu J_n) t_hat,
             1/m_red_t = 1/m + 1/M_eff + r^2 / I      (sticking = rolling contact)
    v'     = v + (J_n n + J_t) / m
    omega' = omega + (-r n) x J_t / I

The normal COR e(v_n) decreases with impact speed (Nathan 2003 BBCOR data):
    e = e0 - k (|v_n| - v_ref), clipped to [e_min, e_max].
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

from .bat import BatSpec
from .constants import BALL_INERTIA, BALL_MASS, BALL_RADIUS

Vec3 = np.ndarray


@dataclass
class CORModel:
    e0: float = 0.50
    v_ref: float = 26.8        # m/s (60 mph)
    k: float = 0.0010          # per m/s
    e_min: float = 0.35
    e_max: float = 0.60

    def __call__(self, v_normal_speed: float) -> float:
        e = self.e0 - self.k * (v_normal_speed - self.v_ref)
        return float(np.clip(e, self.e_min, self.e_max))


@dataclass
class BatContact:
    """Bat kinematics at the instant of contact."""
    vel: Vec3                 # bat velocity at the impact point (m/s)
    axis: Vec3                # unit vector handle -> barrel
    offset_vertical: float    # E (m), ball centre above bat axis
    offset_axial: float       # d (m), impact point from sweet spot (+ toward tip)


@dataclass
class CollisionResult:
    hit: bool
    vel_out: Optional[Vec3] = None
    spin_out: Optional[Vec3] = None
    exit_speed: float = 0.0           # m/s
    launch_angle: float = 0.0         # deg, above horizontal
    spray_angle: float = 0.0          # deg, + = toward first-base side (+x)
    spin_rpm: float = 0.0
    cor: float = 0.0
    m_eff: float = 0.0
    normal_speed: float = 0.0         # |v_rel . n| before impact
    reason: str = ""


def _unit(v: Vec3) -> Vec3:
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def collide(ball_vel: Vec3, ball_spin: Vec3, bat: BatContact,
            spec: BatSpec = None, cor: CORModel = None) -> CollisionResult:
    spec = spec or BatSpec()
    cor = cor or CORModel()
    r_sum = BALL_RADIUS + spec.barrel_radius

    # --- miss checks ------------------------------------------------------
    if abs(bat.offset_vertical) >= r_sum:
        return CollisionResult(False, reason="swing under/over the ball")
    if not spec.on_barrel(bat.offset_axial):
        return CollisionResult(False, reason="ball missed the bat lengthwise")

    # --- frame ------------------------------------------------------------
    u = _unit(bat.vel)
    b = _unit(bat.axis)
    w = np.cross(b, u)
    if w[2] < 0:
        w = -w
    w = _unit(w)
    sin_t = bat.offset_vertical / r_sum
    cos_t = np.sqrt(1.0 - sin_t ** 2)
    n = cos_t * u + sin_t * w

    # --- relative velocity at contact point ---------------------------------
    r_c = -BALL_RADIUS * n                       # ball centre -> contact point
    v_cp = ball_vel + np.cross(ball_spin, r_c)
    v_rel = v_cp - bat.vel
    v_n = float(np.dot(v_rel, n))
    if v_n >= 0.0:
        return CollisionResult(False, reason="bat and ball separating")

    m = BALL_MASS
    m_eff = spec.effective_mass(bat.offset_axial)
    e = cor(abs(v_n))

    inv_red_n = 1.0 / m + 1.0 / m_eff
    j_n = -(1.0 + e) * v_n / inv_red_n           # scalar > 0

    v_t_vec = v_rel - v_n * n
    v_t = float(np.linalg.norm(v_t_vec))
    if v_t > 1e-9:
        t_hat = v_t_vec / v_t
        inv_red_t = 1.0 / m + 1.0 / m_eff + BALL_RADIUS ** 2 / BALL_INERTIA
        j_t_stick = v_t / inv_red_t
        j_t = min(j_t_stick, spec.mu_friction * j_n)
        j_t_vec = -j_t * t_hat
    else:
        j_t_vec = np.zeros(3)

    j_vec = j_n * n + j_t_vec
    vel_out = ball_vel + j_vec / m
    spin_out = ball_spin + np.cross(r_c, j_t_vec) / BALL_INERTIA

    speed = float(np.linalg.norm(vel_out))
    horiz = float(np.hypot(vel_out[0], vel_out[1]))
    la = float(np.degrees(np.arctan2(vel_out[2], horiz)))
    spray = float(np.degrees(np.arctan2(vel_out[0], vel_out[1])))
    return CollisionResult(True, vel_out, spin_out, speed, la, spray,
                           float(np.linalg.norm(spin_out)) * 60 / (2 * np.pi),
                           e, m_eff, abs(v_n), "contact")


def bat_frame(handedness: str, spray_plan_deg: float, attack_angle_deg: float,
              bat_speed: float):
    """Build (bat velocity vector, bat axis) from swing-plan angles.

    spray_plan_deg : horizontal direction of bat velocity, 0 = toward pitcher,
                     positive = toward +x (first-base side)
    attack_angle_deg: upward tilt of bat path
    """
    phi = np.radians(spray_plan_deg)
    alpha = np.radians(attack_angle_deg)
    u = np.array([np.sin(phi) * np.cos(alpha), np.cos(phi) * np.cos(alpha), np.sin(alpha)])
    axis = np.array([np.cos(phi), -np.sin(phi), 0.0])   # barrel toward +x for RHB
    if handedness.upper().startswith("L"):
        axis = -axis
    return bat_speed * u, axis
