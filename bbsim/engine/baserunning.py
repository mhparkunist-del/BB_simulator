"""Batter-runner model (v1.7): sprint physics from the batter's `speed` attribute, base-to-base times,
and the timed events the viewers replay (runner path + arrivals).

Sprint: v(t) = v_max (1 - exp(-t/tau)); distance s(t) = v_max (t - tau (1 - exp(-t/tau))).
  speed 0 -> v_max 7.0 m/s (slow catcher), 0.5 -> 8.05, 1.0 -> 9.1 m/s (elite, Statcast 30 ft/s).
  Home-to-first (with a 0.18 s reaction after contact): 4.88 / 4.28 / 3.86 s for speed 0 / 0.5 / 1.
Paths: the batter's box is ~1.1 m (RHB) / ~2.2 m (LHB) toward first, so the first leg is shorter than
27.43 m; later legs are ~4 % longer (rounding the bag) and each turn costs 0.25 s.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

BASE_XY = {0: (0.0, 0.0), 1: (19.4, 19.4), 2: (0.0, 38.8), 3: (-19.4, 19.4), 4: (0.0, 0.0)}
BASE_LEN = 27.43
REACTION = 0.18            # s from contact to the first step (follow-through, drop the bat)
TURN_PENALTY = 0.25        # s lost per base rounded
ROUND_FACTOR = 1.04        # path length multiplier after the first base


def sprint_params(speed: float):
    """(v_max, tau) from the 0..1 running attribute."""
    s = min(1.0, max(0.0, speed))
    return 7.0 + 2.1 * s, 0.95 - 0.15 * s


def dist_at(u: float, v_max: float, tau: float) -> float:
    if u <= 0:
        return 0.0
    return v_max * (u - tau * (1.0 - math.exp(-u / tau)))


def time_for(d: float, v_max: float, tau: float) -> float:
    """Time to cover distance d from a standing start (Newton on the closed-form distance)."""
    if d <= 0:
        return 0.0
    t = d / v_max + tau
    for _ in range(12):
        f = dist_at(t, v_max, tau) - d
        df = v_max * (1.0 - math.exp(-t / tau))
        t -= f / max(df, 1e-6)
        if t < 0:
            t = 0.5 * d / v_max
    return max(t, 0.0)


def first_leg(hand: str) -> float:
    return BASE_LEN - (2.2 if hand.upper().startswith("L") else 1.1)


def time_to_base(speed: float, bases: int, hand: str = "R", jog: bool = False) -> float:
    """Batter-runner time from contact to reach base `bases` (1..4)."""
    v, tau = sprint_params(speed)
    if jog:
        v, tau = 5.2, 0.8                                   # home-run trot
    d = first_leg(hand) + max(0, bases - 1) * BASE_LEN * ROUND_FACTOR
    return REACTION + time_for(d, v, tau) + TURN_PENALTY * max(0, bases - 1)


def runner_event(speed: float, hand: str, bases: int, safe: bool, out_t: Optional[float] = None,
                 jog: bool = False, who: str = "BR") -> Dict:
    """Timed path for the viewers. `bases` = how far the runner tries to go (0 = stays), `safe` = reaches it.
    `out_t` = when the runner is retired (fly caught / tag) so the animation can peel off."""
    v, tau = sprint_params(speed)
    if jog:
        v, tau = 5.2, 0.8
    n = max(1, bases)
    return {"kind": "run", "who": who, "path": [list(BASE_XY[i]) for i in range(0, n + 1)],
            "t0": REACTION, "arrive": [round(time_to_base(speed, b, hand, jog), 2) for b in range(1, n + 1)],
            "vmax": round(v, 2), "tau": round(tau, 2), "safe": bool(safe), "bases": int(bases if safe else 0),
            "out_t": (None if out_t is None else round(float(out_t), 2))}


def runner_position(ev: Dict, t: float) -> List[float]:
    """Where a `run` event's runner is at time t (used by tests; the JS renderer mirrors this)."""
    path, arr = ev["path"], ev["arrive"]
    if t <= ev["t0"]:
        return list(path[0])
    if ev.get("out_t") is not None and t >= ev["out_t"] + 1.0:
        t = ev["out_t"] + 1.0
    # first leg: the sprint law scaled so the runner arrives exactly at arrive[0]
    u = t - ev["t0"]
    u1 = arr[0] - ev["t0"]
    s1 = dist_at(u1, ev["vmax"], ev["tau"])
    if u <= u1:
        f = dist_at(u, ev["vmax"], ev["tau"]) / max(s1, 1e-6)
        return [path[0][0] + f * (path[1][0] - path[0][0]), path[0][1] + f * (path[1][1] - path[0][1])]
    for i in range(1, len(arr)):
        if t <= arr[i]:
            f = (t - arr[i - 1]) / max(arr[i] - arr[i - 1], 1e-6)
            return [path[i][0] + f * (path[i + 1][0] - path[i][0]), path[i][1] + f * (path[i + 1][1] - path[i][1])]
    return list(path[len(arr)])
