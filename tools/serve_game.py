"""Local matchup server for the v1 platform (승부 플랫폼).

Usage:  python3 tools/serve_game.py [--port 8765] [--page web/game_v1.0.1_0906.html]
Then open http://localhost:8765/ (VS Code forwards the port automatically).

API
  GET  /                      -> the HTML page
  GET  /api/profiles          -> pitcher profiles / forms / grips / attribute lists (from pitching_params.json)
  POST /api/simulate          -> body: {"pitcher": {...}, "catcher": {...}, "lineup": [{...}, ...],
                                        "seed": 1, "innings": 1}
                                 returns: {"innings": [...], "pitches": [...], "summary": {...}}
Everything runs in Python (physics + agents); the page only renders.
"""
import argparse
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from bbsim import __version__
from bbsim.agents import BatterProfile, CatcherProfile, HeuristicCatcher, HeuristicPitcher, PerceptiveBatter
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, Umpire
from bbsim.engine.inning import HalfInning
from bbsim.engine.game import Game
import uuid
from bbsim.engine.fielding import DEFAULT_POSITIONS, default_fielders
from bbsim.agents.fielder import Fielder, FielderProfile
from bbsim.physics.body import PARAMS
from bbsim.physics.constants import MS_TO_MPH, PLATE_FRONT_Y

ROOT = os.path.join(os.path.dirname(__file__), "..")
PITCHER_FIELDS = ("mph", "eff", "cmd", "wrist_speed", "finger_len", "grip_force", "grip_skill", "abd", "tilt", "lean", "stride", "fwd", "core", "height", "hand")
BATTER_FIELDS = ("recognition", "discipline", "tracking", "composure", "reaction", "boldness", "barrel_placement", "timing",
                 "swing_quickness", "path_control", "barrel_accuracy", "power", "spray_control", "guess_hitting", "stamina", "focus",
                 "game_sense", "bat_speed", "bat_mass", "speed", "run_iq", "hand", "height", "name")
FIELDER_FIELDS = ("sprint_speed", "wingspan", "first_step", "route", "ball_reading", "glove", "arm_strength", "arm_accuracy",
                  "transfer", "positioning", "composure", "focus", "stamina", "name")
FIELDER_RANGES = {k: (0, 1) for k in FIELDER_FIELDS}


def build_fielders(req):
    """req['fielders']: {position: {...}} or {'level': 0.5}; missing positions get the level default."""
    d = req.get("fielders") or {}
    level = float(d.get("level", 0.5)) if isinstance(d, dict) else 0.5
    base = {f.profile.position: f for f in default_fielders(level)}
    for pos, spec in (d.items() if isinstance(d, dict) else []):
        if pos not in base or not isinstance(spec, dict):
            continue
        kw = _clean(spec, FIELDER_FIELDS, FIELDER_RANGES)
        kw["name"] = str(spec.get("name") or pos)
        base[pos] = Fielder(FielderProfile(position=pos, **kw), DEFAULT_POSITIONS[pos])
    return [base[p] for p in DEFAULT_POSITIONS]


CATCHER_FIELDS = ("game_iq", "scouting_accuracy", "observation", "umpire_read", "pitcher_weight", "sequencing", "framing", "blocking",
                  "arm", "rapport", "composure")


def _sample(traj, n=28):
    """Down-sample a trajectory to n points [t, x, y, z] plus spin (rpm) for the renderer."""
    t, p = traj.t, traj.pos
    idx = np.unique(np.linspace(0, len(t) - 1, n).astype(int))
    w = traj.spin[0]
    return {"t": t[idx].round(4).tolist(), "xyz": p[idx].round(3).tolist(), "rpm": float(np.linalg.norm(w) * 60 / (2 * np.pi)),
            "axis": (w / max(np.linalg.norm(w), 1e-9)).round(3).tolist()}


def _clean(d, fields, ranges):
    out = {}
    for k in fields:
        v = d.get(k)
        if v is None:
            continue
        if isinstance(v, (int, float)):
            if v != v:                     # NaN
                continue
            lo, hi = ranges.get(k, (-1e9, 1e9))
            v = float(min(max(v, lo), hi))
        out[k] = v
    if "hand" in out and str(out["hand"]).upper() not in ("L", "R"):
        out["hand"] = "R"
    return out


PITCHER_RANGES = {"mph": (55, 106), "cmd": (0.03, 0.6), "core": (0, 1), "abd": (40, 140), "tilt": (-30, 80), "lean": (0, 60),
                  "stride": (0.5, 1.1), "fwd": (0, 60), "wrist_speed": (0, 100), "finger_len": (0, 100), "grip_force": (0, 100),
                  "grip_skill": (0, 100), "eff": (0.3, 1.0), "height": (1.5, 2.2)}
BATTER_RANGES = {k: (0, 1) for k in BATTER_FIELDS}
BATTER_RANGES.update({"bat_speed": (20, 40), "bat_mass": (0.7, 1.1), "height": (1.5, 2.2)})


def build_pitcher(d):
    if d.get("profile") not in [p["id"] for p in PARAMS["profiles"]]:
        d = dict(d, profile="B")
    base = PitcherProfile.from_params(d.get("profile", "B"))
    kw = _clean(d, PITCHER_FIELDS, PITCHER_RANGES)
    if "repertoire" in d:
        kw["repertoire"] = tuple(d["repertoire"])
    from dataclasses import replace
    p = HeuristicPitcher(replace(base, **kw))
    p.name = d.get("name", "P-%s" % d.get("profile", "B"))
    return p


def build_batter(d, i=0):
    kw = _clean(d, BATTER_FIELDS, BATTER_RANGES)
    kw["name"] = str(d.get("name") or "타자%d" % (i + 1))
    return PerceptiveBatter(BatterProfile(**kw))


def build_catcher(d):
    return HeuristicCatcher(CatcherProfile(**_clean(d, CATCHER_FIELDS, {k: (0, 1) for k in CATCHER_FIELDS})))


def admin_row(rec, inn=0, k=0, batter_name="", fielders=None):
    """Everything the engine knows about one pitch (admin / test mode)."""
    cb = rec.context_before
    d = rec.decision
    plate = rec.pitch.plate
    row = {"inning": inn, "pa": k, "batter": batter_name, "count": [cb.balls, cb.strikes], "outs": cb.outs,
           "runners": list(cb.runners), "code": rec.call.code, "zone": rec.call.zone,
           "intent": [rec.intent.code, rec.intent.zone], "intent_reasons": list(rec.intent.reasons[:4]),
           "sign": [rec.sign.code, rec.sign.zone], "sign_reasons": list(rec.sign.reasons[:4]), "shake_offs": rec.call.shake_offs,
           "target_xz": [round(float(rec.call.target_xz[0]), 3), round(float(rec.call.target_xz[1]), 3)], "sigma": round(float(rec.sigma_used), 3),
           "mph": round(float(np.linalg.norm(rec.pitch.trajectory.vel[0])) * MS_TO_MPH, 1),
           "rpm": round(float(np.linalg.norm(rec.pitch.trajectory.spin[0])) * 60 / (2 * np.pi)),
           "plate_xz": [round(float(plate.pos[0]), 3), round(float(plate.pos[2]), 3)] if plate is not None else None,
           "zone_top": cb.zone_top, "zone_bottom": cb.zone_bottom,
           "swing": bool(d.swing), "decision_note": d.note, "predicted_xz": [round(v, 3) for v in d.predicted_xz] if d.predicted_xz else None,
           "tipped": bool(getattr(d, "tipped", False)), "adjusted": bool(getattr(d, "adjusted", False)), "checked": bool(getattr(d, "checked", False)),
           "late_shift": [round(float(v), 3) for v in getattr(d, "late_shift", (0.0, 0.0))],
           "result": rec.result, "umpire": rec.umpire_call, "wild_pitch": rec.wild_pitch, "in_dirt": rec.in_dirt,
           "flight": _sample(rec.pitch.trajectory), "eye": np.asarray(rec.observation.eye_pos).round(3).tolist(),
           "contact_y": rec.observation.contact_y, "t_deadline": round(rec.observation.t_deadline, 4),
           "batter_hand": cb.batter_hand, "text": commentary(rec, cb, cb.batter_hand)}
    if rec.collision is not None and rec.collision.hit:
        c = rec.collision
        row["contact"] = {"ev_mph": round(c.exit_speed * MS_TO_MPH, 1), "la": round(c.launch_angle, 1),
                          "spray": round(c.spray_angle, 1), "spin_rpm": round(c.spin_rpm, 0),
                          "offset_v_cm": round(100 * rec.contact_offsets["vertical_m"], 1),
                          "offset_a_cm": round(100 * rec.contact_offsets["axial_m"], 1),
                          "timing_ms": round(1000 * rec.contact_offsets["timing_error_s"], 1),
                          "bat_speed": round(d.bat_speed * MS_TO_MPH, 1)}
        if rec.batted is not None:
            row["batted"] = {"flight": _sample(rec.batted.trajectory, 40), "distance": round(rec.batted.landing_distance, 1),
                             "hang": round(float(rec.batted.trajectory.t[-1]), 2)}
        if rec.play is not None:
            row["play"] = {"kind": rec.play.kind, "note": rec.play.detail, "text": spectator_play_text(rec)}
        if rec.fielding is not None:
            row["fielding"] = rec.fielding.to_dict()
            row["fielders"] = [{"pos": f.profile.position, "name": f.name, "xy": [round(f.pos[0], 1), round(f.pos[1], 1)]} for f in (fielders or [])]
    return row


def simulate(req):
    t0 = time.time()
    pitcher = build_pitcher(req.get("pitcher", {}))
    catcher = build_catcher(req.get("catcher", {}))
    lineup = [build_batter(b, i) for i, b in enumerate((req.get("lineup") or [{}])[:15])]
    try:
        seed = int(req.get("seed", 1)) % (1 << 31)
    except (TypeError, ValueError):
        seed = 1
    n_inn = max(1, min(9, int(req.get("innings", 1) or 1)))
    fielders = build_fielders(req) if req.get("fielders", True) not in (False, None, "off") else None
    cfg = EngineConfig(umpire=Umpire(low_shift=float(req.get("umpire_low_shift", 0.02))), fielders=fielders)
    innings, pitches = [], []
    idx, total_runs = 0, 0
    for inn in range(1, n_inn + 1):
        hi = HalfInning(pitcher, catcher, lineup, cfg, seed=seed, inning=inn, batter_index=idx, new_game=(inn == 1))
        r = hi.play()
        idx = r.next_batter_index
        total_runs += r.runs
        pa_events = [e for e in r.events if e["type"] == "pa"]
        for k, pa in enumerate(r.plate_appearances):
            ev = pa_events[k]
            for rec in pa.pitches:
                cb = rec.context_before
                d = rec.decision
                plate = rec.pitch.plate
                row = {"inning": inn, "pa": k, "batter": ev["batter"], "count": [cb.balls, cb.strikes], "outs": cb.outs,
                       "runners": list(cb.runners), "code": rec.call.code, "zone": rec.call.zone,
                       "intent": [rec.intent.code, rec.intent.zone], "sign": [rec.sign.code, rec.sign.zone],
                       "sign_reasons": rec.sign.reasons[:3], "shake_offs": rec.call.shake_offs,
                       "mph": round(float(np.linalg.norm(rec.pitch.trajectory.vel[0])) * MS_TO_MPH, 1),
                       "plate_xz": [round(float(plate.pos[0]), 3), round(float(plate.pos[2]), 3)] if plate is not None else None,
                       "zone_top": cb.zone_top, "zone_bottom": cb.zone_bottom,
                       "swing": bool(d.swing), "decision_note": d.note, "predicted_xz": [round(v, 3) for v in d.predicted_xz] if d.predicted_xz else None,
                       "result": rec.result, "umpire": rec.umpire_call, "wild_pitch": rec.wild_pitch,
                       "flight": _sample(rec.pitch.trajectory), "eye": np.asarray(rec.observation.eye_pos).round(3).tolist(),
                       "contact_y": rec.observation.contact_y, "t_deadline": round(rec.observation.t_deadline, 4)}
                if rec.collision is not None and rec.collision.hit:
                    c = rec.collision
                    row["contact"] = {"ev_mph": round(c.exit_speed * MS_TO_MPH, 1), "la": round(c.launch_angle, 1),
                                      "spray": round(c.spray_angle, 1), "spin_rpm": round(c.spin_rpm, 0),
                                      "offset_v_cm": round(100 * rec.contact_offsets["vertical_m"], 1),
                                      "offset_a_cm": round(100 * rec.contact_offsets["axial_m"], 1),
                                      "timing_ms": round(1000 * rec.contact_offsets["timing_error_s"], 1),
                                      "bat_speed": round(d.bat_speed * MS_TO_MPH, 1)}
                    if rec.batted is not None:
                        row["batted"] = {"flight": _sample(rec.batted.trajectory, 40), "distance": round(rec.batted.landing_distance, 1),
                                         "hang": round(float(rec.batted.trajectory.t[-1]), 2)}
                    if rec.play is not None:
                        row["play"] = {"kind": rec.play.kind, "note": rec.play.detail}
                    if rec.fielding is not None:
                        row["fielding"] = rec.fielding.to_dict()
                        row["fielders"] = [{"pos": f.profile.position, "name": f.name, "xy": [round(f.pos[0], 1), round(f.pos[1], 1)]} for f in fielders]
                pitches.append(row)
        innings.append({"inning": inn, "runs": r.runs, "outs": r.outs, "pitches": r.pitches, "events": r.events})
    summary = {"runs": total_runs, "pitches": len(pitches), "pitch_count": pitcher.pitch_count, "seconds": round(time.time() - t0, 2),
               "version": __version__, "fatigue": round(pitcher.fatigue_level(), 2),
               "chain": {k: round(v, 3) for k, v in pitcher.chain.items() if isinstance(v, (int, float))},
               "arm_angle": round(pitcher.pose.arm_angle_deg, 1),
               "fielders": [{"pos": f.profile.position, "name": f.name, "xy": [round(f.home[0], 1), round(f.home[1], 1)]} for f in (fielders or [])],
               "contact_y": PLATE_FRONT_Y + 0.15, "plate_front_y": PLATE_FRONT_Y}
    return {"innings": innings, "pitches": pitches, "summary": summary}


def profiles_payload():
    return {"profiles": [dict(p, core=p.get("core", 0.7)) for p in PARAMS["profiles"]], "forms": PARAMS.get("forms", {}), "grips": {k: {"name": v["name"]} for k, v in PARAMS["grips"].items()},
            "batter_fields": BATTER_FIELDS, "catcher_fields": CATCHER_FIELDS, "pitcher_fields": PITCHER_FIELDS,
            "fielder_fields": FIELDER_FIELDS, "positions": list(DEFAULT_POSITIONS), "version": __version__}



# ====================================================================== gamer view (v1.3)
GAMES = {}
ZONE_WORDS = {(-1, 1): "바깥쪽 높은", (0, 1): "높은", (1, 1): "몸쪽 높은", (-1, 0): "바깥쪽", (0, 0): "가운데", (1, 0): "몸쪽",
              (-1, -1): "바깥쪽 낮은", (0, -1): "낮은", (1, -1): "몸쪽 낮은"}


def _grade(x):
    return "S" if x >= 0.8 else "A" if x >= 0.65 else "B" if x >= 0.5 else "C" if x >= 0.35 else "D"


def make_roster(seed):
    """12 batters + 5 pitchers with hidden attributes; the gamer only ever sees fuzzy grades."""
    rng = np.random.default_rng(seed)
    bats = []
    for i in range(12):
        kw = {k: float(np.clip(rng.normal(0.55, 0.16), 0.15, 0.95)) for k in
              ("recognition", "discipline", "tracking", "composure", "reaction", "boldness", "barrel_placement", "timing",
               "swing_quickness", "path_control", "barrel_accuracy", "power", "spray_control", "guess_hitting")}
        kw["bat_speed"] = float(np.clip(rng.normal(33.0, 2.0), 28, 38)); kw["hand"] = "L" if rng.random() < 0.35 else "R"
        kw["speed"] = float(np.clip(rng.normal(0.5, 0.2), 0.05, 0.98))
        kw["run_iq"] = float(np.clip(rng.normal(0.5, 0.2), 0.05, 0.98))
        kw["name"] = "타자%02d" % (i + 1)
        contact = np.mean([kw["recognition"], kw["tracking"], kw["barrel_placement"], kw["timing"]])
        power = 0.5 * kw["power"] + 0.5 * (kw["bat_speed"] - 27) / 9
        eye = np.mean([kw["discipline"], kw["recognition"]])
        fuzz = lambda v: float(np.clip(v + rng.normal(0, 0.08), 0, 1))
        bats.append({"id": i, "profile": kw, "card": {"name": kw["name"], "hand": kw["hand"], "contact": _grade(fuzz(contact)),
                                                       "power": _grade(fuzz(power)), "eye": _grade(fuzz(eye)), "speed": _grade(fuzz(kw["speed"])), "run_iq": _grade(fuzz(kw["run_iq"]))}})
    pits = []
    for j, pid in enumerate("ABCDE"):
        pr = next(x for x in PARAMS["profiles"] if x["id"] == pid)
        stuff = np.clip((pr["mph"] - 80) / 18, 0, 1); cmd = np.clip(1 - (pr["cmd"] - 0.12) / 0.16, 0, 1)
        fuzz = lambda v: float(np.clip(v + rng.normal(0, 0.08), 0, 1))
        pits.append({"id": j, "profile_id": pid, "card": {"name": "투수%d" % (j + 1), "hand": pr["hand"], "form": pr["name"].split("·")[-1].strip(),
                                                          "stuff": _grade(fuzz(stuff)), "control": _grade(fuzz(cmd)), "stamina": _grade(fuzz(0.6))}})
    return {"batters": bats, "pitchers": pits}


def make_fielders(seed, level=0.5):
    """Nine fielders with varied skills around `level` (arm strength, speed, glove, ...): the same club every game for a seed."""
    rng = np.random.default_rng(seed + 777)
    out = default_fielders(level)
    for f in out:
        pr = f.profile
        for k in ("sprint_speed", "first_step", "route", "ball_reading", "glove", "arm_strength", "arm_accuracy", "transfer", "positioning"):
            if hasattr(pr, k):
                setattr(pr, k, float(np.clip(getattr(pr, k) + rng.normal(0.0, 0.18), 0.05, 0.98)))
    return out


def make_opponent(seed):
    """The other club: nine hidden batters (built like ours, different seed) and the same five pitcher profiles."""
    r = make_roster(seed + 1000)
    for i, b in enumerate(r["batters"][:9]):
        b["profile"]["name"] = "상대%d" % (i + 1)
        b["card"] = {"name": b["profile"]["name"], "hand": b["profile"]["hand"]}       # no grades: scouting is not modelled for the other side
    r["batters"] = r["batters"][:9]
    for j, p in enumerate(r["pitchers"]):
        p["card"] = {"name": "상대 투수%d" % (j + 1), "hand": p["card"]["hand"]}
    return r


def new_game(req):
    seed = int(req.get("seed", 1)) % (1 << 31)
    roster = make_roster(seed)
    ids = [int(i) for i in (req.get("lineup_ids") or list(range(9)))][:9]
    lineup = [build_batter(roster["batters"][i]["profile"], i) for i in ids]
    for b, i in zip(lineup, ids):
        b.name = roster["batters"][i]["profile"]["name"]
    pit = roster["pitchers"][int(req.get("pitcher_id", 1)) % 5]
    pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
    catcher = build_catcher({})
    level = {"easy": 0.35, "normal": 0.5, "hard": 0.7}.get(req.get("difficulty", "normal"), 0.5)
    cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=default_fielders(level))
    g = Game(pitcher, catcher, lineup, cfg, seed=seed + 17, innings=max(1, min(9, int(req.get("innings", 3) or 3))))
    gid = uuid.uuid4().hex[:10]
    GAMES[gid] = {"game": g, "reveal_type": bool(req.get("reveal_type", False)), "roster": roster, "lineup_ids": ids}
    return {"game_id": gid, "state": game_state(g), "lineup": [roster["batters"][i]["card"] for i in ids], "pitcher": pit["card"]}


def game_state(g):
    st = g.state
    return {"inning": st.inning, "outs": st.outs, "runs": st.runs, "runners": list(st.runners), "batter_index": st.batter_index % len(g.lineup),
            "batter": getattr(g.current_batter(), "name", "?") if not st.over else "", "over": st.over, "line": st.line,
            "innings_total": st.innings_total, "box": st.box, "pitch_count": getattr(g.pitcher, "pitch_count", 0)}


def _zone_word(px, pz, top, bot, hand):
    side = -1 if hand == "R" else 1
    col = 0 if abs(px) < 0.12 else (1 if px * side > 0 else -1)
    mid = 0.5 * (top + bot)
    row = 0 if abs(pz - mid) < (top - bot) / 6 else (1 if pz > mid else -1)
    return ZONE_WORDS[(col, row)]


def commentary(rec, ctx, hand):
    """Broadcast-style sentence from what a spectator can see: location, result, batted ball."""
    plate = rec.pitch.plate
    where = _zone_word(plate.pos[0], plate.pos[2], ctx.zone_top, ctx.zone_bottom, hand) if plate is not None else "원바운드"
    mph = float(np.linalg.norm(rec.pitch.trajectory.vel[0])) * MS_TO_MPH
    r = rec.result
    base = "%d구째 %.0f마일, %s 코스" % (rec.index + 1, mph, where)
    if r == "called_strike":
        return base + " — 지켜보고 스트라이크"
    if r == "ball":
        return base + " — 볼" + (", 폭투!" if rec.wild_pitch else "")
    if r == "swinging_strike":
        return base + " — 헛스윙!"
    if r == "foul":
        return base + " — 파울"
    if r == "hbp":
        return base + " — 몸에 맞는 공"
    if r == "in_play" and rec.collision is not None:
        c = rec.collision
        kind = "땅볼" if c.launch_angle < 10 else ("라인드라이브" if c.launch_angle < 20 else "뜬공")
        txt = base + " — 쳤습니다! %s, %.0f마일" % (kind, c.exit_speed * MS_TO_MPH)
        if rec.play is not None:
            txt += " → " + spectator_play_text(rec)
        return txt
    return base + " — " + r


def spectator_play_text(rec):
    """What the crowd sees: who handled it and what happened, no times or probabilities."""
    k = rec.play.kind
    f = rec.fielding
    who = ""
    if f is not None and f.attempts:
        a = f.attempts[-1]
        who = a.position
    if k == "out":
        return ("%s 정면, 아웃" % who) if f is not None and f.kind == "ground" else ("%s가 잡았습니다, 아웃" % who if who else "아웃")
    if k == "single":
        return ("내야 안타!" if f is not None and f.kind == "ground" and who else "안타!") + ((" %s 앞에 떨어집니다" % f.retriever) if f is not None and f.retriever else "")
    if k == "double":
        return "2루타! " + (("%s가 쫓아갑니다" % f.retriever) if f is not None and f.retriever else "")
    if k == "triple":
        return "3루타!"
    if k == "HR":
        return "담장을 넘어갑니다, 홈런!"
    if k == "error":
        return ("%s 실책, 출루" % who) if who else "실책, 출루"
    if k == "foul":
        return "파울"
    return k


def _swing_kind(rec):
    """What the crowd sees of the swing: none / swing / bunt / check."""
    note = (getattr(rec.decision, "note", "") or "")
    if getattr(rec.decision, "checked", False) or "check" in note:
        return "check"                                    # a held check swing still shows as a check
    if not rec.decision.swing:
        return "none"
    if "bunt" in note:
        return "bunt"
    return "swing"


def sanitize_for_player(res, reveal_type, hand):
    """Only what a spectator sees: trajectory, speed, result, zone location, batted ball, fielding narrative."""
    out = []
    for rec in res.pitches:
        cb = rec.context_before
        plate = rec.pitch.plate
        row = {"count": [cb.balls, cb.strikes], "mph": round(float(np.linalg.norm(rec.pitch.trajectory.vel[0])) * MS_TO_MPH, 1),
               "result": rec.result, "umpire": rec.umpire_call, "swing": bool(rec.decision.swing),
               "plate_xz": [round(float(plate.pos[0]), 3), round(float(plate.pos[2]), 3)] if plate is not None else None,
               "zone_top": cb.zone_top, "zone_bottom": cb.zone_bottom, "flight": _sample(rec.pitch.trajectory),
               "contact_y": rec.observation.contact_y, "batter_hand": hand, "text": commentary(rec, cb, hand), "wild_pitch": rec.wild_pitch,
               "swing_kind": _swing_kind(rec), "in_dirt": bool(getattr(rec, "in_dirt", False) or (plate is not None and plate.pos[2] < 0.12))}
        row["flight"]["rpm"] = float(round(row["flight"]["rpm"] / 100.0) * 100)   # the seam close-up shows the true axis (v1.8), like a slow-motion camera
        if reveal_type:
            row["type"] = rec.call.code
        if rec.collision is not None and rec.collision.hit:
            c = rec.collision
            row["contact"] = {"ev_mph": round(c.exit_speed * MS_TO_MPH, 1), "la": round(c.launch_angle, 1), "spray": round(c.spray_angle, 1)}
            if rec.batted is not None:
                row["batted"] = {"flight": _sample(rec.batted.trajectory, 40), "distance": round(rec.batted.landing_distance, 1)}
            if rec.play is not None:
                row["play"] = {"kind": rec.play.kind, "text": spectator_play_text(rec)}
            if rec.fielding is not None:
                # narrative only: who went for it and whether it was caught; no times, no probabilities
                row["fielding"] = {"kind": rec.fielding.kind, "landing": rec.fielding.to_dict()["landing"],
                                   "attempts": [{"position": a.position, "success": a.success, "point": [round(a.point[0], 1), round(a.point[1], 1)]}
                                                for a in rec.fielding.attempts],
                                   "events": rec.fielding.events, "positions": rec.fielding.positions,
                                   "ground": rec.fielding.ground, "foul_point": rec.fielding.foul_point, "note": rec.fielding.note}   # what the crowd sees
        out.append(row)
    return out


def game_step(req):
    g_entry = GAMES.get(req.get("game_id", ""))
    if g_entry is None:
        return {"error": "unknown game_id"}
    g = g_entry["game"]
    call = req.get("bench_call", "none")
    shift = req.get("shift", "none")
    if call not in ("none", "bunt", "take", "power", "inside", "outside", "infield_in", "outfield_deep"):
        call = "none"
    if shift not in ("none", "pull", "opposite"):
        shift = "none"
    hand = getattr(g.current_batter(), "hand", "R") if not g.state.over else "R"
    batter_name = getattr(g.current_batter(), "name", "?") if not g.state.over else ""
    out = g.step(call, shift)
    if out.get("over") and "result" not in out:
        return {"over": True, "state": game_state(g)}
    fielders = [{"pos": f.profile.position, "xy": [round(f.pos[0], 1), round(f.pos[1], 1)]} for f in (g.cfg.fielders or [])]
    return {"state": game_state(g), "event": {k: v for k, v in out["event"].items() if k in ("batter", "outcome", "pitches", "inning", "runners_before",
                                                                                                "outs_before", "runs_before", "runners_after", "outs_after",
                                                                                                "runs_after", "double_play", "sac_fly", "error", "wild_pitches")},
            "pitches": sanitize_for_player(out["result"], g_entry["reveal_type"], hand), "batter": batter_name, "fielders": fielders,
            "inning_over": out["inning_over"], "over": out["over"]}



class Handler(BaseHTTPRequestHandler):
    page = None

    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/api/profiles"):
            return self._json(profiles_payload())
        if self.path.startswith("/api/game/roster"):
            try:
                seed = int(self.path.split("seed=")[1].split("&")[0]) if "seed=" in self.path else 1
            except ValueError:
                seed = 1
            r = make_roster(seed)
            return self._json({"batters": [b["card"] | {"id": b["id"]} for b in r["batters"]], "pitchers": [p["card"] | {"id": p["id"]} for p in r["pitchers"]]})
        page = self.page
        if self.path.startswith("/play"):
            page = os.path.join(ROOT, "web", "play_v1.0_0906.html")
        data = open(page, "rb").read()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(req, dict):
                raise ValueError("body must be a JSON object")
        except ValueError as e:
            return self._json({"error": "bad JSON: %s" % e}, 400)
        if self.path.startswith("/api/game/new") or self.path.startswith("/api/game/step"):
            try:
                fn = new_game if self.path.startswith("/api/game/new") else game_step
                return self._json(fn(req))
            except Exception as e:
                import traceback
                return self._json({"error": repr(e), "trace": traceback.format_exc()}, 500)
        if self.path.startswith("/api/simulate"):
            try:
                return self._json(simulate(req))
            except Exception as e:      # report to the page instead of dying
                import traceback
                return self._json({"error": repr(e), "trace": traceback.format_exc()}, 500)
        self._json({"error": "unknown endpoint"}, 404)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--page", default=os.path.join(ROOT, "web", "game_v1.2_0906.html"))
    a = ap.parse_args()
    Handler.page = a.page
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    print("bbsim %s server: admin http://localhost:%d/   gamer http://localhost:%d/play" % (__version__, a.port, a.port))
    srv.serve_forever()


if __name__ == "__main__":
    main()
