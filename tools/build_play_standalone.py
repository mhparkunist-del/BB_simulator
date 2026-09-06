"""Build a server-less gamer page: pre-simulate a bank of plate appearances and inject it into the template.

Usage: python3 tools/build_play_standalone.py [--version v1.0_0906] [--per 2] [--seed 7]
Bank key: "<batter_id>|<pitcher_id>|<bench_call>|<difficulty>" -> list of PA dicts (sanitized like the live gamer API).
Limits (by design, documented in docs/PLAYER_VIEW.md): each PA is simulated fresh (no pitch-to-pitch memory across
PAs, bases empty, 0 outs); base running and innings run in the browser.
"""
import argparse
import json
import os
import sys
import time

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
from serve_game import build_batter, build_catcher, build_pitcher, make_roster, sanitize_for_player  # noqa: E402
from bbsim import __version__  # noqa: E402
from bbsim.agents import GameContext  # noqa: E402
from bbsim.engine import EngineConfig, PlateAppearance, Umpire  # noqa: E402
from bbsim.engine.fielding import default_fielders  # noqa: E402

CALLS = ("none", "take", "bunt", "power")
DIFF = {"easy": 0.35, "normal": 0.5, "hard": 0.7}


FLIGHT_PTS = 28
BATTED_PTS = 40


def thin(row, n_f, n_b):
    """Down-sample flight samples in a sanitized pitch row (mobile build)."""
    def ds(fl, n):
        k = max(1, (len(fl["t"]) - 1) // (n - 1))
        idx = list(range(0, len(fl["t"]), k))
        if idx[-1] != len(fl["t"]) - 1:
            idx.append(len(fl["t"]) - 1)
        return {"t": [fl["t"][i] for i in idx], "xyz": [fl["xyz"][i] for i in idx], "rpm": fl["rpm"], "axis": fl["axis"]}
    row["flight"] = ds(row["flight"], n_f)
    if "batted" in row:
        row["batted"]["flight"] = ds(row["batted"]["flight"], n_b)
    return row


def compact(x):
    if isinstance(x, float):
        return round(x, 3)
    if isinstance(x, list):
        return [compact(v) for v in x]
    if isinstance(x, dict):
        return {k: compact(v) for k, v in x.items()}
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v1.0_0906")
    ap.add_argument("--per", type=int, default=2)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--mobile", action="store_true", help="smaller bank: 1 sample per combo, down-sampled flights, mobile flag")
    a = ap.parse_args()
    roster = make_roster(a.seed)
    bank = {}
    t0 = time.time()
    n_pa = 0
    for pit in roster["pitchers"]:
        pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
        for dname, level in DIFF.items():
            for bat in roster["batters"]:
                b = build_batter(bat["profile"], bat["id"])
                b.name = bat["profile"]["name"]
                for call in CALLS:
                    key = "%d|%d|%s|%s" % (bat["id"], pit["id"], call, dname)
                    bank[key] = []
                    for k in range(1 if a.mobile else a.per):
                        cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=default_fielders(level))
                        seed = (a.seed * 7919 + bat["id"] * 131 + pit["id"] * 17 + CALLS.index(call) * 3 + k) % (1 << 31)
                        pa = PlateAppearance(pitcher, build_catcher({}), b, cfg, seed=seed, new_game=(k == 0))
                        r = pa.run(GameContext(fielder_shift=("bunt" if call == "bunt" else call if call in ("take", "power") else "none")))
                        last = r.pitches[-1]
                        rows = sanitize_for_player(r, False, b.hand)
                        if a.mobile:
                            rows = [thin(x, 14, 20) for x in rows]
                        extra = {"outcome": r.outcome, "la": round(last.collision.launch_angle, 1) if (last.collision and last.collision.hit) else None,
                                 "dist": round(last.batted.landing_distance, 1) if last.batted is not None else 0.0,
                                 "wild": sum(1 for x in r.pitches if x.wild_pitch)}
                        bank[key].append(compact({"pitches": rows, **extra}))
                        n_pa += 1
    fielders = [{"pos": f.profile.position, "xy": [round(f.home[0], 1), round(f.home[1], 1)]} for f in default_fielders(0.5)]
    payload = {"version": __version__, "seed": a.seed, "calls": CALLS, "difficulties": list(DIFF),
               "roster": {"batters": [dict(b["card"], id=b["id"]) for b in roster["batters"]],
                          "pitchers": [dict(p["card"], id=p["id"]) for p in roster["pitchers"]]},
               "fielders": fielders, "bank": bank}
    js = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    tpl = open(os.path.join(ROOT, "web", "templates", "play_standalone.template.html"), encoding="utf-8").read()
    html = tpl.replace("/*__BANK__*/", js).replace("__VERSION__", a.version).replace("/*__MOBILE__*/", "true" if a.mobile else "false")
    out = os.path.join(ROOT, "web", ("play_mobile_%s.html" if a.mobile else "play_standalone_%s.html") % a.version)
    open(out, "w", encoding="utf-8").write(html)
    print("wrote %s: %d PA, %.1f MB, %.0f s" % (os.path.abspath(out), n_pa, len(html) / 1e6, time.time() - t0))


if __name__ == "__main__":
    main()
