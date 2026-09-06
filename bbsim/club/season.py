"""Club object and the weekly season loop (frame). Game results come from bbsim.engine (HalfInning / future Game)."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .contracts import Contract
from .development import DevelopmentPlan
from .lineup import Lineup
from .morale import Morale
from .rules import KBO_RULES, LeagueRules


@dataclass
class ClubPolicy:
    mode: str = "contend"            # contend | rebuild
    risk: float = 0.5                # 0..1 willingness to trade prospects / sign long contracts
    youth_first: bool = False


@dataclass
class Club:
    name: str
    cards: Dict[str, object] = field(default_factory=dict)          # player_id -> PlayerCard
    contracts: Dict[str, Contract] = field(default_factory=dict)
    morale: Dict[str, Morale] = field(default_factory=dict)
    lineup: Lineup = field(default_factory=Lineup)
    development: DevelopmentPlan = field(default_factory=DevelopmentPlan)
    policy: ClubPolicy = field(default_factory=ClubPolicy)
    budget: float = 0.0
    staff: Optional[object] = None                                  # bbsim.game.coaching.Staff
    rules: LeagueRules = KBO_RULES
    record: Dict[str, int] = field(default_factory=lambda: {"W": 0, "L": 0})

    def payroll(self) -> float:
        return sum(c.salary for c in self.contracts.values())

    def clubhouse(self) -> float:
        return sum(m.overall() for m in self.morale.values()) / max(len(self.morale), 1)


class SeasonLoop:
    """week: games -> injuries/results -> morale -> training -> market window -> events. Bodies TODO."""

    def __init__(self, clubs: List[Club], rules: LeagueRules = KBO_RULES, weeks: int = 26):
        self.clubs, self.rules, self.weeks = clubs, rules, weeks
        self.week = 0
        self.log: List[dict] = []

    def play_week(self, rng) -> List[dict]:
        events = []
        # TODO 1: schedule + engine games (bbsim.engine.inning.HalfInning x 9 x 2 per game)
        # TODO 2: injuries from load (coaching.Staff), results -> record
        for club in self.clubs:
            wp = club.record["W"] / max(club.record["W"] + club.record["L"], 1)
            ch = club.clubhouse()
            for pid, m in club.morale.items():
                played = pid in club.lineup.batting_order or pid in club.lineup.rotation
                m.update_week(played, wp, 1.0, True, ch)
                if m.wants_transfer():
                    events.append({"week": self.week, "club": club.name, "player": pid, "event": "transfer_request"})
        # TODO 3: training week through DevelopmentPlan.weekly
        # TODO 4: market window (FreeAgentMarket / TradeProposal) if rules.transfer_window_weeks covers self.week
        self.week += 1
        self.log += events
        return events

    def end_season(self, rng) -> List[dict]:
        events = []
        for club in self.clubs:
            for pid, c in club.contracts.items():
                ev = c.advance_season(self.rules)
                if ev:
                    events.append({"club": club.name, "player": pid, "event": ev})
        # TODO: retirement_probability per player, draft, FA market
        return events
