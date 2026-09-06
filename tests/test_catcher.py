"""Catcher system tests (v0.6): tunnelling, batter book, framing, blocking, rapport."""
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import (BatterProfile, CatcherProfile, GameContext, HeuristicCatcher, HeuristicPitcher,
                          PerceptiveBatter)
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance, StrikeZone, Umpire


def _run(catcher, n=80, batter=None, ctx_fn=None):
    b = batter or PerceptiveBatter(BatterProfile())
    out = Counter(); m = Counter(); tunnels = shakes = wild = 0; pitches = 0
    for seed in range(n):
        pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), catcher, b, EngineConfig(),
                             seed=seed, new_game=(seed == 0))
        r = pa.run(ctx_fn(seed) if ctx_fn else None)
        out[r.outcome] += 1
        for rec in r.pitches:
            pitches += 1; m[rec.result] += 1
            tunnels += rec.sign.zone == "tunnel"; shakes += rec.call.shake_offs; wild += rec.wild_pitch
    return out, m, tunnels, shakes, wild, pitches


def test_tunnel_table_is_physical():
    c = HeuristicCatcher(CatcherProfile())
    c.learn_pitcher(HeuristicPitcher(PitcherProfile.from_params("B")))
    ps, es, _ = c.tunnel_table[("FF", "CH")]
    assert ps > 0.4 and es < 0.15                       # same early path, far apart at the plate
    tgt = c.tunnel_target("FF", "CH", (0.0, 0.85))
    assert tgt is not None and tgt[1] < 0.5              # a changeup on the fastball's path ends low


def test_sequencing_catcher_uses_tunnels_and_hurts_the_batter():
    lo, _, t_lo, _, _, n_lo = _run(HeuristicCatcher(CatcherProfile(sequencing=0.0)), 100)
    hi, m_hi, t_hi, _, _, n_hi = _run(HeuristicCatcher(CatcherProfile(sequencing=1.0)), 100)
    assert t_hi > t_lo + 10                              # tunnel signs actually get called
    whiff = lambda m: m["swinging_strike"] / max(sum(m.values()), 1)
    assert whiff(m_hi) >= whiff(_run(HeuristicCatcher(CatcherProfile(sequencing=0.0)), 100)[1]) - 0.02


def test_batter_book_learns_in_game():
    c = HeuristicCatcher(CatcherProfile(observation=0.9))
    b = PerceptiveBatter(BatterProfile(recognition=0.2, discipline=0.2))   # whiffs on breaking, chases
    _run(c, 40, b)
    book = c.books[b.name]
    assert book.seen > 60
    fam, gap = book.weak_family(3.0)
    assert book.whiff_rate("BR", 3.0) > 0.1


def test_framing_steals_edge_strikes():
    zone = StrikeZone.for_height(1.85)
    ump = Umpire()
    edge = np.array([zone.half_width + 0.03, 0.0, 0.8])       # 3 cm off the plate
    rng = np.random.default_rng(0)
    good = np.mean([ump.call(zone, edge, rng, framing=1.0) == "strike" for _ in range(400)])
    bad = np.mean([ump.call(zone, edge, rng, framing=0.0) == "strike" for _ in range(400)])
    assert good > bad + 0.2


def test_blocking_reduces_wild_pitches():
    ctx = lambda s: GameContext(runners=(True, False, True), outs=1)
    _, _, _, _, w_lo, _ = _run(HeuristicCatcher(CatcherProfile(blocking=0.0, game_iq=0.0)), 80, ctx_fn=ctx)
    _, _, _, _, w_hi, _ = _run(HeuristicCatcher(CatcherProfile(blocking=1.0, game_iq=0.0)), 80, ctx_fn=ctx)
    assert w_hi <= w_lo


def test_rapport_reduces_shake_offs():
    _, _, _, s_lo, _, n1 = _run(HeuristicCatcher(CatcherProfile(rapport=0.0)), 80)
    _, _, _, s_hi, _, n2 = _run(HeuristicCatcher(CatcherProfile(rapport=1.0)), 80)
    assert s_hi / n2 < s_lo / n1


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
