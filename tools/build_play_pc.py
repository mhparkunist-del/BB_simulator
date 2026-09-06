"""PC gamer page with a pitch-level bank: every (batter, pitcher, bench call, count) has pre-simulated pitches,
so a bench sign pressed between pitches applies to the very next pitch and innings can be auto-played.

Usage: python3 tools/build_play_pc.py [--version v1.0_0906] [--per 3] [--seed 7]
Bank key: "<batter_id>|<pitcher_id>|<call>|<balls>|<strikes>" -> list of sanitized pitch rows (+ outcome fields).
The page also gets each pitcher's release-pose joints (from physics/body.py) and batter heights for the
ergonomic figure view. Limits: bases empty / 0 outs during pre-simulation; batter memory is warmed with two PAs.
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
from serve_game import admin_row, build_batter, build_catcher, build_pitcher, make_fielders, make_opponent, make_roster, sanitize_for_player  # noqa: E402
from bbsim import __version__  # noqa: E402
from bbsim.agents import GameContext  # noqa: E402
from bbsim.engine import EngineConfig, PlateAppearance, Umpire  # noqa: E402
from bbsim.engine.fielding import DEFAULT_POSITIONS, default_fielders  # noqa: E402
from bbsim.physics.constants import PLATE_FRONT_Y  # noqa: E402

CALLS = ("none", "take", "bunt", "power")
COUNTS = [(b, s) for b in range(4) for s in range(3)]


class _Res:
    def __init__(self, rec):
        self.pitches = [rec]


def compact(x):
    if isinstance(x, float):
        return round(x, 3)
    if isinstance(x, list):
        return [compact(v) for v in x]
    if isinstance(x, dict):
        return {k: compact(v) for k, v in x.items()}
    return x


def thin(row, n_f=18, n_b=24):
    def ds(fl, n):
        m = len(fl["t"])
        idx = sorted(set(int(round(i * (m - 1) / (n - 1))) for i in range(n))) if m > n else list(range(m))
        return {"t": [fl["t"][i] for i in idx], "xyz": [[round(v[0], 2), round(v[1], 2), round(v[2], 2)] for v in (fl["xyz"][i] for i in idx)],
                "rpm": fl["rpm"], **({"axis": fl["axis"]} if fl.get("axis") else {})}
    row["flight"] = ds(row["flight"], n_f)
    fd = row.get("fielding")
    if fd and fd.get("ground") and fd["ground"].get("t"):           # ground samples: at most 16 points, 1 cm rounding is enough
        g = fd["ground"]; m = len(g["t"]); n = min(16, m)
        idx = sorted(set(int(round(i * (m - 1) / (n - 1))) for i in range(n))) if m > n else list(range(m))
        fd["ground"] = {"t": [g["t"][i] for i in idx], "xyz": [[round(g["xyz"][i][0], 1), round(g["xyz"][i][1], 1), round(g["xyz"][i][2], 2)] for i in idx]}
    if fd and fd.get("positions"):
        fd["positions"] = {k: [round(v[0]), round(v[1])] for k, v in fd["positions"].items()}
    if "batted" in row:
        row["batted"]["flight"] = ds(row["batted"]["flight"], n_b)
    return row


def pitcher_figure(p):
    """Joints of the release pose (m) for the figure view; elbow approximated on the shoulder->hand line."""
    pose = p.pose
    sh, rel, pel = pose.shoulder, pose.release, pose.pelvis
    side = -1.0 if p.hand.upper().startswith("R") else 1.0
    up = np.array([0.0, 0.0, 1.0])
    d = rel - sh
    elbow = sh + 0.52 * d + (-side) * 0.08 * np.cross(d / max(np.linalg.norm(d), 1e-6), up)
    sh_c = sh.copy(); sh_c[0] -= side * 0.19
    sh_g = sh_c.copy(); sh_g[0] -= side * 0.19
    head = sh_c + np.array([0.0, 0.05, 0.28])
    glove = sh_g + np.array([-side * 0.25, -0.35, -0.15])
    return {"hand": p.hand, "height": p.profile.height, "arm_angle": round(float(pose.arm_angle_deg), 1),
            "rubber_y": 18.44, "stride": round(float(18.44 - pose.front_foot[1]), 2),   # rubber -> front foot (real stride)
            "extension": round(float(pose.extension), 2),
            "joints": {k: [round(float(v[0]), 3), round(float(v[1]), 3), round(float(v[2]), 3)] for k, v in
                       {"release": rel, "elbow": elbow, "shoulder": sh, "shoulder_c": sh_c, "shoulder_g": sh_g, "glove": glove,
                        "head": head, "pelvis": pel, "front_foot": pose.front_foot, "rear_foot": pose.rear_foot}.items()}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v1.0_0906")
    ap.add_argument("--per", type=int, default=3)
    ap.add_argument("--per-def", type=int, default=None, help="pitches per (opponent batter, our pitcher, defensive call, count); default = --per")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--admin", action="store_true", help="test mode: include every internal field and hidden attributes")
    a = ap.parse_args()
    roster = make_roster(a.seed)
    bank = {}
    figures = {}
    t0 = time.time()
    n = 0
    opp = make_opponent(a.seed)
    per_def = a.per_def or a.per
    DCALLS = ("none", "inside", "outside", "infield_in", "outfield_deep")

    def simulate(pit, pitcher, batters, calls, prefix, per, seed_off):
        nonlocal n
        for bat in batters:
            b = build_batter(bat["profile"], bat["id"])
            b.name = bat["profile"]["name"]
            # top half: the opponent's fielders (seed+1000); bottom half: ours (seed) -- varied arms, so hops and relays happen
            cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=make_fielders(a.seed + (1000 if prefix == "" else 0)))
            pa = PlateAppearance(pitcher, build_catcher({}), b, cfg, seed=(a.seed * 977 + seed_off + bat["id"] * 31 + pit["id"]) % (1 << 31), new_game=True)
            for w in range(2):                                   # warm-up: memory of this pitcher
                pa.run(GameContext())
            for call in calls:
                shift = call if call != "none" else "none"
                for (balls, strikes) in COUNTS:
                    key = "%s%d|%d|%s|%d|%d" % (prefix, bat["id"], pit["id"], call, balls, strikes)
                    bank[key] = []
                    for k in range(per):
                        ctx = GameContext(balls=balls, strikes=strikes, fielder_shift=shift, batter_hand=b.hand, pitcher_hand=pitcher.hand,
                                          pitcher_id=pitcher.name, batter_id=b.name, zone_top=pa.zone.top, zone_bottom=pa.zone.bottom,
                                          pitch_count=pitcher.pitch_count, umpire_low_shift=0.02)
                        rec = pa.pitch_once(ctx, balls + strikes)
                        pa._batter_learns(rec)
                        if a.admin:
                            row = admin_row(rec, 0, 0, b.name, cfg.fielders)
                            row["batter_hand"] = b.hand
                        else:
                            row = sanitize_for_player(_Res(rec), False, b.hand)[0]
                        row = thin(row)
                        row["kind"] = rec.play.kind if rec.play is not None else None
                        row["la"] = round(rec.collision.launch_angle, 1) if (rec.collision is not None and rec.collision.hit) else None
                        row["dist"] = round(rec.batted.landing_distance, 1) if rec.batted is not None else 0.0
                        if rec.fielding is not None:
                            row["fielding"]["hang"] = round(rec.fielding.hang, 2)
                        bank[key].append(compact(row))
                        n += 1
            if pitcher.pitch_count > 60:
                pitcher.begin_game(np.random.default_rng(bat["id"]))   # keep the pitcher fresh across batters

    for pit in roster["pitchers"]:
        pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
        figures[str(pit["id"])] = pitcher_figure(pitcher)
        simulate(pit, pitcher, roster["batters"], CALLS, "", a.per, 0)                 # top half: our batters vs this (opponent) profile
        print("  pitcher %s (top) done, %d pitches, %.0f s" % (pit["card"]["name"], n, time.time() - t0))
        pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
        simulate(pit, pitcher, opp["batters"], DCALLS, "D|", per_def, 5000)              # bottom half: opponent batters vs our pitcher, defensive calls
        print("  pitcher %s (bottom) done, %d pitches, %.0f s" % (pit["card"]["name"], n, time.time() - t0))
    fielders = [{"pos": f.profile.position, "xy": [round(f.home[0], 1), round(f.home[1], 1)]} for f in default_fielders(0.5)]
    payload = {"version": __version__, "seed": a.seed, "calls": CALLS,
               "roster": {"batters": [dict(b["card"], id=b["id"], height=round(b["profile"].get("height", 1.85), 2),
                                           **({"attrs": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in b["profile"].items()}} if a.admin else {}))
                                      for b in roster["batters"]],
                          "pitchers": [dict(p["card"], id=p["id"], **({"profile_id": p["profile_id"]} if a.admin else {})) for p in roster["pitchers"]],
                          "opp": {"batters": [dict(b["card"], id=b["id"], height=round(b["profile"].get("height", 1.85), 2), **({"attrs": compact(b["profile"])} if a.admin else {})) for b in opp["batters"]],
                                  "pitchers": [dict(p["card"], id=p["id"], **({"profile_id": p["profile_id"]} if a.admin else {})) for p in opp["pitchers"]]}},
               "admin": bool(a.admin),
               "figures": figures, "fielders": fielders, "plate_front_y": PLATE_FRONT_Y, "bank": bank}
    js = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=lambda o: o.item() if hasattr(o, "item") else str(o))
    tpl = open(os.path.join(ROOT, "web", "templates", "play_pc.template.html"), encoding="utf-8").read()
    html = tpl.replace("/*__BANK__*/", js).replace("__VERSION__", a.version + (" · 관리자 모드(모든 정보 표시)" if a.admin else ""))
    if a.admin:
        html = html.replace("<title>덕아웃 나이트게임 PC</title>", "<title>덕아웃 나이트게임 PC 관리자</title>", 1)
    out = os.path.join(ROOT, "web", ("play_pc_admin_%s.html" if a.admin else "play_pc_%s.html") % a.version)
    open(out, "w", encoding="utf-8").write(html)
    print("wrote %s: %d pitches, %.1f MB, %.0f s" % (os.path.abspath(out), n, len(html) / 1e6, time.time() - t0))


if __name__ == "__main__":
    main()
