"""Player card: the game-layer attribute schema (docs/PLAYER_ATTRIBUTES.md).

Layers
    fixed   A  skeleton/genetics, never change (0..1 normalised or SI)
    semi    B  ranges of motion, mass: move slowly
    form    C0 delivery geometry (deg, fraction of height)
    skills  C  trainable 0..100
    state   D  daily condition
    talent  T  per-domain learning speed / potential / retention / game sense / stability (0..1)

`derive_pitch_traits` implements the v0.5 output chain: velocity, spin
(BU x velocity x grip x wrist x grip-force saturation), command sigma.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional

import numpy as np

DOMAINS = ("pitching", "batting", "fielding", "running", "stamina", "mental")

PITCH_SKILLS = ("leg_power", "core_rotation", "wrist_speed", "grip_force", "repeatability", "grip_skill")
BAT_SKILLS = ("tracking", "discipline", "boldness", "guess_hitting", "bat_speed", "barrel_placement", "timing",
              "swing_quickness", "path_control", "barrel_accuracy", "power", "spray_control", "bunt_skill",
              "split_vs_L", "split_vs_R")
FIELD_SKILLS = ("first_step", "sprint", "route", "ball_reading", "glove", "arm_strength", "arm_accuracy", "transfer", "positioning")
SKILLS = PITCH_SKILLS + BAT_SKILLS + FIELD_SKILLS + ("stamina", "focus", "mental", "guts", "composure", "reaction", "game_sense")
SKILL_DOMAIN: Dict[str, str] = {}
SKILL_DOMAIN.update({k: "pitching" for k in PITCH_SKILLS})
SKILL_DOMAIN.update({k: "batting" for k in BAT_SKILLS})
SKILL_DOMAIN.update({k: "fielding" for k in FIELD_SKILLS})
SKILL_DOMAIN.update({"stamina": "stamina", "focus": "mental", "mental": "mental", "guts": "mental",
                     "composure": "mental", "reaction": "running", "game_sense": "batting"})


@dataclass
class Talent:
    learn: float = 0.5        # learning speed
    potential: float = 0.5    # ceiling (0..1 -> skill ceiling 50..100)
    retain: float = 0.5       # resistance to decay
    sense: float = 0.5        # gain from real games / in-game awakening
    stability: float = 0.5    # low day-to-day swing

    def ceiling(self) -> float:
        return 50.0 + 50.0 * self.potential


@dataclass
class PlayerCard:
    name: str
    age: int = 24
    hand: str = "R"
    fixed: Dict[str, float] = field(default_factory=lambda: {
        "height": 1.85, "finger_len": 0.5, "hand_size": 0.5, "fast_twitch": 0.5,
        "shoulder_er_cap": 0.5, "vision_base": 0.5})
    semi: Dict[str, float] = field(default_factory=lambda: {
        "mass": 90.0, "shoulder_er_rom": 0.5, "wrist_rom": 0.5, "hip_rom": 0.5,
        "tendon_stiffness": 0.5})
    form: Dict[str, float] = field(default_factory=lambda: {
        "abd": 92.0, "tilt": 30.0, "lean": 30.0, "stride": 0.84, "fwd": 35.0})
    skills: Dict[str, float] = field(default_factory=lambda: {k: 50.0 for k in SKILLS})
    state: Dict[str, float] = field(default_factory=lambda: {
        "condition": 0.8, "fatigue": 0.1, "pain": 0.0, "confidence": 0.6})
    talent: Dict[str, Talent] = field(default_factory=lambda: {d: Talent() for d in DOMAINS})
    injury_risk: float = 0.0
    history: list = field(default_factory=list)

    # ---- ceilings -------------------------------------------------------
    def skill_ceiling(self, skill: str) -> float:
        t = self.talent[SKILL_DOMAIN[skill]]
        return min(100.0, t.ceiling() * self.age_multiplier(skill))

    def age_multiplier(self, skill: str) -> float:
        """Age curve on the ceiling: power peaks ~27, technique keeps rising to ~32."""
        a = self.age
        if skill in ("leg_power", "core_rotation", "wrist_speed", "grip_force", "stamina", "bat_speed", "power",
                     "reaction", "swing_quickness"):
            if a <= 27:
                return 0.92 + 0.08 * max(0.0, a - 18) / 9
            return max(0.7, 1.0 - 0.012 * (a - 27))
        if a <= 32:
            return 0.90 + 0.10 * min(1.0, max(0.0, a - 18) / 14)
        return max(0.75, 1.0 - 0.01 * (a - 32))

    # ---- capacity --------------------------------------------------------
    def weekly_capacity(self) -> float:
        """Training load units the body can absorb this week (true value)."""
        base = 6.0 + 6.0 * self.skills["stamina"] / 100.0
        age_pen = 0.0 if self.age < 30 else 0.12 * (self.age - 30)
        return max(2.0, base - age_pen - 4.0 * self.state["fatigue"] - 3.0 * self.state["pain"])

    # ---- derived physical traits ----------------------------------------
    def derive_pitch_traits(self) -> Dict[str, float]:
        s, f, st = self.skills, self.fixed, self.state
        ceiling_mph = 84.0 + 16.0 * f["fast_twitch"]
        chain = (0.5 * s["leg_power"] + 0.3 * s["core_rotation"] + 20.0 * self.semi["shoulder_er_rom"]) / 100.0
        mph = ceiling_mph * (0.80 + 0.20 * chain) * self.age_multiplier("leg_power")
        mph *= (1.0 - 0.04 * st["fatigue"]) * (0.98 + 0.03 * st["condition"])
        bu = 20.0 + 8.0 * (0.6 * s["wrist_speed"] / 100.0 + 0.4 * f["finger_len"])
        needed = 35.0 + 0.8 * (mph - 85.0)                 # grip pressure needed to avoid slip
        f_force = min(1.0, s["grip_force"] / max(needed, 1.0))
        f_grip = 0.85 + 0.15 * s["grip_skill"] / 100.0
        rpm = bu * mph * f_grip * f_force
        sigma = 0.30 - 0.14 * s["repeatability"] / 100.0
        sigma *= (1.0 + 0.5 * st["fatigue"]) * (1.15 - 0.15 * s["focus"] / 100.0)
        return {"mph": mph, "rpm": rpm, "bauer": rpm / mph, "sigma_m": sigma,
                "f_force": f_force, "ceiling_mph": ceiling_mph}

    def derive_field_traits(self) -> Dict[str, float]:
        """Card -> FielderProfile inputs (0..1). sprint blends the fixed fast_twitch with the trained sprint skill."""
        sk, f, st = self.skills, self.fixed, self.state
        g = lambda k: sk.get(k, 50.0) / 100.0
        return {"first_step": g("first_step"), "route": g("route"), "ball_reading": g("ball_reading"), "glove": g("glove"),
                "arm_strength": g("arm_strength"), "arm_accuracy": g("arm_accuracy"), "transfer": g("transfer"),
                "positioning": g("positioning"), "sprint_speed": float(0.5 * g("sprint") + 0.5 * f.get("fast_twitch", 0.5)),
                "wingspan": float(f.get("hand_size", 0.5)), "composure": g("composure"), "focus": g("focus"),
                "game_sense": g("game_sense"), "stamina": g("stamina")}

    def derive_bat_traits(self) -> Dict[str, float]:
        """Batter card -> physical/judgment parameters (0..1 skills, bat speed in m/s)."""
        s, f = self.skills, self.fixed
        bat_speed = 25.0 + 12.0 * (0.6 * s["bat_speed"] / 100.0 + 0.4 * f["fast_twitch"])      # 25..37 m/s
        zone_top, zone_bot = 0.565 * f["height"], 0.27 * f["height"]
        d = {k: s[k] / 100.0 for k in BAT_SKILLS if k in s}
        d["bat_speed_skill"] = d.pop("bat_speed", 0.5)
        return {"bat_speed": bat_speed * (1.0 - 0.04 * self.state["fatigue"]), "zone_top": zone_top, "zone_bottom": zone_bot,
                **d,
                "composure": s["composure"] / 100.0, "reaction": s["reaction"] / 100.0, "game_sense": s["game_sense"] / 100.0,
                "stamina": s["stamina"] / 100.0, "focus": s["focus"] / 100.0,
                "recognition": float(np.clip(0.3 + 0.5 * s["tracking"] / 100.0 + 0.2 * f["vision_base"], 0, 1)),
                "release_read": float(np.clip(0.2 + 0.6 * s["tracking"] / 100.0, 0, 1))}

    def snapshot(self) -> Dict[str, float]:
        d = dict(self.skills)
        d.update({"fatigue": self.state["fatigue"], "condition": self.state["condition"],
                  "injury_risk": self.injury_risk})
        d.update(self.derive_pitch_traits())
        return d


def make_prospect(name: str, rng: np.random.Generator, age: int = 22,
                  quality: float = 0.5) -> PlayerCard:
    """Random prospect around a quality level (0 weak .. 1 elite)."""
    p = PlayerCard(name, age=age)
    q = float(np.clip(quality, 0, 1))
    p.fixed.update({k: float(np.clip(rng.normal(q, 0.15), 0.05, 0.95))
                    for k in ("finger_len", "hand_size", "fast_twitch", "shoulder_er_cap", "vision_base")})
    p.semi.update({k: float(np.clip(rng.normal(q, 0.15), 0.1, 0.95))
                   for k in ("shoulder_er_rom", "wrist_rom", "hip_rom")})
    p.skills = {k: float(np.clip(rng.normal(30 + 40 * q, 8), 15, 90)) for k in SKILLS}
    p.talent = {d: Talent(*[float(np.clip(rng.normal(q, 0.2), 0.05, 0.98)) for _ in range(5)])
                for d in DOMAINS}
    return p
