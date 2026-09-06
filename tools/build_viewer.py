"""Inject bbsim/data/pitching_params.json into the viewer template.

Usage: python3 tools/build_viewer.py [--version v0.5_0905]
Writes web/pitch_viewer_<version>.html from web/templates/pitch_viewer.template.html.
The placeholder in the template is the literal token  /*__PARAMS__*/  .
"""
import argparse
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v0.5_0905")
    a = ap.parse_args()
    params_path = os.path.join(ROOT, "bbsim", "data", "pitching_params.json")
    tpl_path = os.path.join(ROOT, "web", "templates", "pitch_viewer.template.html")
    out_path = os.path.join(ROOT, "web", "pitch_viewer_%s.html" % a.version)
    with open(params_path, encoding="utf-8") as f:
        params = json.load(f)
    with open(tpl_path, encoding="utf-8") as f:
        tpl = f.read()
    assert "/*__PARAMS__*/" in tpl, "placeholder missing"
    html = tpl.replace("/*__PARAMS__*/", json.dumps(params, ensure_ascii=False))
    html = html.replace("__VERSION__", a.version)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote", os.path.abspath(out_path), len(html), "bytes; params version", params["version"])


if __name__ == "__main__":
    main()
