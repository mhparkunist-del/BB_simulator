"""Satisfaction (만족도) with five axes and a personality that weights them (FM / The Show style)."""
from dataclasses import dataclass, field
from typing import Dict


@dataclass
class Personality:
    ambition: float = 0.5        # 야망: playing time & team success matter more
    loyalty: float = 0.5         # 충성: relationships matter more, transfer requests rarer
    professionalism: float = 0.5 # 프로의식: trains through low morale, retires later


@dataclass
class Morale:
    playing_time: float = 0.6
    team_success: float = 0.6
    salary_fairness: float = 0.6
    relationships: float = 0.6
    role_fit: float = 0.6
    personality: Personality = field(default_factory=Personality)

    def weights(self) -> Dict[str, float]:
        p = self.personality
        return {"playing_time": 0.8 + 0.6 * p.ambition, "team_success": 0.6 + 0.6 * p.ambition, "salary_fairness": 1.0,
                "relationships": 0.6 + 0.8 * p.loyalty, "role_fit": 0.8}

    def overall(self) -> float:
        w = self.weights()
        tot = sum(w.values())
        return sum(w[k] * getattr(self, k) for k in w) / tot

    def training_multiplier(self) -> float:
        """Low morale hurts training efficiency unless the player is a professional. TODO calibrate."""
        m = self.overall()
        return 1.0 - (0.6 - 0.4 * self.personality.professionalism) * max(0.0, 0.5 - m)

    def wants_transfer(self) -> bool:
        return self.overall() < 0.35 - 0.15 * self.personality.loyalty

    def update_week(self, played: bool, team_win_pct: float, salary_ratio: float, role_ok: bool, clubhouse: float) -> None:
        """One week of evidence. clubhouse = average morale of the squad (contagion, FM). TODO: event hooks."""
        def step(cur, target, k=0.15):
            return cur + k * (target - cur)
        self.playing_time = step(self.playing_time, 1.0 if played else 0.2)
        self.team_success = step(self.team_success, team_win_pct)
        self.salary_fairness = step(self.salary_fairness, min(1.0, salary_ratio))
        self.role_fit = step(self.role_fit, 1.0 if role_ok else 0.3)
        self.relationships = step(self.relationships, clubhouse, 0.08)
