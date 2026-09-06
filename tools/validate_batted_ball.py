"""Batted-ball model validation (v1.0): exit velocity / launch angle / spin / distance as functions of
bat speed, contact offset, pitch speed, pitch spin and bat effective mass, against published relations.

References (checked values):
  Nathan 2003/2015: EV = q*v_pitch + (1+q)*v_bat, q ~ 0.2 at the sweet spot (wood, 70 mph bat)
  Nathan: launch angle rises ~10-12 deg per cm of undercut; backspin of a well-hit fly ~2000-3000 rpm
  Statcast: 100 mph / 28 deg -> ~120 m (395 ft); 95 mph / 25 deg -> ~105 m
Usage: python3 tools/validate_batted_ball.py  -> prints markdown tables (paste into docs/BATTED_BALL.md)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.engine.outcome import fly
from bbsim.physics.ball import BallState
from bbsim.physics.bat import BatSpec
from bbsim.physics.collision import BatContact, bat_frame, collide
from bbsim.physics.constants import MPH_TO_MS, MS_TO_MPH, RPM_TO_RADS


def hit(bat_mph, off_v_cm, pitch_mph=90, pitch_rpm=2200, m_eff=0.66, off_a_cm=0.0, attack=8.0):
    ball_v = np.array([0.0, -pitch_mph * MPH_TO_MS * 0.92, -2.0])       # ~8 % lost to drag by the plate
    spin = np.array([-pitch_rpm * RPM_TO_RADS, 0.0, 0.0])                  # backspin fastball
    bv, ba = bat_frame("R", 0.0, attack, bat_mph * MPH_TO_MS)
    c = collide(ball_v, spin, BatContact(bv, ba, off_v_cm / 100.0, off_a_cm / 100.0), BatSpec(mass=0.879, m_eff_sweet=m_eff), None)
    return c


def main():
    print("## A. EV vs bat speed (sweet spot, centred, pitch 90 mph) — Nathan: EV ~ 0.2 v_pitch + 1.2 v_bat")
    print("| bat mph | EV model | EV Nathan | q model |")
    print("|---|---|---|---|")
    for b in (60, 65, 70, 75, 80):
        c = hit(b, 0.0)
        ev = c.exit_speed * MS_TO_MPH
        q = (ev - b) / (b + 90 * 0.92)          # solve EV = q v_p + (1+q) v_b
        print("| %d | %.1f | %.1f | %.2f |" % (b, ev, 0.2 * 90 * 0.92 + 1.2 * b, q))
    print("\n## B. Launch angle & spin vs vertical offset (bat 70 mph) — Nathan: ~10-12 deg/cm, fly-ball backspin 2000-3000 rpm")
    print("| offset cm (ball above bat centre) | EV | LA | spin rpm | distance m |")
    print("|---|---|---|---|---|")
    for off in (-2, -1, 0, 1, 2, 3, 4):
        c = hit(70, off)
        if not c.hit:
            print("| %d | miss | | | |" % off); continue
        bb = fly(BallState(0.0, np.array([0.0, -0.3, 0.9]), c.vel_out, c.spin_out, np.zeros(3)))
        print("| %+d | %.0f | %+.0f | %.0f | %.0f |" % (off, c.exit_speed * MS_TO_MPH, c.launch_angle, c.spin_rpm, bb.landing_distance))
    print("\n## C. Pitch speed & spin (bat 70 mph, +1.5 cm) — faster pitch adds ~0.2 mph EV per mph; incoming backspin adds batted backspin")
    print("| pitch mph | pitch rpm | EV | LA | spin rpm |")
    print("|---|---|---|---|---|")
    for pm, pr in ((80, 1800), (90, 2200), (98, 2500), (90, 1200), (90, 2800)):
        c = hit(70, 1.5, pm, pr)
        print("| %d | %d | %.1f | %+.0f | %.0f |" % (pm, pr, c.exit_speed * MS_TO_MPH, c.launch_angle, c.spin_rpm))
    print("\n## D. Effective mass (힘/배트) and end-of-bat contact (bat 70 mph, +1.5 cm)")
    print("| m_eff kg | axial offset cm | EV | note |")
    print("|---|---|---|---|")
    for me, ax in ((0.55, 0), (0.66, 0), (0.75, 0), (0.66, 8), (0.66, 15)):
        c = hit(70, 1.5, m_eff=me, off_a_cm=ax)
        print("| %.2f | %d | %.1f | %s |" % (me, ax, c.exit_speed * MS_TO_MPH, c.reason))
    print("\n## E. Distance check (Statcast: 100 mph/28 deg ~ 120 m, 95/25 ~ 105 m)")
    print("| EV mph | LA deg | backspin rpm | distance m |")
    print("|---|---|---|---|")
    for ev, la, rpm in ((100, 28, 2200), (95, 25, 2000), (105, 30, 2500), (90, 15, 1500)):
        v = ev * MPH_TO_MS
        vel = np.array([0.0, v * np.cos(np.radians(la)), v * np.sin(np.radians(la))])
        bb = fly(BallState(0.0, np.array([0.0, -0.3, 0.9]), vel, np.array([rpm * RPM_TO_RADS, 0.0, 0.0]), np.zeros(3)))
        print("| %d | %d | %d | %.0f |" % (ev, la, rpm, bb.landing_distance))


if __name__ == "__main__":
    main()
