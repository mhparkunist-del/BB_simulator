"""Sweep the bat–ball vertical offset for several bat speeds on a fastball.

Usage: python3 examples/collision_sweep.py [--out DIR]
Outputs: <out>/collision_sweep.png, <out>/D02_collision_sweep.csv,
         <out>/batted_ball_example.png
"""
import argparse
import csv
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.engine.outcome import Park, fly
from bbsim.physics import (AeroModel, BallState, BatContact, DEFAULT_REPERTOIRE, bat_frame, collide,
                           constants as C, throw)
from bbsim.viz import plot_batted_ball, plot_collision_sweep

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    aero = AeroModel()
    ball = throw(DEFAULT_REPERTOIRE["FF"], "R", (0.0, 0.75), aero).plate

    offsets_mm = np.arange(-30, 31, 2.5)
    bat_speeds = [26.0, 30.0, 34.0]
    curves = {}
    rows = []
    for bs in bat_speeds:
        lab = "bat %.0f m/s (%.0f mph)" % (bs, bs * C.MS_TO_MPH)
        ev, la, sp, dist = [], [], [], []
        v, ax = bat_frame("R", 0.0, 8.0, bs)
        for e in offsets_mm:
            res = collide(ball.vel, ball.spin, BatContact(v, ax, e / 1000.0, 0.0))
            if res.hit:
                bb = fly(BallState(0.0, ball.pos.copy(), res.vel_out, res.spin_out), aero)
                ev.append(res.exit_speed * C.MS_TO_MPH)
                la.append(res.launch_angle)
                sp.append(res.spin_rpm)
                dist.append(bb.landing_distance)
            else:
                ev.append(np.nan); la.append(np.nan); sp.append(np.nan); dist.append(np.nan)
            rows.append({"bat_speed_ms": bs, "offset_mm": float(e), "ev_mph": ev[-1],
                         "la_deg": la[-1], "spin_rpm": sp[-1], "distance_m": dist[-1]})
        curves[lab] = {"ev_mph": ev, "la_deg": la, "spin_rpm": sp}
    plot_collision_sweep(list(offsets_mm), curves, os.path.join(a.out, "collision_sweep.png"),
                         title="94 mph four-seam, attack angle 8°, sweet-spot contact")
    with open(os.path.join(a.out, "D02_collision_sweep.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # one example batted ball: 30 m/s bat, 12 mm undercut
    v, ax = bat_frame("R", -10.0, 8.0, 32.0)
    res = collide(ball.vel, ball.spin, BatContact(v, ax, 0.012, 0.0))
    bb = fly(BallState(0.0, ball.pos.copy(), res.vel_out, res.spin_out), aero)
    plot_batted_ball(bb, Park(), os.path.join(a.out, "batted_ball_example.png"))
    print("example: EV %.1f mph LA %.1f deg spin %.0f rpm -> %.1f m" %
          (bb.exit_speed_mph, bb.launch_angle, bb.spin_rpm, bb.landing_distance))
    best = max((r for r in rows if r["distance_m"] == r["distance_m"]), key=lambda r: r["distance_m"])
    print("longest in sweep: bat %.0f m/s, offset %+.1f mm -> %.1f m (EV %.1f, LA %.1f)" %
          (best["bat_speed_ms"], best["offset_mm"], best["distance_m"], best["ev_mph"], best["la_deg"]))
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
