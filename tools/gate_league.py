"""League-distribution gate (v0.7): a persistent 9-man lineup vs pitchers A/B/C, summary vs MLB references.

Usage: python3 tools/gate_league.py [--n 150] [--pitchers B] [--json out.json]
"""
import argparse
import json
import os
import sys
import time
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import BatterProfile, CatcherProfile, GameContext, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance, Umpire
from bbsim.physics.constants import MS_TO_MPH, STRIKE_ZONE_HALF_WIDTH

MLB = {"BB%": (7.5, 9.5), "K%": (20, 24), "HR/PA%": (2.5, 3.5), "BABIP": (0.285, 0.305), "EV": (87, 90), "LA": (10, 14),
       "swing%": (45, 49), "whiff/swing%": (22, 27), "foul/swing%": (33, 40), "Z-swing%": (64, 70), "O-swing%": (28, 34),
       "Z-contact%": (80, 86), "called_strike%": (15, 19), "F-strike%": (58, 63), "2S_zone%": (40, 50), "pitches/PA": (3.8, 4.0),
       "shake/100": (2, 10), "CH%": (8, 16)}


def lineup(rng):
    out = []
    for i in range(9):
        kw = {k: float(np.clip(rng.normal(0.55, 0.15), 0.15, 0.95)) for k in
              ("recognition", "discipline", "tracking", "composure", "reaction", "boldness", "barrel_placement", "timing",
               "swing_quickness", "path_control", "barrel_accuracy", "power", "spray_control", "guess_hitting")}
        kw["bat_speed"] = float(np.clip(rng.normal(33.0, 2.0), 28, 38))
        kw["hand"] = "L" if i % 3 == 0 else "R"
        kw["name"] = "B%d" % i
        out.append(PerceptiveBatter(BatterProfile(**kw)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=150)
    ap.add_argument("--pitchers", default="B")
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    rng = np.random.default_rng(7)
    bats = lineup(rng)
    cfg = EngineConfig(umpire=Umpire(low_shift=0.02))
    out = Counter(); res = Counter(); n_pitch = 0; shakes = 0; codes = Counter()
    swings = whiffs = fouls = inplay = 0; z_pitch = z_swing = o_pitch = o_swing = z_contact = 0
    first_strike = 0; two_s = two_s_zone = 0; by_count = {}; dout = []; ev = []; la = []; hits = 0; bip = 0; whiff_by = Counter(); swing_by = Counter(); dt_by = {}; dv_by = {}
    from collections import defaultdict; dt_by = defaultdict(list); dv_by = defaultdict(list); pe_by = defaultdict(list)
    t0 = time.time()
    seed = 0
    for pid in a.pitchers:
        catcher = HeuristicCatcher(CatcherProfile())
        for k in range(a.n):
            b = bats[k % 9]
            fresh = k % 27 == 0                      # a new (rested) pitcher every ~100 pitches, like a real outing
            if fresh:
                pitcher = HeuristicPitcher(PitcherProfile.from_params(pid)); pitcher.name = "%s%d" % (pid, k // 27)
            pa = PlateAppearance(pitcher, catcher, b, cfg, seed=seed, new_game=fresh); seed += 1
            r = pa.run(GameContext(runners=(k % 4 == 1, False, k % 7 == 2), outs=k % 3, inning=1 + (k // 9) % 9))
            out[r.outcome] += 1
            for i, rec in enumerate(r.pitches):
                n_pitch += 1; res[rec.result] += 1; shakes += rec.call.shake_offs; codes[rec.call.code] += 1
                px, pz = (rec.pitch.plate.pos[0], rec.pitch.plate.pos[2]) if rec.pitch.plate is not None else (9, 9)
                inz = abs(px) <= STRIKE_ZONE_HALF_WIDTH + 0.037 and rec.context_before.zone_bottom - 0.037 <= pz <= rec.context_before.zone_top + 0.037
                sw = rec.decision.swing
                cb = by_count.setdefault((rec.context_before.balls, rec.context_before.strikes), [0, 0, 0, 0])
                cb[0] += 1; cb[1] += inz; cb[2] += (inz and sw); cb[3] += ((not inz) and sw)
                if inz:
                    z_pitch += 1; z_swing += sw
                else:
                    o_pitch += 1; o_swing += sw
                    if px < 5:
                        dout.append(max(abs(px) - STRIKE_ZONE_HALF_WIDTH - 0.037, rec.context_before.zone_bottom - 0.037 - pz, pz - rec.context_before.zone_top - 0.037))
                if i == 0 and rec.result != "ball":
                    first_strike += 1
                if rec.context_before.strikes == 2:
                    two_s += 1; two_s_zone += inz
                if sw:
                    swings += 1; swing_by[rec.call.code] += 1
                    if rec.result == "swinging_strike":
                        whiffs += 1; whiff_by[rec.call.code] += 1
                    elif rec.result == "foul":
                        fouls += 1
                    if inz and rec.result != "swinging_strike":
                        z_contact += 1
                    if rec.contact_offsets:
                        dt_by[rec.call.code].append(rec.contact_offsets["timing_error_s"]); dv_by[rec.call.code].append(rec.contact_offsets["vertical_m"])
                        arrz = rec.pitch.trajectory.crossing(1, rec.observation.contact_y)
                        if arrz is not None and rec.decision.predicted_xz is not None:
                            pe_by["adj" if rec.decision.adjusted else "raw"].append(arrz.pos[2] - rec.decision.predicted_xz[1])
                            pe_by[rec.call.code].append(arrz.pos[2] - rec.decision.predicted_xz[1])
                    if rec.collision is not None and rec.collision.hit and rec.result != "foul":
                        inplay += 1
                        ev.append(rec.collision.exit_speed * MS_TO_MPH); la.append(rec.collision.launch_angle)
            if r.outcome in ("single", "double", "triple", "out"):
                bip += 1; hits += r.outcome != "out"
    pa_n = sum(out.values())
    stats = {"BB%": 100 * out["walk"] / pa_n, "K%": 100 * out["strikeout"] / pa_n, "HR/PA%": 100 * out["HR"] / pa_n,
             "BABIP": hits / max(bip, 1), "EV": float(np.mean(ev)) if ev else 0, "LA": float(np.mean(la)) if la else 0,
             "swing%": 100 * swings / n_pitch, "whiff/swing%": 100 * whiffs / max(swings, 1), "foul/swing%": 100 * fouls / max(swings, 1),
             "Z-swing%": 100 * z_swing / max(z_pitch, 1), "O-swing%": 100 * o_swing / max(o_pitch, 1), "Z-contact%": 100 * z_contact / max(z_swing, 1),
             "called_strike%": 100 * res["called_strike"] / n_pitch, "F-strike%": 100 * first_strike / pa_n,
             "2S_zone%": 100 * two_s_zone / max(two_s, 1), "pitches/PA": n_pitch / pa_n, "shake/100": 100 * shakes / n_pitch,
             "CH%": 100 * codes["CH"] / n_pitch}
    ok = 0
    for k, v in stats.items():
        lo, hi = MLB[k]
        flag = "ok " if lo <= v <= hi else "OUT"
        ok += flag == "ok "
        print("%-15s %7.2f   [%s-%s] %s" % (k, v, lo, hi, flag))
    print("zone%%: %.1f   dt_err ms by pitch: %s   vertical offset cm (ball-bat) by pitch: %s" % (
        100 * z_pitch / n_pitch, {c: "%+.0f±%.0f" % (1000 * np.mean(v), 1000 * np.std(v)) for c, v in dt_by.items()},
        {c: "%+.1f±%.1f" % (100 * np.mean(v), 100 * np.std(v)) for c, v in dv_by.items()}))
    print("by count (n, zone%, Z-swing%, O-swing%):", {"%d-%d" % k: "%d %.0f %.0f %.0f" % (v[0], 100 * v[1] / max(v[0], 1), 100 * v[2] / max(v[1], 1), 100 * v[3] / max(v[0] - v[1], 1)) for k, v in sorted(by_count.items())})
    d = np.array(dout) * 100
    print("outside pitches: d_out cm quartiles %s, share within 5 cm %.0f%%, within 10 cm %.0f%%" % (np.percentile(d, [25, 50, 75]).round(1).tolist(), 100 * np.mean(d < 5), 100 * np.mean(d < 10)))
    print("prediction error cm (actual - predicted z):", {c: "%+.1f±%.1f n%d" % (100 * np.mean(v), 100 * np.std(v), len(v)) for c, v in pe_by.items()})
    print("whiff by pitch:", {c: "%.0f%%" % (100 * whiff_by[c] / max(swing_by[c], 1)) for c in swing_by})
    print("mix:", {c: "%.0f%%" % (100 * n / n_pitch) for c, n in codes.most_common()})
    print("outcomes:", dict(out))
    print("gates %d/%d, %d PA, %d pitches, %.0f s" % (ok, len(stats), pa_n, n_pitch, time.time() - t0))
    if a.json:
        json.dump({"stats": stats, "whiff_by": dict(whiff_by), "swing_by": dict(swing_by), "mix": dict(codes), "outcomes": dict(out)}, open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
