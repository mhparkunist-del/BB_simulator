"""Umpire and strike zone."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..physics.constants import BALL_RADIUS, PLATE_HALF_WIDTH


@dataclass
class StrikeZone:
    top: float
    bottom: float
    half_width: float = PLATE_HALF_WIDTH

    @classmethod
    def for_height(cls, height_m: float) -> "StrikeZone":
        return cls(top=0.565 * height_m, bottom=0.27 * height_m)

    def contains(self, pos: np.ndarray) -> bool:
        x, z = float(pos[0]), float(pos[2])
        return (abs(x) <= self.half_width + BALL_RADIUS
                and self.bottom - BALL_RADIUS <= z <= self.top + BALL_RADIUS)

    def edge_distance(self, pos: np.ndarray) -> float:
        """Signed distance outside the zone (negative = inside)."""
        x, z = float(pos[0]), float(pos[2])
        dx = abs(x) - (self.half_width + BALL_RADIUS)
        dz = max(self.bottom - BALL_RADIUS - z, z - (self.top + BALL_RADIUS))
        return max(dx, dz)


@dataclass
class Umpire:
    """Called strikes with an edge coin-flip band, a personal zone shift and catcher framing.

    low_shift > 0 : gives the low strike; high_shift > 0: gives the high strike.
    framing (0..1): a good receiver moves the edge band by up to +-2.5 cm in its favour.
    """
    edge_noise: float = 0.02
    low_shift: float = 0.0
    high_shift: float = 0.0
    wide_shift: float = 0.0

    def call(self, zone: StrikeZone, pos: np.ndarray, rng: np.random.Generator, framing: float = 0.5) -> str:
        x, z = float(pos[0]), float(pos[2])
        dx = abs(x) - (zone.half_width + BALL_RADIUS + self.wide_shift)
        dz = max((zone.bottom - self.low_shift) - BALL_RADIUS - z, z - (zone.top + self.high_shift + BALL_RADIUS))
        d = max(dx, dz) - 0.025 * (framing - 0.5) * 2.0        # framing pulls the ball "into" the zone
        # v0.7: logistic edge band (audit 03): P(strike) = 1 / (1 + exp(d / s)), s = band / 2.2 (2.5 cm -> 10 % / 90 %)
        s = max(self.edge_noise * 1.25 / 2.2, 1e-4)
        p = 1.0 / (1.0 + np.exp(float(np.clip(d / s, -30, 30))))
        return "strike" if rng.random() < p else "ball"
