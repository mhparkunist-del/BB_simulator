"""Coaching-staff demo: same prospect, 30 weeks under elite vs weak staff.

Usage: python3 examples/run_coaching.py [--out DIR] [--weeks 30] [--seed 3]
Outputs: <out>/coaching_compare.png, <out>/D01_weekly_skills.csv, <out>/D02_week_reports.csv
"""
import argparse
import copy
import csv
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.game import SKILLS, elite_staff, make_prospect, weak_staff
from bbsim.viz import palette as P

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")


def simulate(staff, player, weeks):
    reports = [staff.run_week(player, w) for w in range(weeks)]
    return reports


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--weeks", type=int, default=30)
    ap.add_argument("--seed", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    base = make_prospect("유망주", np.random.default_rng(a.seed), age=22, quality=0.6)
    runs = {}
    for label, fn in (("우수 스태프", elite_staff), ("부실 스태프", weak_staff)):
        p = copy.deepcopy(base)
        st = fn(a.seed)
        reps = simulate(st, p, a.weeks)
        runs[label] = (p, reps)

    # ---- CSV --------------------------------------------------------------
    rows = []
    for label, (p, reps) in runs.items():
        for w, snap in enumerate(p.history):
            r = {"staff": label, "week": w + 1}
            r.update({k: round(v, 3) for k, v in snap.items()})
            rows.append(r)
    with open(os.path.join(a.out, "D01_weekly_skills.csv"), "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    rows2 = []
    for label, (p, reps) in runs.items():
        for rep in reps:
            hd = rep.diagnoses[0]
            rows2.append({"staff": label, "week": rep.week + 1, "sessions": "|".join(rep.sessions),
                          "planned_load": round(rep.planned_load, 2), "capacity_true": round(rep.capacity_true, 2),
                          "capacity_est": round(rep.capacity_est, 2), "fatigue": round(rep.fatigue, 3),
                          "injury_risk": round(rep.injury_risk, 3), "injured": int(rep.injured),
                          "head_top_problem": hd.ranked[0][0], "true_top_problem": hd.true_ranked[0][0],
                          "head_top1_hit": int(hd.top1_hit), "head_rank_error": round(hd.rank_error, 2),
                          "talent_pitching_est": "%.2f-%.2f" % rep.talent_interval["pitching"]})
    with open(os.path.join(a.out, "D02_week_reports.csv"), "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows2[0].keys()))
        wr.writeheader()
        wr.writerows(rows2)

    # ---- figure -------------------------------------------------------------
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11, "axes.edgecolor": P.GRID,
                         "axes.labelcolor": P.TEXT_2, "xtick.color": P.TEXT_2, "ytick.color": P.TEXT_2,
                         "figure.facecolor": P.SURFACE, "axes.facecolor": P.SURFACE, "legend.frameon": False})
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.6))
    labels = list(runs.keys())
    eng = {"우수 스태프": "elite staff", "부실 스태프": "weak staff"}
    for i, lab in enumerate(labels):
        p, reps = runs[lab]
        wk = np.arange(1, len(p.history) + 1)
        ax = axes[0]
        ax.plot(wk, [h["mph"] for h in p.history], color=P.SERIES[i], linewidth=2, label=eng[lab])
        ax = axes[1]
        ax.plot(wk, [h["rpm"] for h in p.history], color=P.SERIES[i], linewidth=2, label=eng[lab])
        ax = axes[2]
        ax.plot(wk, [h["fatigue"] for h in p.history], color=P.SERIES[i], linewidth=2, label=eng[lab] + " fatigue")
        ax.plot(wk, [h["injury_risk"] for h in p.history], color=P.SERIES[i], linewidth=2, linestyle="--",
                label=eng[lab] + " injury risk")
    for ax, t, yl in zip(axes, ("Derived velocity", "Derived spin (BU x mph x grip x force)", "Fatigue / injury risk"),
                         ("mph", "rpm", "0..1")):
        ax.set_title(t)
        ax.set_xlabel("week")
        ax.set_ylabel(yl)
        ax.grid(True, color=P.GRID, linewidth=0.8)
        ax.set_axisbelow(True)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        ax.legend(loc="best", fontsize=9)
    fig.suptitle("Same prospect, 30 weeks: elite vs weak coaching staff", fontsize=12)
    fig.tight_layout()
    fig.savefig(os.path.join(a.out, "coaching_compare.png"), dpi=150)

    # ---- console summary ----------------------------------------------------
    for lab, (p, reps) in runs.items():
        t0, t1 = p.history[0], p.history[-1]
        hits = np.mean([r.diagnoses[0].top1_hit for r in reps])
        over = np.mean([max(0, r.planned_load - r.capacity_true) for r in reps])
        inj = sum(r.injured for r in reps)
        print("%s: mph %.1f→%.1f  rpm %.0f→%.0f  σ %.3f→%.3f m  | 감독 1순위 진단 적중 %.0f%%  평균 과부하 %.2f  부상 %d회"
              % (lab, t0["mph"], t1["mph"], t0["rpm"], t1["rpm"], t0["sigma_m"], t1["sigma_m"], 100 * hits, over, inj))
        print("   skills:", {k: round(p.skills[k]) for k in SKILLS})
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
