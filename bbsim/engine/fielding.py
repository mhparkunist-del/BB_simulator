"""Fielding resolution (v1.2 draft): batted ball + nine fielders + runners -> play result.

Replaces the probability table in outcome.resolve when fielders are configured. Model:
  * fly / line drives: landing point and hang time from the flight; each fielder routes with its own
    read noise, first step, route efficiency and speed; the best-placed fielder attempts the catch.
  * ground balls: the ball decelerates on the ground (a ~ 4 m/s^2); infielders look for the earliest
    interception; then the throw to first races the batter-runner.
  * hits: the retrieving fielder's time (reach + transfer + throw) vs the runner's base-to-base time
    decides single / double / triple.
Coordinates: +x first-base side, +y toward the pitcher, meters.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..agents.fielder import OUTFIELD, Fielder, FielderProfile, FieldingAttempt
from .baserunning import BASE_XY, runner_event, time_to_base
from .outcome import BattedBall, Park, PlayResult, _height_at_distance, foul_probability

DEFAULT_POSITIONS: Dict[str, Tuple[float, float]] = {
    "P": (0.0, 17.5), "C": (0.0, -1.5), "1B": (21.0, 27.0), "2B": (11.0, 41.0), "SS": (-11.0, 41.0), "3B": (-21.0, 27.0),
    "LF": (-38.0, 86.0), "CF": (0.0, 98.0), "RF": (38.0, 86.0)}
BASES = {1: (19.4, 19.4), 2: (0.0, 38.8), 3: (-19.4, 19.4), "H": (0.0, 0.0)}   # 27.43 m sides
GROUND_DECEL = 2.5            # m/s^2, bouncing/rolling on grass-dirt mix (a 95 mph grounder crosses the infield in ~1.2 s)
G_ACC = 9.81
BAG_DIST = 27.43              # first/third base from the plate: the fair/foul judgement line for balls that land short
RUNNER_TO_FIRST = 4.35        # s, average batter-runner (Statcast home-to-first ~4.3 s)


@dataclass
class FieldingPlay:
    attempts: List[FieldingAttempt] = field(default_factory=list)
    landing: Tuple[float, float] = (0.0, 0.0)
    hang: float = 0.0
    kind: str = ""                     # fly | ground | line | hr | foul
    retriever: str = ""
    t_retrieve: float = 0.0
    note: str = ""
    events: List[Dict] = field(default_factory=list)        # v1.7 timed events for the viewers (run / move / field / throw / call)
    positions: Dict[str, List[float]] = field(default_factory=dict)   # where the nine stood at the pitch
    ground: Dict = field(default_factory=dict)              # v1.10 ball on the ground after landing: {"t": [s after contact], "xyz": [[x,y,z]]}
    foul_point: Optional[List[float]] = None                # v1.10 where the fair/foul call was made

    def to_dict(self) -> Dict:
        return {"kind": self.kind, "landing": [round(self.landing[0], 1), round(self.landing[1], 1)], "hang": round(self.hang, 2),
                "retriever": self.retriever, "t_retrieve": round(self.t_retrieve, 2), "note": self.note,
                "events": self.events, "positions": self.positions, "ground": self.ground, "foul_point": self.foul_point,
                "attempts": [{"fielder": a.fielder, "position": a.position, "kind": a.kind, "point": [round(a.point[0], 1), round(a.point[1], 1)],
                              "t_ball": round(a.t_ball, 2), "t_fielder": round(a.t_fielder, 2), "p": round(a.p_success, 2),
                              "success": a.success, "note": a.note, "difficulty": a.difficulty, "read_error_m": round(a.read_error_m, 1),
                              "dive": a.dive, "backhand": a.backhand} for a in self.attempts]}


def default_fielders(level: float = 0.5, names: Optional[Dict[str, str]] = None) -> List[Fielder]:
    out = []
    for pos, xy in DEFAULT_POSITIONS.items():
        if pos in ("P", "C"):
            prof = FielderProfile(name=(names or {}).get(pos, pos), position=pos, sprint_speed=level - 0.1, first_step=level, glove=level)
        else:
            prof = FielderProfile(name=(names or {}).get(pos, pos), position=pos, sprint_speed=level, first_step=level, route=level,
                                  ball_reading=level, glove=level, arm_strength=level, arm_accuracy=level, transfer=level, positioning=level)
        out.append(Fielder(prof, xy))
    return out


def align(fielders: List[Fielder], shift: str = "none", batter_hand: str = "R") -> None:
    """Pre-pitch positioning: each fielder's `positioning` skill moves it toward the expected spray."""
    pull = -1.0 if batter_hand.upper().startswith("R") else 1.0
    for f in fielders:
        dx, dy = 0.0, 0.0
        if shift == "pull" or (shift not in ("pull", "opposite") and f.profile.position in ("2B", "SS", "LF", "CF", "RF")):
            dx = pull * 6.0 * f.profile.positioning * (1.0 if shift == "pull" else 0.35)
        elif shift == "opposite":
            dx = -pull * 6.0 * f.profile.positioning
        # v1.8 bench depth calls: infield in (cut the run off at the plate, shorter throw, less range),
        # outfield deep (take away the extra-base hit, give up the bloop single)
        if shift == "infield_in" and f.profile.position in ("1B", "2B", "SS", "3B"):
            dy = -5.5
        if shift == "outfield_deep" and f.profile.position in ("LF", "CF", "RF"):
            dy = 8.0
        f.pos = (f.home[0] + dx, f.home[1] + dy)


def _runner_time(bases: int, speed: float = 0.5, hand: str = "R") -> float:
    """Batter-runner time to reach `bases` (1..3) from contact; speed 0..1 (engine/baserunning.py sprint model)."""
    return time_to_base(speed, bases, hand)


# ---------------------------------------------------------------- v1.7 timed events for the viewers
def _fpos(fielders: List[Fielder], position: str) -> List[float]:
    f = next(x for x in fielders if x.profile.position == position)
    return [round(float(f.pos[0]), 1), round(float(f.pos[1]), 1)]


def _cover(base: int, fielder_pos: str) -> str:
    pref = {1: ["1B", "P", "2B"], 2: ["SS", "2B", "CF"], 3: ["3B", "SS", "P"], 4: ["C", "P"]}[base]
    return next(p for p in pref if p != fielder_pos)


def _r2(v):
    return [round(float(v[0]), 1), round(float(v[1]), 1)]


def _ev_move(play, who, frm, to, t0, t1):
    play.events.append({"kind": "move", "who": who, "from": _r2(frm), "to": _r2(to), "t0": round(float(t0), 2), "t1": round(float(max(t1, t0 + 0.05)), 2)})


def _ev_field(play, who, at, t, how, success=True):
    play.events.append({"kind": "field", "who": who, "at": _r2(at), "t": round(float(t), 2), "how": how, "success": bool(success)})


def _ev_call(play, base, t, out):
    play.events.append({"kind": "call", "base": int(base), "t": round(float(t), 2), "out": bool(out)})


# ---------------------------------------------------------------- v1.10 fair / foul geometry
def foul_boundary(bb, park=None):
    """Deterministic fair/foul call. Beyond the bases the landing point decides (foul iff |x| > y).
    Short of the bases the roll decides: where the ball passes the base distance, or where it stops.
    Returns (foul, (x, y) of the call, how) with how in landing | bag | stop."""
    land = bb.trajectory.final.pos
    lx, ly = float(land[0]), float(land[1])
    if np.hypot(lx, ly) >= BAG_DIST:
        return bool(abs(lx) > ly), (lx, ly), "landing"
    v0 = bb.trajectory.vel[0]
    vh = float(np.hypot(v0[0], v0[1])) or 1e-6
    ux, uy = float(v0[0]) / vh, float(v0[1]) / vh
    v_g = 0.85 * vh
    s_stop = v_g * v_g / (2.0 * GROUND_DECEL)
    b = 2.0 * (lx * ux + ly * uy)
    c = lx * lx + ly * ly - BAG_DIST * BAG_DIST
    disc = b * b - 4.0 * c
    s_bag = (-b + np.sqrt(disc)) / 2.0 if disc >= 0 else None
    if s_bag is not None and 0.0 <= s_bag <= s_stop:
        px, py, how = lx + ux * s_bag, ly + uy * s_bag, "bag"
    else:
        px, py, how = lx + ux * s_stop, ly + uy * s_stop, "stop"
    return bool(abs(px) > py), (float(px), float(py)), how


def _samples(fn, t0: float, t1: float, dt: float = 0.04) -> Dict:
    """Sample fn(t) -> (x, y, z) from t0 to t1 (seconds after contact) for the viewers."""
    ts, xs = [], []
    t = t0
    while t <= t1 + 1e-9:
        x, y, z = fn(t)
        ts.append(round(float(t), 3)); xs.append([round(float(x), 2), round(float(y), 2), round(float(z), 2)])
        t += dt
    return {"t": ts, "xyz": xs}


def _bounce_roll(start, stop, t0, t1, h1):
    """Ball on the ground from `start` (t0) to `stop` (t1): two decaying bounces then a roll, decelerating."""
    h2 = 0.35 * h1
    def fn(t):
        tau = min(1.0, max(0.0, (t - t0) / max(t1 - t0, 1e-3)))
        f = 1.0 - (1.0 - tau) ** 2
        x = start[0] + (stop[0] - start[0]) * f
        y = start[1] + (stop[1] - start[1]) * f
        if tau < 0.4:
            ph = tau / 0.4; z = 4 * h1 * ph * (1 - ph)
        elif tau < 0.7:
            ph = (tau - 0.4) / 0.3; z = 4 * h2 * ph * (1 - ph)
        else:
            z = 0.04
        return x, y, max(0.04, z)
    return fn


# ---------------------------------------------------------------- v1.10 throw physics: arc, one-hop, relay
def _throw_seg(v: float, frm, to):
    """One throw at speed v: (flight time, hop point or None, time to the hop). A throw the arm cannot make on a
    line (launch above ~26 deg) is thrown as a one-hop: 78 % of the way in the air, then the bounce runs in."""
    d = float(np.hypot(to[0] - frm[0], to[1] - frm[1]))
    if d < 1e-6:
        return 0.05, None, None
    k = d * G_ACC / (v * v)
    if k <= 0.80:
        th = 0.5 * np.arcsin(k)
        return float(d / (v * np.cos(th))), None, None
    th = np.radians(26.0)
    d1 = min(0.78 * d, 0.788 * v * v / G_ACC)
    T1 = d1 / (v * np.cos(th))
    v2 = 0.70 * v * np.cos(th)
    T2 = (d - d1) / max(v2, 1e-6)
    hop = (frm[0] + (to[0] - frm[0]) * d1 / d, frm[1] + (to[1] - frm[1]) * d1 / d)
    return float(T1 + T2), hop, float(T1)


def throw_plan(f: Fielder, frm, base: int, fielders: List[Fielder], t_release: float, cover_pos: Optional[str] = None) -> Dict:
    """How the ball gets from `frm` to `base`: a direct throw (line or one-hop) or a relay through a cutoff man,
    whichever arrives first. Times are absolute (seconds after contact)."""
    to = BASE_XY[base]
    d = float(np.hypot(to[0] - frm[0], to[1] - frm[1]))
    v = f.profile.throw_speed()
    T, hop, T1 = _throw_seg(v, frm, to)
    plan = {"arrive": t_release + T, "relay": None,
            "segs": [{"who": f.profile.position, "from": frm, "to": to, "t0": t_release, "t1": t_release + T,
                      "hop": hop, "t_hop": (t_release + T1) if hop else None, "base": base}]}
    if f.profile.position in OUTFIELD and d > 42.0 and base in (2, 3, 4):
        cover_pos = cover_pos or _cover(base, f.profile.position)
        u = ((to[0] - frm[0]) / d, (to[1] - frm[1]) / d)
        dc = min(0.5 * d, 34.0)
        cut = (frm[0] + u[0] * dc, frm[1] + u[1] * dc)
        cands = [x for x in fielders if x.profile.position in ("SS", "2B", "1B", "3B") and x.profile.position != cover_pos]
        if cands:
            c = min(cands, key=lambda x: np.hypot(cut[0] - x.pos[0], cut[1] - x.pos[1]))
            t_c = 0.3 + float(np.hypot(cut[0] - c.pos[0], cut[1] - c.pos[1])) / 7.0
            T1s, hop1, T1a = _throw_seg(v, frm, cut)
            T2s, hop2, T2a = _throw_seg(c.profile.throw_speed(), cut, to)
            t_catch = max(t_release + T1s, t_c)
            t_rel2 = t_catch + 0.55
            arrive = t_rel2 + T2s
            if arrive < plan["arrive"] - 0.05 or (hop is not None and d > 60.0):
                plan = {"arrive": arrive, "relay": {"who": c.profile.position, "from": c.pos, "cut": cut, "t_c": t_c, "t_catch": t_catch},
                        "segs": [{"who": f.profile.position, "from": frm, "to": cut, "t0": t_release, "t1": t_release + T1s,
                                  "hop": hop1, "t_hop": (t_release + T1a) if hop1 else None, "base": 0},
                                 {"who": c.profile.position, "from": cut, "to": to, "t0": t_rel2, "t1": arrive,
                                  "hop": hop2, "t_hop": (t_rel2 + T2a) if hop2 else None, "base": base}]}
    return plan


def _commit_plan(play, fielders, plan: Dict, error: bool = False) -> float:
    """Write the plan's events: cover man to the bag, cutoff man to his spot, the throw segment(s)."""
    last = plan["segs"][-1]
    base = last["base"]
    thrower0 = plan["segs"][0]["who"]
    cov = _cover(base, thrower0 if plan["relay"] is None else plan["relay"]["who"])
    cp = _fpos(fielders, cov)
    tgt = BASE_XY[base]
    _ev_move(play, cov, cp, tgt, 0.3, 0.3 + float(np.hypot(tgt[0] - cp[0], tgt[1] - cp[1])) / 7.0)
    if plan["relay"] is not None:
        r = plan["relay"]
        _ev_move(play, r["who"], r["from"], r["cut"], 0.3, r["t_c"])
        _ev_field(play, r["who"], r["cut"], r["t_catch"], "relay", True)
    for i, sg in enumerate(plan["segs"]):
        to = sg["to"]
        err = bool(error and i == len(plan["segs"]) - 1)
        if err:
            d = float(np.hypot(to[0] - sg["from"][0], to[1] - sg["from"][1])) or 1e-6
            ux, uy = (to[0] - sg["from"][0]) / d, (to[1] - sg["from"][1]) / d
            to = (to[0] + ux * 6.0 + uy * 2.0, to[1] + uy * 6.0 - ux * 2.0)
        play.events.append({"kind": "throw", "who": sg["who"], "from": _r2(sg["from"]), "to": _r2(to), "t0": round(float(sg["t0"]), 2),
                            "t1": round(float(sg["t1"]), 2), "base": int(sg["base"]), "error": err,
                            "hop": (_r2(sg["hop"]) if sg["hop"] else None), "t_hop": (round(float(sg["t_hop"]), 2) if sg["hop"] else None),
                            "relay": plan["relay"] is not None})
    return float(plan["arrive"])


def _throw_to_base(play, fielders, f: Fielder, at, t_release: float, base: int, error: bool = False) -> float:
    """Throw from `at` to `base` with the v1.10 physics (arc / one-hop / relay). Returns the arrival time."""
    return _commit_plan(play, fielders, throw_plan(f, at, base, fielders, t_release), error)


def resolve_fielding(bb: BattedBall, fielders: List[Fielder], park: Park, rng: np.random.Generator,
                     batter_speed: float = 0.5, pressure: float = 0.0, batter_hand: str = "R") -> Tuple[PlayResult, FieldingPlay]:
    play = FieldingPlay()
    play.positions = {f.profile.position: _fpos(fielders, f.profile.position) for f in fielders}
    land0 = bb.trajectory.final.pos
    foul_geo, fpt, how = foul_boundary(bb, park)
    la = bb.launch_angle
    p_mis = 0.0                                          # contact directions the bat model cannot aim: topped / popped straight up
    if la < -15:
        p_mis = min(0.95, 0.55 + 0.01 * max(0.0, -15 - la))
    elif la > 50:
        p_mis = min(0.95, 0.45 + 0.010 * (la - 50))
    if foul_geo or (p_mis > 0.0 and rng.random() < p_mis):
        play.kind = "foul"
        play.landing, play.hang = (float(land0[0]), float(land0[1])), float(bb.hang_time)
        play.foul_point = [round(fpt[0], 1), round(fpt[1], 1)]
        v0 = bb.trajectory.vel[0]
        vh = float(np.hypot(v0[0], v0[1])) or 1e-6
        ux, uy = float(v0[0]) / vh, float(v0[1]) / vh
        v_g = 0.85 * vh
        t_roll = min(3.0, v_g / GROUND_DECEL)
        stop = (play.landing[0] + ux * (v_g * t_roll - 0.5 * GROUND_DECEL * t_roll * t_roll), play.landing[1] + uy * (v_g * t_roll - 0.5 * GROUND_DECEL * t_roll * t_roll))
        h1 = min(0.8, 0.05 * float(np.linalg.norm(bb.trajectory.vel[-1])))
        play.ground = _samples(_bounce_roll(play.landing, stop, play.hang, play.hang + t_roll, h1), play.hang, play.hang + t_roll)
        play.note = ("파울 · " + {"landing": "착지점이 파울 지역", "bag": "베이스를 지날 때 파울 지역", "stop": "파울 지역에서 정지"}[how]) if foul_geo else "파울 · 빗맞음(뒤·옆)"
        return PlayResult("foul", 0, play.note, 1.0 if foul_geo else p_mis), play
    fence = park.fence_distance(bb.spray_angle)
    h = _height_at_distance(bb.trajectory, fence)
    if h is not None and h > park.fence_height:
        play.kind = "hr"
        play.events.append(runner_event(batter_speed, batter_hand, 4, True, jog=True))
        ux, uy = np.sin(np.radians(bb.spray_angle)), np.cos(np.radians(bb.spray_angle))
        watch = (ux * (fence - 3.0), uy * (fence - 3.0))
        fw = min((f for f in fielders if f.profile.position in ("LF", "CF", "RF")), key=lambda f: f.time_to(watch))
        _ev_move(play, fw.profile.position, fw.pos, watch, 0.3, max(bb.hang_time, fw.time_to(watch)))
        return PlayResult("HR", 4, "over the fence (%.0f m)" % bb.landing_distance, 1.0), play

    land = bb.trajectory.final.pos
    lx, ly = float(land[0]), float(land[1])
    hang = float(bb.hang_time)
    v0 = bb.trajectory.vel[0]
    vh = float(np.hypot(v0[0], v0[1]))
    ground = bb.launch_angle < 10.0 and bb.apex < 2.5
    play.kind = "ground" if ground else ("line" if bb.launch_angle < 20 else "fly")
    wall_h = None
    if not ground and np.hypot(lx, ly) > fence - 1.0:
        # the ball reaches the wall in the air below the top: it hits the wall at (wx, wy) at t_wall
        p = bb.trajectory.pos
        r = np.hypot(p[:, 0], p[:, 1])
        i = int(np.argmax(r >= fence - 1.0))
        wx, wy = float(p[i, 0]), float(p[i, 1])
        wall_h = float(p[i, 2])
        t_wall = float(bb.trajectory.t[i])
        lx, ly, hang = wx, wy, t_wall
        play.note = "펜스 직격 (높이 %.1f m)" % wall_h
    play.landing, play.hang = (lx, ly), hang

    if not ground:
        # every fielder routes; the one with the best chance attempts
        v_arr = float(np.linalg.norm(bb.trajectory.vel[-1]))
        cands = [f.fly_attempt((lx, ly), hang, bb.apex, bb.launch_angle, v_arr, rng, pressure)
                 for f in fielders if f.profile.position != "P" or hang > 1.5]
        if wall_h is not None:                                # catch at the wall: only below the reach (jump ~2.6 m)
            for a in cands:
                if wall_h > 2.6:
                    a.p_success, a.success = 0.0, False
                elif wall_h > 2.0:
                    a.p_success *= 0.6
                    a.success = bool(a.success and rng.random() < 0.6)
                    a.difficulty = (a.difficulty + ", 펜스 앞 점프").strip(", ")
        cands = [a for a in cands if a.p_success > 0.0]
        if cands:
            best = max(cands, key=lambda a: a.p_success)
            # the attempt already sampled success with its own probability
            play.attempts.append(best)
            fb = next(x for x in fielders if x.profile.position == best.position)
            _ev_move(play, best.position, fb.pos, best.point, 0.25, min(best.t_fielder, best.t_ball))
            _ev_field(play, best.position, best.point, best.t_ball, "catch", best.success)
            if best.success:
                play.events.append(runner_event(batter_speed, batter_hand, 1, False, out_t=best.t_ball))
                _throw_to_base(play, fielders, fb, best.point, best.t_ball + fb.profile.transfer_time(), 2)
                return PlayResult("out", 0, "%s 뜬공 처리 (%s)" % (best.position, best.note), best.p_success), play
        # not caught: the ball lands (or caroms off the wall); nearest fielder retrieves
        if wall_h is not None:
            ux, uy = (lx, ly) / max(np.hypot(lx, ly), 1e-6)
            stop = (lx - ux * 4.0, ly - uy * 4.0)                # carom a few metres back onto the field
            t_land = hang + 0.6
        else:
            roll = 0.25 * vh * (0.5 if bb.launch_angle > 20 else 1.0)
            ux, uy = (lx, ly) / max(np.hypot(lx, ly), 1e-6)
            stop = (lx + ux * roll, ly + uy * roll)
            t_land = hang
        f = min(fielders, key=lambda f: f.time_to(stop))
        after_dive = bool(play.attempts) and play.attempts[-1].dive and play.attempts[-1].position == f.profile.position
        t_ret = max(t_land, f.time_to(stop)) + f.profile.transfer_time(on_the_run=True, after_dive=after_dive)
        play.retriever, play.t_retrieve = f.profile.position, float(t_ret)
        t_pick = t_ret - f.profile.transfer_time(on_the_run=True, after_dive=after_dive)
        if play.attempts and play.attempts[-1].position == f.profile.position:
            _ev_move(play, f.profile.position, play.attempts[-1].point, stop, play.attempts[-1].t_ball, t_pick)
        else:
            _ev_move(play, f.profile.position, f.pos, stop, 0.3, t_pick)
        _ev_field(play, f.profile.position, stop, t_pick, "wall" if wall_h is not None else "pickup", True)
        h1 = (wall_h if wall_h is not None else min(1.2, 0.05 * v_arr))
        play.ground = _samples(_bounce_roll((lx, ly), stop, t_land if wall_h is None else hang, max(t_pick, t_land + 0.3), h1), (t_land if wall_h is None else hang), max(t_pick, t_land + 0.3))
        return _hit_bases(stop, f, t_ret, batter_speed, rng, play, pressure, batter_hand, fielders)

    # ground ball: decelerating roll along the spray direction from the landing/first bounce point
    ux, uy = v0[0] / max(vh, 1e-6), v0[1] / max(vh, 1e-6)
    x0, y0 = float(bb.trajectory.pos[0][0]), float(bb.trajectory.pos[0][1])
    v_g = 0.85 * vh                                       # first bounce takes ~15 %
    t_stop = v_g / GROUND_DECEL
    path = lambda t: (x0 + ux * (v_g * t - 0.5 * GROUND_DECEL * t * t), y0 + uy * (v_g * t - 0.5 * GROUND_DECEL * t * t))
    speed = lambda t: max(0.0, v_g - GROUND_DECEL * t)
    # hop phase: bounces get shorter as the ball slows; phase 0 = just bounced, ~0.4 = rising in-between hop
    def hop(t):
        el, ph = 0.0, 0.0
        while True:
            T = 0.18 + 0.30 * max(0.2, speed(el) / max(v_g, 1e-6))
            if el + T > t:
                return (t - el) / T
            el += T
            if el > 20.0:
                return 0.0
    def ground_fn(t):                                     # for the viewers: the roll model with hop height, joined to the real landing point
        x, y = path(t)
        c = max(0.0, 1.0 - (t - hang) / 0.4)
        px0, py0 = path(hang)
        x += (lx - px0) * c; y += (ly - py0) * c
        ph = hop(t)
        hh = 0.04 + 0.35 * (speed(t) / max(v_g, 1e-6))
        return x, y, max(0.04, 4 * hh * ph * (1 - ph))
    infield = [f for f in fielders if f.profile.position in ("P", "1B", "2B", "SS", "3B")]
    attempts = [(f, f.ground_attempt(path, speed, hop, min(t_stop, 3.0), rng, pressure)) for f in infield]
    attempts = [(f, a) for f, a in attempts if a is not None]
    if attempts:
        f, a = min(attempts, key=lambda fa: fa[1].t_ball)
        play.attempts.append(a)
        _ev_move(play, f.profile.position, f.pos, a.point, 0.2, min(a.t_fielder, a.t_ball))
        _ev_field(play, f.profile.position, a.point, a.t_ball, "ground", a.success)
        play.ground = _samples(ground_fn, hang, a.t_ball + (0.0 if a.success else 1.2))
        if a.success:
            # throw to first vs the runner
            d1 = float(np.hypot(BASES[1][0] - a.point[0], BASES[1][1] - a.point[1]))
            moved = float(np.hypot(a.point[0] - f.pos[0], a.point[1] - f.pos[1])) > 3.0
            t_run = _runner_time(1, batter_speed, batter_hand)
            t_rel = a.t_ball + f.profile.transfer_time(on_the_run=moved)
            plan = throw_plan(f, a.point, 1, fielders, t_rel)
            t_throw = plan["arrive"]
            rushed = (t_run - t_throw) < 0.25
            if rushed:
                t_rel -= 0.10                                     # hurried release buys a little time
                plan = throw_plan(f, a.point, 1, fielders, t_rel)
                t_throw = plan["arrive"]
            if rng.random() < f.profile.throw_error_p(pressure, d1, rushed):
                play.note = "송구 실책"
                _commit_plan(play, fielders, plan, error=True)
                play.events.append(runner_event(batter_speed, batter_hand, 1, True))
                _ev_call(play, 1, t_run, False)
                return PlayResult("error", 1, "%s 송구 실책" % f.profile.position, 0.0), play
            _commit_plan(play, fielders, plan)
            out = t_throw < t_run - 0.05
            play.events.append(runner_event(batter_speed, batter_hand, 1, not out, out_t=(t_throw if out else None)))
            _ev_call(play, 1, max(t_throw, t_run), out)
            if out:
                return PlayResult("out", 0, "%s 땅볼 처리 (송구 %.2f s vs 주자 %.2f s)" % (f.profile.position, t_throw, t_run), 1.0), play
            return PlayResult("single", 1, "내야 안타 (송구 %.2f s vs 주자 %.2f s)" % (t_throw, t_run), 1.0), play
        play.note = "포구 실책"
        chase = path(min(a.t_ball + 1.0, t_stop))
        _ev_move(play, f.profile.position, a.point, chase, a.t_ball, a.t_ball + 1.2)
        _ev_field(play, f.profile.position, chase, a.t_ball + 1.2, "pickup", True)
        play.events.append(runner_event(batter_speed, batter_hand, 1, True))
        return PlayResult("error", 1, "%s 포구 실책" % f.profile.position, 0.0), play
    # through the infield: outfielders charge and cut it off at the earliest point they can reach
    outfield = [f for f in fielders if f.profile.position in ("LF", "CF", "RF")]
    best = None
    for f in outfield:
        for t in np.arange(1.0, min(t_stop, 8.0), 0.1):
            xy = path(t)
            if np.hypot(*xy) > fence - 2.0:
                break
            if f.time_to(xy) <= t:
                if best is None or t < best[0]:
                    best = (t, xy, f)
                break
    if best is None:                                       # nobody gets there before the wall
        t_cut = min(t_stop, (fence - 2.0) / max(v_g * 0.6, 1e-6))
        stop = path(t_cut)
        k = min(1.0, (fence - 2.0) / max(np.hypot(*stop), 1e-6))
        stop = (stop[0] * k, stop[1] * k)
        f = min(outfield, key=lambda f: f.time_to(stop))
        t_ret = max(t_cut, f.time_to(stop)) + f.profile.transfer_time(on_the_run=True)
    else:
        t_cut, stop, f = best
        t_ret = t_cut + f.profile.transfer_time(on_the_run=True)
    play.retriever, play.t_retrieve = f.profile.position, float(t_ret)
    t_pick = t_ret - f.profile.transfer_time(on_the_run=True)
    _ev_move(play, f.profile.position, f.pos, stop, 0.3, min(t_pick, max(0.35, f.time_to(stop))))
    _ev_field(play, f.profile.position, stop, t_pick, "pickup", True)
    play.ground = _samples(ground_fn, hang, t_pick)
    return _hit_bases(stop, f, t_ret, batter_speed, rng, play, pressure, batter_hand, fielders)


def _hit_bases(stop, f: Fielder, t_ret: float, batter_speed: float, rng, play: FieldingPlay, pressure: float,
               hand: str = "R", fielders: Optional[List[Fielder]] = None):
    """Single/double/triple from the retrieval time and throw to 2B / 3B vs the runner."""
    fl = fielders or []
    if fl:
        p2, p3 = throw_plan(f, stop, 2, fl, t_ret), throw_plan(f, stop, 3, fl, t_ret)
        t2, t3 = p2["arrive"], p3["arrive"]
    else:
        d2 = float(np.hypot(BASES[2][0] - stop[0], BASES[2][1] - stop[1]))
        d3 = float(np.hypot(BASES[3][0] - stop[0], BASES[3][1] - stop[1]))
        t2, t3 = t_ret + f.profile.throw_time(d2), t_ret + f.profile.throw_time(d3)
    r2, r3 = _runner_time(2, batter_speed, hand), _runner_time(3, batter_speed, hand)
    tag = lambda pl: (" · 중계 %s" % pl["relay"]["who"]) if (pl.get("relay")) else (" · 원바운드" if pl["segs"][-1]["hop"] else "")
    if t3 < r3 and t2 < r2:
        if fl:
            _commit_plan(play, fl, p2)
            play.events.append(runner_event(batter_speed, hand, 1, True))
        return PlayResult("single", 1, "%s 처리, 1루 정지 (2루 송구 %.1f s vs 주자 %.1f s%s)" % (f.profile.position, t2, r2, tag(p2) if fl else ""), 1.0), play
    if t3 < r3:
        if fl:
            t_arr = _commit_plan(play, fl, p2)
            play.events.append(runner_event(batter_speed, hand, 2, True))
            _ev_call(play, 2, max(r2, t_arr), False)
        return PlayResult("double", 2, "2루타 (3루 송구 %.1f s vs 주자 %.1f s%s)" % (t3, r3, tag(p3) if fl else ""), 1.0), play
    if fl:
        t_arr = _commit_plan(play, fl, p3)
        play.events.append(runner_event(batter_speed, hand, 3, True))
        _ev_call(play, 3, max(r3, t_arr), False)
    return PlayResult("triple", 3, "3루타 (회수 %.1f s%s)" % (t_ret, tag(p3) if fl else ""), 1.0), play
