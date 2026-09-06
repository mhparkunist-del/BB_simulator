"""Build the web app's data files (web/app/data): one club (engine-backed batters and starters + quick-sim extras),
the opponent club, the season schedule, the free-agent pool, and the pitch banks split per (pitcher, batter) pair so the
app fetches ~100 KB when a plate appearance starts instead of embedding 15 MB.

Usage: python3 tools/build_app.py [--seed 7] [--per 2] [--per-def 2] [--preview]
  --preview  also writes web/app_preview_<version>.html: the app bundled into one file with a small bank subset
             (our batters vs the first opponent starter, the opponent batters vs our first starter) for the artifact viewer.
Data layout:
  data/roster.json   {batters, pitchers, opp:{batters, pitchers}, figures, fielders, calls, version}
  data/club.json     {club, players, free_agents, opponents, schedule, programs, ko, bat_keys, pit_keys, date0, days}
  data/bank/top_<p>_<b>.json   {"<b>|<p>|<call>|<balls>|<strikes>": [rows]}   our batter b vs opponent pitcher profile p
  data/bank/bot_<p>_<b>.json   {"D|<b>|<p>|<call>|<balls>|<strikes>": [rows]} opponent batter b vs our pitcher profile p
"""
import argparse
import datetime as dt
import json
import os
import sys
import time

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
from serve_game import PARAMS, build_batter, build_catcher, build_pitcher, make_fielders, make_opponent, make_roster, sanitize_for_player  # noqa: E402
from build_play_pc import CALLS, COUNTS, _Res, compact, pitcher_figure, thin  # noqa: E402
from build_club import GIVEN, OPP_NAMES, PROGRAMS, SURNAMES, grade, make_player  # noqa: E402
from bbsim import __version__  # noqa: E402
from bbsim.agents import GameContext  # noqa: E402
from bbsim.engine import EngineConfig, PlateAppearance, Umpire  # noqa: E402
from bbsim.engine.fielding import default_fielders  # noqa: E402
from bbsim.physics.constants import PLATE_FRONT_Y  # noqa: E402

DCALLS = ("none", "inside", "outside", "infield_in", "outfield_deep")
POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "C", "2B", "SS"]
APP = os.path.join(ROOT, "web", "app")


def club_batter(rng, i, bat, pos):
    """A club player record for an engine-backed batter (make_roster profile -> visible grades + hidden club attrs)."""
    pr = bat["profile"]
    p = make_player(rng, i, "B", pos=pos, name=SURNAMES[i % len(SURNAMES)] + GIVEN[(i * 5 + 3) % len(GIVEN)])
    contact = float(np.mean([pr["recognition"], pr["tracking"], pr["barrel_placement"], pr["timing"]]))
    power = float(np.clip(0.5 * pr["power"] + 0.5 * (pr["bat_speed"] - 27) / 9, 0, 1))
    eye = float(np.mean([pr["discipline"], pr["recognition"]]))
    p["attrs"].update({"contact": round(contact, 3), "power": round(power, 3), "eye": round(eye, 3), "speed": round(float(pr.get("speed", 0.5)), 3), "run_iq": round(float(pr.get("run_iq", 0.5)), 3)})
    p["pot"]["run_iq"] = round(float(np.clip(p["attrs"]["run_iq"] + rng.uniform(0.02, 0.25) * max(0.0, (30 - p["age"]) / 11.0), p["attrs"]["run_iq"], 0.98)), 3)
    for k in ("contact", "power", "eye", "speed", "run_iq"):
        p["pot"][k] = round(float(np.clip(max(p["attrs"][k], p["pot"][k]), p["attrs"][k], 0.98)), 3)
        p["grades"][k] = bat["card"][k]
    p["hand"] = pr["hand"]
    p["engine_id"] = bat["id"]
    p["height"] = round(float(pr.get("height", 1.85)), 2)
    return p


def club_pitcher(rng, i, pit):
    """A club starter backed by an engine profile."""
    pr = next(x for x in PARAMS["profiles"] if x["id"] == pit["profile_id"])
    p = make_player(rng, i, "P", role="SP", name=SURNAMES[(i * 3) % len(SURNAMES)] + GIVEN[(i * 11 + 7) % len(GIVEN)])
    stuff = float(np.clip((pr["mph"] - 80) / 18, 0, 1)); ctrl = float(np.clip(1 - (pr["cmd"] - 0.12) / 0.16, 0, 1))
    p["attrs"].update({"stuff": round(stuff, 3), "control": round(ctrl, 3)})
    for k in ("stuff", "control"):
        p["pot"][k] = round(float(np.clip(max(p["attrs"][k], p["pot"][k]), p["attrs"][k], 0.98)), 3)
    p["grades"].update({"stuff": pit["card"]["stuff"], "control": pit["card"]["control"], "stamina": pit["card"]["stamina"]})
    p["hand"] = pit["card"]["hand"]
    p["engine_id"] = pit["id"]
    p["form"] = pit["card"].get("form", "")
    return p


def simulate_pair(pit, pitcher, bat, calls, prefix, per, seed, seed_off, fielders):
    """All (call, count) pitches for one pitcher-batter pair -> {key: [rows]}."""
    out = {}
    b = build_batter(bat["profile"], bat["id"])
    b.name = bat["profile"]["name"]
    cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=fielders)
    pa = PlateAppearance(pitcher, build_catcher({}), b, cfg, seed=(seed * 977 + seed_off + bat["id"] * 31 + pit["id"]) % (1 << 31), new_game=True)
    for w in range(2):
        pa.run(GameContext())
    for call in calls:
        for (balls, strikes) in COUNTS:
            key = "%s%d|%d|%s|%d|%d" % (prefix, bat["id"], pit["id"], call, balls, strikes)
            out[key] = []
            for k in range(per):
                ctx = GameContext(balls=balls, strikes=strikes, fielder_shift=call, batter_hand=b.hand, pitcher_hand=pitcher.hand,
                                  pitcher_id=pitcher.name, batter_id=b.name, zone_top=pa.zone.top, zone_bottom=pa.zone.bottom,
                                  pitch_count=pitcher.pitch_count, umpire_low_shift=0.02)
                rec = pa.pitch_once(ctx, balls + strikes)
                pa._batter_learns(rec)
                row = sanitize_for_player(_Res(rec), False, b.hand)[0]
                row = thin(row)
                row["kind"] = rec.play.kind if rec.play is not None else None
                row["la"] = round(rec.collision.launch_angle, 1) if (rec.collision is not None and rec.collision.hit) else None
                row["dist"] = round(rec.batted.landing_distance, 1) if rec.batted is not None else 0.0
                if rec.fielding is not None:
                    row["fielding"]["hang"] = round(rec.fielding.hang, 2)
                out[key].append(compact(row))
    if pitcher.pitch_count > 60:
        pitcher.begin_game(np.random.default_rng(bat["id"]))
    return out


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), default=lambda o: o.item() if hasattr(o, "item") else str(o))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--per", type=int, default=2)
    ap.add_argument("--per-def", type=int, default=None)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--version", default="v2.0_0906")
    ap.add_argument("--skip-bank", action="store_true", help="only rebuild roster/club data")
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed + 99)
    roster = make_roster(a.seed)
    opp = make_opponent(a.seed)
    # ---- club players: 12 engine batters, 5 engine starters, 8 quick-sim relievers, 1 bench batter
    players = [club_batter(rng, i, bat, POSITIONS[i]) for i, bat in enumerate(roster["batters"])]
    players += [club_pitcher(rng, 100 + j, pit) for j, pit in enumerate(roster["pitchers"])]
    players += [make_player(rng, 200 + k, "P", role="RP") for k in range(8)]
    players.append(make_player(rng, 300, "B", pos="OF"))
    for p in players:
        p["active"] = True
    players[-1]["active"] = False
    for p in [x for x in players if x["type"] == "P" and x["role"] == "RP"][-2:]:
        p["active"] = False
    fa = []
    for k in range(8):
        kind = "B" if k < 5 else "P"
        p = make_player(rng, 400 + k, kind, pos=(["1B", "LF", "SS", "C", "RF"][k] if kind == "B" else None), role=(None if kind == "B" else ["SP", "RP", "RP"][k - 5]))
        p["active"] = False; p["asking"] = round(p["contract"]["salary"] * 1.25, 1)
        fa.append(p)
    # ---- opponents: five clubs; the physics opponent roster (9 batters, 5 starters) is shared, strengths differ
    ob = [b["profile"] for b in opp["batters"]]
    obat = float(np.mean([np.mean([x["recognition"], x["tracking"], x["barrel_placement"], x["timing"]]) for x in ob]))
    opps = [{"id": j + 1, "name": n, "bat": round(float(np.clip(obat + rng.normal(0, 0.06), 0.35, 0.75)), 2), "pitch": round(float(rng.uniform(0.42, 0.68)), 2),
             "def": round(float(rng.uniform(0.42, 0.66)), 2), "W": 0, "L": 0, "starter": j} for j, n in enumerate(OPP_NAMES)]
    d0 = dt.date(2026, 4, 3)
    sched, g, day = [], 1, 0
    while g <= 30:
        d = d0 + dt.timedelta(days=day)
        if d.weekday() != 0:
            sched.append({"g": g, "date": d.isoformat(), "opp": ((g - 1) // 3) % 5 + 1, "home": ((g - 1) // 3) % 2 == 0, "result": None})
            g += 1
        day += 1
    club = {"version": a.version, "club": {"name": "덕아웃 나이트", "budget": 60.0, "staff": {"batting": 0.6, "pitching": 0.55, "conditioning": 0.5, "medical": 0.5}},
            "date0": d0.isoformat(), "days": day + 2, "players": players, "free_agents": fa, "opponents": opps, "schedule": sched,
            "programs": PROGRAMS, "ko": {"contact": "컨택", "power": "파워", "eye": "선구", "speed": "주력", "defense": "수비", "arm": "송구", "stuff": "구위", "control": "제구", "stamina": "체력", "movement": "무브먼트", "run_iq": "판단"},
            "bat_keys": ["contact", "power", "eye", "speed", "run_iq", "defense", "arm"], "pit_keys": ["stuff", "control", "stamina", "movement"]}
    dump(os.path.join(APP, "data", "club.json"), club)
    # ---- game roster (what the game screen needs) with club names
    name_of = {p["engine_id"]: p["name"] for p in players if "engine_id" in p and p["type"] == "B"}
    pname_of = {p["engine_id"]: p["name"] for p in players if "engine_id" in p and p["type"] == "P"}
    figures = {}
    for pit in roster["pitchers"]:
        figures[str(pit["id"])] = pitcher_figure(build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]}))
    game_roster = {"version": __version__, "seed": a.seed, "calls": CALLS, "dcalls": DCALLS,
                   "batters": [dict(b["card"], id=b["id"], name=name_of.get(b["id"], b["card"]["name"]), height=round(b["profile"].get("height", 1.85), 2), speed=next(p["grades"]["speed"] for p in players if p.get("engine_id") == b["id"] and p["type"] == "B")) for b in roster["batters"]],
                   "pitchers": [dict(p["card"], id=p["id"], name=pname_of.get(p["id"], p["card"]["name"])) for p in roster["pitchers"]],
                   "opp": {"batters": [dict(b["card"], id=b["id"], height=round(b["profile"].get("height", 1.85), 2)) for b in opp["batters"]],
                           "pitchers": [dict(p["card"], id=p["id"]) for p in opp["pitchers"]]},
                   "figures": figures, "fielders": [{"pos": f.profile.position, "xy": [round(f.home[0], 1), round(f.home[1], 1)]} for f in default_fielders(0.5)],
                   "plate_front_y": PLATE_FRONT_Y, "admin": False}
    dump(os.path.join(APP, "data", "roster.json"), game_roster)
    print("club.json: %d players, roster.json written" % len(players))
    if a.skip_bank:
        return
    # ---- banks per pair
    per_def = a.per_def or a.per
    t0 = time.time(); n = 0
    for pit in roster["pitchers"]:
        pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
        for bat in roster["batters"]:
            rows = simulate_pair(pit, pitcher, bat, CALLS, "", a.per, a.seed, 0, make_fielders(a.seed + 1000))
            dump(os.path.join(APP, "data", "bank", "top_%d_%d.json" % (pit["id"], bat["id"])), rows); n += sum(len(v) for v in rows.values())
        pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
        for bat in opp["batters"]:
            rows = simulate_pair(pit, pitcher, bat, DCALLS, "D|", per_def, a.seed, 5000, make_fielders(a.seed))
            dump(os.path.join(APP, "data", "bank", "bot_%d_%d.json" % (pit["id"], bat["id"])), rows); n += sum(len(v) for v in rows.values())
        print("  pitcher %d done: %d pitches, %.0f s" % (pit["id"], n, time.time() - t0))
    print("bank files written: %d pitches" % n)


if __name__ == "__main__":
    main()
