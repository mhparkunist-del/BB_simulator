"""Simulate N plate appearances with the v0.3 battery (pitcher intent + catcher sign).

Usage: python3 examples/run_plate_appearance.py [--n 300] [--pitcher B] [--out DIR]
Outputs: <out>/D03_pitches.csv, <out>/D04_plate_appearances.csv, <out>/D05_battery_log.txt,
         <out>/pa_example.png, <out>/pitch_example_swing.png, <out>/batted_ball_pa.png
"""
import argparse
import csv
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import BatterProfile, CatcherProfile, GameContext, HeuristicBatter, HeuristicCatcher, HeuristicPitcher
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance, Umpire
from bbsim.physics import constants as C
from bbsim.viz import plot_batted_ball, plot_pitch, plot_plate_appearance

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300)
    ap.add_argument("--pitcher", default="B")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--recognition", type=float, default=0.6)
    ap.add_argument("--discipline", type=float, default=0.6)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    cfg = EngineConfig(umpire=Umpire(low_shift=0.02))
    pitch_rows, pa_rows, log = [], [], []
    outcomes, results, codes = Counter(), Counter(), Counter()
    agree = shakes = tipped = 0
    example = None
    pitcher = HeuristicPitcher(PitcherProfile.from_params(a.pitcher))
    catcher = HeuristicCatcher(CatcherProfile())
    for seed in range(a.n):
        batter = HeuristicBatter(BatterProfile(recognition=a.recognition, discipline=a.discipline,
                                               hand="L" if seed % 3 == 0 else "R",
                                               power_zone=["middle", "in", "low", "away"][seed % 4]))
        runners = (seed % 4 == 1, False, seed % 7 == 2)
        ctx = GameContext(outs=seed % 3, inning=1 + seed % 9, runners=runners, score_diff=(seed % 5) - 2, runner_speed=0.7)
        pa = PlateAppearance(pitcher, catcher, batter, cfg, seed=seed, new_game=(seed % 25 == 0))
        res = pa.run(ctx)
        outcomes[res.outcome] += 1
        pa_rows.append({"seed": seed, "pitcher": a.pitcher, "outcome": res.outcome, "n_pitches": len(res.pitches),
                        "pitch_count_end": pitcher.pitch_count})
        for r in res.pitches:
            results[r.result] += 1
            codes[r.call.code] += 1
            agree += r.call.agreed
            shakes += r.call.shake_offs
            tipped += r.decision.tipped
            row = {"seed": seed, "pitch_no": r.index + 1, "balls": r.context_before.balls,
                   "strikes": r.context_before.strikes, "runners": "".join("1" if x else "0" for x in r.context_before.runners),
                   "pitcher_intent": r.intent.code, "intent_zone": r.intent.zone, "catcher_sign": r.sign.code,
                   "sign_zone": r.sign.zone, "final": r.call.code, "final_zone": r.call.zone,
                   "agreed": int(r.call.agreed), "shake_offs": r.call.shake_offs,
                   "mph": round(r.pitch.initial.speed * C.MS_TO_MPH, 1), "rpm": round(r.pitch.initial.spin_rpm),
                   "axis_deg": round(r.pitch.spec.tilt_axis_deg, 1) if r.pitch.spec else "",
                   "sigma_m": round(r.sigma_used, 3),
                   "plate_x": round(float(r.pitch.plate.pos[0]), 3) if r.pitch.plate is not None else "",
                   "plate_z": round(float(r.pitch.plate.pos[2]), 3) if r.pitch.plate is not None else "",
                   "swing": int(r.decision.swing), "tipped": int(r.decision.tipped), "result": r.result,
                   "reasons": " / ".join(r.call.reasons[:4])}
            if r.collision and r.collision.hit:
                row.update({"ev_mph": round(r.collision.exit_speed * C.MS_TO_MPH, 1),
                            "la_deg": round(r.collision.launch_angle, 1)})
            if r.play:
                row["play"] = r.play.kind
            pitch_rows.append(row)
            if len(log) < 60:
                log.append("PA%03d #%d [%d-%d, R%s] 투수 의도 %s@%s (%s) | 포수 사인 %s@%s (%s) | 최종 %s%s → %s" % (
                    seed, r.index + 1, r.context_before.balls, r.context_before.strikes,
                    "".join("1" if x else "0" for x in r.context_before.runners),
                    r.intent.code, r.intent.zone, ", ".join(r.intent.reasons[:3]) or "-",
                    r.sign.code, r.sign.zone, ", ".join(r.sign.reasons[:3]) or "-",
                    r.call.code, " (흔들기 %d회)" % r.call.shake_offs if r.call.shake_offs else "", r.result))
        if example is None and res.outcome in ("HR", "double", "triple", "single", "out") and len(res.pitches) >= 3:
            example = (pa, res)

    keys = []
    for r in pitch_rows:
        for k in r:
            if k not in keys:
                keys.append(k)
    with open(os.path.join(a.out, "D03_pitches.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(pitch_rows)
    with open(os.path.join(a.out, "D04_plate_appearances.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(pa_rows[0].keys())); w.writeheader(); w.writerows(pa_rows)
    with open(os.path.join(a.out, "D05_battery_log.txt"), "w") as f:
        f.write("\n".join(log))

    n, m = sum(outcomes.values()), sum(results.values())
    print("pitcher %s | PA %d | pitches %d (%.2f/PA) | 의도=사인 일치 %.0f%% | 흔들기 %d회 | 구종 팁 %d회" %
          (a.pitcher, n, m, m / n, 100.0 * agree / m, shakes, tipped))
    for k, v in outcomes.most_common():
        print("  %-10s %4d  %5.1f%%" % (k, v, 100.0 * v / n))
    print("pitch results:", ", ".join("%s %.1f%%" % (k, 100.0 * v / m) for k, v in results.most_common()))
    print("pitch mix:", ", ".join("%s %.0f%%" % (k, 100.0 * v / m) for k, v in codes.most_common()))
    swings = [r for r in pitch_rows if r["swing"]]
    whiffs = [r for r in swings if r["result"] == "swinging_strike"]
    inplay = [r for r in pitch_rows if r["result"] == "in_play"]
    if swings:
        print("swing %%: %.1f   whiff/swing: %.1f%%" % (100.0 * len(swings) / m, 100.0 * len(whiffs) / len(swings)))
    if inplay:
        print("in play: %d  mean EV %.1f mph  mean LA %.1f deg" % (len(inplay), sum(r["ev_mph"] for r in inplay) / len(inplay),
                                                                 sum(r["la_deg"] for r in inplay) / len(inplay)))
    ff = [r for r in pitch_rows if r["final"] == "FF"]
    if ff:
        print("FF: mean %.1f mph, %.0f rpm" % (sum(r["mph"] for r in ff) / len(ff), sum(r["rpm"] for r in ff) / len(ff)))
    if example is not None:
        pa, res = example
        zone = (pa.zone.top, pa.zone.bottom)
        plot_plate_appearance(res.pitches, os.path.join(a.out, "pa_example.png"), zone,
                              title="PA — %s in %d pitches" % (res.outcome, len(res.pitches)))
        last = res.pitches[-1]
        plot_pitch(last.pitch, os.path.join(a.out, "pitch_example_swing.png"), zone,
                   sightings=last.observation.sightings, predicted_xz=last.decision.predicted_xz,
                   title="Final pitch: %s (intent %s / sign %s), batter predicted (%.2f, %.2f) vs actual (%.2f, %.2f) m" %
                         (last.pitch.pitch_type.name, last.intent.code, last.sign.code, last.decision.predicted_xz[0],
                          last.decision.predicted_xz[1], last.pitch.plate.pos[0], last.pitch.plate.pos[2]))
        if last.batted is not None:
            plot_batted_ball(last.batted, cfg.park, os.path.join(a.out, "batted_ball_pa.png"))
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
