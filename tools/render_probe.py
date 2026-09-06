"""Render the PC page's body view to a PNG so the figures can actually be inspected.

Usage:
  python3 tools/render_probe.py [--out DIR] [--code TAG] [--frames "-1.5,-0.6,0,0.2,0.42,0.7"] [--pitch swing|take|hr]
It extracts the render block from web/templates/play_pc.template.html (between the RENDER markers,
or from `function interp(` up to `function drawCam(`), builds a standalone harness with one real
pre-simulated pitch, and writes harness.html. Then:
  firefox --headless --screenshot <out>/body.png --window-size=1360,900 file://<out>/harness.html
"""
import argparse
import json


def _dflt(o):
    return o.item() if hasattr(o, "item") else str(o)

import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
from build_play_pc import pitcher_figure, thin  # noqa: E402
from serve_game import admin_row, build_batter, build_catcher, build_pitcher, make_roster  # noqa: E402
from bbsim.agents import GameContext  # noqa: E402
from bbsim.engine import EngineConfig, PlateAppearance, Umpire  # noqa: E402
from bbsim.engine.fielding import default_fielders  # noqa: E402

TPL = os.path.join(ROOT, "web", "templates", "play_pc.template.html")


def render_block(text):
    """Helpers + the render block (everything the body view needs, without the game logic)."""
    a = text.index("function interp(")
    b = text.find("/* == RENDER BLOCK END == */")
    if b < 0:
        b = text.index("function drawCam(")
    else:
        b = b + len("/* == RENDER BLOCK END == */")
    return text[a:b]


def one_pitch(kind, seed=7):
    """Simulate until we get a pitch of the requested kind; return an admin row + context."""
    roster = make_roster(seed)
    pit = roster["pitchers"][1]
    pitcher = build_pitcher({"profile": pit["profile_id"], "name": pit["card"]["name"]})
    bat = roster["batters"][3]
    b = build_batter(bat["profile"], 3)
    b.name = bat["profile"]["name"]
    cfg = EngineConfig(umpire=Umpire(low_shift=0.02), fielders=default_fielders(0.5))
    pa = PlateAppearance(pitcher, build_catcher({}), b, cfg, seed=seed * 31, new_game=True)
    pa.run(GameContext())
    want = {"swing": ("in_play", "foul", "swinging_strike"), "take": ("called_strike", "ball"),
            "hr": ("in_play",), "inplay": ("in_play",), "bunt": ("in_play", "foul")}[kind]
    best = None
    for i in range(60):
        rec = pa.pitch_once(GameContext(balls=i % 3, strikes=i % 2, batter_hand=b.hand, pitcher_hand=pitcher.hand,
                                        zone_top=pa.zone.top, zone_bottom=pa.zone.bottom,
                                        fielder_shift=("bunt" if kind == "bunt" else "none")), i)
        pa._batter_learns(rec)
        if rec.result in want:
            if kind == "hr" and not (rec.batted is not None and rec.batted.landing_distance > 95):
                continue
            best = rec
            break
        if best is None and rec.result in ("called_strike", "ball"):
            best = rec
    if best.result not in want:
        print("WARNING: no %s pitch found in 60 tries; using a %s pitch instead" % (kind, best.result))
    row = admin_row(best, 0, 0, b.name, cfg.fielders)
    row["batter_hand"] = b.hand
    row = thin(row, 24, 30)
    row["kind"] = best.play.kind if best.play is not None else None
    return row, pitcher, b, pit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/render")
    ap.add_argument("--frames", default="-1.5,-0.9,-0.45,-0.12,0.0,0.18,0.34,0.42,0.52,0.75")
    ap.add_argument("--pitch", default="swing")
    ap.add_argument("--tag", default="body")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--cw", type=int, default=440)
    ap.add_argument("--ch", type=int, default=280)
    ap.add_argument("--shot", action="store_true", help="also run firefox --headless --screenshot")
    ap.add_argument("--cams", default="", help="cx,cy,cz,tx,ty,tz,fov ; ... -> one panel per camera at a single t")
    ap.add_argument("--at", type=float, default=None, help="single t used with --cams (default: contact)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--view", default="body", help="body | cam")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    block = render_block(open(TPL, encoding="utf-8").read())
    row, pitcher, batter, pcard = one_pitch(a.pitch, a.seed)
    T = row["flight"]["t"][-1]
    cams = [[float(v) for v in c.split(",")] for c in a.cams.split(";") if c.strip()]
    frames = [float(x) for x in a.frames.split(",")]
    frames = [T + f + 1e-9 if f > 90 else f for f in frames]
    bank = {"admin": True, "figures": {"1": pitcher_figure(pitcher)},
            "fielders": [{"pos": p, "xy": [round(v[0], 1), round(v[1], 1)]} for p, v in
                         __import__("bbsim.engine.fielding", fromlist=["DEFAULT_POSITIONS"]).DEFAULT_POSITIONS.items()],
            "roster": {"batters": [{"id": 3, "name": batter.name, "hand": batter.hand, "height": round(batter.profile.height, 2)}],
                       "pitchers": [dict(pcard["card"], id=1)]}}
    html = """<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0d1a13;font:12px system-ui;color:#ece7d8">
<div id="wrap" style="display:grid;grid-template-columns:repeat(%d,%dpx);gap:6px;padding:6px"></div>
<div id="bodyNote" style="padding:6px;color:#8ea394"></div>
<script>
const BANK=%s;
const PITCH=%s;
const FRAMES=%s, T=%s;
let CUR=null;
const _note={};
const $=id=>(id=="body"||id=="cam"||id=="seam"||id=="play")?CUR:(document.getElementById(id)||{textContent:"",style:{},hidden:true,classList:{toggle:()=>{},add:()=>{},remove:()=>{}}});
const G={pitcher:1,lineup:[3],idx:0};
function batter(){return BANK.roster.batters[0]}
%s
const wrap=document.getElementById("wrap");
const CAMS=%s, AT=%s;
(CAMS.length?CAMS:FRAMES).forEach((item,ci)=>{
  let t=AT; if(!CAMS.length){t=item} else {window.CAMOVR={C:[item[0],item[1],item[2]],T:[item[3],item[4],item[5]],fov:item[6]}}
  const box=document.createElement("div");
  const c=document.createElement("canvas");c.width=%d;c.height=%d;c.style.width="%dpx";c.style.display="block";
  const lab=document.createElement("div");lab.textContent=CAMS.length?("cam "+JSON.stringify(item)):("t = "+t.toFixed(2)+" s"+(Math.abs(t-T)<0.02?"  (접촉/포구)":(t<0?"  (릴리스 전)":"")));
  box.appendChild(c);box.appendChild(lab);wrap.appendChild(box);
  CUR=c;
  window.VIEW=VIEWSEL; try{ (window.VIEW=="cam"?drawCam(PITCH,t):(window.VIEW=="seam"?drawSeam(PITCH,t):drawBody(PITCH,t))) }catch(e){ const g=c.getContext("2d");g.fillStyle="#400";g.fillRect(0,0,c.width,c.height);g.fillStyle="#fff";g.font="13px monospace";
    String((e&&e.message?e.message+" @@ ":"")+(e.stack||e)).split("\\n").slice(0,7).forEach((L,i)=>g.fillText(L.slice(0,86),8,20+16*i)); }
});
document.title="ok";
</script></body>""" % (a.cols, a.cw, json.dumps(bank, ensure_ascii=False, default=_dflt), json.dumps(row, ensure_ascii=False, default=_dflt),
                       json.dumps(frames), json.dumps(T), block, json.dumps(cams), json.dumps(a.at if a.at is not None else -1), a.cw * 2, a.ch * 2, a.cw)
    html = html.replace("VIEWSEL", json.dumps(a.view))
    hp = os.path.join(a.out, "harness_%s.html" % a.tag)
    open(hp, "w", encoding="utf-8").write(html)
    print("harness:", hp, "| pitch:", row["code"], row["result"], "swing", row["swing"], "| T=%.3f" % T)
    if a.shot:
        png = os.path.join(a.out, "%s.png" % a.tag)
        rows = ((len(cams) or len(frames)) + a.cols - 1) // a.cols
        prof = tempfile.mkdtemp(prefix="bbsim_ff_")
        r = subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, "--screenshot", png,
                            "--window-size=%d,%d" % (a.cols * (a.cw + 8) + 20, rows * (a.ch + 26) + 60),
                            "file://" + hp], capture_output=True, text=True, timeout=180)
        shutil.rmtree(prof, ignore_errors=True)
        if not os.path.exists(png):
            print("png MISSING; firefox stderr:", (r.stderr or "")[-400:])
            sys.exit(1)
        print("png:", png, os.path.getsize(png))


if __name__ == "__main__":
    main()
