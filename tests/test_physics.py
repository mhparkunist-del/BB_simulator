"""Physics sanity tests. Run:  python3 -m pytest tests  (or python3 tests/test_physics.py)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bbsim.physics import (AeroModel, BallState, BatContact, BatSpec, CORModel, DEFAULT_REPERTOIRE,
                           bat_frame, collide, constants as C, integrate, throw)
from bbsim.engine.outcome import fly

AERO = AeroModel()


def _no_spin_plate_z(pitch):
    s0 = BallState(0.0, pitch.initial.pos.copy(), pitch.initial.vel.copy(), np.zeros(3))
    tr = integrate(s0, AERO, dt=1e-3, t_max=2.0, stop=lambda s: s.pos[1] <= -0.3)
    return tr.crossing(1, C.PLATE_FRONT_Y).pos


def test_aim_solver_hits_target():
    for code, pt in DEFAULT_REPERTOIRE.items():
        r = throw(pt, "R", (0.1, 0.8), AERO)
        assert r.plate is not None, code
        dx, dz = r.miss_xz
        assert abs(dx) < 0.02 and abs(dz) < 0.02, (code, dx, dz)


def test_backspin_fastball_rises_relative_to_no_spin():
    r = throw(DEFAULT_REPERTOIRE["FF"], "R", (0.0, 0.8), AERO)
    ghost = _no_spin_plate_z(r)
    lift = r.plate.pos[2] - ghost[2]
    assert 0.25 < lift < 0.60, lift            # 10-24 in induced vertical break


def test_curveball_drops_relative_to_no_spin():
    r = throw(DEFAULT_REPERTOIRE["CU"], "R", (0.0, 0.7), AERO)
    ghost = _no_spin_plate_z(r)
    drop = ghost[2] - r.plate.pos[2]
    assert 0.20 < drop < 0.65, drop


def test_slider_moves_glove_side_for_rhp():
    r = throw(DEFAULT_REPERTOIRE["SL"], "R", (0.0, 0.7), AERO)
    ghost = _no_spin_plate_z(r)
    assert r.plate.pos[0] - ghost[0] > 0.05      # toward +x (RHP glove side)


def test_fastball_loses_speed_to_drag():
    r = throw(DEFAULT_REPERTOIRE["FF"], "R", (0.0, 0.8), AERO)
    loss = (r.initial.speed - r.plate.speed) * C.MS_TO_MPH
    assert 6.0 < loss < 12.0, loss


def _fastball_at_plate():
    r = throw(DEFAULT_REPERTOIRE["FF"], "R", (0.0, 0.8), AERO)
    return r.plate


def test_head_on_exit_velocity_in_range():
    ball = _fastball_at_plate()
    v, ax = bat_frame("R", 0.0, 8.0, 32.0)
    res = collide(ball.vel, ball.spin, BatContact(v, ax, 0.0, 0.0))
    assert res.hit
    ev = res.exit_speed * C.MS_TO_MPH
    assert 95 < ev < 112, ev
    assert abs(res.launch_angle - 8.0) < 6.0, res.launch_angle


def test_undercut_gives_backspin_and_loft():
    ball = _fastball_at_plate()
    v, ax = bat_frame("R", 0.0, 8.0, 32.0)
    res = collide(ball.vel, ball.spin, BatContact(v, ax, +0.015, 0.0))
    assert res.hit
    assert res.launch_angle > 15.0, res.launch_angle
    # ball going +y: backspin is +x spin component
    assert res.spin_out[0] > 0, res.spin_out
    assert res.spin_rpm > 1000


def test_topped_ball_goes_down():
    ball = _fastball_at_plate()
    v, ax = bat_frame("R", 0.0, 8.0, 32.0)
    res = collide(ball.vel, ball.spin, BatContact(v, ax, -0.025, 0.0))
    assert res.hit and res.launch_angle < 0.0, res.launch_angle


def test_whiff_when_offset_exceeds_radii():
    ball = _fastball_at_plate()
    v, ax = bat_frame("R", 0.0, 8.0, 32.0)
    res = collide(ball.vel, ball.spin, BatContact(v, ax, 0.08, 0.0))
    assert not res.hit


def test_end_of_bat_is_weaker():
    ball = _fastball_at_plate()
    v, ax = bat_frame("R", 0.0, 8.0, 32.0)
    sweet = collide(ball.vel, ball.spin, BatContact(v, ax, 0.0, 0.0)).exit_speed
    tip = collide(ball.vel, ball.spin, BatContact(v, ax, 0.0, 0.12)).exit_speed
    assert tip < sweet - 3.0


def test_fly_ball_distance_realistic():
    # 100 mph, 28 deg, 1800 rpm backspin, straight away
    v = 100 * C.MPH_TO_MS
    la = np.radians(28)
    vel = np.array([0.0, v * np.cos(la), v * np.sin(la)])
    spin = np.array([1800 * C.RPM_TO_RADS, 0.0, 0.0])
    bb = fly(BallState(0.0, np.array([0.0, 0.5, 0.9]), vel, spin), AERO)
    assert 105 < bb.landing_distance < 130, bb.landing_distance
    assert 4.5 < bb.hang_time < 6.5, bb.hang_time


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
