"""Playtest runner: serve web/ locally, open the app in headless Firefox with ?pt=<name>, inject a tester's scenario
script (plain JS run inside the page with the PT helper, see docs/PLAYTEST.md), keep the page-load event pending until
the scenario calls PT.done(report), then screenshot. Outputs in --out: <name>.png (final page), <name>.json (report),
<name>.log (PT.note lines), <name>_<label>.png (canvas shots from PT.shot).

Usage: python3 tools/playtest.py --script path/to/scenario.js [--name NAME] [--size 1360,700 | 900,420] [--timeout 150]
"""
import argparse
import base64
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import parse_qs, urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB = os.path.join(ROOT, "web")
STATE = {"script": None, "name": "pt", "out": None, "done": threading.Event(), "report": None}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB, **k)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.endswith("/hold"):
            q = parse_qs(u.query)
            if "wait" in q:
                STATE["done"].wait(float(q.get("max", ["140"])[0]))
            else:
                time.sleep(int(q.get("ms", ["5000"])[0]) / 1000.0)
            self.send_response(204); self.end_headers()
            return
        if "/pt/" in u.path:
            body = open(STATE["script"], "rb").read()
            self.send_response(200); self.send_header("Content-Type", "application/javascript; charset=utf-8"); self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(n) if n else b""
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            data = {"raw": raw[:200].decode("utf-8", "replace")}
        base = os.path.join(STATE["out"], STATE["name"])
        if u.path.endswith("/log"):
            with open(base + ".log", "a", encoding="utf-8") as f:
                f.write(time.strftime("%H:%M:%S ") + str(data.get("t", "")) + "\n")
        elif u.path.endswith("/shot"):
            label = "".join(ch for ch in str(data.get("label", "shot")) if ch.isalnum() or ch in "-_")[:40] or "shot"
            b64 = str(data.get("png", "")).split(",", 1)[-1]
            open(base + "_" + label + ".png", "wb").write(base64.b64decode(b64))
        elif u.path.endswith("/report"):
            STATE["report"] = data
            json.dump(data, open(base + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            STATE["done"].set()
        self.send_response(204); self.end_headers()

    def log_message(self, *a):
        pass


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--name", default=None)
    ap.add_argument("--out", default=os.path.join(ROOT, "examples", "out", "playtest"))
    ap.add_argument("--size", default="1360,700")
    ap.add_argument("--timeout", type=int, default=170)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    STATE["script"] = os.path.abspath(a.script); STATE["out"] = a.out
    STATE["name"] = a.name or os.path.splitext(os.path.basename(a.script))[0]
    for ext in (".json", ".log"):
        p = os.path.join(a.out, STATE["name"] + ext)
        if os.path.exists(p):
            os.remove(p)
    port = free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/app/index.html?pt=%s" % (port, STATE["name"])
    png = os.path.join(a.out, STATE["name"] + ".png")
    prof = tempfile.mkdtemp(prefix="bbsim_pt_")
    t0 = time.time()
    try:
        r = subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, "--screenshot", png, "--window-size=" + a.size, url],
                           capture_output=True, text=True, timeout=a.timeout)
    except subprocess.TimeoutExpired:
        r = None
    finally:
        shutil.rmtree(prof, ignore_errors=True)
        httpd.shutdown()
    print("elapsed %.1fs" % (time.time() - t0))
    print("png:", png if os.path.exists(png) else "MISSING")
    if STATE["report"] is None:
        print("report: MISSING (scenario never called PT.done — check %s.log and the png status bar)" % STATE["name"])
        if r is not None and r.stderr:
            print("firefox stderr:", r.stderr[-300:])
        sys.exit(1)
    print("report:", os.path.join(a.out, STATE["name"] + ".json"))
    print(json.dumps(STATE["report"], ensure_ascii=False)[:1500])


if __name__ == "__main__":
    main()
