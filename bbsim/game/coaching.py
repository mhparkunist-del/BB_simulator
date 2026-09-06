"""Coaching staff system (docs/COACHING.md).

A coach is an *agent with imperfect perception*: it sees the player's
skills through noise set by its diagnosis attribute, estimates the
player's weekly load capacity through noise set by its load-management
attribute, and its teaching attribute scales what the player actually
gains. Nothing here touches physics directly; it moves the player card,
which `player.derive_pitch_traits` turns into mph / rpm / sigma.

Weekly loop (Staff.run_week):
    1. diagnose   : each coach ranks the player's problems in its domain
    2. plan       : head coach fills the week with sessions on the top
                    problems up to the *estimated* capacity
    3. execute    : gains (teaching x talent x compliance x headroom),
                    fatigue, injury risk, decay of untrained skills
    4. observe    : hidden-talent estimate intervals narrow with observation
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from .player import DOMAINS, SKILLS, SKILL_DOMAIN, PlayerCard
from .training import BASE_GAIN, CATALOG, TrainingAxis

ROLES = ("head", "pitching", "batting", "fielding", "conditioning", "mental", "medical")


@dataclass
class Coach:
    name: str
    role: str
    diagnosis: float = 50.0        # sees true weaknesses (0..100)
    teaching: float = 50.0         # gain multiplier in own domain
    load_mgmt: float = 50.0        # judges how much a player can absorb
    communication: float = 50.0    # player compliance / morale
    observation: float = 50.0      # narrows hidden-talent estimates
    style: Dict[str, float] = field(default_factory=dict)   # skill -> bias on flagged gaps (+ favours)

    def perceive(self, player: PlayerCard, rng: np.random.Generator) -> Dict[str, float]:
        sig = 25.0 * (1.0 - self.diagnosis / 100.0)
        return {k: float(np.clip(v + rng.normal(0, sig), 0, 100)) for k, v in player.skills.items()}

    def domain_skills(self) -> List[str]:
        if self.role == "head":
            return list(SKILLS)
        dom = {"pitching": "pitching", "conditioning": "stamina", "mental": "mental",
               "medical": None, "batting": "batting", "fielding": "fielding"}[self.role]
        skills = [s for s in SKILLS if SKILL_DOMAIN[s] == dom]
        if self.role == "conditioning":
            skills += ["leg_power", "core_rotation", "bat_speed", "power", "reaction"]
        return skills


@dataclass
class Diagnosis:
    coach: str
    ranked: List[Tuple[str, float]]        # (skill, perceived gap) high -> low
    true_ranked: List[Tuple[str, float]]
    top1_hit: bool
    rank_error: float                       # mean |rank_perceived - rank_true|


@dataclass
class WeekReport:
    week: int
    sessions: List[str]
    planned_load: float
    capacity_true: float
    capacity_est: float
    gains: Dict[str, float]
    fatigue: float
    injury_risk: float
    injured: bool
    diagnoses: List[Diagnosis]
    talent_interval: Dict[str, Tuple[float, float]]


IMPORTANCE = {"leg_power": 1.0, "core_rotation": 0.9, "wrist_speed": 0.8, "grip_force": 0.5,
              "repeatability": 1.1, "grip_skill": 0.7, "stamina": 0.8, "focus": 0.7,
              "mental": 0.7, "guts": 0.5}


def diagnose(coach: Coach, player: PlayerCard, rng: np.random.Generator) -> Diagnosis:
    seen = coach.perceive(player, rng)
    skills = coach.domain_skills()
    if not skills:
        return Diagnosis(coach.name, [], [], True, 0.0)

    def gaps(vals):
        g = []
        for s in skills:
            gap = (player.skill_ceiling(s) - vals[s]) * IMPORTANCE.get(s, 0.7)
            g.append((s, gap))
        return sorted(g, key=lambda x: -x[1])
    perceived = [(s, gap * (1.0 + coach.style.get(s, 0.0))) for s, gap in gaps(seen)]
    perceived.sort(key=lambda x: -x[1])
    true = gaps(player.skills)
    tr = {s: i for i, (s, _) in enumerate(true)}
    err = float(np.mean([abs(i - tr[s]) for i, (s, _) in enumerate(perceived)]))
    return Diagnosis(coach.name, perceived, true, perceived[0][0] == true[0][0], err)


@dataclass
class Staff:
    coaches: List[Coach]
    rng: np.random.Generator = field(default_factory=lambda: np.random.default_rng(0))
    talent_est: Dict[str, Tuple[float, float]] = field(default_factory=dict)

    # ---- lookup ---------------------------------------------------------
    def by_role(self, role: str) -> Optional[Coach]:
        for c in self.coaches:
            if c.role == role:
                return c
        return None

    def head(self) -> Coach:
        return self.by_role("head") or max(self.coaches, key=lambda c: c.diagnosis)

    def teacher_for(self, axis: TrainingAxis) -> Tuple[Optional[Coach], float]:
        c = self.by_role(axis.domain)
        if c is None:
            return None, 0.5                       # nobody specialised: half effect
        return c, 0.6 + 0.8 * c.teaching / 100.0

    # ---- planning -------------------------------------------------------
    def estimate_capacity(self, player: PlayerCard) -> float:
        c = self.by_role("conditioning") or self.by_role("medical") or self.head()
        true = player.weekly_capacity()
        noise = 0.35 * (1.0 - c.load_mgmt / 100.0)
        bias = 0.10 * (1.0 - c.load_mgmt / 100.0)  # weak coaches push a little too hard
        return max(1.0, true * (1.0 + bias + self.rng.normal(0, noise)))

    def plan_week(self, player: PlayerCard) -> Tuple[List[TrainingAxis], float, List[Diagnosis]]:
        diags = [diagnose(c, player, self.rng) for c in self.coaches if c.domain_skills()]
        head = self.head()
        head_diag = diagnose(head, player, self.rng)
        # merge: head's ranking, specialists sharpen their own domain
        score: Dict[str, float] = {s: g for s, g in head_diag.ranked}
        for d in diags:
            for s, g in d.ranked:
                score[s] = 0.5 * score.get(s, g) + 0.5 * g
        ordered = sorted(score.items(), key=lambda x: -x[1])
        cap = self.estimate_capacity(player)
        sessions: List[TrainingAxis] = []
        load = 0.0
        for s, _ in ordered:
            for ax in CATALOG.values():
                if s in ax.primary and load + ax.load <= cap + 1e-9:
                    sessions.append(ax)
                    load += ax.load
                    break
            if load >= cap - 0.5:
                break
        return sessions, cap, [head_diag] + diags

    # ---- execution ------------------------------------------------------
    def run_week(self, player: PlayerCard, week: int) -> WeekReport:
        sessions, cap_est, diags = self.plan_week(player)
        cap_true = player.weekly_capacity()
        load = sum(a.load for a in sessions)
        overload = max(0.0, load / cap_true - 1.0)
        comm = self.head().communication
        compliance = 0.7 + 0.3 * (0.5 * comm / 100.0 + 0.5 * player.skills["mental"] / 100.0)
        gains: Dict[str, float] = {s: 0.0 for s in SKILLS}
        trained = set()
        fatigue_pen = 1.0 - 0.7 * max(0.0, player.state["fatigue"] - 0.4) / 0.6
        for ax in sessions:
            coach, mult = self.teacher_for(ax)
            for skill, w in ax.primary.items():
                t = player.talent[SKILL_DOMAIN[skill]]
                ceil = player.skill_ceiling(skill)
                headroom = max(0.0, (ceil - player.skills[skill]) / max(ceil, 1.0))
                g = BASE_GAIN * w * mult * (0.5 + 1.0 * t.learn) * compliance * (headroom ** 0.5) * fatigue_pen
                gains[skill] += g
                trained.add(skill)
            if ax.key == "shoulder_rom":
                player.semi["shoulder_er_rom"] = min(0.98, player.semi["shoulder_er_rom"] + 0.01 * mult)
            player.injury_risk += ax.injury_factor * (0.3 + 3.0 * overload) * player.state["fatigue"] ** 2
        # decay of skills not stimulated this week
        for s in SKILLS:
            if s not in trained:
                r = player.talent[SKILL_DOMAIN[s]].retain
                gains[s] -= 0.25 * (1.0 - r)
        for s, g in gains.items():
            player.skills[s] = float(np.clip(player.skills[s] + g, 0.0, player.skill_ceiling(s)))
        # fatigue dynamics
        rec = 0.55 + 0.25 * player.skills["stamina"] / 100.0
        player.state["fatigue"] = float(np.clip(player.state["fatigue"] * (1 - rec) + 0.30 * (load / cap_true) ** 2, 0, 1))
        player.injury_risk = float(np.clip(player.injury_risk * 0.85 + 0.08 * overload
                                           + 0.02 * max(0.0, player.state["fatigue"] - 0.6), 0, 1))
        injured = bool(self.rng.random() < 0.25 * player.injury_risk)
        if injured:
            player.state["pain"] = 0.6
            player.semi["shoulder_er_rom"] = max(0.1, player.semi["shoulder_er_rom"] - 0.05)
            player.skills["repeatability"] -= 3.0
        else:
            player.state["pain"] = max(0.0, player.state["pain"] - 0.2)
        # hidden-talent observation
        obs = max(c.observation for c in self.coaches)
        for d in DOMAINS:
            lo, hi = self.talent_est.get(d, (0.0, 1.0))
            true = player.talent[d].learn
            shrink = 1.0 - 0.08 * obs / 100.0
            width = (hi - lo) * shrink
            centre = 0.5 * (lo + hi) + 0.3 * (true - 0.5 * (lo + hi))
            self.talent_est[d] = (max(0.0, centre - width / 2), min(1.0, centre + width / 2))
        rep = WeekReport(week, [a.key for a in sessions], load, cap_true, cap_est, gains,
                         player.state["fatigue"], player.injury_risk, injured, diags, dict(self.talent_est))
        player.history.append(player.snapshot())
        return rep


# ---------------------------------------------------------------- presets
def elite_staff(seed: int = 0) -> Staff:
    return Staff([
        Coach("감독 A", "head", 80, 60, 75, 85, 70),
        Coach("투수코치 A", "pitching", 85, 85, 70, 75, 80, style={"repeatability": 0.1}),
        Coach("체력코치 A", "conditioning", 75, 80, 90, 65, 50),
        Coach("멘탈코치 A", "mental", 70, 75, 60, 90, 75),
        Coach("트레이너 A", "medical", 70, 60, 90, 70, 60),
    ], np.random.default_rng(seed))


def weak_staff(seed: int = 0) -> Staff:
    return Staff([
        Coach("감독 B", "head", 40, 45, 35, 50, 40, style={"leg_power": 0.5}),
        Coach("투수코치 B", "pitching", 40, 50, 40, 45, 35, style={"wrist_speed": 0.4}),
        Coach("체력코치 B", "conditioning", 35, 45, 30, 40, 30),
    ], np.random.default_rng(seed))
