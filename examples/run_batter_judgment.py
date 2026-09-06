"""Batter judgment timeline: how the read sharpens from release to commit.

Usage: python3 examples/run_batter_judgment.py [--out DIR] [--pitcher B]
Outputs: <out>/judgment_timeline.png, <out>/D01_judgments.csv, <out>/D02_memory_clusters.csv, <out>/judgment_log.txt
"""
import argparse
import csv
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import GameContext, HeuristicPitcher, PitcherMemory, judge, learn_from_flight, timeline
from bbsim.agents.perception import observe, observe_release
from bbsim.agents.pitcher import PitcherProfile
from bbsim.physics import throw_spec
from bbsim.physics.constants import MS_TO_MPH, PLATE_FRONT_Y
from bbsim.viz import palette as P

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")
CONTACT_Y = PLATE_FRONT_Y + 0.15
EYE = np.array([-0.75, CONTACT_Y - 0.30, 1.66])


def flight(pitcher, code, rng, target=(0.0, 0.75)):
    res = throw_spec(pitcher.spec_for(code, 1.0, rng), target)
    arr = res.trajectory.crossing(1, CONTACT_Y)
    full = observe(res.trajectory, EYE, arr.t, rng, 60.0, 0.05)
    rel = observe_release(res.trajectory, EYE, rng, 0.05)
    return res, arr, full, rel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--pitcher", default="B")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(1)
    pitcher = HeuristicPitcher(PitcherProfile.from_params(a.pitcher))
    pitcher.begin_game(rng)

    # 1) the batter learns this pitcher over 24 pitches (mixed)
    mem = PitcherMemory()
    log = []
    codes = [c for _ in range(6) for c in pitcher.repertoire_codes]
    for i, code in enumerate(codes):
        res, arr, full, rel = flight(pitcher, code, rng)
        ctx0 = GameContext(balls=i % 4, strikes=i % 3, pitcher_id=a.pitcher)
        info = learn_from_flight(mem, full, CONTACT_Y, rel, ctx0)
        log.append("학습 %2d: %s  관측 구속 %.1f mph, 도달 편차 dx %+.2f dz %+.2f m → 가족 %s, 유형 %d개, 직구 비율 %.0f%%, 구간 신뢰 %s" %
                   (i + 1, code, info["speed"] * MS_TO_MPH, info["break_x"], info["break_z"], info["family"], len(mem.clusters),
                    100 * mem.fb_share, {k: round(v, 2) for k, v in mem.trust.items()}))
    with open(os.path.join(a.out, "D02_memory_clusters.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["label", "family", "speed_mph", "break_x_m", "break_z_m", "n"])
        for c in sorted(mem.clusters, key=lambda c: -c.speed):
            w.writerow([c.label, c.family, round(c.speed * MS_TO_MPH, 1), round(c.break_x, 3), round(c.break_z, 3), c.n])
        w.writerow([]); w.writerow(["bin_frac", "trust"]); [w.writerow([b, round(v, 3)]) for b, v in mem.trust.items()]

    # 2) judgment timelines for one pitch of each type, with and without memory
    rows = []
    n = len(pitcher.repertoire_codes)
    fig, axes2 = plt.subplots(2, n, figsize=(4.2 * n, 7.2), sharex="col")
    axes, axesp = axes2[0], axes2[1]
    plt.rcParams.update({"font.family": "DejaVu Sans"})
    for ax, axp, code in zip(np.atleast_1d(axes), np.atleast_1d(axesp), pitcher.repertoire_codes):
        res, arr, full, rel = flight(pitcher, code, rng, target=(0.1, 0.7))
        ctx = GameContext(balls=1, strikes=1, pitcher_id=a.pitcher)
        for label, memory, color in (("with memory", mem, P.SERIES[0]), ("no memory", PitcherMemory(), P.SERIES[1])):
            tl = timeline(full, ctx, memory, CONTACT_Y, 0.6)
            ts = [j.t * 1000 for j in tl]
            zs = [j.pred_xz[1] for j in tl]
            sg = [j.sigma_xz[1] for j in tl]
            ax.plot(ts, zs, color=color, linewidth=2, marker="o", markersize=5, label=label)
            ax.fill_between(ts, np.array(zs) - sg, np.array(zs) + sg, color=color, alpha=0.12, linewidth=0)
            axp.plot(ts, [j.p_fastball for j in tl], color=color, linewidth=2, marker="o", markersize=5, label=label)
            for j in tl:
                rows.append({"code": code, "memory": label, "t_ms": round(j.t * 1000), "speed_mph": round(j.reads[-1].speed_est * MS_TO_MPH, 1),
                             "bend_z_seen_cm": round(100 * j.reads[-1].bend_seen[1], 1),
                             "prior_fastball": round(j.prior_fastball, 2), "p_fastball": round(j.p_fastball, 2),
                             "pred_x": round(j.pred_xz[0], 3), "pred_z": round(j.pred_xz[1], 3),
                             "sigma_x": round(j.sigma_xz[0], 3), "sigma_z": round(j.sigma_xz[1], 3),
                             "actual_z": round(float(arr.pos[2]), 3), "dominant_bin": j.dominant_bin,
                             "cues": " / ".join(j.cues)})
        axp.axhline(0.5, color=P.GRID, linewidth=1.2)
        axp.axhline(1.0 if code in ("FF", "SI", "CT") else 0.0, color=P.TEXT_2, linewidth=1.2, linestyle="--", label="truth (family)")
        axp.set_ylim(-0.05, 1.05)
        axp.set_xlabel("judgment time after release (ms)")
        axp.grid(True, color=P.GRID, linewidth=0.8)
        axp.set_axisbelow(True)
        for sp in ("top", "right"):
            axp.spines[sp].set_visible(False)
        ax.axhline(arr.pos[2], color=P.TEXT_2, linewidth=1.2, linestyle="--", label="actual")
        ax.axvline((arr.t - 0.15) * 1000, color=P.GRID, linewidth=1.5)
        ax.text((arr.t - 0.15) * 1000, ax.get_ylim()[1] if False else 1.35, "commit", fontsize=9, color=P.TEXT_2, ha="center")
        ax.set_title("%s  (%.0f mph)" % (code, res.initial.speed * MS_TO_MPH))
        ax.grid(True, color=P.GRID, linewidth=0.8)
        ax.set_axisbelow(True)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        ax.set_ylim(0.2, 1.4)
    np.atleast_1d(axes)[0].set_ylabel("predicted plate height z (m)")
    np.atleast_1d(axes)[0].legend(loc="lower left", fontsize=9)
    np.atleast_1d(axesp)[0].set_ylabel("P(fastball) read")
    np.atleast_1d(axesp)[0].legend(loc="center left", fontsize=9)
    fig.suptitle("Batter's read over time: plate height (top) and fastball-vs-breaking belief (bottom); memory vs none", fontsize=12)
    fig.tight_layout()
    fig.savefig(os.path.join(a.out, "judgment_timeline.png"), dpi=150)
    with open(os.path.join(a.out, "D01_judgments.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(a.out, "judgment_log.txt"), "w") as f:
        f.write("\n".join(log))
    # console summary: error at commit with vs without memory
    for code in pitcher.repertoire_codes:
        sub = [r for r in rows if r["code"] == code]
        for label in ("with memory", "no memory"):
            rr = [r for r in sub if r["memory"] == label]
            if rr:
                last = rr[-1]
                print("%s %-11s commit-time error dz %+.3f m (σ %.3f), P(fastball) prior %.2f → %.2f, dominant bin %.0f%%" %
                      (code, label, last["pred_z"] - last["actual_z"], last["sigma_z"], last["prior_fastball"], last["p_fastball"], 100 * last["dominant_bin"]))
    # averaged commit-time error over 12 pitches per type, memory vs none
    ctx = GameContext(balls=1, strikes=1, pitcher_id=a.pitcher)
    avg_rows = []
    for code in pitcher.repertoire_codes:
        errs = {"with memory": [], "no memory": []}
        pfb = {"with memory": [], "no memory": []}
        for i in range(12):
            res, arr, full, rel = flight(pitcher, code, rng, target=(0.1 * (i % 3 - 1), 0.6 + 0.1 * (i % 4)))
            early = [sg for sg in full if sg.t <= arr.t - 0.15]
            for label, memory in (("with memory", mem), ("no memory", PitcherMemory())):
                j = judge(early, ctx, memory, CONTACT_Y, 0.6, rel)
                if j is None:
                    continue
                errs[label].append(np.hypot(j.pred_xz[0] - arr.pos[0], j.pred_xz[1] - arr.pos[1] * 0 + j.pred_xz[1] - arr.pos[2]) if False else np.hypot(j.pred_xz[0] - arr.pos[0], j.pred_xz[1] - arr.pos[2]))
                pfb[label].append(j.p_fastball)
        for label in errs:
            avg_rows.append({"code": code, "memory": label, "n": len(errs[label]), "mean_err_cm": round(100 * np.mean(errs[label]), 1),
                             "mean_p_fastball": round(float(np.mean(pfb[label])), 2)})
            print("%s %-11s mean commit error %.1f cm, mean P(fastball) %.2f (n=%d)" % (code, label, 100 * np.mean(errs[label]), np.mean(pfb[label]), len(errs[label])))
    with open(os.path.join(a.out, "D03_commit_error_summary.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(avg_rows[0].keys()))
        w.writeheader()
        w.writerows(avg_rows)
    print("clusters:", [(c.label, c.family, round(c.speed * MS_TO_MPH, 1), round(c.break_z, 2), c.n) for c in sorted(mem.clusters, key=lambda c: -c.speed)])
    print("fastball share %.2f, trust per bin %s" % (mem.fb_share, {k: round(v, 2) for k, v in mem.trust.items()}))
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
