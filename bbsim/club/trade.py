"""Player value and trade evaluation (OOTP-style): value = present + potential x age curve - salary burden."""
from dataclasses import dataclass, field
from typing import List, Optional


def age_factor(age: int) -> float:
    if age <= 23:
        return 1.35
    if age <= 27:
        return 1.15
    if age <= 30:
        return 1.0
    if age <= 33:
        return 0.75
    return 0.45


def player_value(card, contract=None, policy=None) -> float:
    """0..100-ish. present = mean of skills; potential = talent x youth. TODO: position scarcity, injuries."""
    skills = [v for v in card.skills.values() if isinstance(v, (int, float))]
    present = 100.0 * (sum(skills) / len(skills) if skills else 0.5)
    talent = card.talent if hasattr(card, "talent") else {}
    tal = [v for v in talent.values() if isinstance(v, (int, float))]
    potential = 100.0 * (sum(tal) / len(tal) if tal else 0.5)
    age = card.fixed.get("age", 27) if hasattr(card, "fixed") else 27
    w_pot = 0.6 if (policy and policy.mode == "rebuild") else 0.35
    v = (1 - w_pot) * present + w_pot * potential * (age_factor(age) - 0.5)
    if contract is not None:
        v -= 0.15 * max(0.0, contract.salary / 1e8 - present / 10.0)      # salary burden above production (TODO units)
    return float(v)


@dataclass
class TradeProposal:
    from_club: str
    to_club: str
    give: List[str]            # player ids leaving from_club
    receive: List[str]
    note: str = ""


def evaluate_trade(proposal: TradeProposal, values: dict, tolerance: float = 3.0, policy=None) -> dict:
    """Return the receiving club's decision from precomputed values {player_id: value}."""
    gain = sum(values.get(p, 0.0) for p in proposal.give)
    loss = sum(values.get(p, 0.0) for p in proposal.receive)
    gap = gain - loss
    return {"accept": gap >= -tolerance, "value_gap": gap, "reason": "가치 차 %.1f (허용 %.1f)" % (gap, tolerance)}
