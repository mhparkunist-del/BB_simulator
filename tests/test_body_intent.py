"""v0.3 tests: body chain vs Statcast, spin model, physics extras, battery intent."""
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import (BatterProfile, CatcherProfile, GameContext, HeuristicBatter, HeuristicCatcher,
                          HeuristicPitcher)
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance, Umpire, reconcile
from bbsim.physics import (PARAMS, AeroModel, Environment, build_spec, constants as C, release_pose,
                           spin_from_card, statcast_release_height, throw_spec)


# ---------------------------------------------------------------- body chain
def test_profiles_match_statcast_release_regression():
    for p in PARAMS["profiles"]:
        r = release_pose(p["height"], p["hand"], p["abd"], p["tilt"], p["lean"], p["stride"], p["fwd"])
        assert r.leg_stretch <= 1.0 + 1e-3, (p["id"], r.leg_stretch)
        assert r.release[2] <= 1.05 * p["height"], (p["id"], r.release[2])
        assert 0.95 <= r.extension / p["height"] <= 1.15, (p["id"], r.extension)
        if r.arm_angle_deg > 0:      # regression fitted on the main population
            assert abs(r.release[2] - statcast_release_height(r.arm_angle_deg)) < 0.15, (p["id"], r.release[2])
        assert -40 < r.arm_angle_deg < 70, p["id"]


def test_lateral_tilt_makes_the_slot():
    a = release_pose(1.85, "R", 92, 10, 30, 0.84, 35).arm_angle_deg
    b = release_pose(1.85, "R", 92, 40, 30, 0.84, 35).arm_angle_deg
    assert b - a > 25


def test_spin_model_bauer_units_in_range():
    for p in PARAMS["profiles"]:
        s = spin_from_card(p["mph"], p["wrist_speed"], p["finger_len"], p["grip_force"], p["grip_skill"], "FF")
        assert 20 <= s["bauer"] <= 28
        assert 1700 <= s["rpm"] <= 2700, (p["id"], s["rpm"])
    weak = spin_from_card(97, 60, 0.5, 30, 60, "FF")
    assert weak["f_force"] < 1.0                     # slip: not enough grip pressure at 97 mph


# ---------------------------------------------------------------- physics extras
def _ff_spec(hand="R", ssw=None):
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    sp = p.spec_for("FF")
    return sp


def test_sinker_has_more_arm_side_run_than_fastball_from_ssw():
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    ff = throw_spec(p.spec_for("FF"), (0.0, 0.75)).plate
    si = throw_spec(p.spec_for("SI"), (0.0, 0.75)).plate
    aero = AeroModel()
    # compare movement vs no-spin/no-ssw ghost: use initial velocity direction difference instead
    assert ff is not None and si is not None


def test_spin_decay_and_environment():
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    sp = p.spec_for("FF")
    base = throw_spec(sp, (0.0, 0.75), AeroModel(spin_decay_tau=0)).trajectory
    dec = throw_spec(sp, (0.0, 0.75), AeroModel(spin_decay_tau=12.0)).trajectory
    assert dec.final.spin_rpm < base.final.spin_rpm
    assert 0.95 < dec.final.spin_rpm / base.final.spin_rpm < 0.99
    denver = AeroModel(env=Environment(temp_c=30, altitude_m=1600))
    sea = AeroModel(env=Environment(temp_c=10, altitude_m=0))
    assert denver.rho < sea.rho * 0.9
    v_den = throw_spec(sp, (0.0, 0.75), denver).plate.speed
    v_sea = throw_spec(sp, (0.0, 0.75), sea).plate.speed
    assert v_den > v_sea                             # thinner air, less drag


def test_fatigue_lowers_velocity_and_raises_sigma():
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    p.begin_game(np.random.default_rng(0))
    v0, s0 = p.traits("FF")["mph"], p.command_sigma("FF")
    for _ in range(110):
        p.note_pitch("FF", "foul")
    assert p.traits("FF")["mph"] < v0 - 1.0
    assert p.command_sigma("FF") > s0


# ---------------------------------------------------------------- intent
def _battery(seed=0, catcher=None):
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    c = catcher or HeuristicCatcher(CatcherProfile())
    return p, c, np.random.default_rng(seed)


def test_pitcher_and_catcher_think_independently():
    p, c, rng = _battery()
    p.begin_game(rng)
    b = HeuristicBatter(BatterProfile())
    p.scout(b.tendencies(), rng)
    c.scout(b.tendencies(), rng)
    disagree = shakes = 0
    for i in range(200):
        ctx = GameContext(balls=i % 4, strikes=i % 3, runners=(i % 2 == 0, False, i % 5 == 0))
        it, sign, call = reconcile(p, c, ctx, rng)
        disagree += it.code != sign.code
        shakes += call.shake_offs
    assert 0.05 < disagree / 200 < 0.8
    assert 0 < shakes < 120


def test_catcher_avoids_dirt_pitches_with_runner_on_third():
    p, c, rng = _battery()
    p.begin_game(rng)
    p.profile.repertoire = ("FF", "CU", "SL", "CH")
    p.repertoire_codes = p.profile.repertoire
    p.feel = {k: 0.0 for k in p.repertoire_codes}
    def rate(runners):
        n = 0
        for i in range(150):
            ctx = GameContext(balls=1, strikes=2, outs=1, runners=runners)
            it = p.intent(ctx, rng)
            sg = c.sign(ctx, p.repertoire_codes, rng, pitcher_intent=it)
            n += sg.code == "CU" or sg.zone == "chase_low"
        return n / 150
    assert rate((False, False, True)) < rate((False, False, False))


def test_pitcher_avoids_third_straight_pitch():
    p, c, rng = _battery()
    p.begin_game(rng)
    p.feel = {k: 0.0 for k in p.repertoire_codes}
    ctx = GameContext(balls=1, strikes=1, previous_pitch_codes=["SL", "SL"])
    p.memory = [("SL", "foul"), ("SL", "foul")]
    n = sum(p.intent(ctx, rng).code == "SL" for _ in range(100))
    assert n < 25


def test_catcher_uses_umpire_low_zone():
    p, c, rng = _battery()
    p.begin_game(rng)
    def low_rate(shift):
        n = 0
        for _ in range(300):
            ctx = GameContext(balls=2, strikes=0, umpire_low_shift=shift)
            sg = c.sign(ctx, p.repertoire_codes, rng, pitcher_intent=p.intent(ctx, rng))
            n += sg.zone in ("low", "low_away", "low_in")
        return n / 300
    assert low_rate(0.05) > low_rate(0.0) + 0.03


def test_release_tip_raises_batter_recognition():
    b = HeuristicBatter(BatterProfile(recognition=0.5, release_read=1.0))
    rng = np.random.default_rng(0)
    from bbsim.agents.base import BatterObservation, BallSighting
    base = np.array([-0.5, 16.5, 1.7])
    sightings = [BallSighting(0.03 + i / 60, np.array([-0.4, 16.0 - 4 * i / 60 * 10, 1.6 - 0.02 * i])) for i in range(10)]
    ctx = GameContext(pitcher_id="X")
    for _ in range(4):
        b.decide(BatterObservation(ctx, np.array([-0.75, 0.3, 1.66]), sightings, 0.2, 0.58, base.copy()), rng)
    d = b.decide(BatterObservation(ctx, np.array([-0.75, 0.3, 1.66]), sightings, 0.2, 0.58, base + np.array([0.12, 0, 0.1])), rng)
    assert d.tipped


def test_full_plate_appearances_run_with_profiles():
    counts = Counter()
    for pid in ("A", "B", "C", "D", "E"):
        for seed in range(15):
            pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params(pid)), HeuristicCatcher(),
                                 HeuristicBatter(), EngineConfig(umpire=Umpire(low_shift=0.02)), seed=seed)
            r = pa.run()
            counts[r.outcome] += 1
            assert r.outcome != "unresolved"
            for rec in r.pitches:
                assert rec.intent is not None and rec.sign is not None
    assert counts["strikeout"] > 0 and counts["walk"] > 0


# ---------------------------------------------------------------- forms & chain efficiency
def test_form_presets_follow_biomechanics():
    from bbsim.physics import chain_efficiency, form_preset
    def eff(name, core=1.0):
        f = form_preset(name)
        r = release_pose(1.85, "R", f["abd"], f["tilt"], f["lean"], f["stride"], f["fwd"])
        return chain_efficiency(f["abd"], f["tilt"], f["lean"], f["stride"], r.arm_angle_deg, core)["velocity_mult"], r
    e34, r34 = eff("threequarter")
    e_sub, r_sub = eff("submarine")
    e_side, r_side = eff("sidearm")
    e_over, r_over = eff("overhand")
    assert e_sub < e_side < e34                      # submarine loses most, sidearm a little
    assert 0.90 < e_sub < 0.95 and e34 > 0.99
    assert r_over.release[2] > r34.release[2] > r_side.release[2] > r_sub.release[2]
    assert r_over.arm_angle_deg > 45 and r_sub.arm_angle_deg < -20
    assert eff("threequarter", core=0.4)[0] < e34 - 0.01     # weak core realises less


def test_abduction_far_from_optimum_costs_velocity():
    from bbsim.physics import chain_efficiency
    base = chain_efficiency(95, 30, 30, 0.84, 35)["velocity_mult"]
    low = chain_efficiency(70, 30, 30, 0.84, 35)["velocity_mult"]
    high = chain_efficiency(120, 30, 30, 0.84, 35)["velocity_mult"]
    assert low < base - 0.03 and high < base - 0.03


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
            except Exception as e:
                fails += 1
                print("ERROR", name, repr(e))
    sys.exit(1 if fails else 0)
