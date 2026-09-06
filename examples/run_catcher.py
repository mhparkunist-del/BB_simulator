"""Catcher attribute sweep vs a perceptive batter: sequencing (tunnelling), observation, framing, blocking, rapport.

Usage: python3 examples/run_catcher.py [--n 120] [--out DIR]
Outputs: <out>/catcher_sweep.png, <out>/D01_catcher_sweep.csv, <out>/D02_tunnel_table.csv, <out>/battery_log.txt
"""
import argparse
import csv
import os
import sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim.agents import BatterProfile, CatcherProfile, GameContext, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.physics.constants import MS_TO_MPH
from bbsim.viz import palette as P

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")


def run(profile, n, log=None):
    c = HeuristicCatcher(profile)
    b = PerceptiveBatter(BatterProfile())
    out = Counter(); m = Counter(); tunnels = shakes = wild = 0; ev = []
    for seed in range(n):
        ctx = GameContext(runners=(seed % 3 == 0, False, seed % 5 == 0), outs=seed % 3, inning=1 + seed % 9)
        pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), c, b, EngineConfig(), seed=seed, new_game=(seed % 25 == 0))
        r = pa.run(ctx)
        out[r.outcome] += 1
        for rec in r.pitches:
            m[rec.result] += 1; tunnels += rec.sign.zone == "tunnel"; shakes += rec.call.shake_offs; wild += rec.wild_pitch
            if rec.collision and rec.collision.hit:
                ev.append(rec.collision.exit_speed * MS_TO_MPH)
            if log is not None and len(log) < 40:
                log.append("PA%03d #%d [%d-%d] 투수 %s@%s | 포수 %s@%s (%s) | 최종 %s → %s" % (
                    seed, rec.index + 1, rec.context_before.balls, rec.context_before.strikes, rec.intent.code, rec.intent.zone,
                    rec.sign.code, rec.sign.zone, ", ".join(rec.sign.reasons[:3]), rec.call.code, rec.result))
    tot = sum(out.values()); pitches = sum(m.values())
    return {"K%": 100 * out["strikeout"] / tot, "BB%": 100 * out["walk"] / tot,
            "H%": 100 * sum(out[k] for k in ("single", "double", "triple", "HR")) / tot,
            "whiff%": 100 * m["swinging_strike"] / pitches, "called_strike%": 100 * m["called_strike"] / pitches,
            "tunnel/PA": tunnels / tot, "shake/PA": shakes / tot, "wild/PA": wild / tot,
            "EV": float(np.mean(ev)) if ev else 0.0}, c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--out", default=DEFAULT_OUT)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rows = []; log = []
    cases = [("sequencing", "터널링·시퀀싱"), ("observation", "관찰(타자북)"), ("framing", "프레이밍"), ("blocking", "블로킹"), ("rapport", "소통")]
    base_stats, c0 = run(CatcherProfile(), a.n, log)
    rows.append({"attribute": "baseline", "level": "0.5", **{k: round(v, 2) for k, v in base_stats.items()}})
    print("baseline", base_stats)
    for attr, kr in cases:
        for level, val in (("low", 0.1), ("high", 0.9)):
            st, _ = run(CatcherProfile(**{attr: val}), a.n)
            rows.append({"attribute": attr, "level": level, **{k: round(v, 2) for k, v in st.items()}})
            print("%-11s %-4s " % (attr, level) + "  ".join("%s %.2f" % (k, v) for k, v in st.items()))
    with open(os.path.join(a.out, "D01_catcher_sweep.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    with open(os.path.join(a.out, "D02_tunnel_table.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["prev", "next", "plate_sep_m", "early_sep_m", "offset_x", "offset_z"])
        for (p1, p2), (ps, es, off) in c0.tunnel_table.items():
            w.writerow([p1, p2, round(ps, 3), round(es, 3), round(off[0], 3), round(off[1], 3)])
    with open(os.path.join(a.out, "battery_log.txt"), "w") as f:
        f.write("\n".join(log))

    metrics = ["K%", "whiff%", "called_strike%", "H%"]
    fig, axes = plt.subplots(1, len(cases), figsize=(4.0 * len(cases), 4.4))
    for ax, (attr, kr) in zip(axes, cases):
        lo = [r for r in rows if r["attribute"] == attr and r["level"] == "low"][0]
        hi = [r for r in rows if r["attribute"] == attr and r["level"] == "high"][0]
        x = np.arange(len(metrics)); wdt = 0.36
        ax.bar(x - wdt / 2, [lo[k] for k in metrics], wdt, color=P.SERIES[1], label="low (0.1)")
        ax.bar(x + wdt / 2, [hi[k] for k in metrics], wdt, color=P.SERIES[0], label="high (0.9)")
        for i, k in enumerate(metrics):
            ax.text(x[i] - wdt / 2, lo[k] + 0.4, "%.0f" % lo[k], ha="center", fontsize=8, color=P.TEXT_2)
            ax.text(x[i] + wdt / 2, hi[k] + 0.4, "%.0f" % hi[k], ha="center", fontsize=8, color=P.TEXT_2)
        ax.set_xticks(x); ax.set_xticklabels(metrics, fontsize=9)
        ax.set_title(attr); ax.set_ylabel("%")
        ax.grid(True, axis="y", color=P.GRID, linewidth=0.8); ax.set_axisbelow(True)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        ax.legend(loc="upper right", fontsize=8)
    fig.suptitle("Catcher attributes low vs high: %d PA each, pitcher B vs perceptive batter" % a.n, fontsize=12)
    fig.tight_layout(); fig.savefig(os.path.join(a.out, "catcher_sweep.png"), dpi=150)
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
