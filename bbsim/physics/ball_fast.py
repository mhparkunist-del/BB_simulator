"""Scalar RK4 flight integrator (v0.7, audit 01 #1/#16).

Same physics as `ball.acceleration` (drag, Magnus with Nathan's C_L, seam-shifted wake, spin decay,
wind/air density) written with plain floats: no per-step numpy allocation, no np.cross.
Results agree with the numpy version to < 0.1 mm at the plate (see tests/test_physics_fast.py).
Returns a `Trajectory` backed by arrays; `BallState` views are built on demand.
"""
from math import exp, sqrt
from typing import Callable, Optional

import numpy as np

from .ball import AeroModel, BallState, Trajectory
from .constants import BALL_AREA, BALL_MASS, BALL_RADIUS, G


def _accel(vx, vy, vz, wx, wy, wz, k, cd, cl, wind, ssw, ssw_scale):
    rx, ry, rz = vx - wind[0], vy - wind[1], vz - wind[2]
    speed = sqrt(rx * rx + ry * ry + rz * rz)
    if speed < 1e-9:
        return 0.0, 0.0, -G
    omega = sqrt(wx * wx + wy * wy + wz * wz)
    s = BALL_RADIUS * omega / speed
    kd = k * cd(speed, s) * speed
    ax, ay, az = -kd * rx, -kd * ry, -G - kd * rz
    if omega > 1e-9:
        kl = k * cl(s) * speed / omega
        ax += kl * (wy * rz - wz * ry)
        ay += kl * (wz * rx - wx * rz)
        az += kl * (wx * ry - wy * rx)
    if ssw is not None and ssw_scale != 0.0:
        ks = k * speed * speed * ssw_scale
        ax += ks * ssw[0]
        ay += ks * ssw[1]
        az += ks * ssw[2]
    return ax, ay, az


def integrate_fast(initial: BallState, aero: AeroModel, dt: float = 4e-3, t_max: float = 10.0,
                   stop_y: Optional[float] = None, stop_ground: bool = True, min_t: float = 0.0,
                   stop: Callable[[float, float, float, float], bool] = None) -> Trajectory:
    """RK4 with scalar math.

    stop_y      : stop once pos_y <= stop_y (a pitch passing the plate)
    stop_ground : stop once pos_z <= 0 (after min_t seconds, so a batted ball may start at z>0 going down)
    stop        : optional extra predicate stop(t, x, y, z)
    """
    k = aero.rho * BALL_AREA / (2.0 * BALL_MASS)
    cd, cl = aero.cd, aero.cl
    wind = (float(aero.env.wind[0]), float(aero.env.wind[1]), float(aero.env.wind[2]))
    ssw = None if initial.ssw is None else (float(initial.ssw[0]), float(initial.ssw[1]), float(initial.ssw[2]))
    ssw_scale = aero.ssw_scale
    decay = exp(-dt / aero.spin_decay_tau) if aero.spin_decay_tau > 0 else 1.0
    t = float(initial.t)
    x, y, z = (float(v) for v in initial.pos)
    vx, vy, vz = (float(v) for v in initial.vel)
    wx, wy, wz = (float(v) for v in initial.spin)
    T = [t]; X = [x]; Y = [y]; Z = [z]; VX = [vx]; VY = [vy]; VZ = [vz]; W = [(wx, wy, wz)]
    h2, h6 = 0.5 * dt, dt / 6.0
    while t < t_max:
        a1x, a1y, a1z = _accel(vx, vy, vz, wx, wy, wz, k, cd, cl, wind, ssw, ssw_scale)
        v2x, v2y, v2z = vx + h2 * a1x, vy + h2 * a1y, vz + h2 * a1z
        a2x, a2y, a2z = _accel(v2x, v2y, v2z, wx, wy, wz, k, cd, cl, wind, ssw, ssw_scale)
        v3x, v3y, v3z = vx + h2 * a2x, vy + h2 * a2y, vz + h2 * a2z
        a3x, a3y, a3z = _accel(v3x, v3y, v3z, wx, wy, wz, k, cd, cl, wind, ssw, ssw_scale)
        v4x, v4y, v4z = vx + dt * a3x, vy + dt * a3y, vz + dt * a3z
        a4x, a4y, a4z = _accel(v4x, v4y, v4z, wx, wy, wz, k, cd, cl, wind, ssw, ssw_scale)
        x += h6 * (vx + 2 * v2x + 2 * v3x + v4x)
        y += h6 * (vy + 2 * v2y + 2 * v3y + v4y)
        z += h6 * (vz + 2 * v2z + 2 * v3z + v4z)
        vx += h6 * (a1x + 2 * a2x + 2 * a3x + a4x)
        vy += h6 * (a1y + 2 * a2y + 2 * a3y + a4y)
        vz += h6 * (a1z + 2 * a2z + 2 * a3z + a4z)
        wx *= decay; wy *= decay; wz *= decay
        t += dt
        T.append(t); X.append(x); Y.append(y); Z.append(z); VX.append(vx); VY.append(vy); VZ.append(vz); W.append((wx, wy, wz))
        if stop_y is not None and y <= stop_y:
            break
        if stop_ground and z <= 0.0 and t > min_t:
            break
        if stop is not None and stop(t, x, y, z):
            break
    tr = Trajectory.from_arrays(np.array(T), np.column_stack([X, Y, Z]), np.column_stack([VX, VY, VZ]),
                                np.array(W), None if initial.ssw is None else np.asarray(initial.ssw, float))
    return tr
