"""Half-inning loop (v1.0): three outs, runners, runs, using PlateAppearance for every matchup.

The base-running model is deliberately simple (no fielder agents yet): advancement probabilities
by hit type / batted-ball shape, double plays on hard ground balls, sacrifice flies, wild pitches.
Everything is recorded as events so a front-end can replay pitch by pitch.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

import numpy as np

from ..agents.base import BatterAgent, CatcherAgent, GameContext, PitcherAgent
from .plate_appearance import EngineConfig, PlateAppearance, PlateAppearanceResult


@dataclass
class HalfInningResult:
    runs: int
    outs: int
    plate_appearances: List[PlateAppearanceResult]
    events: List[Dict]                       # ordered, JSON-friendly summaries (one per PA + runner events)
    runners_end: tuple
    next_batter_index: int
    pitches: int


def _advance_all(runners: List[bool], n: int) -> int:
    """Move every runner n bases; return runs scored."""
    runs = 0
    for _ in range(n):
        if runners[2]:
            runs += 1
        runners[2], runners[1], runners[0] = runners[1], runners[0], False
    return runs


def apply_outcome(runners: List[bool], outs: int, runs: int, r: PlateAppearanceResult, rng, ev: Dict):
    """Advance runners/outs/runs for one plate-appearance result (shared by HalfInning and Game). Returns (runners, outs, runs)."""
    last = r.pitches[-1] if r.pitches else None
    la = last.collision.launch_angle if (last and last.collision and last.collision.hit) else None
    dist = last.batted.landing_distance if (last and last.batted) else 0.0
    o = r.outcome
    if o == "strikeout":
        outs += 1
    elif o in ("walk", "hbp"):
        # force advance
        if runners[0]:
            if runners[1]:
                if runners[2]:
                    runs += 1
                runners[2] = True
            runners[1] = True
        runners[0] = True
    elif o == "out":
        outs += 1
        if la is not None and la < 10 and runners[0] and outs < 3 and rng.random() < 0.40:
            outs += 1                                   # ground-ball double play
            runners[0] = False
            ev["double_play"] = True
        elif la is not None and la >= 25 and dist > 65 and runners[2] and outs < 3:
            runs += 1; runners[2] = False               # sacrifice fly
            ev["sac_fly"] = True
        elif la is not None and la < 10 and outs < 3:
            # ground out: runners usually advance one base
            if runners[2]:
                runs += 1; runners[2] = False
            if runners[1]:
                runners[2], runners[1] = True, False
    elif o in ("single", "error"):
        if o == "error":
            ev["error"] = True
        if runners[2]:
            runs += 1
        r2_scores = runners[1] and rng.random() < 0.60
        runners[2] = (runners[1] and not r2_scores)
        runs += int(r2_scores)
        r1_to_3 = runners[0] and rng.random() < 0.30 and not runners[2]
        runners[2] = runners[2] or r1_to_3
        runners[1] = runners[0] and not r1_to_3
        runners[0] = True
    elif o == "double":
        runs += int(runners[2]) + int(runners[1])
        r1_scores = runners[0] and rng.random() < 0.45
        runs += int(r1_scores)
        runners = [False, True, runners[0] and not r1_scores]
    elif o == "triple":
        runs += sum(runners); runners = [False, False, True]
    elif o == "HR":
        runs += sum(runners) + 1; runners = [False, False, False]
    else:                                               # unresolved (20+ pitches): scored as an out, flagged
        outs += 1
        ev["note"] = "unresolved -> out"
    return runners, outs, runs


class HalfInning:
    """One half-inning: `pitcher`/`catcher` vs a `lineup` of batter agents starting at `batter_index`."""

    def __init__(self, pitcher: PitcherAgent, catcher: CatcherAgent, lineup: Sequence[BatterAgent],
                 cfg: EngineConfig = None, seed: int = 0, inning: int = 1, batter_index: int = 0,
                 new_game: bool = True, score_diff: int = 0, runner_speed: float = 0.5, umpire_low_shift: float = 0.0):
        self.pitcher, self.catcher, self.lineup = pitcher, catcher, list(lineup)
        self.cfg = cfg or EngineConfig()
        self.seed, self.inning, self.batter_index = seed, inning, batter_index
        self.new_game, self.score_diff, self.runner_speed = new_game, score_diff, runner_speed
        self.umpire_low_shift = umpire_low_shift

    def play(self) -> HalfInningResult:
        rng = np.random.default_rng(self.seed + 7919 * self.inning)
        outs, runs = 0, 0
        runners = [False, False, False]
        pas: List[PlateAppearanceResult] = []
        events: List[Dict] = []
        idx = self.batter_index
        n_pitch = 0
        if self.new_game:                                   # v1.0.1: whole lineup studies the pitcher, not just the leadoff man
            if hasattr(self.pitcher, "begin_game"):
                self.pitcher.begin_game(rng)
            for b in self.lineup:
                if hasattr(b, "begin_game"):
                    b.begin_game()
                if hasattr(b, "scout_pitcher") and hasattr(self.pitcher, "spec_for"):
                    b.scout_pitcher(self.pitcher, rng)
            if hasattr(self.catcher, "learn_pitcher") and hasattr(self.pitcher, "spec_for"):
                self.catcher.learn_pitcher(self.pitcher)
        first = False
        while outs < 3:
            batter = self.lineup[idx % len(self.lineup)]
            ctx = GameContext(outs=outs, inning=self.inning, runners=tuple(runners), score_diff=self.score_diff + runs,
                              runner_speed=self.runner_speed, umpire_low_shift=self.umpire_low_shift,
                              pitch_count=getattr(self.pitcher, "pitch_count", 0))
            pa = PlateAppearance(self.pitcher, self.catcher, batter, self.cfg, seed=int(rng.integers(1 << 31)),
                                 new_game=(first and self.new_game))
            first = False
            r = pa.run(ctx)
            pas.append(r)
            n_pitch += len(r.pitches)
            runners_start, outs_start, runs_start = tuple(runners), outs, runs
            # wild pitches during the PA advance everybody one base (applied before the PA result; v1.0.1 keeps
            # runs_before consistent and records them as events with their pitch index)
            wp_idx = [rec.index for rec in r.pitches if rec.wild_pitch]
            if wp_idx:
                scored = _advance_all(runners, min(len(wp_idx), 3))
                runs += scored
                events.append({"type": "wild_pitch", "n": len(wp_idx), "pitch_indices": wp_idx, "runs": scored,
                               "batter": getattr(batter, "name", "B%d" % idx)})
            ev: Dict = {"type": "pa", "batter": getattr(batter, "name", "B%d" % idx), "outcome": r.outcome,
                        "pitches": len(r.pitches), "runners_before": runners_start, "outs_before": outs_start, "runs_before": runs_start,
                        "wild_pitches": len(wp_idx), "runs_from_wild_pitches": runs - runs_start}
            runners, outs, runs = apply_outcome(runners, outs, runs, r, rng, ev)
            ev.update({"runners_after": tuple(runners), "outs_after": outs, "runs_after": runs})
            events.append(ev)
            idx += 1
        return HalfInningResult(runs, outs, pas, events, tuple(runners), idx % len(self.lineup), n_pitch)
