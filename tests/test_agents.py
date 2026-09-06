"""Agent-boundary and engine tests."""
import dataclasses
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bbsim.agents import (BatterObservation, BatterProfile, GameContext, HeuristicBatter,
                          HeuristicCatcher, HeuristicPitcher, PitcherProfile)
from bbsim.engine import PlateAppearance


def test_batter_observation_carries_no_ground_truth():
    names = {f.name for f in dataclasses.fields(BatterObservation)}
    forbidden = {"spin", "pitch_type", "trajectory", "velocity", "release_speed"}
    assert not (names & forbidden), names


def test_plate_appearance_is_deterministic():
    def run(seed):
        pa = PlateAppearance(HeuristicPitcher(), HeuristicCatcher(), HeuristicBatter(), seed=seed)
        return pa.run().outcome, len(pa.run().pitches)
    a = PlateAppearance(HeuristicPitcher(), HeuristicCatcher(), HeuristicBatter(), seed=7).run()
    b = PlateAppearance(HeuristicPitcher(), HeuristicCatcher(), HeuristicBatter(), seed=7).run()
    assert a.outcome == b.outcome and len(a.pitches) == len(b.pitches)


def test_outcome_distribution_not_degenerate():
    counts = Counter()
    for seed in range(120):
        pa = PlateAppearance(HeuristicPitcher(), HeuristicCatcher(), HeuristicBatter(), seed=seed)
        counts[pa.run().outcome] += 1
    assert counts["strikeout"] > 0
    assert counts["walk"] > 0
    assert sum(v for k, v in counts.items() if k in ("out", "single", "double", "triple", "HR")) > 0
    assert "unresolved" not in counts, counts


def test_better_recognition_whiffs_less():
    def whiff_rate(rec):
        swings = misses = 0
        from bbsim.agents import PerceptiveBatter
        b = PerceptiveBatter(BatterProfile(recognition=rec, tracking=rec))
        pitcher = HeuristicPitcher()
        for seed in range(120):
            pa = PlateAppearance(pitcher, HeuristicCatcher(), b, seed=seed, new_game=(seed == 0))
            for p in pa.run().pitches:
                if p.decision.swing:
                    swings += 1
                    misses += p.result == "swinging_strike"
        return misses / max(swings, 1)
    assert whiff_rate(0.9) < whiff_rate(0.2)


if __name__ == "__main__":
    import inspect
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and inspect.isfunction(fn):
            try:
                fn()
                print("PASS", name)
            except AssertionError as e:
                fails += 1
                print("FAIL", name, e)
    sys.exit(1 if fails else 0)
