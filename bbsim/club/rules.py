"""League rule constants (KBO default, MLB preset). Numbers are the public rules as of 2026; verify before use."""
from dataclasses import dataclass


@dataclass(frozen=True)
class LeagueRules:
    name: str
    roster_max: int                 # active roster
    reserve_max: int                # 보류선수 / 40-man
    foreign_max: int
    fa_service_seasons: int         # seasons registered before free agency
    salary_cap: float               # currency units (0 = none)
    draft_rounds: int
    trade_deadline_week: int        # week of season
    transfer_window_weeks: tuple    # (start, end) weeks when signings allowed
    waiver: bool


KBO_RULES = LeagueRules("KBO", roster_max=28, reserve_max=65, foreign_max=3, fa_service_seasons=8, salary_cap=11_426_000_000,
                        draft_rounds=11, trade_deadline_week=18, transfer_window_weeks=(0, 18), waiver=False)
MLB_RULES = LeagueRules("MLB", roster_max=26, reserve_max=40, foreign_max=99, fa_service_seasons=6, salary_cap=0.0,
                        draft_rounds=20, trade_deadline_week=18, transfer_window_weeks=(0, 18), waiver=True)
