"""Throw every pitch type in the default repertoire to one target; report movement.

Usage: python3 examples/run_pitch.py [--out DIR]
Outputs: <out>/pitch_<CODE>.png, <out>/D01_pitch_movement.csv, <out>/pitch_FF.gif
"""
import argparse
import csv
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.physics import AeroModel, BallState, DEFAULT_REPERTOIRE, constants as C, integrate, throw
from bbsim.viz import animate_pitch, plot_pitch

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")          # v1.0.1: never write into report folders by default


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--hand", default="R")
    ap.add_argument("--gif", action="store_true", help="also write pitch_FF.gif (slow)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    aero = AeroModel()
    target = (0.0, 0.75)
    rows = []
    for code, pt in DEFAULT_REPERTOIRE.items():
        r = throw(pt, a.hand, target, aero)
        g0 = BallState(0.0, r.initial.pos.copy(), r.initial.vel.copy(), np.zeros(3))
        ghost = integrate(g0, aero, dt=1e-3, t_max=2.0, stop=lambda s: s.pos[1] <= -0.3)
        gp = ghost.crossing(1, C.PLATE_FRONT_Y).pos
        mv = r.plate.pos - gp
        rows.append({
            "code": code, "name": pt.name,
            "release_mph": round(r.initial.speed * C.MS_TO_MPH, 1),
            "plate_mph": round(r.plate.speed * C.MS_TO_MPH, 1),
            "spin_rpm": pt.spin_rpm, "tilt_deg": pt.tilt_deg, "gyro_frac": pt.gyro_frac,
            "flight_time_s": round(r.plate.t, 3),
            "h_move_in": round(mv[0] * 39.37, 1), "v_move_in": round(mv[2] * 39.37, 1),
            "miss_x_m": round(r.miss_xz[0], 4), "miss_z_m": round(r.miss_xz[1], 4),
        })
        plot_pitch(r, os.path.join(a.out, "pitch_%s.png" % code))
        if a.gif and code == "FF":
            animate_pitch(r, os.path.join(a.out, "pitch_FF.gif"))
    with open(os.path.join(a.out, "D01_pitch_movement.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print("%-4s %-20s %7s %7s %6s %8s %8s" % ("code", "name", "rel", "plate", "rpm", "H(in)", "V(in)"))
    for r in rows:
        print("%-4s %-20s %7.1f %7.1f %6d %+8.1f %+8.1f" % (r["code"], r["name"], r["release_mph"],
                                                         r["plate_mph"], r["spin_rpm"],
                                                         r["h_move_in"], r["v_move_in"]))
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
