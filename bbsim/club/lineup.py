"""Batting order and rotation from player cards (auto), overridable by the manager's policy."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence


@dataclass
class Lineup:
    batting_order: List[str] = field(default_factory=list)     # player ids, 9
    rotation: List[str] = field(default_factory=list)          # starting pitchers, 5
    bullpen_roles: Dict[str, str] = field(default_factory=dict)  # id -> closer | setup | long | middle
    platoon: Dict[str, str] = field(default_factory=dict)      # slot -> alternate id vs LHP


def _bat_score(card, vs_hand: str) -> Dict[str, float]:
    t = card.derive_bat_traits()
    split = t.get("split_vs_L" if vs_hand == "L" else "split_vs_R", 0.5)
    onbase = 0.5 * t.get("discipline", 0.5) + 0.3 * t.get("recognition", 0.5) + 0.2 * t.get("tracking", 0.5)
    quality = 0.4 * t.get("power", 0.5) + 0.3 * t.get("barrel_accuracy", 0.5) + 0.3 * (t.get("bat_speed", 31.0) - 27.0) / 10.0
    return {"onbase": onbase * (0.85 + 0.3 * split), "quality": quality * (0.85 + 0.3 * split)}


def auto_batting_order(cards: Sequence, vs_hand: str = "R") -> List[str]:
    """Modern order: best on-base 1-2, best quality 3-4, then mixed. TODO: positions / DH / manager policy."""
    scored = [(c, _bat_score(c, vs_hand)) for c in cards]
    by_ob = sorted(scored, key=lambda x: -x[1]["onbase"])
    order: List = []
    for c, _ in by_ob[:2]:
        order.append(c)
    rest = [c for c, _ in scored if c not in order]
    by_q = sorted(rest, key=lambda c: -_bat_score(c, vs_hand)["quality"])
    order += by_q[:2]
    rest = [c for c in rest if c not in order]
    order += sorted(rest, key=lambda c: -(_bat_score(c, vs_hand)["onbase"] + _bat_score(c, vs_hand)["quality"]))
    return [c.name for c in order[:9]]


def auto_rotation(pitcher_cards: Sequence, n: int = 5) -> List[str]:
    """Rank by derived pitch traits (velocity, command, stamina). TODO: fatigue/recovery scheduling."""
    def score(c):
        t = c.derive_pitch_traits()
        return 0.4 * (t.get("mph", 88) - 80) / 15 + 0.3 * (1 - min(t.get("cmd", 0.2), 0.3) / 0.3) + 0.3 * c.state.get("stamina", 0.5) if hasattr(c, "state") else 0.5
    return [c.name for c in sorted(pitcher_cards, key=lambda c: -score(c))[:n]]
