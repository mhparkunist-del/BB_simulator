"""Attribute sensitivity: tracking / composure / reaction, low vs high, under calm and pressure.

Usage: python3 examples/run_batter_attributes.py [--n 150] [--out DIR]
Outputs: <out>/attribute_sweep.png, <out>/D01_attribute_sweep.csv
"""
import argparse
import csv
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import BatterProfile, GameContext, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.physics import constants as C
from bbsim.viz import palette as P

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")


def run(profile, n, pressure):
    b = PerceptiveBatter(profile)
    out = Counter(); m = Counter()
    swings = whiffs = chases = checks = adjusted = takes_learn = fp_swings = fp = 0; ev = []
    for seed in range(n):
        ctx = GameContext(outs=2, runners=(True, False, True), inning=8, score_diff=-1) if pressure else GameContext()
        pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), b, EngineConfig(),
                             seed=seed, new_game=(seed % 25 == 0))
        r = pa.run(ctx)
        out[r.outcome] += 1
        for rec in r.pitches:
            m[rec.result] += 1
            d = rec.decision
            if d.swing:
                swings += 1; whiffs += rec.result == "swinging_strike"
                if rec.pitch.plate is not None and not pa.zone.contains(rec.pitch.plate.pos):
                    chases += 1
            checks += d.checked; adjusted += d.adjusted; takes_learn += d.note == "take to learn"
            if rec.context_before.balls == 0 and rec.context_before.strikes == 0:
                fp += 1; fp_swings += d.swing
            if rec.collision and rec.collision.hit:
                ev.append(rec.collision.exit_speed * C.MS_TO_MPH)
    tot = sum(out.values()); pitches = sum(m.values())
    hits = sum(out[k] for k in ("single", "double", "triple", "HR"))
    return {"K%": 100 * out["strikeout"] / tot, "BB%": 100 * out["walk"] / tot, "H%": 100 * hits / tot,
            "whiff%": 100 * whiffs / max(swings, 1), "chase%": 100 * chases / max(swings, 1),
            "check/PA": checks / tot, "adjust/pitch": adjusted / pitches, "EV": float(np.mean(ev)) if ev else 0.0,
            "1st-pitch swing%": 100 * fp_swings / max(fp, 1), "take-to-learn/PA": takes_learn / tot}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=150)
    ap.add_argument("--out", default=DEFAULT_OUT)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rows = []
    cases = [("tracking", "타구판단능력"), ("composure", "침착성"), ("reaction", "순발력"), ("boldness", "과감성")]
    for attr, kr in cases:
        for level, val in (("low", 0.1), ("high", 0.9)):
            for pressure in (False, True):
                prof = BatterProfile(**{attr: val})
                stats = run(prof, a.n, pressure)
                row = {"attribute": attr, "level": level, "pressure": int(pressure)}
                row.update({k: round(v, 2) for k, v in stats.items()})
                rows.append(row)
                print("%-9s %-4s %-8s " % (attr, level, "pressure" if pressure else "calm") +
                      "  ".join("%s %.1f" % (k, v) for k, v in stats.items()))
    with open(os.path.join(a.out, "D01_attribute_sweep.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

    metrics = ["K%", "BB%", "whiff%", "chase%", "H%"]
    fig, axes = plt.subplots(1, 4, figsize=(19, 4.6), sharey=False)
    for ax, (attr, kr) in zip(axes, cases):
        sub = [r for r in rows if r["attribute"] == attr and r["pressure"] == 1]
        lo = [r for r in sub if r["level"] == "low"][0]; hi = [r for r in sub if r["level"] == "high"][0]
        x = np.arange(len(metrics)); wdt = 0.36
        ax.bar(x - wdt / 2, [lo[k] for k in metrics], wdt, color=P.SERIES[1], label="low (0.1)")
        ax.bar(x + wdt / 2, [hi[k] for k in metrics], wdt, color=P.SERIES[0], label="high (0.9)")
        for i, k in enumerate(metrics):
            ax.text(x[i] - wdt / 2, lo[k] + 0.5, "%.0f" % lo[k], ha="center", fontsize=9, color=P.TEXT_2)
            ax.text(x[i] + wdt / 2, hi[k] + 0.5, "%.0f" % hi[k], ha="center", fontsize=9, color=P.TEXT_2)
        ax.set_xticks(x); ax.set_xticklabels(metrics)
        ax.set_title("%s (under pressure)" % attr)
        ax.set_ylabel("%")
        ax.grid(True, axis="y", color=P.GRID, linewidth=0.8); ax.set_axisbelow(True)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        ax.legend(loc="upper right", fontsize=9)
    fig.suptitle("Batter attributes low vs high: %d PA each vs pitcher B, pressure situation (2 out, runners 1st/3rd, 8th, -1)" % a.n, fontsize=12)
    fig.tight_layout()
    fig.savefig(os.path.join(a.out, "attribute_sweep.png"), dpi=150)
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
