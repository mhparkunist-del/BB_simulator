"""Full nine-inning games between two generated teams; league statistics vs MLB 2024 references.

Usage: python3 tools/simulate_games.py [--games 100] [--seed 1] [--out DIR] [--fielding 0.5]
Both teams: 9 batters (lineup drawn like the gamer roster), a starter (profiles A..E) replaced by a fresh
reliever when the pitch count passes ~95 or fatigue > 1.0, one catcher, nine fielders. Extra innings up to 12.
Outputs: D01_games.csv (per game), D02_league_vs_mlb.csv, runs_hist.png, summary printed.
"""
import argparse
import csv
import os
import sys
import time
from collections import Counter

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
from bbsim.agents import BatterProfile, CatcherProfile, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter  # noqa: E402
from bbsim.agents.pitcher import PitcherProfile  # noqa: E402
from bbsim.engine import EngineConfig, Umpire  # noqa: E402
from bbsim.engine.fielding import default_fielders  # noqa: E402
from bbsim.engine.inning import HalfInning  # noqa: E402
from bbsim.physics.constants import MS_TO_MPH  # noqa: E402

MLB = {"R/G": 4.39, "H/G": 8.19, "HR/G": 1.12, "BB/G": 3.22, "K/G": 8.51, "E/G": 0.58, "pitches/G": 146.0, "PA/G": 38.0,
       "AVG": 0.243, "OBP": 0.312, "BABIP": 0.291, "K%": 22.6, "BB%": 8.2, "HR/PA%": 2.9, "XBH/H%": 34.0, "shutout%": 7.0,
       "10+runs%": 7.5, "starter_IP": 5.2, "extra%": 9.0, "1run_game%": 29.0}


BAT_SPEED_MEAN = 33.0


def make_team(rng, name):
    bats = []
    for i in range(9):
        kw = {k: float(np.clip(rng.normal(0.55, 0.15), 0.15, 0.95)) for k in
              ("recognition", "discipline", "tracking", "composure", "reaction", "boldness", "barrel_placement", "timing",
               "swing_quickness", "path_control", "barrel_accuracy", "power", "spray_control", "guess_hitting")}
        kw["bat_speed"] = float(np.clip(rng.normal(BAT_SPEED_MEAN, 2.0), 27, 38)); kw["hand"] = "L" if rng.random() < 0.35 else "R"
        kw["name"] = "%s%d" % (name, i + 1)
        bats.append(PerceptiveBatter(BatterProfile(**kw)))
    return bats


class Team:
    def __init__(self, name, rng, fielding_level):
        self.name = name
        self.lineup = make_team(rng, name)
        self.profiles = list("ABCBE")
        self.rng = rng
        self.fielding_level = fielding_level
        self.catcher = HeuristicCatcher(CatcherProfile())
        self.new_game()

    def new_game(self):
        self.starter_id = self.profiles[int(self.rng.integers(len(self.profiles)))]
        self.pitcher = HeuristicPitcher(PitcherProfile.from_params(self.starter_id)); self.pitcher.name = self.name + "-SP"
        self.relievers = 0
        self.starter_outs = None
        self.fresh = True
        self.cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=default_fielders(self.fielding_level))

    def maybe_change(self, inning, outs_so_far):
        if self.pitcher.pitch_count > 95 or self.pitcher.fatigue_level() > 1.0:
            if self.starter_outs is None:
                self.starter_outs = outs_so_far
            self.relievers += 1
            self.pitcher = HeuristicPitcher(PitcherProfile.from_params(self.profiles[(self.relievers + 1) % len(self.profiles)]))
            self.pitcher.name = "%s-RP%d" % (self.name, self.relievers)
            self.fresh = True


def play_game(home, away, seed):
    """Returns per-game dict. away bats top, home bats bottom."""
    for t in (home, away):
        t.new_game()
    score = {home.name: 0, away.name: 0}
    stats = {t.name: Counter() for t in (home, away)}
    idx = {home.name: 0, away.name: 0}
    line = {home.name: [], away.name: []}
    inning = 1
    outs_recorded = {home.name: 0, away.name: 0}
    while True:
        for batting, fielding_team in ((away, home), (home, away)):
            if inning >= 10 and batting is home and score[home.name] > score[away.name]:
                break
            fielding_team.maybe_change(inning, outs_recorded[fielding_team.name])
            hi = HalfInning(fielding_team.pitcher, fielding_team.catcher, batting.lineup, fielding_team.cfg, seed=seed * 131 + inning * 7,
                            inning=inning, batter_index=idx[batting.name], new_game=fielding_team.fresh,
                            score_diff=score[batting.name] - score[fielding_team.name])
            fielding_team.fresh = False
            r = hi.play()
            idx[batting.name] = r.next_batter_index
            score[batting.name] += r.runs
            line[batting.name].append(r.runs)
            outs_recorded[fielding_team.name] += 3
            st = stats[batting.name]
            st["pitches"] += r.pitches
            for pa in r.plate_appearances:
                o = pa.outcome
                st["PA"] += 1
                st[o] += 1
                if o in ("single", "double", "triple", "HR"):
                    st["H"] += 1
                if o in ("double", "triple", "HR"):
                    st["XBH"] += 1
                if o == "error":
                    stats[fielding_team.name]["E"] += 1
                last = pa.pitches[-1]
                if last.collision is not None and last.collision.hit and last.result == "in_play":
                    st["BIP"] += 1
                    st["EV_sum"] += last.collision.exit_speed * MS_TO_MPH
            if inning >= 9 and batting is home and score[home.name] > score[away.name]:
                break
        if inning >= 9 and score[home.name] != score[away.name]:
            break
        if inning >= 12:
            break
        inning += 1
    return {"seed": seed, "innings": inning, "home": home.name, "away": away.name, "R_home": score[home.name], "R_away": score[away.name],
            "line_home": line[home.name], "line_away": line[away.name], "stats": stats,
            "starter_outs": {t.name: (t.starter_outs if t.starter_outs is not None else outs_recorded[t.name]) for t in (home, away)},
            "relievers": {t.name: t.relievers for t in (home, away)}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=100)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--fielding", type=float, default=0.5)
    ap.add_argument("--bat_speed", type=float, default=33.0, help="lineup mean bat speed m/s (what-if)")
    ap.add_argument("--out", default=os.path.join(ROOT, "3_recent_report", "2026-09-06_v1.4_nine_innings"))
    a = ap.parse_args()
    global BAT_SPEED_MEAN
    BAT_SPEED_MEAN = a.bat_speed
    os.makedirs(a.out, exist_ok=True)
    rng = np.random.default_rng(a.seed)
    teams = [Team("H", rng, a.fielding), Team("A", rng, a.fielding)]
    games = []
    t0 = time.time()
    for g in range(a.games):
        if g % 10 == 0:                                   # fresh rosters every 10 games (a series)
            teams = [Team("H", rng, a.fielding), Team("A", rng, a.fielding)]
        games.append(play_game(teams[0], teams[1], a.seed * 1000 + g))
        if (g + 1) % 10 == 0:
            print("  %d games, %.0f s" % (g + 1, time.time() - t0))
    n = len(games)
    tot = Counter()
    per_team_game = []
    for gm in games:
        for t in ("H", "A"):
            st = gm["stats"][t]
            tot.update(st)
            per_team_game.append(st)
    tg = 2 * n
    PA = tot["PA"]; H = tot["H"]; BB = tot["walk"] + tot["hbp"]; K = tot["strikeout"]; HR = tot["HR"]
    AB = PA - BB - tot.get("sacrifice", 0)
    runs = [gm["R_home"] for gm in games] + [gm["R_away"] for gm in games]
    lg = {"R/G": np.mean(runs), "H/G": H / tg, "HR/G": HR / tg, "BB/G": BB / tg, "K/G": K / tg, "E/G": tot["E"] / tg,
          "pitches/G": tot["pitches"] / tg, "PA/G": PA / tg, "AVG": H / max(AB, 1), "OBP": (H + BB) / max(PA, 1),
          "BABIP": (H - HR) / max(AB - K - HR, 1), "K%": 100 * K / PA, "BB%": 100 * BB / PA, "HR/PA%": 100 * HR / PA,
          "XBH/H%": 100 * tot["XBH"] / max(H, 1), "shutout%": 100 * np.mean([r == 0 for r in runs]),
          "10+runs%": 100 * np.mean([r >= 10 for r in runs]),
          "starter_IP": np.mean([gm["starter_outs"][t] / 3 for gm in games for t in ("H", "A")]),
          "extra%": 100 * np.mean([gm["innings"] > 9 for gm in games]),
          "1run_game%": 100 * np.mean([abs(gm["R_home"] - gm["R_away"]) == 1 for gm in games])}
    print("\n%-12s %8s %8s  %s" % ("metric", "model", "MLB24", ""))
    ok = 0
    rows = []
    for k, v in lg.items():
        ref = MLB[k]
        tol = 0.15 * abs(ref) if k not in ("AVG", "OBP", "BABIP") else 0.02
        flag = "ok" if abs(v - ref) <= tol else "OUT"
        ok += flag == "ok"
        rows.append((k, round(v, 3), ref, flag))
        print("%-12s %8.2f %8.2f  %s" % (k, v, ref, flag))
    print("within 15%%: %d/%d  (EV mean %.1f mph, %d games, %.0f s)" % (ok, len(lg), tot["EV_sum"] / max(tot["BIP"], 1), n, time.time() - t0))
    with open(os.path.join(a.out, "D02_league_vs_mlb.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["metric", "model", "mlb_2024", "within_15pct"]); w.writerows(rows)
    with open(os.path.join(a.out, "D01_games.csv"), "w", newline="") as f:
        w = csv.writer(f); w.writerow(["game", "innings", "R_home", "R_away", "H_home", "H_away", "HR_home", "HR_away", "BB_home", "BB_away", "K_home", "K_away",
                                       "E_home", "E_away", "pitches_home", "pitches_away", "starter_IP_home", "starter_IP_away", "line_home", "line_away"])
        for gm in games:
            sh, sa = gm["stats"]["H"], gm["stats"]["A"]
            w.writerow([gm["seed"], gm["innings"], gm["R_home"], gm["R_away"], sh["H"], sa["H"], sh["HR"], sa["HR"], sh["walk"] + sh["hbp"], sa["walk"] + sa["hbp"],
                        sh["strikeout"], sa["strikeout"], sh["E"], sa["E"], sh["pitches"], sa["pitches"], gm["starter_outs"]["H"] / 3, gm["starter_outs"]["A"] / 3,
                        " ".join(map(str, gm["line_home"])), " ".join(map(str, gm["line_away"]))])
    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        from bbsim.viz import palette as P
        fig, ax = plt.subplots(figsize=(7, 4))
        bins = np.arange(-0.5, 16.5, 1)
        ax.hist(runs, bins=bins, color=P.SERIES[0], alpha=0.85, label="model (%d team-games)" % tg)
        # MLB 2024 team runs per game distribution (approx. negative binomial fit, mean 4.39, sd 3.1)
        from math import lgamma, exp, log
        mu, sd = 4.39, 3.1; r_ = mu * mu / (sd * sd - mu); p_ = r_ / (r_ + mu)
        xs = np.arange(0, 16); pm = [exp(lgamma(x + r_) - lgamma(r_) - lgamma(x + 1) + r_ * log(p_) + x * log(1 - p_)) for x in xs]
        ax.plot(xs, np.array(pm) * tg, color=P.SERIES[1], marker="o", label="MLB 2024 (fit, mean 4.39)")
        ax.set_xlabel("runs per team per game"); ax.set_ylabel("count"); ax.legend(); ax.set_title("bbsim v1.4 nine-inning games vs MLB", fontsize=11)
        for s in ("top", "right"):
            ax.spines[s].set_visible(False)
        ax.grid(True, axis="y", color=P.GRID, linewidth=0.8); ax.set_axisbelow(True)
        fig.tight_layout(); fig.savefig(os.path.join(a.out, "runs_hist.png"), dpi=150)
    except Exception as e:
        print("plot skipped:", e)


if __name__ == "__main__":
    main()
