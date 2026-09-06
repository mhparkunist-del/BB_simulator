"""v1.7 baserunning: sprint model, home-to-first range, event consistency with the play result."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.engine.baserunning import dist_at, runner_event, runner_position, sprint_params, time_for, time_to_base  # noqa: E402


def check(name, cond, info=""):
    print(("PASS" if cond else "FAIL"), name, info)
    return cond


def main():
    ok = True
    # closed-form distance and its inverse agree
    v, tau = sprint_params(0.5)
    t = time_for(26.3, v, tau)
    ok &= check("time_for inverts dist_at", abs(dist_at(t, v, tau) - 26.3) < 1e-3, "t=%.3f" % t)
    # home-to-first in the Statcast range and monotonic in speed
    t0, t5, t1 = time_to_base(0.0, 1), time_to_base(0.5, 1), time_to_base(1.0, 1)
    ok &= check("home-to-first slow/avg/fast = 4.7~5.0 / 4.2~4.4 / 3.8~3.95", 4.7 <= t0 <= 5.0 and 4.2 <= t5 <= 4.4 and 3.8 <= t1 <= 3.95,
                "%.2f %.2f %.2f" % (t0, t5, t1))
    ok &= check("faster runner is never slower", t1 < t5 < t0)
    ok &= check("LHB reaches first ~0.1 s sooner", 0.05 < time_to_base(0.5, 1, "R") - time_to_base(0.5, 1, "L") < 0.2)
    ok &= check("second/third take 3.6~4.4 s more per base (Statcast home-to-second ~8.1 s)", 3.6 < time_to_base(0.5, 2) - t5 < 4.4 and 3.6 < time_to_base(0.5, 3) - time_to_base(0.5, 2) < 4.4,
                "%.2f %.2f" % (time_to_base(0.5, 2), time_to_base(0.5, 3)))
    # runner event path and interpolation
    ev = runner_event(0.5, "R", 2, True)
    ok &= check("run event has 3 path points and 2 arrivals", len(ev["path"]) == 3 and len(ev["arrive"]) == 2)
    p_start = runner_position(ev, 0.0)
    p_first = runner_position(ev, ev["arrive"][0])
    p_end = runner_position(ev, 99.0)
    ok &= check("runner starts at home, touches first at arrive[0], ends on second",
                np.allclose(p_start, [0, 0]) and np.allclose(p_first, [19.4, 19.4], atol=0.05) and np.allclose(p_end, [0, 38.8]),
                "%s %s %s" % (p_start, p_first, p_end))
    mid = runner_position(ev, 0.5 * (ev["t0"] + ev["arrive"][0]))
    ok &= check("half way in time is less than half way in distance (acceleration)", np.hypot(*mid) < 0.5 * np.hypot(19.4, 19.4))
    # engine consistency: a ground-ball out must have the throw arriving before the runner
    from bbsim.engine.plate_appearance import EngineConfig, GameContext, PlateAppearance
    from bbsim.engine.fielding import default_fielders
    from bbsim.engine.rules import Umpire
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
    from serve_game import build_batter, build_catcher, build_pitcher, make_roster
    roster = make_roster(5)
    pitcher = build_pitcher({"profile": roster["pitchers"][1]["profile_id"], "name": "p"})
    n_play, n_bad, n_events = 0, 0, 0
    for bi in range(6):
        b = build_batter(roster["batters"][bi]["profile"], bi)
        cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=default_fielders(0.5))
        pa = PlateAppearance(pitcher, build_catcher({}), b, cfg, seed=101 + bi, new_game=True)
        pa.run(GameContext())
        for i in range(40):
            rec = pa.pitch_once(GameContext(balls=i % 3, strikes=i % 2, batter_hand=b.hand, pitcher_hand=pitcher.hand,
                                            zone_top=pa.zone.top, zone_bottom=pa.zone.bottom), i)
            pa._batter_learns(rec)
            if rec.result != "in_play" or rec.fielding is None or rec.play.kind == "foul":
                continue
            n_play += 1
            evs = rec.fielding.events
            n_events += len(evs)
            runs = [e for e in evs if e["kind"] == "run"]
            calls = [e for e in evs if e["kind"] == "call"]
            throws = [e for e in evs if e["kind"] == "throw"]
            if not runs:
                n_bad += 1
                continue
            r = runs[0]
            if rec.play.kind == "out" and rec.fielding.kind == "ground" and calls and throws:
                # out at first: the throw arrives before the runner
                if not (calls[0]["out"] and throws[-1]["t1"] <= r["arrive"][0] + 0.06):
                    n_bad += 1
            if rec.play.kind in ("single", "double", "triple") and (not r["safe"] or r["bases"] != rec.play.bases):
                n_bad += 1
            if rec.play.kind == "HR" and r["bases"] != 4:
                n_bad += 1
    ok &= check("events consistent with play results", n_play > 10 and n_bad == 0, "plays=%d bad=%d events=%d" % (n_play, n_bad, n_events))
    print("ALL PASS" if ok else "SOME FAIL")


if __name__ == "__main__":
    main()
