"""Ball flight: gravity + quadratic drag + Magnus lift + seam-shifted wake, RK4.

Model (Nathan 2008, *Am. J. Phys.* 76, 119; Adair, *The Physics of Baseball*):

    a = g + (rho*A/2m) * |v_r| * ( -C_D v_r + C_L (w_hat x v_r) ) + (rho*A/2m) |v_r|^2 c_ssw
    v_r  = v - wind                         air-relative velocity
    S    = r*|w| / |v_r|                    spin parameter
    C_L  = 1.5 S (S < 0.1) ; 0.09 + 0.6 S   Nathan's piecewise fit
    C_D  = 0.35 (constant; hook provided)
    c_ssw  constant coefficient vector attached to the pitch (seam-shifted
           wake, set by the grip; zero for batted balls)
    w(t) = w0 exp(-t / tau)                 spin decay (tau ~ 12 s -> ~3 % per pitch)

Air density from temperature, altitude and humidity (Environment).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, List, Optional

import numpy as np

from .constants import (BALL_AREA, BALL_MASS, BALL_RADIUS, G, RHO_AIR)

Vec3 = np.ndarray


@dataclass
class Environment:
    temp_c: float = 20.0
    altitude_m: float = 0.0
    rel_humidity: float = 0.5
    wind: Vec3 = field(default_factory=lambda: np.zeros(3))     # m/s, world frame

    @property
    def rho(self) -> float:
        p = 101325.0 * np.exp(-self.altitude_m / 8400.0)
        t = self.temp_c + 273.15
        rho_dry = p / (287.05 * t)
        return float(rho_dry * (1.0 - 0.0035 * self.rel_humidity * (t - 273.15) / 20.0))


@dataclass
class BallState:
    """Full ground-truth state of the ball at time t."""
    t: float
    pos: Vec3
    vel: Vec3
    spin: Vec3                       # rad/s, world frame
    ssw: Vec3 = field(default_factory=lambda: np.zeros(3))     # seam-shifted-wake coefficient vector

    @property
    def speed(self) -> float:
        return float(np.linalg.norm(self.vel))

    @property
    def spin_rpm(self) -> float:
        return float(np.linalg.norm(self.spin)) * 60.0 / (2.0 * np.pi)

    def copy(self) -> "BallState":
        return BallState(self.t, self.pos.copy(), self.vel.copy(), self.spin.copy(), self.ssw.copy())


@dataclass
class AeroModel:
    """Aerodynamic coefficient model. Swap the callables to tune."""
    env: Environment = field(default_factory=Environment)
    cd: Callable[[float, float], float] = None      # (speed, S) -> C_D
    cl: Callable[[float], float] = None             # (S) -> C_L
    spin_decay_tau: float = 12.0                    # s; <=0 disables decay
    ssw_scale: float = 1.0

    def __post_init__(self):
        if self.cd is None:
            self.cd = lambda speed, s: 0.35
        if self.cl is None:
            self.cl = nathan_lift_coefficient

    @property
    def rho(self) -> float:
        return self.env.rho


def nathan_lift_coefficient(s: float) -> float:
    if s < 0.1:
        return 1.5 * s
    return 0.09 + 0.6 * s


def acceleration(vel: Vec3, spin: Vec3, aero: AeroModel, ssw: Vec3 = None) -> Vec3:
    v_r = vel - aero.env.wind
    speed = float(np.linalg.norm(v_r))
    a = np.array([0.0, 0.0, -G])
    if speed < 1e-9:
        return a
    k = aero.rho * BALL_AREA / (2.0 * BALL_MASS)
    omega = float(np.linalg.norm(spin))
    s = BALL_RADIUS * omega / speed
    a = a - k * aero.cd(speed, s) * speed * v_r
    if omega > 1e-9:
        w_hat = spin / omega
        a = a + k * aero.cl(s) * speed * np.cross(w_hat, v_r)
    if ssw is not None and aero.ssw_scale != 0.0:
        a = a + k * speed * speed * aero.ssw_scale * ssw
    return a


class Trajectory:
    """Time series of ball states, stored as arrays (v0.7); `states` builds BallState views on demand."""

    def __init__(self, states: List[BallState] = None):
        self._states: Optional[List[BallState]] = list(states) if states is not None else []
        self._t = self._pos = self._vel = self._spin = None
        self._ssw = None

    @classmethod
    def from_arrays(cls, t: np.ndarray, pos: np.ndarray, vel: np.ndarray, spin: np.ndarray, ssw=None) -> "Trajectory":
        tr = cls.__new__(cls)
        tr._states = None
        tr._t, tr._pos, tr._vel, tr._spin = t, pos, vel, spin
        tr._ssw = np.zeros(3) if ssw is None else np.asarray(ssw, float)
        return tr

    # ---- array views ------------------------------------------------------
    def _sync(self) -> None:
        if self._t is None:
            st = self._states or []
            self._t = np.array([s.t for s in st])
            self._pos = np.array([s.pos for s in st]).reshape(-1, 3)
            self._vel = np.array([s.vel for s in st]).reshape(-1, 3)
            self._spin = np.array([s.spin for s in st]).reshape(-1, 3)
            self._ssw = st[0].ssw.copy() if st else np.zeros(3)

    @property
    def states(self) -> List[BallState]:
        if self._states is None:
            self._states = [BallState(float(self._t[i]), self._pos[i].copy(), self._vel[i].copy(), self._spin[i].copy(),
                                      self._ssw.copy()) for i in range(len(self._t))]
        return self._states

    def append(self, s: BallState) -> None:
        self.states.append(s)
        self._t = self._pos = self._vel = self._spin = None

    def __len__(self) -> int:
        return len(self._t) if self._t is not None else len(self._states)

    @property
    def t(self) -> np.ndarray:
        self._sync(); return self._t

    @property
    def pos(self) -> np.ndarray:
        self._sync(); return self._pos

    @property
    def vel(self) -> np.ndarray:
        self._sync(); return self._vel

    @property
    def spin(self) -> np.ndarray:
        self._sync(); return self._spin

    def _state(self, i: int, f: float, t: float) -> BallState:
        p, v, w = self._pos, self._vel, self._spin
        return BallState(t, p[i] + f * (p[i + 1] - p[i]), v[i] + f * (v[i + 1] - v[i]), w[i].copy(), self._ssw.copy())

    def state_at(self, t: float) -> BallState:
        self._sync()
        ts = self._t
        i = int(np.searchsorted(ts, t))
        if i <= 0:
            return self._state(0, 0.0, float(ts[0]))
        if i >= len(ts):
            return self._state(len(ts) - 2, 1.0, float(ts[-1]))
        f = (t - ts[i - 1]) / max(ts[i] - ts[i - 1], 1e-12)
        return self._state(i - 1, float(f), float(t))

    def crossing(self, axis: int, value: float, descending: bool = True) -> Optional[BallState]:
        self._sync()
        p = self._pos[:, axis]
        if descending:
            idx = np.nonzero((p[:-1] >= value) & (p[1:] < value))[0]
        else:
            idx = np.nonzero((p[:-1] <= value) & (p[1:] > value))[0]
        if len(idx) == 0:
            return None
        i = int(idx[0])
        f = (value - p[i]) / (p[i + 1] - p[i])
        return self._state(i, float(f), float(self._t[i] + f * (self._t[i + 1] - self._t[i])))

    @property
    def final(self) -> BallState:
        self._sync()
        return self._state(len(self._t) - 2, 1.0, float(self._t[-1])) if len(self._t) > 1 else self.states[-1]


def integrate(initial: BallState, aero: AeroModel, dt: float = 1e-3,
              t_max: float = 10.0,
              stop: Callable[[BallState], bool] = None) -> Trajectory:
    """RK4 integrate until `stop(state)` is True, ground contact, or t_max."""
    if stop is None:
        stop = lambda s: s.pos[2] <= 0.0
    decay = np.exp(-dt / aero.spin_decay_tau) if aero.spin_decay_tau > 0 else 1.0
    traj = Trajectory([initial.copy()])
    s = initial.copy()
    ssw = initial.ssw

    def deriv(pos, vel, spin):
        return vel, acceleration(vel, spin, aero, ssw)

    while s.t < t_max:
        p, v, w = s.pos, s.vel, s.spin
        k1p, k1v = deriv(p, v, w)
        k2p, k2v = deriv(p + 0.5 * dt * k1p, v + 0.5 * dt * k1v, w)
        k3p, k3v = deriv(p + 0.5 * dt * k2p, v + 0.5 * dt * k2v, w)
        k4p, k4v = deriv(p + dt * k3p, v + dt * k3v, w)
        p_new = p + dt / 6.0 * (k1p + 2 * k2p + 2 * k3p + k4p)
        v_new = v + dt / 6.0 * (k1v + 2 * k2v + 2 * k3v + k4v)
        s = BallState(s.t + dt, p_new, v_new, w * decay, ssw.copy())
        traj.append(s)
        if stop(s):
            break
    return traj
