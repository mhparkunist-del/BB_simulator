"""Batter judgment model tests (v0.4)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import (BatterProfile, GameContext, HeuristicBatter, HeuristicCatcher, HeuristicPitcher,
                          PerceptiveBatter, PitcherMemory, judge, learn_from_flight, timeline)
from bbsim.agents.perception import observe, observe_release
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.physics import throw_spec
from bbsim.physics.constants import PLATE_FRONT_Y

CONTACT_Y = PLATE_FRONT_Y + 0.15


def _flight(code, seed=0, target=(0.0, 0.75)):
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    rng = np.random.default_rng(seed)
    res = throw_spec(p.spec_for(code, 1.0, rng), target)
    eye = np.array([-0.75, CONTACT_Y - 0.30, 1.66])
    arr = res.trajectory.crossing(1, CONTACT_Y)
    from bbsim.agents.batter_perception import visibility
    blur = lambda f: 1.0 + 2.0 * (1.0 - visibility(f, 0.5))          # same late blur the engine applies
    full = observe(res.trajectory, eye, arr.t, rng, 60.0, 0.05, blur_fn=blur, t_end=arr.t)
    early = [s for s in full if s.t <= arr.t - 0.15]
    rel = observe_release(res.trajectory, eye, rng, 0.05)
    return res, arr, full, early, rel


def test_memory_learns_pitcher_clusters():
    mem = PitcherMemory()
    ctx = GameContext(pitcher_id="B")
    for seed in range(6):
        for code in ("FF", "CH"):
            _, arr, full, _, rel = _flight(code, seed)
            learn_from_flight(mem, full, CONTACT_Y, rel, ctx)
    assert mem.learned == 12
    fast = max(mem.clusters, key=lambda c: c.speed)
    slow = min(mem.clusters, key=lambda c: c.speed)
    assert fast.speed - slow.speed > 2.0                 # FF vs CH separated by speed
    assert slow.break_z < fast.break_z                   # the slow one drops more


def test_memory_improves_changeup_prediction():
    ctx = GameContext(balls=1, strikes=1, pitcher_id="B")
    errs = {}
    from bbsim.agents.batter_perception import PitchCluster
    # v0.7: the default memory already knows league shapes, so "naive" = a hitter who only expects fastballs
    for name, mem in (("naive", PitcherMemory(clusters=[PitchCluster(41.0, -0.15, 0.23, 1, "four-seam", "FB")])), ("learned", PitcherMemory())):
        if name == "learned":
            for seed in range(8):
                for code in ("FF", "CH"):
                    _, arr, full, _, rel = _flight(code, 100 + seed)
                    learn_from_flight(mem, full, CONTACT_Y, rel, ctx)
        e = []
        for seed in range(10):
            _, arr, full, early, rel = _flight("CH", 200 + seed)
            j = judge(early, ctx, mem, CONTACT_Y, recognition=0.3, release_seen=rel)
            e.append(abs(j.pred_xz[1] - arr.pos[2]))
        errs[name] = float(np.mean(e))
    assert errs["learned"] < errs["naive"], errs


def test_fastball_vs_breaking_from_speed_and_bend():
    mem = PitcherMemory()
    ctx = GameContext(balls=1, strikes=1, pitcher_id="B")
    for seed in range(6):
        for code in ("FF", "SL"):
            _, arr, full, _, rel = _flight(code, seed)
            learn_from_flight(mem, full, CONTACT_Y, rel, ctx)
    fams = {c.family for c in mem.clusters}
    assert fams == {"FB", "BR"}
    p_ff = np.mean([judge(_flight("FF", 300 + s)[3], ctx, mem, CONTACT_Y, 0.5).p_fastball for s in range(8)])
    p_sl = np.mean([judge(_flight("SL", 400 + s)[3], ctx, mem, CONTACT_Y, 0.5).p_fastball for s in range(8)])
    assert p_ff > 0.6 and p_sl < 0.4, (p_ff, p_sl)


def test_count_prior_uses_league_table_and_pitcher_share():
    from bbsim.agents.batter_perception import fastball_prior
    mem = PitcherMemory()
    p30, _ = fastball_prior(GameContext(balls=3, strikes=0), mem)
    p02, _ = fastball_prior(GameContext(balls=0, strikes=2), mem)
    assert p30 > 0.8 and p02 < 0.5
    mem.fb_share, mem.fb_n = 0.2, 30                     # a breaking-ball heavy pitcher
    p00, cues = fastball_prior(GameContext(balls=0, strikes=0), mem)
    assert p00 < 0.45 and any("이 투수" in c for c in cues)


def test_commit_lock_and_trust_learns():
    """v0.7: the eyes track most of the flight (visibility model); what limits late information is the
    swing commit. judge(t_now=...) must ignore later samples, and per-bin trust must learn."""
    from bbsim.agents.batter_perception import visibility, BINS
    assert visibility(0.25) == 1.0 and visibility(0.97, 0.0) < 0.6
    mem = PitcherMemory()
    ctx = GameContext(balls=1, strikes=1, pitcher_id="B")
    before = dict(mem.trust)
    for seed in range(10):
        _, arr, full, _, rel = _flight("SL", 500 + seed)
        learn_from_flight(mem, full, CONTACT_Y, rel, ctx)
    assert any(abs(mem.trust[b] - before[b]) > 0.02 for b in BINS)
    _, arr, full, early, rel = _flight("SL", 600)
    t_lock = early[0].t + 0.5 * (arr.t - early[0].t)
    j = judge(full, ctx, mem, CONTACT_Y, 0.6, rel, t_now=t_lock)
    assert j.t <= t_lock + 1e-9                         # nothing after the lock is used
    assert all(r.frac <= 0.56 for r in j.reads)


def test_uncertainty_shrinks_over_time():
    mem = PitcherMemory()
    ctx = GameContext(pitcher_id="B")
    _, arr, full, _, rel = _flight("SL", 5)
    tl = timeline(full, ctx, mem, CONTACT_Y, 0.6)
    assert len(tl) >= 3
    assert tl[-1].sigma_xz[1] < tl[0].sigma_xz[1]


def test_two_strike_contact_mode_and_learning_in_pa():
    b = PerceptiveBatter(BatterProfile(recognition=0.5))
    notes = set()
    for seed in range(20):
        pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), b,
                             EngineConfig(), seed=seed, new_game=(seed == 0))
        r = pa.run()
        for rec in r.pitches:
            if rec.decision.swing:
                notes.add(rec.decision.note)
    assert "contact swing" in notes and "power swing" in notes
    assert b.memory["B · 쓰리쿼터 표준"].learned > 30


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
