"""Bundle the web app into one HTML file (for the artifact viewer, which serves a single page): inline the css and all
scripts in load order and embed a subset of the data (roster, club, and the banks for one opponent starter in the top
half and all five of our starters in the bottom half). The full multi-file app in web/app/ is the deployable one.

Usage: python3 tools/bundle_app.py --version v2.0_0906 [--opp-pitcher 1] [--smoke game|club]
"""
import argparse
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP = os.path.join(ROOT, "web", "app")
ORDER = ["js/render/math.js", "js/render/park.js", "js/render/person.js", "js/render/pitcher.js", "js/render/figures.js", "js/render/play.js", "js/render/seam.js", "js/game/game.js", "js/club/club.js"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v2.0_0906")
    ap.add_argument("--opp-pitcher", type=int, default=1, help="opponent starter id whose top-half banks are embedded (page seed 1 -> 1)")
    ap.add_argument("--smoke", default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    html = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(APP, "css", "app.css"), encoding="utf-8").read()
    html = html.replace('<link rel="stylesheet" href="css/app.css">', "<style>\n" + css + "\n</style>")
    html = html.replace('<link rel="manifest" href="manifest.webmanifest">', "")
    roster = json.load(open(os.path.join(APP, "data", "roster.json"), encoding="utf-8"))
    club = json.load(open(os.path.join(APP, "data", "club.json"), encoding="utf-8"))
    kbo = json.load(open(os.path.join(APP, "data", "kbo.json"), encoding="utf-8"))
    emb = {"data/roster.json": roster, "data/club.json": club, "data/kbo.json": kbo}
    bank_dir = os.path.join(APP, "data", "bank")
    n = 0
    for f in sorted(os.listdir(bank_dir)):
        if f.startswith("top_%d_" % a.opp_pitcher) or f.startswith("bot_"):
            emb["data/bank/" + f] = json.load(open(os.path.join(bank_dir, f), encoding="utf-8")); n += 1
    scripts = "\n".join("/* ==== %s ==== */\n%s" % (f, open(os.path.join(APP, f), encoding="utf-8").read()) for f in ORDER)
    smoke = ('<script>window.SMOKE=%s;</script>' % json.dumps(a.smoke)) if a.smoke else ""
    pre = ('<script>window.APP=window.APP||{};window.APP.bundled=true;window.APP.base="";window.APP.embedded=%s;</script>'
           % json.dumps(emb, ensure_ascii=False, separators=(",", ":")))
    # the bundled scripts must run after the shell (they touch elements) but the game/club modules need APP.roster/club:
    # app.js boot() sets those from the embedded data, then calls A.bundledInit(), which we define to run the module code.
    mods = '<script>window.APP=window.APP||{};window.APP.bundledInit=function(){\n%s\n};</script>' % scripts.replace("</script>", "<\\/script>")
    html = html.replace('<script src="js/kv.js"></script>', smoke + pre + '<script src="js/kv.js"></script>')
    html = html.replace('<script src="js/kv.js"></script>', "<script>\n" + open(os.path.join(APP, "js", "kv.js"), encoding="utf-8").read() + "\n</script>")
    html = html.replace('<script src="js/app.js"></script>', mods + "<script>\n" + open(os.path.join(APP, "js", "app.js"), encoding="utf-8").read() + "\n</script>")
    html = html.replace("웹앱 v2.0", "웹앱 " + a.version + " 미리보기")
    out = a.out or os.path.join(ROOT, "web", "app_preview_%s.html" % a.version)
    open(out, "w", encoding="utf-8").write(html)
    print("wrote %s: %d bank files embedded, %.1f MB" % (out, n, len(html) / 1e6))


if __name__ == "__main__":
    main()
