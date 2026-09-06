"""Smoke-test a built PC page in headless Firefox: load it with a JS error hook, auto-pick the roster,
press 플레이 볼, draw one pitch at four times, and screenshot the result.

Usage: python3 tools/page_smoke.py web/play_pc_admin_v1.2_0906.html [--out DIR]
Exit code 1 if the PNG is missing. The PNG shows a red bar for any JS error and a green
"FLOW OK" bar when the game flow ran; read it with an image viewer.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

HOOK = ("<script>window.__errs=[];window.onerror=function(m,s,l,c,e){window.__errs.push(m+' @'+l+':'+c);"
        "var d=document.getElementById('__errbox');if(!d){d=document.createElement('div');d.id='__errbox';"
        "d.style.cssText='position:fixed;top:0;left:0;right:0;background:#900;color:#fff;z-index:9999;padding:6px;"
        "font:14px monospace;white-space:pre-wrap';document.body.appendChild(d)}d.textContent=window.__errs.join('\\n')};</script>")
FLOW = """<script>
try{
  $("autoOrder").onclick(); document.querySelector("[data-p]").onclick(); $("start").onclick();
  if (BOTTOM) { G.outs = 3; endHalf(); dcall = "inside"; if (typeof setScene === "function") setScene("pitch"); }
  let p=pickPitch(); let T=p.flight.t[p.flight.t.length-1];
  if (SCENE === "play") {
    for (const k in BANK.bank) { const r = BANK.bank[k].find(x => x.fielding && x.fielding.events && x.fielding.events.length); if (r) { p = r; break } }
    T = p.flight.t[p.flight.t.length-1]; setScene("play"); $("playText").textContent = p.text; drawAll(p, contactTime(p) + 1.5);
  } else if (SCENE === "break") { G.outs = 3; endHalf(); }
  else { [-1.2,0.0,0.40,T+0.3].forEach(t=>drawAll(p,t)); if(BANK.admin) adminInfo(p); }
  const box=document.createElement('div'); box.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#063;color:#fff;z-index:9999;padding:6px;font:14px monospace';
  box.textContent='FLOW OK: scene='+(typeof scene==='undefined'?'-':scene)+' half='+G.half+' dcall='+dcall+' G.pitcher='+G.pitcher+' lineup='+G.lineup.length+' pitch='+p.code+' '+p.result+' swing='+p.swing+' T='+T.toFixed(3)+' batted='+(!!p.batted)+' errs='+window.__errs.length;
  document.body.insertBefore(box, document.body.firstChild); box.style.cssText='background:#063;color:#fff;padding:6px;font:14px monospace'; document.title='FLOW OK';
}catch(e){ const d=document.createElement('div'); d.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#900;color:#fff;z-index:9999;padding:6px;font:14px monospace;white-space:pre-wrap'; d.textContent='FLOW ERR: '+e.message+'\\n'+(e.stack||'').slice(0,400); d.style.cssText='background:#900;color:#fff;padding:6px;font:14px monospace;white-space:pre-wrap'; document.body.insertBefore(d, document.body.firstChild); document.title='FLOW ERR' }
</script></body>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "examples", "out", "page_smoke"))
    ap.add_argument("--no-flow", action="store_true", help="only load the page (no roster pick / pitch)")
    ap.add_argument("--bottom", action="store_true", help="jump to the bottom half and pick a pitch with the inside defensive sign")
    ap.add_argument("--scene", default="pitch", help="pitch | play (draw an in-play pitch on the play scene) | break (end the half and show the break scene)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    s = open(a.page, encoding="utf-8").read()
    i = s.index("<body")
    j = s.index(">", i) + 1
    s = s[:j] + HOOK + s[j:]
    if not a.no_flow:
        k = s.rindex("</body>")
        s = s[:k] + FLOW.replace("BOTTOM", "true" if a.bottom else "false").replace("SCENE", json.dumps(a.scene)) + s[k + len("</body>"):]
    name = os.path.splitext(os.path.basename(a.page))[0] + ("_bottom" if a.bottom else "") + ("" if a.scene == "pitch" else "_" + a.scene)
    hp = os.path.join(a.out, "smoke_%s.html" % name)
    png = os.path.join(a.out, "smoke_%s.png" % name)
    open(hp, "w", encoding="utf-8").write(s)
    prof = tempfile.mkdtemp(prefix="bbsim_ff_")
    r = subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, "--screenshot", png,
                        "--window-size=1360,1400", "file://" + os.path.abspath(hp)], capture_output=True, text=True, timeout=300)
    shutil.rmtree(prof, ignore_errors=True)
    if not os.path.exists(png):
        print("png MISSING; firefox stderr:", (r.stderr or "")[-400:])
        sys.exit(1)
    print("png:", os.path.abspath(png), os.path.getsize(png))


if __name__ == "__main__":
    main()
