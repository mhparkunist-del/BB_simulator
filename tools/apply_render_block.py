"""Splice a renderer JS file into web/templates/play_pc.template.html between the RENDER BLOCK markers.

Usage: python3 tools/apply_render_block.py <renderer.js>
The first time, it replaces everything from `function ground(` up to `function drawCam(` and adds the markers;
afterwards it replaces whatever sits between the markers. Keeps a .bak copy.
"""
import os
import shutil
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
TPL = os.path.join(ROOT, "web", "templates", "play_pc.template.html")
START = "/* == RENDER BLOCK START == */"
END = "/* == RENDER BLOCK END == */"


def main():
    src = sys.argv[1]
    code = open(src, encoding="utf-8").read().strip()
    s = open(TPL, encoding="utf-8").read()
    a, b = s.find(START), s.find(END)
    if a >= 0 and b > a:
        head, tail = s[:a], s[b + len(END):]
    else:
        a = s.index("function ground(")
        b = s.index("function drawCam(")
        head, tail = s[:a], "\n" + s[b:]
    shutil.copy(TPL, TPL + ".bak")
    out = head + START + "\n" + code + "\n" + END + tail
    open(TPL, "w", encoding="utf-8").write(out)
    print("spliced %d chars into %s (backup %s.bak)" % (len(code), TPL, TPL))


if __name__ == "__main__":
    main()
