"""Gate 1 (v0.7): induced vertical/horizontal break per profile x grip vs Statcast ranges.

Usage: python3 tools/gate_movement.py
IVB = plate z minus gravity-only z at the same time (inches); HB = plate x minus drag-only x.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents.pitcher import HeuristicPitcher, PitcherProfile
from bbsim.physics import throw_spec
from bbsim.physics.constants import G, MS_TO_MPH, PLATE_FRONT_Y

def gate(code, arm):
    """Statcast 2024: FF IVB ~ 9 + 0.16*arm_angle (16 in at 45 deg, ~10 at sidearm); SI ~ FF-8; CH ~ FF-10."""
    ff = 9.0 + 0.16 * arm
    return {"FF": (ff - 2.5, ff + 2.5), "SI": (ff - 12, ff - 5), "CH": (ff - 13, ff - 6),
            "SL": (-4, 6), "CU": (-0.9 * ff - 5, -0.9 * ff + 6)}[code]
IN = 39.37


def breaks(spec):
    res = throw_spec(spec, (0.0, 0.75))
    tr = res.trajectory
    s0, s1 = tr.states[0], tr.crossing(1, PLATE_FRONT_Y)
    t = s1.t - s0.t
    z_grav = s0.pos[2] + s0.vel[2] * t - 0.5 * G * t * t
    # drag-only reference: scale straight-line by the actual mean deceleration ratio
    x_line = s0.pos[0] + s0.vel[0] / s0.vel[1] * (s1.pos[1] - s0.pos[1])
    return (s1.pos[2] - z_grav) * IN, (s1.pos[0] - x_line) * IN, np.linalg.norm(s0.vel) * MS_TO_MPH, spec.rpm, spec.tilt_axis_deg


def main():
    rng = np.random.default_rng(0)
    ok = True
    print("%-4s %-4s %6s %6s %6s %6s %6s  gate" % ("prof", "grip", "arm", "mph", "rpm", "IVB", "HB"))
    for pid in "ABCDE":
        p = HeuristicPitcher(PitcherProfile.from_params(pid))
        for code in ("FF", "SI", "CH", "SL", "CU"):
            if code not in p.repertoire_codes:
                continue
            spec = p.spec_for(code, 1.0, None)
            ivb, hb, mph, rpm, ax = breaks(spec)
            lo, hi = gate(code, p.pose.arm_angle_deg)
            g = "ok" if lo <= ivb <= hi else "OUT"
            ok &= g == "ok"
            print("%-4s %-4s %6.1f %6.1f %6.0f %6.1f %6.1f  %s" % (pid, code, p.pose.arm_angle_deg, mph, rpm, ivb, hb, g))
    print("GATE", "PASS" if ok else "FAIL")


if __name__ == "__main__":
    main()
