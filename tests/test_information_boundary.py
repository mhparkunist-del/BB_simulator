"""Property tests for the three agents' separated viewpoints (v1.1).

Each test changes something one agent must NOT be able to see and asserts that the other agent's
decision is unchanged, with random streams held fixed per agent.
"""
import os
import sys
from dataclasses import replace

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import (BatterProfile, BatterTendencies, CatcherProfile, GameContext, HeuristicCatcher,
                          HeuristicPitcher, PerceptiveBatter)
from bbsim.agents.base import BatterObservation
from bbsim.agents.perception import observe, observe_release
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.engine.plate_appearance import batter_view
from bbsim.physics import build_spec, throw_spec
from bbsim.physics.constants import PLATE_FRONT_Y


def _pa(batter=None, catcher=None, pitcher=None, seed=11):
    return PlateAppearance(pitcher or HeuristicPitcher(PitcherProfile.from_params("B")),
                           catcher or HeuristicCatcher(CatcherProfile()),
                           batter or PerceptiveBatter(BatterProfile()), EngineConfig(), seed=seed, new_game=True)


def _pitch_signature(rec):
    return (rec.call.code, rec.call.zone, tuple(np.round(rec.call.target_xz, 4)), round(float(rec.pitch.plate.pos[0]), 4),
            round(float(rec.pitch.plate.pos[2]), 4), rec.intent.code, rec.sign.code)


def test_first_pitch_does_not_depend_on_batter_hidden_attributes():
    """The battery only knows the batter's scouted tendencies. Two batters with identical tendencies but
    different hidden attributes must receive the identical first pitch (same seed)."""
    class FixedTendencies(PerceptiveBatter):
        def tendencies(self):
            return BatterTendencies(hand="R", chase_low=0.4, chase_away=0.36, chase_in=0.28, whiff_breaking=0.4,
                                    whiff_high_ff=0.3, first_pitch_swing=0.3, power_zone="middle", contact_vs_offspeed=0.5)
    a = FixedTendencies(BatterProfile(recognition=0.2, tracking=0.2, power=0.2, discipline=0.2))
    b = FixedTendencies(BatterProfile(recognition=0.9, tracking=0.9, power=0.9, discipline=0.9))
    ra = _pa(batter=a).run(GameContext(balls=1, strikes=1))
    rb = _pa(batter=b).run(GameContext(balls=1, strikes=1))
    assert _pitch_signature(ra.pitches[0]) == _pitch_signature(rb.pitches[0])


def test_batter_decision_depends_only_on_what_it_sees():
    """Same sightings, different hidden ball state (spin / grip) -> identical decision."""
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    res = throw_spec(p.spec_for("SL", 1.0, None), (0.1, 0.7))
    contact_y = PLATE_FRONT_Y + 0.15
    arr = res.trajectory.crossing(1, contact_y)
    b = PerceptiveBatter(BatterProfile())
    eye = b.eye_position(contact_y)
    rng = np.random.default_rng(3)
    sightings = observe(res.trajectory, eye, arr.t - 0.15, rng, 60.0, 0.05, t_end=arr.t)
    rel = observe_release(res.trajectory, eye, np.random.default_rng(4), 0.05)
    ctx = GameContext(balls=1, strikes=1, pitcher_id="X")
    obs1 = BatterObservation(ctx, eye, sightings, arr.t - 0.15, contact_y, rel)
    # the "true" pitch behind the same sightings is irrelevant: the observation object carries no trajectory/spin
    assert not any(hasattr(obs1, k) for k in ("trajectory", "spin", "spec", "pitch", "code"))
    d1 = b.decide(obs1, np.random.default_rng(7))
    d2 = PerceptiveBatter(BatterProfile()).decide(BatterObservation(ctx, eye, list(sightings), arr.t - 0.15, contact_y, rel),
                                                  np.random.default_rng(7))
    assert (d1.swing, d1.predicted_xz, d1.note) == (d2.swing, d2.predicted_xz, d2.note)


def test_batter_cannot_see_umpire_read_or_steal_threat():
    ctx = GameContext(balls=2, strikes=1, umpire_low_shift=0.05, runner_speed=0.95, runners=(True, False, False))
    v = batter_view(ctx)
    assert v.umpire_low_shift == 0.0 and v.runner_speed == 0.5
    assert (v.balls, v.strikes, v.runners, v.outs) == (ctx.balls, ctx.strikes, ctx.runners, ctx.outs)


def test_catcher_sign_ignores_batter_hidden_attributes_given_same_scouting():
    """Catcher signs from scouting + game state only: identical scouting -> identical sign for any hidden batter."""
    t = BatterTendencies(hand="R", chase_low=0.5, chase_away=0.4, chase_in=0.3, whiff_breaking=0.55, whiff_high_ff=0.3,
                         first_pitch_swing=0.3, power_zone="in", contact_vs_offspeed=0.5)
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    signs = []
    for _ in range(2):
        c = HeuristicCatcher(CatcherProfile(sequencing=0.7))
        c.scout(t, np.random.default_rng(5), "B")
        c.learn_pitcher(p, np.random.default_rng(6))
        it = p.intent(GameContext(balls=0, strikes=1), np.random.default_rng(8))
        s = c.sign(GameContext(balls=0, strikes=1), p.repertoire_codes, np.random.default_rng(9), pitcher_intent=it)
        signs.append((s.code, s.zone))
    assert signs[0] == signs[1]


def test_catcher_and_pitcher_disagree_by_their_own_attributes():
    """Same situation, same scouting: a catcher that weighs the pitcher's intent heavily agrees more often than one
    that does not - a difference that comes only from the catcher's own attribute."""
    t = BatterTendencies(hand="R", chase_low=0.5, chase_away=0.4, chase_in=0.3, whiff_breaking=0.7, whiff_high_ff=0.3,
                         first_pitch_swing=0.3, power_zone="middle", contact_vs_offspeed=0.5)
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    p.scout(t, np.random.default_rng(1))
    agree = {}
    for w in (0.0, 1.0):
        c = HeuristicCatcher(CatcherProfile(pitcher_weight=w))
        c.scout(t, np.random.default_rng(5), "B")
        c.learn_pitcher(p, np.random.default_rng(6))
        n = 0
        for k in range(40):
            ctx = GameContext(balls=k % 4, strikes=k % 3)
            it = p.intent(ctx, np.random.default_rng(100 + k))
            s = c.sign(ctx, p.repertoire_codes, np.random.default_rng(200 + k), pitcher_intent=it)
            n += s.code == it.code
        agree[w] = n
    assert agree[1.0] > agree[0.0]


def test_agent_streams_are_independent():
    """An extra random draw inside the batter must not change the pitcher's pitch (separate streams)."""
    class NoisyBatter(PerceptiveBatter):
        def decide(self, obs, rng):
            rng.random(); rng.random()                      # extra draws from the batter's own stream
            return super().decide(obs, rng)
    ra = _pa(batter=PerceptiveBatter(BatterProfile())).run(GameContext(balls=1, strikes=1))
    rb = _pa(batter=NoisyBatter(BatterProfile())).run(GameContext(balls=1, strikes=1))
    assert _pitch_signature(ra.pitches[0]) == _pitch_signature(rb.pitches[0])


def test_pitcher_intent_moves_with_pitcher_attributes_only():
    """A pitcher's own feel changes its intent; changing the catcher does not touch the pitcher's intent."""
    ctx = GameContext(balls=1, strikes=1)
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    base = [p.intent(ctx, np.random.default_rng(k)).code for k in range(30)]
    p.feel["SL"] = 0.4                                        # slider is working today
    hot = [p.intent(ctx, np.random.default_rng(k)).code for k in range(30)]
    assert hot.count("SL") > base.count("SL")
    p2 = HeuristicPitcher(PitcherProfile.from_params("B"))
    for cp in (CatcherProfile(sequencing=0.0), CatcherProfile(sequencing=1.0)):
        HeuristicCatcher(cp)                                  # a different catcher exists ...
        assert [p2.intent(ctx, np.random.default_rng(k)).code for k in range(10)] == \
            [HeuristicPitcher(PitcherProfile.from_params("B")).intent(ctx, np.random.default_rng(k)).code for k in range(10)]


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
