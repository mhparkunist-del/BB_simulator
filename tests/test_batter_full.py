"""Full batter attribute set (v0.5.0): mechanics, power, zone map, guess, stamina, feel, bunt, card mapping."""
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import (BatterProfile, GameContext, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter,
                          PitcherMemory, judge)
from bbsim.agents.perception import observe, observe_release
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.game import make_prospect
from bbsim.physics import BatContact, bat_frame, collide, throw_spec
from bbsim.physics.constants import MS_TO_MPH, PLATE_FRONT_Y

CONTACT_Y = PLATE_FRONT_Y + 0.15


def _pa_stats(profile, n=80, ctx_fn=None):
    b = PerceptiveBatter(profile)
    out = Counter(); swings = 0; ev = []; notes = Counter(); by_zone = Counter(); by_zone_sw = Counter()
    for seed in range(n):
        pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), b, EngineConfig(),
                             seed=seed, new_game=(seed == 0))
        r = pa.run(ctx_fn(seed) if ctx_fn else None)
        out[r.outcome] += 1
        for rec in r.pitches:
            d = rec.decision; notes[d.note] += 1
            if rec.pitch.plate is not None and pa.zone.contains(rec.pitch.plate.pos):
                hi = rec.pitch.plate.pos[2] > 0.5 * (pa.zone.top + pa.zone.bottom)
                by_zone["high" if hi else "low"] += 1; by_zone_sw["high" if hi else "low"] += d.swing
            if d.swing:
                swings += 1
            if rec.collision and rec.collision.hit:
                ev.append(rec.collision.exit_speed * MS_TO_MPH)
    return out, swings, ev, notes, by_zone, by_zone_sw, b


def test_mechanics_skills_map_to_execution_and_commit():
    lo, hi = BatterProfile(timing=0.0, barrel_placement=0.0, swing_quickness=0.0), BatterProfile(timing=1.0, barrel_placement=1.0, swing_quickness=1.0)
    e_lo, e_hi = lo.derived_execution(), hi.derived_execution()
    assert e_hi.timing_sigma < e_lo.timing_sigma and e_hi.vertical_sigma < e_lo.vertical_sigma
    assert hi.derived_reaction_time() < lo.derived_reaction_time()
    assert lo.derived_execution(fatigue=1.0).timing_sigma > e_lo.timing_sigma          # fatigue widens
    assert BatterProfile(focus=1.0).derived_execution().timing_sigma < BatterProfile(focus=0.0).derived_execution().timing_sigma


def test_power_raises_exit_velocity_through_bat_speed_not_collision_mass():
    """v0.7 (audit 02 #2): the effective mass at impact is a property of the bat; power lives in bat speed."""
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    ball = throw_spec(p.spec_for("FF"), (0.0, 0.75)).plate
    weak, strong = BatterProfile(power=0.1), BatterProfile(power=0.9)
    assert PerceptiveBatter(weak).bat_spec().m_eff_sweet == PerceptiveBatter(strong).bat_spec().m_eff_sweet
    assert strong.derived_bat_speed() > weak.derived_bat_speed() + 2.0
    v_w, ax = bat_frame("R", 0.0, 8.0, weak.derived_bat_speed())
    v_s, _ = bat_frame("R", 0.0, 8.0, strong.derived_bat_speed())
    spec = PerceptiveBatter(strong).bat_spec()
    ev_w = collide(ball.vel, ball.spin, BatContact(v_w, ax, 0.0, 0.0), spec).exit_speed
    ev_s = collide(ball.vel, ball.spin, BatContact(v_s, ax, 0.0, 0.0), spec).exit_speed
    assert ev_s > ev_w + 1.0


def test_zone_map_changes_swing_rate_by_location():
    high_lover = BatterProfile(zone_map=(1.3, 1.3, 1.3, 1.0, 1.0, 1.0, 0.4, 0.4, 0.4))
    low_lover = BatterProfile(zone_map=(0.4, 0.4, 0.4, 1.0, 1.0, 1.0, 1.3, 1.3, 1.3))
    _, _, _, _, z1, s1, _ = _pa_stats(high_lover, 60)
    _, _, _, _, z2, s2, _ = _pa_stats(low_lover, 60)
    r1 = s1["high"] / max(z1["high"], 1) - s1["low"] / max(z1["low"], 1)
    r2 = s2["high"] / max(z2["high"], 1) - s2["low"] / max(z2["low"], 1)
    assert r1 > r2


def test_guess_hitting_sharpens_prior():
    mem = PitcherMemory()
    ctx = GameContext(balls=3, strikes=0)
    p = HeuristicPitcher(PitcherProfile.from_params("B")); rng = np.random.default_rng(0)
    res = throw_spec(p.spec_for("FF", 1.0, rng), (0.0, 0.75)); arr = res.trajectory.crossing(1, CONTACT_Y)
    eye = np.array([-0.75, CONTACT_Y - 0.3, 1.66])
    early = [s for s in observe(res.trajectory, eye, arr.t, rng, 60, 0.05) if s.t <= arr.t - 0.15]
    j_g = judge(early, ctx, mem, CONTACT_Y, 0.6, guess=1.0)
    j_n = judge(early, ctx, mem, CONTACT_Y, 0.6, guess=0.0)
    assert j_g.prior_fastball > j_n.prior_fastball          # 3-0 lean sharpened toward fastball


def test_feel_and_fatigue_evolve_in_game():
    b = PerceptiveBatter(BatterProfile(game_sense=1.0))
    b.begin_game()
    for _ in range(5):
        b.note_result("swinging_strike")
    assert b.feel < -0.3
    for _ in range(30):
        b.note_result("ball")
    assert b.fatigue() > 0.5


def test_bunt_branch():
    prof = BatterProfile(power=0.1, bunt_skill=0.9)
    _, _, _, notes, _, _, _ = _pa_stats(prof, 40, lambda s: GameContext(runners=(True, False, False), outs=0))
    assert notes["bunt"] > 0


def test_split_changes_recognition_vs_lefty():
    b = PerceptiveBatter(BatterProfile(recognition=0.6, split_vs_L=0.0, split_vs_R=1.0))
    assert b.effective_recognition("L") < 0.6 < b.effective_recognition("R")
    neutral = PerceptiveBatter(BatterProfile(recognition=0.6))
    assert abs(neutral.effective_recognition("L") - 0.6) < 1e-9


def test_card_maps_to_batter_profile_and_plays():
    card = make_prospect("타자", np.random.default_rng(3), age=24, quality=0.7)
    prof = BatterProfile.from_card(card)
    assert 25.0 <= prof.bat_speed <= 37.0
    assert 0.0 <= prof.tracking <= 1.0 and 0.0 <= prof.power <= 1.0
    out, swings, ev, notes, _, _, _ = _pa_stats(prof, 30)
    assert sum(out.values()) == 30 and swings > 0


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
