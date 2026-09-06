"""Bat specification and effective-mass profile.

Effective mass at the impact point is what the ball "feels" in the
collision (Nathan 2003, *Am. J. Phys.* 71, 134). For a 31 oz wood bat the
collision efficiency q ~ 0.2 at the sweet spot, which with e ~ 0.5 implies
M_eff ~ 0.6-0.7 kg there. Away from the sweet spot M_eff drops (tip) or the
handle vibrations soak up energy; both are folded into a single
Lorentzian roll-off here.
"""
from __future__ import annotations

from dataclasses import dataclass

from .constants import BAT_BARREL_RADIUS, BAT_LENGTH, BAT_MASS


@dataclass
class BatSpec:
    length: float = BAT_LENGTH            # m
    mass: float = BAT_MASS                # kg
    barrel_radius: float = BAT_BARREL_RADIUS
    sweet_spot_from_tip: float = 0.15     # m
    m_eff_sweet: float = 0.65             # kg, effective mass at sweet spot
    m_eff_rolloff: float = 0.12           # m, half-width of the sweet region
    mu_friction: float = 0.50             # ball–wood

    def effective_mass(self, d_from_sweet: float) -> float:
        """Effective mass a distance d (m) along the axis from the sweet spot."""
        return self.m_eff_sweet / (1.0 + (d_from_sweet / self.m_eff_rolloff) ** 2)

    def on_barrel(self, d_from_sweet: float) -> bool:
        """True if the impact point lies on the bat (tip .. handle)."""
        tip = self.sweet_spot_from_tip              # +d toward tip
        handle = -(self.length - self.sweet_spot_from_tip)
        return handle <= d_from_sweet <= tip
