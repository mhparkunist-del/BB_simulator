"""Free agency and transfers: club offer -> selling club accepts -> player accepts (FM three-step)."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class TransferOffer:
    player_id: str
    from_club: str
    to_club: str
    fee: float
    salary: float
    years: int
    playing_time_promise: float = 0.5      # 0..1 expected share of games
    status: str = "proposed"               # proposed | club_accepted | player_accepted | rejected


@dataclass
class FreeAgentMarket:
    league_price: float = 1.0
    listed: Dict[str, float] = field(default_factory=dict)      # player_id -> asking salary
    offers: List[TransferOffer] = field(default_factory=list)

    def club_decides(self, offer: TransferOffer, value: float, policy=None) -> bool:
        """Selling club: fee vs value. TODO: policy, roster need, window check."""
        ok = offer.fee >= 0.9 * value * self.league_price
        offer.status = "club_accepted" if ok else "rejected"
        return ok

    def player_decides(self, offer: TransferOffer, morale, current_salary: float, team_strength: float) -> bool:
        """Player: salary, playing time, team prospects weighted by personality. TODO: distance/loyalty to city."""
        p = morale.personality
        score = 0.4 * min(1.5, offer.salary / max(current_salary, 1.0)) + 0.3 * offer.playing_time_promise * (0.7 + 0.6 * p.ambition) \
            + 0.3 * team_strength * (0.7 + 0.6 * p.ambition) - 0.3 * p.loyalty * (1.0 - float(morale.wants_transfer()))
        ok = score > 0.75
        offer.status = "player_accepted" if ok else "rejected"
        return ok
