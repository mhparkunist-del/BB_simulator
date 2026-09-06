"""Club (구단 운영) layer — v1.0 frame only. See docs/TEAM_MANAGEMENT.md.

Modules: rules (league constants), contracts (contract state machine), morale (satisfaction 5 axes),
lineup (batting order / rotation), market (free agency & transfers), trade (trade AI), development
(training focus, farm), retirement, season (weekly loop). Rule bodies marked TODO are placeholders.
"""
from .rules import LeagueRules, KBO_RULES, MLB_RULES
from .contracts import Contract, ContractStatus
from .morale import Morale, Personality
from .lineup import Lineup, auto_batting_order, auto_rotation
from .trade import player_value, TradeProposal, evaluate_trade
from .market import TransferOffer, FreeAgentMarket
from .development import DevelopmentPlan
from .retirement import retirement_probability
from .season import Club, ClubPolicy, SeasonLoop

__all__ = ["LeagueRules", "KBO_RULES", "MLB_RULES", "Contract", "ContractStatus", "Morale", "Personality", "Lineup",
           "auto_batting_order", "auto_rotation", "player_value", "TradeProposal", "evaluate_trade", "TransferOffer",
           "FreeAgentMarket", "DevelopmentPlan", "retirement_probability", "Club", "ClubPolicy", "SeasonLoop"]
