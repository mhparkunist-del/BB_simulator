"""Contract state machine: rookie -> arbitration -> veteran -> FA (KBO/MLB differ only in the thresholds)."""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class ContractStatus(str, Enum):
    ROOKIE = "rookie"
    ARBITRATION = "arbitration"
    VETERAN = "veteran"
    FREE_AGENT = "FA"
    FOREIGN = "foreign"
    RETIRED = "retired"


@dataclass
class Contract:
    player_id: str
    salary: float
    years_left: int
    status: ContractStatus = ContractStatus.ROOKIE
    service_seasons: int = 0
    options: int = 0                     # remaining minor-league options (MLB) / 2군 배정 자유도
    no_trade: bool = False
    history: List[str] = field(default_factory=list)

    def advance_season(self, rules) -> Optional[str]:
        """End-of-season transition. Returns an event string or None. TODO: arbitration raise model."""
        self.service_seasons += 1
        self.years_left = max(0, self.years_left - 1)
        if self.service_seasons >= rules.fa_service_seasons and self.years_left == 0:
            self.status = ContractStatus.FREE_AGENT
            self.history.append("FA 자격 취득")
            return "free_agent"
        if self.years_left == 0:
            self.status = ContractStatus.ARBITRATION if self.service_seasons < rules.fa_service_seasons else ContractStatus.VETERAN
            self.history.append("재계약 대상")
            return "renewal"
        return None


def fair_salary(value: float, league_price: float, demand: float = 1.0) -> float:
    """Market salary from player value (trade.player_value) x league price level x demand (1 = neutral). TODO calibrate."""
    return max(0.0, value) * league_price * demand
