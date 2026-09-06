"""Smoke-test the web app: serve web/ over HTTP on a free port, open the app in headless Firefox with ?smoke=<mode>,
and screenshot. The app's smoke mode drives a flow (game: roster -> play ball -> one pitch drawn; club: nine days) and
prints a status bar at the top of the page. Firefox captures after the load event, so the app requests an image from
/hold?ms=6000 which this server answers late, keeping the load event (and the capture) waiting for the flow.

Usage: python3 tools/app_smoke.py [--mode game|club] [--out DIR]
"""
import argparse
import http.server
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


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB, **k)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.endswith("/hold"):
            ms = int(parse_qs(u.query).get("ms", ["5000"])[0])
            time.sleep(ms / 1000.0)
            self.send_response(204); self.end_headers()
            return
        return super().do_GET()

    def log_message(self, *a):
        pass


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="game")
    ap.add_argument("--out", default=os.path.join(ROOT, "examples", "out", "app_smoke"))
    ap.add_argument("--size", default="1360,900", help="window size WxH as W,H (phone landscape: 900,420)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    port = free_port()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    th = threading.Thread(target=httpd.serve_forever, daemon=True); th.start()
    url = "http://127.0.0.1:%d/app/index.html?smoke=%s" % (port, a.mode)
    png = os.path.join(a.out, "smoke_app_%s_%s.png" % (a.mode, a.size.replace(",", "x")))
    prof = tempfile.mkdtemp(prefix="bbsim_ff_")
    try:
        r = subprocess.run(["firefox", "--headless", "--no-remote", "--profile", prof, "--screenshot", png, "--window-size=" + a.size, url],
                           capture_output=True, text=True, timeout=300)
    finally:
        shutil.rmtree(prof, ignore_errors=True)
        httpd.shutdown()
    if not os.path.exists(png):
        print("png MISSING; firefox stderr:", (r.stderr or "")[-400:])
        sys.exit(1)
    print("png:", png, os.path.getsize(png))


if __name__ == "__main__":
    main()
