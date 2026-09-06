"""v0.7: scalar integrator equals the numpy reference and is fast."""
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents.pitcher import HeuristicPitcher, PitcherProfile
from bbsim.physics import throw_spec
from bbsim.physics.ball import AeroModel, BallState, integrate
from bbsim.physics.ball_fast import integrate_fast
from bbsim.physics.constants import PLATE_FRONT_Y


def _s0():
    return BallState(0.0, np.array([-0.5, 16.8, 1.8]), np.array([1.0, -40.0, -1.5]),
                     np.array([-150.0, 30.0, 80.0]), np.array([-0.03, 0.0, 0.02]))


def test_fast_matches_numpy_reference():
    aero = AeroModel()
    a = integrate(_s0(), aero, dt=1e-3, t_max=2.0, stop=lambda s: s.pos[1] <= -0.3)
    b = integrate_fast(_s0(), aero, dt=1e-3, t_max=2.0, stop_y=-0.3)
    ca, cb = a.crossing(1, PLATE_FRONT_Y), b.crossing(1, PLATE_FRONT_Y)
    assert np.linalg.norm(ca.pos - cb.pos) < 1e-4 and abs(ca.t - cb.t) < 1e-5


def test_4ms_step_is_within_0p1mm():
    aero = AeroModel()
    a = integrate_fast(_s0(), aero, dt=1e-3, t_max=2.0, stop_y=-0.3).crossing(1, PLATE_FRONT_Y)
    b = integrate_fast(_s0(), aero, dt=4e-3, t_max=2.0, stop_y=-0.3).crossing(1, PLATE_FRONT_Y)
    assert np.linalg.norm(a.pos - b.pos) < 1e-4


def test_throw_spec_under_5ms():
    p = HeuristicPitcher(PitcherProfile.from_params("B"))
    spec = p.spec_for("FF", 1.0, None)
    throw_spec(spec, (0.0, 0.7))
    t0 = time.time()
    for _ in range(20):
        throw_spec(spec, (0.0, 0.7))
    assert (time.time() - t0) / 20 < 0.005


def test_batted_ball_flight_uses_ground_stop():
    from bbsim.engine.outcome import fly
    c = BallState(0.0, np.array([0.0, -0.3, 0.9]), np.array([5.0, 35.0, 20.0]), np.array([0.0, 0.0, -200.0]), np.zeros(3))
    bb = fly(c)
    assert 60 < bb.landing_distance < 130 and bb.trajectory.final.pos[2] <= 0.01


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
