"""Batter attribute tests: tracking (타구판단능력), composure (침착성), reaction (순발력)."""
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import (BatterProfile, GameContext, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter,
                          PitcherMemory, judge, pressure_index, visibility)
from bbsim.agents.perception import observe, observe_release
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.physics import throw_spec
from bbsim.physics.constants import PLATE_FRONT_Y

CONTACT_Y = PLATE_FRONT_Y + 0.15


def _flight(code, seed, sigma=0.05):
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    rng = np.random.default_rng(seed)
    res = throw_spec(p.spec_for(code, 1.0, rng), (0.0, 0.75))
    eye = np.array([-0.75, CONTACT_Y - 0.30, 1.66])
    arr = res.trajectory.crossing(1, CONTACT_Y)
    full = observe(res.trajectory, eye, arr.t, rng, 60.0, sigma)
    rel = observe_release(res.trajectory, eye, rng, sigma)
    return arr, full, rel


def _run(profile, n=120, ctx_fn=None, seed0=0):
    b = PerceptiveBatter(profile)
    res = Counter()
    swings = whiffs = chases = checks = adjusted = 0
    for seed in range(seed0, seed0 + n):
        ctx = ctx_fn(seed) if ctx_fn else GameContext()
        pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), b,
                             EngineConfig(), seed=seed, new_game=(seed == seed0))
        r = pa.run(ctx)
        res[r.outcome] += 1
        for rec in r.pitches:
            d = rec.decision
            if d.swing:
                swings += 1
                whiffs += rec.result == "swinging_strike"
                if rec.pitch.plate is not None and not pa.zone.contains(rec.pitch.plate.pos):
                    chases += 1
            checks += d.checked
            adjusted += d.adjusted
    return res, swings, whiffs, chases, checks, adjusted


def test_visibility_extends_with_tracking():
    assert visibility(0.80, 0.0) < visibility(0.80, 1.0)       # poor tracker loses the ball at ~70 % of the flight
    assert visibility(0.9, 1.0) > visibility(0.9, 0.0)
    assert visibility(0.5, 0.0) == 1.0                          # everybody sees the first half cleanly


def test_tracking_reduces_commit_error():
    mem = PitcherMemory()
    ctx = GameContext(balls=1, strikes=1)
    errs = {}
    for tr, sig in ((0.0, 0.05 * 1.3), (1.0, 0.05 * 0.7)):
        e = []
        for seed in range(12):
            arr, full, rel = _flight("CH", 700 + seed, sig)
            early = [s for s in full if s.t <= arr.t - 0.15]
            j = judge(early, ctx, mem, CONTACT_Y, 0.6, rel, tracking=tr)
            e.append(np.hypot(j.pred_xz[0] - arr.pos[0], j.pred_xz[1] - arr.pos[2]))
        errs[tr] = np.mean(e)
    assert errs[1.0] < errs[0.0], errs


def test_pressure_index_and_composure_prior():
    calm = GameContext()
    hot = GameContext(balls=3, strikes=2, runners=(True, True, False), inning=9, score_diff=-1)
    assert pressure_index(hot) > pressure_index(calm) + 0.4
    mem = PitcherMemory()
    arr, full, rel = _flight("CH", 800)
    early = [s for s in full if s.t <= arr.t - 0.15]
    j_calm = judge(early, hot, mem, CONTACT_Y, 0.6, rel, rng=np.random.default_rng(0), composure=1.0)
    j_panic = judge(early, hot, mem, CONTACT_Y, 0.6, rel, rng=np.random.default_rng(0), composure=0.0)
    assert j_panic.prior_fastball > j_calm.prior_fastball        # panicking hitter expects the fastball


def test_low_composure_chases_more_under_pressure():
    def hot(seed):
        return GameContext(outs=2, runners=(True, False, True), inning=8, score_diff=-1)
    _, sw1, _, ch1, _, _ = _run(BatterProfile(composure=1.0, reaction=0.0), 100, hot)
    _, sw0, _, ch0, _, _ = _run(BatterProfile(composure=0.0, reaction=0.0), 100, hot)
    assert ch0 / max(sw0, 1) > ch1 / max(sw1, 1)


def test_reaction_enables_check_swings_and_adjustments():
    _, sw_hi, wh_hi, _, ck_hi, ad_hi = _run(BatterProfile(reaction=1.0), 100)
    _, sw_lo, wh_lo, _, ck_lo, ad_lo = _run(BatterProfile(reaction=0.0), 100)
    assert ck_hi > ck_lo and ad_hi > ad_lo
    assert wh_hi / max(sw_hi, 1) <= wh_lo / max(sw_lo, 1) + 0.03


def test_boldness_attacks_first_pitch_and_patience_takes_to_learn():
    def fp_rate_and_learning(bold):
        b = PerceptiveBatter(BatterProfile(boldness=bold))
        fp = fps = takes_learn = power = swings = 0
        for seed in range(80):
            pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), b,
                                 EngineConfig(), seed=seed, new_game=(seed == 0))
            r = pa.run()
            for rec in r.pitches:
                d = rec.decision
                if rec.context_before.balls == 0 and rec.context_before.strikes == 0:
                    fp += 1; fps += d.swing
                takes_learn += d.note == "take to learn"
                if d.swing:
                    swings += 1; power += d.note == "power swing"
        return fps / max(fp, 1), takes_learn, power / max(swings, 1)
    fp_b, tl_b, pw_b = fp_rate_and_learning(1.0)
    fp_p, tl_p, pw_p = fp_rate_and_learning(0.0)
    assert fp_b > fp_p + 0.05           # bold hitter swings at the first strike more (80 PA: 0.21 vs 0.14)
    assert tl_p > tl_b                  # patient hitter takes balls off the plate to watch them
    assert pw_b >= pw_p                 # bold hitter swings big more often


def test_attention_speeds_up_memory_update():
    from bbsim.agents.batter_perception import learn_from_flight
    ctx = GameContext(balls=1, strikes=1)
    m1, m2 = PitcherMemory(), PitcherMemory()
    arr, full, rel = _flight("CH", 900)
    learn_from_flight(m1, full, CONTACT_Y, rel, ctx, attention=1.0)
    learn_from_flight(m2, full, CONTACT_Y, rel, ctx, attention=1.8)
    c1 = min(m1.clusters, key=lambda c: c.speed); c2 = min(m2.clusters, key=lambda c: c.speed)
    assert abs(c2.break_z - (-0.05)) >= abs(c1.break_z - (-0.05)) - 1e-9   # moved at least as far from the default


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
