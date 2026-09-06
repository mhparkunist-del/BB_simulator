"""Session-style game (v1.3): one plate appearance per step so a human can make bench calls in between.

`Game.step(bench_call, shift)` runs one PA with the current state, applies runners/outs/runs, rolls the
inning when three outs are made, and returns the records. The state is plain data so a server can hold
many games. Agents (pitcher, catcher, batters, fielders) keep their own memories across steps.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

import numpy as np

from ..agents.base import BatterAgent, CatcherAgent, GameContext, PitcherAgent
from .inning import apply_outcome
from .plate_appearance import EngineConfig, PlateAppearance, PlateAppearanceResult


@dataclass
class GameState:
    inning: int = 1
    outs: int = 0
    runs: int = 0
    runners: List[bool] = field(default_factory=lambda: [False, False, False])
    batter_index: int = 0
    pa_count: int = 0
    innings_total: int = 3
    over: bool = False
    line: List[int] = field(default_factory=list)       # runs per inning
    box: Dict[str, Dict[str, int]] = field(default_factory=dict)


class Game:
    def __init__(self, pitcher: PitcherAgent, catcher: CatcherAgent, lineup: Sequence[BatterAgent], cfg: EngineConfig = None,
                 seed: int = 0, innings: int = 3, runner_speed: float = 0.5, umpire_low_shift: float = 0.0):
        self.pitcher, self.catcher, self.lineup = pitcher, catcher, list(lineup)
        self.cfg = cfg or EngineConfig()
        self.rng = np.random.default_rng(seed)
        self.state = GameState(innings_total=innings, line=[0])
        self.runner_speed, self.umpire_low_shift = runner_speed, umpire_low_shift
        self.events: List[Dict] = []
        self.results: List[PlateAppearanceResult] = []
        # pre-game: everybody studies the pitcher (same as HalfInning new_game)
        if hasattr(pitcher, "begin_game"):
            pitcher.begin_game(self.rng)
        for b in self.lineup:
            if hasattr(b, "begin_game"):
                b.begin_game()
            if hasattr(b, "scout_pitcher") and hasattr(pitcher, "spec_for"):
                b.scout_pitcher(pitcher, self.rng)
        if hasattr(catcher, "learn_pitcher") and hasattr(pitcher, "spec_for"):
            catcher.learn_pitcher(pitcher, self.rng)

    def current_batter(self) -> BatterAgent:
        return self.lineup[self.state.batter_index % len(self.lineup)]

    def step(self, bench_call: str = "none", shift: str = "none") -> Dict:
        st = self.state
        if st.over:
            return {"over": True}
        batter = self.current_batter()
        # bench call "bunt" travels through fielder_shift (the batter reads ctx.fielder_shift == "bunt"); defensive
        # shift uses the same field for the fielders. A bunt call overrides the shift for this PA.
        ctx = GameContext(outs=st.outs, inning=st.inning, runners=tuple(st.runners), score_diff=st.runs, runner_speed=self.runner_speed,
                          umpire_low_shift=self.umpire_low_shift, pitch_count=getattr(self.pitcher, "pitch_count", 0),
                          fielder_shift=(bench_call if bench_call in ("bunt", "take", "power", "inside", "outside", "infield_in", "outfield_deep") else shift))
        pa = PlateAppearance(self.pitcher, self.catcher, batter, self.cfg, seed=int(self.rng.integers(1 << 31)), new_game=False)
        r = pa.run(ctx)
        self.results.append(r)
        runners = list(st.runners)
        runs_before, outs_before = st.runs, st.outs
        wp_idx = [rec.index for rec in r.pitches if rec.wild_pitch]
        runs = st.runs
        if wp_idx:
            from .inning import _advance_all
            runs += _advance_all(runners, min(len(wp_idx), 3))
        ev: Dict = {"type": "pa", "batter": getattr(batter, "name", "B"), "outcome": r.outcome, "pitches": len(r.pitches),
                    "inning": st.inning, "runners_before": tuple(st.runners), "outs_before": outs_before, "runs_before": runs_before,
                    "wild_pitches": len(wp_idx), "bench_call": bench_call, "shift": shift}
        runners, outs, runs = apply_outcome(runners, st.outs, runs, r, self.rng, ev)
        ev.update({"runners_after": tuple(runners), "outs_after": outs, "runs_after": runs})
        self.events.append(ev)
        bx = st.box.setdefault(ev["batter"], {"PA": 0, "H": 0, "BB": 0, "K": 0, "R": 0})
        bx["PA"] += 1
        bx["H"] += r.outcome in ("single", "double", "triple", "HR", "single_out", "double_out")
        bx["BB"] += r.outcome in ("walk", "hbp")
        bx["K"] += r.outcome == "strikeout"
        st.runners, st.outs, st.runs = runners, outs, runs
        st.line[-1] += runs - runs_before
        st.batter_index += 1
        st.pa_count += 1
        inning_over = outs >= 3
        if inning_over:
            st.inning += 1
            st.outs = 0
            st.runners = [False, False, False]
            if st.inning > st.innings_total:
                st.over = True
            else:
                st.line.append(0)
        return {"result": r, "event": ev, "inning_over": inning_over, "over": st.over}
