"""Coaching-system tests."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.game import Coach, PlayerCard, Staff, diagnose, elite_staff, make_prospect, weak_staff


def _player(seed=1):
    return make_prospect("P", np.random.default_rng(seed), age=22, quality=0.5)


def test_better_diagnosis_ranks_problems_better():
    rng = np.random.default_rng(0)
    p = _player()
    good = Coach("g", "pitching", diagnosis=95)
    bad = Coach("b", "pitching", diagnosis=10)
    eg = np.mean([diagnose(good, p, rng).rank_error for _ in range(200)])
    eb = np.mean([diagnose(bad, p, rng).rank_error for _ in range(200)])
    assert eg < eb, (eg, eb)


def test_load_manager_estimates_capacity_closer():
    p = _player()
    hi = Staff([Coach("c", "conditioning", load_mgmt=95)], np.random.default_rng(0))
    lo = Staff([Coach("c", "conditioning", load_mgmt=5)], np.random.default_rng(0))
    true = p.weekly_capacity()
    e_hi = np.mean([abs(hi.estimate_capacity(p) - true) for _ in range(300)])
    e_lo = np.mean([abs(lo.estimate_capacity(p) - true) for _ in range(300)])
    assert e_hi < e_lo


def test_elite_staff_develops_player_more():
    def run(staff_fn):
        p = _player(3)
        st = staff_fn(0)
        for w in range(26):
            st.run_week(p, w)
        return p
    a, b = run(elite_staff), run(weak_staff)
    assert sum(a.skills.values()) > sum(b.skills.values())
    assert a.derive_pitch_traits()["mph"] > b.derive_pitch_traits()["mph"]


def test_weak_staff_overloads_more():
    p1, p2 = _player(5), _player(5)
    e, w = elite_staff(1), weak_staff(1)
    over_e = over_w = 0.0
    for wk in range(20):
        r1, r2 = e.run_week(p1, wk), w.run_week(p2, wk)
        over_e += max(0, r1.planned_load - r1.capacity_true)
        over_w += max(0, r2.planned_load - r2.capacity_true)
    assert over_w > over_e


def test_talent_interval_narrows():
    p = _player(7)
    st = elite_staff(2)
    for wk in range(10):
        rep = st.run_week(p, wk)
    lo, hi = rep.talent_interval["pitching"]
    assert hi - lo < 0.6
    assert lo - 0.05 <= p.talent["pitching"].learn <= hi + 0.05


def test_skills_never_exceed_ceiling():
    p = _player(9)
    st = elite_staff(3)
    for wk in range(40):
        st.run_week(p, wk)
    for s, v in p.skills.items():
        assert v <= p.skill_ceiling(s) + 1e-6


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
