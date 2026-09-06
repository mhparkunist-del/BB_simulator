"""Two batter cards (contact hitter vs power hitter) through the full chain: card -> profile -> 120 PA.

Usage: python3 examples/run_batter_card.py [--n 120] [--out DIR]
Outputs: <out>/D02_batter_cards.csv
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
from bbsim.game import make_prospect
from bbsim.physics.constants import MS_TO_MPH

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "out")


def make_card(name, rng, overrides):
    card = make_prospect(name, rng, age=26, quality=0.6)
    card.skills.update(overrides)
    return card


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--out", default=DEFAULT_OUT)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(11)
    cards = {
        "컨택형": make_card("컨택형", rng, {"bat_speed": 45, "power": 35, "barrel_placement": 85, "timing": 85, "discipline": 80,
                                         "boldness": 30, "tracking": 80, "swing_quickness": 80, "guess_hitting": 60}),
        "파워형": make_card("파워형", rng, {"bat_speed": 90, "power": 90, "barrel_placement": 45, "timing": 50, "discipline": 40,
                                         "boldness": 85, "tracking": 50, "swing_quickness": 40, "guess_hitting": 40}),
    }
    rows = []
    for label, card in cards.items():
        prof = BatterProfile.from_card(card)
        b = PerceptiveBatter(prof)
        out = Counter(); notes = Counter(); swings = whiffs = 0; ev = []; la = []
        for seed in range(a.n):
            pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), b, EngineConfig(),
                                 seed=seed, new_game=(seed % 25 == 0))
            r = pa.run(GameContext(inning=1 + seed % 9))
            out[r.outcome] += 1
            for rec in r.pitches:
                notes[rec.decision.note] += 1
                if rec.decision.swing:
                    swings += 1; whiffs += rec.result == "swinging_strike"
                if rec.collision and rec.collision.hit:
                    ev.append(rec.collision.exit_speed * MS_TO_MPH); la.append(rec.collision.launch_angle)
        tot = sum(out.values())
        row = {"card": label, "bat_speed_ms": round(prof.bat_speed, 1), "reaction_time_s": round(prof.derived_reaction_time(), 3),
               "timing_sigma_ms": round(1000 * prof.derived_execution().timing_sigma, 1),
               "vertical_sigma_mm": round(1000 * prof.derived_execution().vertical_sigma, 1),
               "m_eff_kg": round(b.bat_spec().m_eff_sweet, 2),
               "K%": round(100 * out["strikeout"] / tot, 1), "BB%": round(100 * out["walk"] / tot, 1),
               "H%": round(100 * sum(out[k] for k in ("single", "double", "triple", "HR")) / tot, 1),
               "HR%": round(100 * out["HR"] / tot, 1), "whiff%": round(100 * whiffs / max(swings, 1), 1),
               "EV": round(float(np.mean(ev)), 1) if ev else 0, "LA": round(float(np.mean(la)), 1) if la else 0,
               "power_swing%": round(100 * notes["power swing"] / max(swings, 1), 1),
               "take_to_learn": notes["take to learn"], "check_swing": notes["check swing"]}
        rows.append(row)
        print(label, row)
    with open(os.path.join(a.out, "D02_batter_cards.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print("outputs:", os.path.abspath(a.out))


if __name__ == "__main__":
    main()
