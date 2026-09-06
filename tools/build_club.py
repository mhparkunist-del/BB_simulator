"""Build the club-management page (web/club_<version>.html): one seeded club, five opponents, a 30-game schedule,
a free-agent pool and the training catalogue, embedded into web/templates/club.template.html.

Usage: python3 tools/build_club.py --version v1.0_0906 [--seed 7]
The page itself runs the season (quick-sim games, training, morale, injuries, roster moves) in the browser and
saves progress in localStorage. Rules mirror docs/TEAM_MANAGEMENT.md and bbsim/club (morale axes, age curve,
training headroom) so the engine-side club module and the page agree.
"""
import argparse
import datetime as dt
import json
import os

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
BAT_KEYS = ("contact", "power", "eye", "speed", "run_iq", "defense", "arm")
PIT_KEYS = ("stuff", "control", "stamina", "movement")
KO = {"contact": "컨택", "power": "파워", "eye": "선구", "speed": "주력", "run_iq": "판단", "defense": "수비", "arm": "송구",
      "stuff": "구위", "control": "제구", "stamina": "체력", "movement": "무브먼트"}
SURNAMES = "김 이 박 최 정 강 조 윤 장 임 한 오 서 신 권 황 안 송 류 전 홍 고 문 양 손 배 백 허 유 남".split()
GIVEN = "민준 서준 도윤 예준 시우 하준 주원 지호 지후 준서 준우 현우 도현 건우 우진 선우 연우 유준 정우 승우 승현 시윤 준혁 은우 지훈 승민 지환 승준 유찬 태윤".split()
POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "C", "2B", "SS", "CF"]
OPP_NAMES = ["항구 갈매기", "고원 산양", "강변 여우", "도심 늑대", "남부 사자"]
PROGRAMS = [
    {"key": "bat", "name": "타격 드릴(배럴·타이밍)", "for": "B", "targets": {"contact": 1.0, "power": 0.2}, "load": 1.0, "risk": 0.0},
    {"key": "power", "name": "배트 스피드·하체 파워", "for": "B", "targets": {"power": 1.0, "contact": 0.1}, "load": 2.0, "risk": 0.015},
    {"key": "eye", "name": "선구안·트래킹", "for": "B", "targets": {"eye": 1.0, "contact": 0.2}, "load": 0.8, "risk": 0.0},
    {"key": "speed", "name": "주루·스프린트", "for": "B", "targets": {"speed": 1.0, "defense": 0.2}, "load": 1.5, "risk": 0.02},
    {"key": "field", "name": "펑고·루트 드릴", "for": "B", "targets": {"defense": 1.0, "arm": 0.3}, "load": 1.2, "risk": 0.01},
    {"key": "arm", "name": "송구·롱토스", "for": "B", "targets": {"arm": 1.0}, "load": 1.0, "risk": 0.02},
    {"key": "stuff", "name": "구위(손목·악력·하체)", "for": "P", "targets": {"stuff": 1.0, "stamina": 0.1}, "load": 2.0, "risk": 0.03},
    {"key": "control", "name": "제구(딜리버리 반복)", "for": "P", "targets": {"control": 1.0, "movement": 0.2}, "load": 1.2, "risk": 0.0},
    {"key": "movement", "name": "그립·실밥·무브먼트", "for": "P", "targets": {"movement": 1.0, "stuff": 0.1}, "load": 0.8, "risk": 0.0},
    {"key": "endurance", "name": "체력·회복", "for": "BP", "targets": {"stamina": 1.0}, "load": 1.5, "risk": 0.0},
    {"key": "rest", "name": "휴식", "for": "BP", "targets": {}, "load": -1.5, "risk": 0.0},
]


def grade(v):
    return "S" if v >= 0.85 else ("A" if v >= 0.7 else ("B" if v >= 0.55 else ("C" if v >= 0.4 else "D")))


def make_player(rng, i, kind, pos=None, role=None, name=None):
    age = int(np.clip(rng.normal(27, 4.2), 19, 37))
    keys = BAT_KEYS if kind == "B" else PIT_KEYS
    peak = float(np.clip(rng.normal(0.55, 0.12), 0.25, 0.92))
    attrs = {k: float(np.clip(peak + rng.normal(0, 0.10), 0.12, 0.96)) for k in keys}
    if kind == "B" and pos == "C":
        attrs["speed"] = min(attrs["speed"], 0.45)
    # potential: young players have headroom, veterans sit near their ceiling
    head = max(0.0, (30 - age) / 11.0)
    pot = {k: float(np.clip(attrs[k] + rng.uniform(0.02, 0.32) * head + rng.normal(0, 0.03), attrs[k], 0.98)) for k in keys}
    grades = {k: grade(float(np.clip(attrs[k] + rng.normal(0, 0.06), 0, 1))) for k in keys}
    pot_g = grade(float(np.mean(list(pot.values()))))
    salary = round(float(np.clip((np.mean(list(attrs.values())) - 0.3) * 18 + rng.normal(0, 1.2) + (0.8 if age > 30 else 0), 0.4, 15.0)), 1)
    years = int(rng.integers(1, 4))
    status = "rookie" if age <= 23 else ("arbitration" if age <= 27 else "veteran")
    nm = name or (SURNAMES[i % len(SURNAMES)] + GIVEN[(i * 7 + kind.__len__()) % len(GIVEN)])
    return {"id": i, "name": nm, "age": age, "hand": "L" if rng.random() < 0.33 else "R", "type": kind, "pos": pos, "role": role,
            "grades": grades, "attrs": {k: round(v, 3) for k, v in attrs.items()}, "pot": {k: round(v, 3) for k, v in pot.items()}, "pot_grade": pot_g,
            "personality": {"ambition": round(float(rng.uniform(0.2, 0.9)), 2), "loyalty": round(float(rng.uniform(0.2, 0.9)), 2), "pro": round(float(rng.uniform(0.3, 0.95)), 2)},
            "morale": {"playing_time": 0.6, "team_success": 0.6, "salary_fairness": 0.6, "relationships": 0.6, "role_fit": 0.6},
            "condition": int(rng.integers(65, 92)), "fatigue": round(float(rng.uniform(0.05, 0.25)), 2), "injury": 0,
            "contract": {"salary": salary, "years": years, "status": status},
            "stats": {"G": 0, "PA": 0, "H": 0, "HR": 0, "RBI": 0, "BB": 0, "K": 0, "IP": 0.0, "ER": 0, "W": 0, "L": 0, "SV": 0, "KP": 0}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v1.0_0906")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    players = []
    i = 0
    for pos in POSITIONS:
        players.append(make_player(rng, i, "B", pos=pos)); i += 1
    for r in ["SP"] * 5 + ["RP"] * 8:
        players.append(make_player(rng, i, "P", role=r)); i += 1
    for p in players:                                     # everyone starts on the active roster except the last two of each kind
        p["active"] = True
    for p in [x for x in players if x["type"] == "B"][-2:] + [x for x in players if x["type"] == "P"][-2:]:
        p["active"] = False
    fa = []
    for k in range(8):
        kind = "B" if k < 5 else "P"
        p = make_player(rng, 100 + k, kind, pos=(["1B", "LF", "SS", "C", "RF"][k] if kind == "B" else None), role=(None if kind == "B" else ["SP", "RP", "RP"][k - 5]))
        p["active"] = False
        p["asking"] = round(p["contract"]["salary"] * 1.25, 1)
        fa.append(p)
    opps = [{"id": j + 1, "name": n, "bat": round(float(rng.uniform(0.42, 0.68)), 2), "pitch": round(float(rng.uniform(0.42, 0.68)), 2),
             "def": round(float(rng.uniform(0.42, 0.66)), 2), "W": 0, "L": 0} for j, n in enumerate(OPP_NAMES)]
    d0 = dt.date(2026, 4, 3)
    sched, g, day = [], 1, 0
    while g <= 30:
        d = d0 + dt.timedelta(days=day)
        if d.weekday() != 0:                             # Mondays off
            sched.append({"g": g, "date": d.isoformat(), "opp": ((g - 1) // 3) % 5 + 1, "home": ((g - 1) // 3) % 2 == 0, "result": None})
            g += 1
        day += 1
    data = {"version": a.version, "club": {"name": "덕아웃 나이트", "budget": 60.0, "staff": {"batting": 0.6, "pitching": 0.55, "conditioning": 0.5, "medical": 0.5}},
            "date0": d0.isoformat(), "days": day + 2, "players": players, "free_agents": fa, "opponents": opps, "schedule": sched,
            "programs": PROGRAMS, "ko": KO, "bat_keys": list(BAT_KEYS), "pit_keys": list(PIT_KEYS)}
    tpl = open(os.path.join(ROOT, "web", "templates", "club.template.html"), encoding="utf-8").read()
    html = tpl.replace("/*__DATA__*/", json.dumps(data, ensure_ascii=False, separators=(",", ":"))).replace("__VERSION__", a.version)
    out = os.path.join(ROOT, "web", "club_%s.html" % a.version)
    open(out, "w", encoding="utf-8").write(html)
    print("wrote %s: %d players, %d FA, %d games, %.2f MB" % (out, len(players), len(fa), len(sched), len(html) / 1e6))


if __name__ == "__main__":
    main()
