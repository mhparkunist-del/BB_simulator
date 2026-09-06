"""Stamp the release version into the web app (service-worker cache name and the header label) so every deploy invalidates
the old cache on phones. Run before committing a deploy: python3 tools/release_app.py
The stamp is bbsim.__version__ plus the current git short hash of the working tree state (or "dev" outside git)."""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)
from bbsim import __version__  # noqa: E402


def main():
    try:
        h = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=10).stdout.strip() or "dev"
    except Exception:
        h = "dev"
    stamp = "v%s-%s" % (__version__, h)
    p = os.path.join(ROOT, "web", "app", "sw.js")
    s = open(p, encoding="utf-8").read()
    s = re.sub(r'const VERSION = "[^"]*";', 'const VERSION = "bbsim-app-%s";' % stamp, s, count=1)
    open(p, "w", encoding="utf-8").write(s)
    p = os.path.join(ROOT, "web", "app", "index.html")
    s = open(p, encoding="utf-8").read()
    s = re.sub(r'<span class="v">[^<]*</span>', '<span class="v">%s</span>' % stamp, s, count=1)
    open(p, "w", encoding="utf-8").write(s)
    print("stamped", stamp)


if __name__ == "__main__":
    main()
