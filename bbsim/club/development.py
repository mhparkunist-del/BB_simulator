"""Development plan: per-player training focus (2 slots), farm assignment, reuse of game/coaching.Staff."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class DevelopmentPlan:
    focus: Dict[str, List[str]] = field(default_factory=dict)      # player_id -> up to 2 training axes (training.CATALOG keys)
    farm: Dict[str, str] = field(default_factory=dict)             # player_id -> "1군" | "2군"
    load_cap: Dict[str, float] = field(default_factory=dict)       # player_id -> weekly load allowed by the staff's load_mgmt

    def set_focus(self, player_id: str, axes: List[str]) -> None:
        self.focus[player_id] = list(axes)[:2]

    def weekly(self, staff, cards, rng) -> List[dict]:
        """Run one training week through the coaching staff (bbsim/game/coaching.py). TODO: farm games -> game_feel."""
        out = []
        for c in cards:
            axes = self.focus.get(c.name)
            out.append(staff.run_week(c, rng, focus=axes) if hasattr(staff, "run_week") else {"player": c.name, "skipped": True})
        return out
