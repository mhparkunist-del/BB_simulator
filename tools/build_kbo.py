"""Build web/app/data/kbo.json: the ten KBO clubs with their full player pools.

Sources (fetched by the study scripts into the scratch folder, then passed here):
  --wiki  kbo_pool_raw.json   Korean Wikipedia roster templates (틀:<구단> 명단): every player with number and group
  --reg   kbo_register.json   KBO official register page (1군 등록명단): number, name, 투타, birth, height/weight
Players on the register get their real hand and age; the rest get a seeded hand/age (marked "est": true).
Game attributes are NOT stored here: the app derives them deterministically from the name (see club.js kboAttrs).
Usage: python3 tools/build_kbo.py --wiki <path> --reg <path>
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import random
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLUBS = [   # code, name, short, city, primary colour, accent colour (light enough to read on a dark screen; scores, lamps, logo)
    ("SS", "삼성 라이온즈", "삼성", "대구", "#074CA1", "#7FB8FF"), ("LG", "LG 트윈스", "LG", "서울", "#C30452", "#FF6FAE"), ("OB", "두산 베어스", "두산", "서울", "#131230", "#FF4D57"),
    ("HT", "KIA 타이거즈", "KIA", "광주", "#EA0029", "#FF8A94"), ("SK", "SSG 랜더스", "SSG", "인천", "#CE0E2D", "#F5C542"), ("LT", "롯데 자이언츠", "롯데", "부산", "#041E42", "#7FC0F0"),
    ("HH", "한화 이글스", "한화", "대전", "#FF6600", "#FFC58F"), ("NC", "NC 다이노스", "NC", "창원", "#315288", "#E1C08A"), ("KT", "KT 위즈", "KT", "수원", "#000000", "#FF5A60"),
    ("WO", "키움 히어로즈", "키움", "서울", "#820024", "#FF7FB5")]
GROUPS = {"투수": "P", "포수": "C", "내야수": "IF", "외야수": "OF"}
IF_POS = ["SS", "2B", "3B", "1B", "SS", "2B", "3B", "1B"]
OF_POS = ["CF", "LF", "RF", "CF", "LF", "RF"]


def seeded(name, team):
    return random.Random(int(hashlib.md5((team + "|" + name).encode("utf-8")).hexdigest()[:8], 16))


def parse_hand(h):
    """'우투좌타' -> throws R, bats L; '우언' = sidearm right; '양타' = switch."""
    m = re.match(r"([우좌양])([투언])([우좌양])타", h or "")
    if not m:
        return None, None
    t = {"우": "R", "좌": "L", "양": "S"}[m.group(1)]
    b = {"우": "R", "좌": "L", "양": "S"}[m.group(3)]
    return t, b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wiki", required=True)
    ap.add_argument("--reg", required=True)
    a = ap.parse_args()
    wiki = json.load(open(a.wiki, encoding="utf-8"))
    reg = json.load(open(a.reg, encoding="utf-8"))
    today = dt.date(2026, 9, 6)
    out = {"season": 2026, "fetched": today.isoformat(), "source": "위키백과 구단 명단 틀 + KBO 공식 등록명단(1군, 투타·생년월일)", "clubs": []}
    total = 0
    for code, name, short, city, color, color2 in CLUBS:
        w = wiki.get(code, {"players": []})
        r = {row["name"]: row for row in reg.get(code, {}).get("rows", []) if row.get("pos") not in ("감독", "코치")}
        players = []
        for p in w["players"]:
            g = GROUPS.get(re.sub(r"<[^>]+>", "", p["group"]).strip())
            if not g:
                continue
            rr = r.get(p["name"])
            rng = seeded(p["name"], code)
            throws, bats = parse_hand(rr["hand"]) if rr else (None, None)
            est = rr is None
            if throws is None:
                throws = "L" if rng.random() < (0.25 if g == "P" else 0.12) else "R"
                bats = throws if rng.random() < 0.7 else ("L" if throws == "R" else "R")
                if rng.random() < 0.04:
                    bats = "S"
            if rr and re.match(r"\d{4}-\d{2}-\d{2}", rr["birth"]):
                y, m, d = map(int, rr["birth"].split("-"))
                age = today.year - y - (1 if (today.month, today.day) < (m, d) else 0)
                birth = rr["birth"]
            else:
                age = int(min(38, max(19, round(rng.gauss(25.5, 4.0)))))
                birth = None
            hw = re.findall(r"(\d+)cm,\s*(\d+)kg", rr["body"]) if rr else []
            height = int(hw[0][0]) / 100.0 if hw else round(rng.gauss(1.82, 0.05), 2)
            weight = int(hw[0][1]) if hw else int(rng.gauss(85, 9))
            pos = "P" if g == "P" else ("C" if g == "C" else (IF_POS[len([x for x in players if x["group"] == "IF"]) % len(IF_POS)] if g == "IF" else OF_POS[len([x for x in players if x["group"] == "OF"]) % len(OF_POS)]))
            players.append({"name": p["name"], "num": p["num"], "group": g, "pos": pos, "throws": throws, "bats": bats, "age": age, "birth": birth,
                            "height": round(height, 2), "weight": weight, "active": rr is not None, "est": est})
        players.sort(key=lambda x: ({"P": 0, "C": 1, "IF": 2, "OF": 3}[x["group"]], not x["active"], x["num"]))
        out["clubs"].append({"code": code, "name": name, "short": short, "city": city, "color": color, "color2": color2, "players": players,
                             "n_active": sum(1 for x in players if x["active"])})
        total += len(players)
        print(name, len(players), "active", sum(1 for x in players if x["active"]))
    path = os.path.join(ROOT, "web", "app", "data", "kbo.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("wrote", path, total, "players", os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
