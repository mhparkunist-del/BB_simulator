"""v1.10: fair/foul geometry, throw physics (arc / one-hop / relay), ground samples, event consistency."""
import os
import sys
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents.fielder import Fielder, FielderProfile  # noqa: E402
from bbsim.engine.fielding import _throw_seg, default_fielders, foul_boundary, throw_plan  # noqa: E402


def check(name, cond, info=""):
    print(("PASS" if cond else "FAIL"), name, info)
    return cond


def bb_at(land_xy, vel_xy, la=5.0):
    tr = SimpleNamespace(final=SimpleNamespace(pos=np.array([land_xy[0], land_xy[1], 0.0])), vel=np.array([[vel_xy[0], vel_xy[1], 3.0], [vel_xy[0], vel_xy[1], -3.0]]))
    return SimpleNamespace(trajectory=tr, launch_angle=la, hang_time=0.5)


def main():
    ok = True
    # fair / foul: beyond the bases the landing decides
    ok &= check("lands beyond 1B in foul ground -> foul", foul_boundary(bb_at((30.0, 29.0), (0.7, 0.7)))[0])
    ok &= check("lands beyond 1B in fair ground -> fair", not foul_boundary(bb_at((20.0, 30.0), (0.5, 0.8)))[0])
    ok &= check("on the line is fair", not foul_boundary(bb_at((40.0, 40.0), (0.7, 0.7)))[0])
    # short of the bases the roll decides: angle from the y axis 48.6 deg rolls foul before the bag, 40 deg stays fair
    f1, pt1, how1 = foul_boundary(bb_at((3.0, 2.5), (30.0 * np.sin(np.radians(48.6)), 30.0 * np.cos(np.radians(48.6)))))
    f2, pt2, how2 = foul_boundary(bb_at((3.0, 2.5), (30.0 * np.sin(np.radians(40.0)), 30.0 * np.cos(np.radians(40.0)))))
    ok &= check("grounder toward 48.6 deg passes the bag foul", f1 and how1 == "bag", "%s %s" % (pt1, how1))
    ok &= check("grounder toward 40 deg passes the bag fair", (not f2) and how2 == "bag", "%s %s" % (pt2, how2))
    f3, pt3, how3 = foul_boundary(bb_at((1.0, 1.5), (2.0, 1.0)))
    ok &= check("dribbler that stops before the bag is judged where it stops", how3 == "stop", "%s %s foul=%s" % (pt3, how3, f3))
    # throw physics
    T_weak, hop_w, _ = _throw_seg(28.0, (40.0, 86.0), (-19.4, 19.4))
    T_elite, hop_e, _ = _throw_seg(42.0, (40.0, 86.0), (-19.4, 19.4))
    ok &= check("weak arm one-hops an 89 m throw; elite arm throws it on a line", hop_w is not None and hop_e is None, "T %.2f vs %.2f" % (T_weak, T_elite))
    ok &= check("the strong arm arrives first", T_elite < T_weak)
    T35, hop35, _ = _throw_seg(35.0, (0.0, 0.0), (35.0, 0.0))
    ok &= check("35 m infield throw at 35 m/s takes ~1.0 s on a line", hop35 is None and 0.95 < T35 < 1.10, "%.2f" % T35)
    # relay: a weak-armed right fielder throwing to third relays through the infield; an elite arm goes direct
    fs = default_fielders(0.5)
    rf_weak = Fielder(FielderProfile(name="RFw", position="RF", arm_strength=0.0, transfer=0.5), (38.0, 86.0))
    rf_elite = Fielder(FielderProfile(name="RFe", position="RF", arm_strength=1.0, transfer=0.5), (38.0, 86.0))
    others = [f for f in fs if f.profile.position != "RF"]
    pw = throw_plan(rf_weak, (60.0, 80.0), 3, others + [rf_weak], 4.0)
    pe = throw_plan(rf_elite, (60.0, 80.0), 3, others + [rf_elite], 4.0)
    ok &= check("weak arm relays through a cutoff man", pw["relay"] is not None and len(pw["segs"]) == 2, "relay=%s arrive=%.2f" % (pw["relay"] and pw["relay"]["who"], pw["arrive"]))
    ok &= check("elite arm throws direct", pe["relay"] is None and len(pe["segs"]) == 1, "arrive=%.2f" % pe["arrive"])
    ok &= check("relay arrives before the weak direct throw would", pw["arrive"] < 4.0 + _throw_seg(28.0, (60.0, 80.0), (-19.4, 19.4))[0])
    # engine consistency over real plays: throws ordered in time, hops inside the segment, ground samples present
    from bbsim.engine.plate_appearance import EngineConfig, GameContext, PlateAppearance
    from bbsim.engine.rules import Umpire
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
    from serve_game import build_batter, build_catcher, build_pitcher, make_roster
    roster = make_roster(5)
    pitcher = build_pitcher({"profile": roster["pitchers"][1]["profile_id"], "name": "p"})
    n_play, n_foul, n_ground, n_bad, n_hop, n_relay = 0, 0, 0, 0, 0, 0
    for bi in range(6):
        b = build_batter(roster["batters"][bi]["profile"], bi)
        cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=default_fielders(0.5))
        pa = PlateAppearance(pitcher, build_catcher({}), b, cfg, seed=101 + bi, new_game=True)
        pa.run(GameContext())
        for i in range(40):
            rec = pa.pitch_once(GameContext(balls=i % 3, strikes=i % 2, batter_hand=b.hand, pitcher_hand=pitcher.hand,
                                            zone_top=pa.zone.top, zone_bottom=pa.zone.bottom), i)
            pa._batter_learns(rec)
            if rec.result != "in_play" or rec.fielding is None:
                continue
            fp = rec.fielding
            if rec.play.kind == "foul":
                n_foul += 1
                if not fp.ground or fp.foul_point is None:
                    n_bad += 1
                continue
            n_play += 1
            if fp.ground and fp.ground["t"]:
                n_ground += 1
                if any(q[2] < 0 for q in fp.ground["xyz"]):
                    n_bad += 1
            for e in fp.events:
                if e["kind"] == "throw":
                    if e["t1"] < e["t0"]:
                        n_bad += 1
                    if e.get("hop"):
                        n_hop += 1
                        if not (e["t0"] < e["t_hop"] < e["t1"]):
                            n_bad += 1
                    if e.get("relay"):
                        n_relay += 1
    ok &= check("plays consistent: throws ordered, hops inside, ground samples non-negative, fouls carry a call point",
                n_play > 10 and n_bad == 0, "plays=%d fouls=%d ground=%d hops=%d relay_segs=%d bad=%d" % (n_play, n_foul, n_ground, n_hop, n_relay, n_bad))
    print("ALL PASS" if ok else "SOME FAIL")


if __name__ == "__main__":
    main()
