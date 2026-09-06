"""Fielder agent (v1.4): reads the batted ball from its own spot, runs a route, catches or fields, transfers, throws.

Information boundary: a fielder sees the ball's flight (with read noise that depends on the geometry of
the flight relative to its own eyes), the runners and the situation; never the collision result or the
batter's plan. Attribute taxonomy follows docs/PLAYER_ATTRIBUTES.md (fixed body, semi-fixed physique,
trainable skills, mental, talent); the perception/difficulty model is in docs/FIELDING.md.

Reading difficulty (why some balls are harder to judge from a given spot):
  * depth ambiguity - a ball hit straight at the fielder shows almost no lateral angular motion, so the
    landing depth is judged from optical acceleration only (Chapman 1968, McBeath 1995): noise grows
    along the line of sight as the approach angle closes;
  * low, hard line drives give little time and a flat optical trajectory: short hang time and low
    apex raise the noise and delay the first step;
  * balls over the head (landing behind the fielder) need a turn and a blind run: extra reaction, lower
    speed while turning, larger noise, over-the-shoulder catch;
  * very high pop-ups drift (spin, wind) and demand a long look: small time pressure but a drift term;
  * ground balls - the hop the fielder meets (short hop / in-between / long hop) and glove side vs
    backhand decide the pick-up reliability.
Movement uses a sprint model with an acceleration phase v(t) = v_max (1 - exp(-t/tau)), tau ~ 0.45 s.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import exp
from typing import Optional, Tuple

import numpy as np

POSITIONS = ("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF")
OUTFIELD = ("LF", "CF", "RF")
SPRINT_TAU = 0.45             # s, acceleration time constant from a set position (27 m in ~4.4 s incl. reaction; Statcast 90 ft/4.5 s ~ 50 %)


@dataclass
class FielderProfile:
    name: str = "F"
    position: str = "CF"
    hand: str = "R"                  # throwing hand: glove is on the other side
    # --- body (fixed / semi-fixed) ---
    height: float = 1.83
    sprint_speed: float = 0.5        # 주력 (semi): top speed 7.6..9.0 m/s (Statcast sprint speed 25-29.5 ft/s)
    wingspan: float = 0.5            # 리치 (fixed): standing catch radius 0.9..1.3 m; a jump adds 0.4 m
    # --- trainable skills ---
    first_step: float = 0.5          # 첫걸음/반응: 0.40..0.22 s before moving (from a set position)
    route: float = 0.5               # 루트 효율: path factor 1.20..1.06 (Statcast route efficiency ~0.85..0.94)
    ball_reading: float = 0.5        # 타구 판단: base landing-read noise 3.0..1.2 m, and commit time
    glove: float = 0.5               # 글러브/포구: routine catch reliability 0.95..0.995
    arm_strength: float = 0.5        # 어깨: throw speed 28..42 m/s (63..94 mph)
    arm_accuracy: float = 0.5        # 송구 정확도: throwing error 2.5 %..0.5 % on a set throw
    transfer: float = 0.5            # 글러브→손 전환: 0.95..0.55 s from a set position (Statcast exchange ~0.7 s)
    positioning: float = 0.5         # 포지셔닝: pre-pitch shift toward the expected spray (0..6 m)
    # --- mental / condition ---
    composure: float = 0.5           # 침착: rushed throws / pressure errors
    focus: float = 0.5               # 집중: read noise late in the game
    game_sense: float = 0.5
    stamina: float = 0.5

    # ----- derived physical quantities -------------------------------------------------
    def top_speed(self, fatigue: float = 0.0) -> float:
        return (7.6 + 1.4 * self.sprint_speed) * (1.0 - 0.06 * fatigue * (1.0 - 0.6 * self.stamina))

    def first_step_time(self) -> float:
        base = 0.30 - 0.15 * self.first_step
        return base + (0.45 if self.position == "P" else 0.0)      # pitcher is finishing the delivery

    def route_factor(self) -> float:
        return (1.10 - 0.08 * self.route) * (1.3 if self.position == "P" else 1.0)

    def read_sigma(self) -> float:
        return 3.0 - 1.8 * self.ball_reading

    def catch_reach(self, jump: bool = False) -> float:
        return 0.9 + 0.4 * self.wingspan + (0.4 if jump else 0.0)

    def catch_reliability(self) -> float:
        return 0.95 + 0.045 * self.glove

    def throw_speed(self) -> float:
        return 28.0 + 14.0 * self.arm_strength

    def throw_error_p(self, pressure: float = 0.0, distance: float = 30.0, rushed: bool = False) -> float:
        p = (0.025 - 0.02 * self.arm_accuracy) * (1.0 + 0.4 * pressure * (1.0 - self.composure))
        p *= 1.0 + 0.012 * max(0.0, distance - 30.0)                 # long throws miss more
        if rushed:
            p *= 1.6 + 0.8 * (1.0 - self.composure)
        return float(min(0.5, p))

    def transfer_time(self, on_the_run: bool = False, after_dive: bool = False) -> float:
        base = 0.95 - 0.40 * self.transfer
        if self.position in OUTFIELD:
            base += 0.30                                              # crow hop
        if on_the_run:
            base += 0.20
        if after_dive:
            base += 0.60
        return base

    def throw_time(self, distance: float) -> float:
        """Flight time of a throw: on a line up to ~40 m, then an arc that costs extra time."""
        t = distance / self.throw_speed()
        if distance > 40.0:
            t *= 1.0 + 0.004 * (distance - 40.0)
        return t

    @classmethod
    def from_card(cls, card, position: str = "CF") -> "FielderProfile":
        t = card.derive_field_traits() if hasattr(card, "derive_field_traits") else {}
        keys = ("first_step", "route", "ball_reading", "glove", "arm_strength", "arm_accuracy", "transfer", "positioning",
                "composure", "focus", "game_sense", "stamina", "sprint_speed", "wingspan")
        kw = {k: float(t[k]) for k in keys if k in t}
        return cls(name=card.name, position=position, hand=card.hand, height=card.fixed.get("height", 1.83), **kw)


@dataclass
class FieldingAttempt:
    fielder: str
    position: str
    kind: str                      # fly_catch | ground_field
    point: Tuple[float, float]     # where the fielder meets (or would meet) the ball, m
    t_ball: float                  # when the ball is there, s after contact
    t_fielder: float               # when the fielder gets there, s after contact
    p_success: float
    success: bool
    note: str = ""
    difficulty: str = ""           # human-readable read/catch difficulty tags
    read_error_m: float = 0.0      # how far the initial read was off
    on_the_run: bool = False
    dive: bool = False
    backhand: bool = False


def sprint_time(distance: float, v_max: float, tau: float = SPRINT_TAU) -> float:
    """Time to cover `distance` from rest with v(t) = v_max (1 - exp(-t/tau)), by Newton iteration."""
    if distance <= 0.0:
        return 0.0
    t = distance / v_max + tau
    for _ in range(6):
        d = v_max * (t - tau * (1.0 - exp(-t / tau)))
        v = v_max * (1.0 - exp(-t / tau))
        t = max(0.0, t - (d - distance) / max(v, 0.5))
    return float(t)


class Fielder:
    """One fielder with a pre-pitch position and a noisy, geometry-dependent read of the batted ball."""

    def __init__(self, profile: FielderProfile, pos_xy: Tuple[float, float]):
        self.profile = profile
        self.home = (float(pos_xy[0]), float(pos_xy[1]))
        self.pos = self.home
        self.fatigue = 0.0

    @property
    def name(self) -> str:
        return self.profile.name

    # ------------------------------------------------------------------ geometry
    def _geometry(self, landing_xy):
        dx, dy = landing_xy[0] - self.pos[0], landing_xy[1] - self.pos[1]
        d = float(np.hypot(dx, dy))
        to_home = np.array([-self.pos[0], -self.pos[1]])
        to_home /= max(np.linalg.norm(to_home), 1e-6)
        to_land = np.array([dx, dy]) / max(d, 1e-6)
        cos_a = float(np.dot(to_home, to_land))       # +1: ball coming straight in; -1: straight over the head
        return d, to_home, to_land, cos_a

    def read_landing(self, landing_xy, hang_time: float, apex: float, launch_deg: float, rng: np.random.Generator):
        """Landing estimate at the moment the route commits: (estimate_xy, sigma_depth, sigma_lateral, tags, t_commit)."""
        p = self.profile
        d, to_home, to_land, cos_a = self._geometry(landing_xy)
        tags = []
        base = p.read_sigma() * (1.0 + 0.4 * (1.0 - p.focus) * self.fatigue)
        t_commit = (0.22 - 0.10 * p.ball_reading) if p.position in OUTFIELD else 0.05
        depth_amb = 1.0 + 1.6 * max(0.0, abs(cos_a) - 0.6) / 0.4          # 1 .. 2.6 for balls straight at / over the fielder
        sig_depth = base * depth_amb
        sig_lat = base * 0.6
        if abs(cos_a) > 0.85 and d > 4.0:
            tags.append("정면 타구: 깊이 판단 어려움")
        if launch_deg < 15.0 and hang_time < 2.5:
            k = 1.0 + 0.5 * (2.5 - hang_time)
            sig_depth *= k; sig_lat *= k
            tags.append("낮은 라이너: 판단 시간 부족")
        if cos_a < -0.3 and d > 3.0:
            sig_depth *= 1.25
            tags.append("머리 위로 넘어감: 등지고 추적")
        if apex > 25.0:
            sig_depth *= 0.8; sig_lat *= 0.8
            drift = 0.6 + 0.02 * (apex - 25.0)
            sig_depth += drift; sig_lat += drift
            tags.append("높은 뜬공: 낙하 지점 흔들림")
        seen = min(0.6, t_commit / max(hang_time, 0.3))
        shrink = max(0.4, 1.0 - 0.8 * seen)
        sig_depth *= shrink; sig_lat *= shrink
        e_depth = rng.normal(0, sig_depth)
        e_lat = rng.normal(0, sig_lat)
        lat = np.array([-to_land[1], to_land[0]])
        est = (float(landing_xy[0] + to_land[0] * e_depth + lat[0] * e_lat),
               float(landing_xy[1] + to_land[1] * e_depth + lat[1] * e_lat))
        return est, sig_depth, sig_lat, tags, t_commit

    def time_to(self, point_xy, backward: bool = False, extra_reaction: float = 0.0) -> float:
        """Arrival time at a point: first step + acceleration-phase sprint along an inefficient route."""
        p = self.profile
        d = float(np.hypot(point_xy[0] - self.pos[0], point_xy[1] - self.pos[1]))
        d = max(0.0, d - p.catch_reach())
        v = p.top_speed(self.fatigue) * (0.95 if backward else 1.0)
        turn = 0.20 if backward else 0.0
        # reading and the first step overlap: the fielder starts moving while still refining the read
        return max(p.first_step_time(), extra_reaction) + 0.5 * min(p.first_step_time(), extra_reaction) + turn + sprint_time(d * p.route_factor(), v)

    # ------------------------------------------------------------------ fly balls
    def fly_attempt(self, landing_xy, hang_time: float, apex: float, launch_deg: float, arrival_speed: float,
                    rng: np.random.Generator, pressure: float = 0.0) -> FieldingAttempt:
        p = self.profile
        d, to_home, to_land, cos_a = self._geometry(landing_xy)
        est, sig_d, sig_l, tags, t_commit = self.read_landing(landing_xy, hang_time, apex, launch_deg, rng)
        backward = cos_a < -0.3 and d > 3.0
        miss = float(np.hypot(est[0] - landing_xy[0], est[1] - landing_xy[1]))
        t_route = self.time_to(est, backward=backward, extra_reaction=t_commit)
        t_arr = t_route + 0.8 * miss / p.top_speed(self.fatigue)
        margin = hang_time - t_arr
        on_the_run = margin < 0.45
        dive = False
        if margin >= 0.0:
            p_ok = p.catch_reliability()
            # difficulty penalties fade with spare time: a fielder camped under the ball makes the play
            rush = max(0.0, 1.0 - margin / 1.0)
            if on_the_run:
                p_ok *= 0.75 + 0.25 * margin / 0.45
            if backward:
                p_ok *= 1.0 - 0.15 * rush
                if rush > 0.5:
                    tags.append("등 뒤로 포구")
            if arrival_speed > 35.0:
                p_ok *= 1.0 - 0.006 * (arrival_speed - 35.0) * max(rush, 0.3)
                tags.append("강한 라이너")
            if apex > 25.0:
                p_ok *= 1.0 - 0.03 * max(rush, 0.3)
        elif margin > -0.45:
            dive = True
            p_ok = 0.35 * (1.0 + margin / 0.45) * (0.7 + 0.6 * p.glove)
            tags.append("다이빙")
        else:
            p_ok = 0.0
        p_ok *= 1.0 - 0.15 * pressure * (1.0 - p.composure)
        p_ok = float(np.clip(p_ok, 0.0, 0.999))
        ok = bool(rng.random() < p_ok)
        note = "잡음" if ok else ("다이빙 실패" if dive else ("따라가지 못함" if margin < -0.45 else "포구 실패"))
        return FieldingAttempt(self.name, p.position, "fly_catch", (float(landing_xy[0]), float(landing_xy[1])), float(hang_time),
                               float(t_arr), p_ok, ok, note, ", ".join(tags), miss, on_the_run, dive, False)

    # ------------------------------------------------------------------ ground balls
    def ground_attempt(self, path_fn, speed_fn, hop_fn, t_stop: float, rng: np.random.Generator,
                       pressure: float = 0.0) -> Optional[FieldingAttempt]:
        """Earliest interception of a bouncing ball; pick-up reliability from the hop and the glove side."""
        p = self.profile
        best = None
        for t in np.arange(0.25, t_stop + 0.01, 0.05):
            xy = path_fn(t)
            if self.time_to(xy, extra_reaction=0.0) * 0.95 <= t:          # short lateral bursts are efficient
                best = (t, xy)
                break
        if best is None:
            return None
        t, xy = best
        v = speed_fn(t)
        phase = hop_fn(t)
        tags = []
        p_ok = p.catch_reliability() - 0.0003 * max(0.0, v - 20.0)
        if 0.25 < phase < 0.6 and v > 12.0:
            p_ok -= 0.01 + 0.0004 * (v - 12.0)
            tags.append("어정쩡한 바운드")
        elif phase < 0.12:
            p_ok -= 0.005
            tags.append("숏 바운드")
        dx = xy[0] - self.pos[0]
        glove_side = -1.0 if p.hand.upper().startswith("R") else 1.0     # RH thrower facing home: glove on the -x side
        backhand = dx * glove_side < -1.0
        if backhand:
            p_ok -= 0.005
            tags.append("백핸드")
        p_ok *= 1.0 - 0.08 * pressure * (1.0 - p.composure)
        p_ok = float(np.clip(p_ok, 0.05, 0.999))
        ok = bool(rng.random() < p_ok)
        return FieldingAttempt(self.name, p.position, "ground_field", (float(xy[0]), float(xy[1])), float(t), float(t), p_ok, ok,
                               "잡음" if ok else "실책(포구)", ", ".join(tags), 0.0, False, False, backhand)
