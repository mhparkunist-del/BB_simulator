"""Fielding tests (v1.2): attributes move outcomes the way a fan expects, and results stay valid."""
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents.fielder import Fielder, FielderProfile
from bbsim.engine.fielding import DEFAULT_POSITIONS, default_fielders, resolve_fielding
from bbsim.engine.outcome import Park, fly
from bbsim.physics.ball import BallState
from bbsim.physics.constants import MPH_TO_MS, RPM_TO_RADS


def _bb(ev_mph, la, spray, rpm=1800.0):
    v = ev_mph * MPH_TO_MS
    vel = np.array([v * np.cos(np.radians(la)) * np.sin(np.radians(spray)), v * np.cos(np.radians(la)) * np.cos(np.radians(spray)),
                    v * np.sin(np.radians(la))])
    return fly(BallState(0.0, np.array([0.0, -0.3, 0.9]), vel, np.array([rpm * RPM_TO_RADS, 0.0, 0.0]), np.zeros(3)))


def _rate(kind_fn, n=150, level=0.5, **bb_kw):
    park = Park()
    c = Counter()
    for s in range(n):
        rng = np.random.default_rng(s)
        fl = default_fielders(level)
        res, play = resolve_fielding(_bb(**bb_kw), fl, park, rng)
        c[res.kind] += 1
    return kind_fn(c, n)


def test_results_are_valid_kinds():
    park = Park()
    kinds = set()
    for s in range(60):
        rng = np.random.default_rng(s)
        ev, la, sp = 70 + 35 * rng.random(), -10 + 60 * rng.random(), -40 + 80 * rng.random()
        res, play = resolve_fielding(_bb(ev, la, sp), default_fielders(0.5), park, rng)
        kinds.add(res.kind)
        assert res.kind in ("out", "single", "double", "triple", "HR", "foul", "error")
        assert play.kind in ("fly", "line", "ground", "hr", "foul")
    assert {"out", "single"} <= kinds


def test_routine_fly_is_usually_caught_and_gap_shot_falls():
    routine = _rate(lambda c, n: c["out"] / n, ev_mph=88, la=35, spray=5)        # can of corn to CF
    gap = _rate(lambda c, n: c["out"] / n, ev_mph=100, la=15, spray=-12)         # hard liner into the LF-CF gap
    assert routine > 0.85 and gap < 0.75, (routine, gap)


def test_faster_outfield_catches_more():
    slow = _rate(lambda c, n: c["out"] / n, level=0.15, ev_mph=95, la=25, spray=-12)
    fast = _rate(lambda c, n: c["out"] / n, level=0.9, ev_mph=95, la=25, spray=-12)
    assert fast > slow + 0.1, (slow, fast)


def test_ground_ball_to_shortstop_is_an_out_and_arm_matters():
    park = Park()
    def outs(arm):
        n_out = 0
        for s in range(120):
            rng = np.random.default_rng(s)
            fl = default_fielders(0.5)
            for f in fl:
                f.profile.arm_strength = arm
            res, _ = resolve_fielding(_bb(92, 2, -18), fl, park, rng)
            n_out += res.kind == "out"
        return n_out / 120
    assert outs(0.9) > 0.7 and outs(0.9) >= outs(0.1), (outs(0.1), outs(0.9))


def test_error_rate_is_small_but_present():
    park = Park()
    errs = 0
    for s in range(300):
        rng = np.random.default_rng(s)
        res, _ = resolve_fielding(_bb(85 + 15 * (s % 3), 1 + (s % 5), -25 + s % 50), default_fielders(0.5), park, rng)
        errs += res.kind == "error"
    assert 0.005 < errs / 300 < 0.06, errs


def test_nine_fielders_default_positions():
    fl = default_fielders()
    assert [f.profile.position for f in fl] == list(DEFAULT_POSITIONS)
    assert all(f.pos == DEFAULT_POSITIONS[f.profile.position] for f in fl)


if __name__ == "__main__":
    import inspect
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and inspect.isfunction(fn):
            try:
                fn(); print("PASS", name)
            except Exception as e:
                fails += 1; print("FAIL", name, repr(e))
    sys.exit(1 if fails else 0)
