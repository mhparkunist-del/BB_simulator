"""Batter judgment model v0.4.1: fastball-or-breaking, staged reads, learned trust.

The batter never sees pitch labels, spin or the true trajectory. It reads
the pitch in stages with only what a hitter has:

    0. prior     P(fastball) from the count (league table), the previous pitch
                 (sequence effect) and this pitcher's learned fastball share
    1. delivery  release point vs memory of this pitcher (tip)
    2. flight    at several *time bins* (25/40/55/70 % of the flight) the eyes
                 give speed and the bend seen so far (deviation from a straight
                 + gravity path). Each bin yields a family posterior
                 P(fastball | speed, bend) and a predicted plate location.
    3. commit    bins are combined with weights = visibility(t) x learned trust
                 per bin; early bins dominate because the ball is seen best far
                 away and the late part is "feel" (low visibility)
    4. learn     after the pitch: clusters of (speed, break) with a family tag,
                 the pitcher's fastball share, and per-bin trust (how right
                 each bin's read was for THIS pitcher)

Families are judged from what the eyes measure: a fastball is the pitcher's
fast, straight-ish family; a breaking pitch is slower and/or bends.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..physics.constants import G
from .base import BallSighting, GameContext, Vec3

# League fastball share by count (Statcast-era approximation; the prior's baseline).
LEAGUE_FB_BY_COUNT = {(0, 0): 0.57, (1, 0): 0.60, (2, 0): 0.70, (3, 0): 0.88, (3, 1): 0.75,
                      (0, 1): 0.48, (1, 1): 0.52, (2, 1): 0.58, (0, 2): 0.42, (1, 2): 0.43,
                      (2, 2): 0.47, (3, 2): 0.55}
SEQ_AFTER_FB = -0.06          # after a fastball, a bit less likely to see another
SEQ_AFTER_BR = +0.04
BINS = (0.25, 0.40, 0.55, 0.70)
QUAD_W_MAX = 1.0           # v0.7: weight of the eyes' own curvature fit late in the read
QUAD_W_START = 0.10        # fraction of flight where that blend starts   # fractions of the flight at which the eyes report


# ---------------------------------------------------------------- visibility
def visibility(frac: float, tracking: float = 0.5) -> float:
    """How well the eyes can measure at this point of the flight (0..1).

    v0.7: angular-velocity model (Bahill & LaRitz 1984). The eye tracks the ball
    until its angular velocity exceeds what smooth pursuit can follow; for a
    professional that is ~1.7 m in front of the plate (~85-90 % of the flight).
    `tracking` (타구판단능력, 0..1) sets the pursuit limit: cutoff 0.70 (poor)
    .. 0.90 (elite) of the flight, floor 0.15 .. 0.30. What limits the use of
    late information is the swing commit (the body is already moving), not the
    eyes; that limit lives in BatterProfile.reaction_time / late_window.
    """
    tr = float(np.clip(tracking, 0, 1))
    cutoff = 0.70 + 0.20 * tr
    floor = 0.15 + 0.15 * tr
    if frac <= cutoff:
        return 1.0
    return float(np.clip(1.0 - (frac - cutoff) / max(1.0 - cutoff, 1e-6) * 1.0, floor, 1.0))


def pressure_index(ctx: GameContext) -> float:
    """0..1 how much the situation squeezes the hitter (count, runners, leverage)."""
    p = 0.0
    if ctx.strikes == 2:
        p += 0.15                 # v0.7: the 2-strike term is already in the swing rule; keep pressure small
    if ctx.balls == 3 and ctx.strikes == 2:
        p += 0.10
    p += 0.12 * sum(ctx.runners)
    p += 0.3 * ctx.leverage
    return float(np.clip(p, 0.0, 1.0))


# ---------------------------------------------------------------- memory
@dataclass
class PitchCluster:
    speed: float
    break_x: float
    break_z: float
    n: int = 1
    label: str = ""
    family: str = "FB"          # FB (직구) | BR (변화구), tagged from speed & bend
    delay: float = 0.012        # s, actual arrival minus the straight-fit arrival (drag makes it late)
    z_mean: float = 0.75        # m, where this shape usually arrives (sinkers live low, four-seamers high)
    z_n: int = 0
    bias_x: float = 0.0         # learned (actual - read at commit) for this shape, m
    bias_z: float = 0.0

    def update(self, speed: float, bx: float, bz: float, rate: float = 0.3, delay: float = None) -> None:
        self.speed += rate * (speed - self.speed)
        self.break_x += rate * (bx - self.break_x)
        self.break_z += rate * (bz - self.break_z)
        if delay is not None:
            self.delay += rate * (delay - self.delay)
        self.n += 1

    def note_location(self, z: float) -> None:
        self.z_n += 1
        self.z_mean += (z - self.z_mean) / min(self.z_n, 12)


def default_clusters(hand: str = "R") -> List[PitchCluster]:
    """League-typical pitch shapes a hitter walks in with (v0.7: speed x break grid, 6 shapes; audit 03 #1).

    break = arrival minus the gravity-compensated straight fit (m); x mirrored for a left-hander.
    """
    sx = -1.0 if hand.upper().startswith("L") else 1.0
    return [PitchCluster(41.0, sx * -0.15, 0.23, 1, "four-seam", "FB"), PitchCluster(40.3, sx * -0.28, 0.06, 1, "sinker", "FB"),
            PitchCluster(38.5, sx * 0.05, 0.12, 1, "cutter", "BR"), PitchCluster(37.0, sx * 0.14, 0.03, 1, "slider", "BR"),
            PitchCluster(37.0, sx * -0.22, 0.03, 1, "changeup", "BR"), PitchCluster(35.5, sx * 0.13, -0.28, 1, "curve", "BR")]


@dataclass
class PitcherMemory:
    clusters: List[PitchCluster] = field(default_factory=default_clusters)
    release_mean: Optional[Vec3] = None
    release_n: int = 0
    last_family: Optional[str] = None
    fb_share: float = 0.57                 # learned fastball share of this pitcher
    fb_n: int = 0
    speed_sigma: float = 2.0
    bend_sigma: float = 0.025              # m, tolerance on the bend seen so far
    max_clusters: int = 8
    learned: int = 0
    trust: Dict[float, float] = field(default_factory=lambda: {b: 0.6 for b in BINS})   # per-bin read trust
    bias: Dict[str, List[float]] = field(default_factory=lambda: {"FB": [0.0, 0.0], "BR": [0.0, 0.0]})  # learned (actual - read) at commit
    history: List[Dict[str, float]] = field(default_factory=list)
    last_cluster: Optional[PitchCluster] = None

    def max_speed(self) -> float:
        return max(c.speed for c in self.clusters)

    def retag(self) -> None:
        """Fastball family = the pitcher's fastest cluster and anything as fast and on the same track."""
        ref = max(self.clusters, key=lambda c: c.speed)
        for c in self.clusters:
            same_track = float(np.hypot(c.break_x - ref.break_x, c.break_z - ref.break_z)) < 0.08
            c.family = "FB" if (c.speed >= ref.speed - 2.5 and same_track) else "BR"

    def nearest(self, speed: float, bx: float, bz: float) -> Tuple[int, float]:
        best, bd = -1, 1e9
        for i, c in enumerate(self.clusters):
            d = ((speed - c.speed) / 3.0) ** 2 + ((bx - c.break_x) / 0.10) ** 2 + ((bz - c.break_z) / 0.10) ** 2
            if d < bd:
                best, bd = i, d
        return best, bd

    def learn(self, speed: float, bx: float, bz: float, release: Optional[Vec3], delay: float = None,
              attention: float = 1.0) -> str:
        """attention > 1: the hitter watched this pitch on purpose (took it to learn) -> faster update."""
        i, d = self.nearest(speed, bx, bz)
        if d > 2.5 and len(self.clusters) < self.max_clusters:
            self.clusters.append(PitchCluster(speed, bx, bz, 1, "new%d" % len(self.clusters), delay=delay or 0.012))
            i = len(self.clusters) - 1
        else:
            base = 0.35 if self.clusters[i].n < 4 else 0.2
            self.clusters[i].update(speed, bx, bz, rate=min(0.6, base * attention), delay=delay)
        self.retag()
        self.last_cluster = self.clusters[i]
        fam = self.clusters[i].family
        self.fb_n += 1
        self.fb_share += ((1.0 if fam == "FB" else 0.0) - self.fb_share) / min(self.fb_n + 1, 20)
        if release is not None:
            if self.release_mean is None:
                self.release_mean = release.copy()
            else:
                self.release_mean = (self.release_mean * self.release_n + release) / (self.release_n + 1)
            self.release_n += 1
        self.last_family = fam
        self.learned += 1
        return fam

    def learn_bias(self, family: str, err_x: float, err_z: float, attention: float = 1.0) -> None:
        """The hitter notices 'this one drops more than I read' and corrects its next read."""
        r = min(0.6, 0.3 * attention)
        self.bias[family][0] += r * (err_x - self.bias[family][0])
        self.bias[family][1] += r * (err_z - self.bias[family][1])

    def learn_trust(self, bin_errors: Dict[float, float], attention: float = 1.0) -> None:
        """bin -> |pred - actual| (m). Trust moves toward exp(-err / 0.10)."""
        for b, e in bin_errors.items():
            target = float(np.exp(-e / 0.10))
            self.trust[b] += min(0.5, 0.25 * attention) * (target - self.trust[b])


# ---------------------------------------------------------------- judgment
@dataclass
class BinRead:
    frac: float
    t: float
    speed_est: float
    bend_seen: Tuple[float, float]         # observed deviation (x, z) from straight+gravity so far
    p_fastball: float
    pred_xz: Tuple[float, float]
    sigma_xz: Tuple[float, float]
    weight: float                          # visibility x trust
    t_arrival: float = 0.0                 # straight-fit arrival + believed family's learned delay


@dataclass
class Judgment:
    t: float
    prior_fastball: float
    p_fastball: float
    prior_cues: List[str]
    reads: List[BinRead]
    pred_xz: Tuple[float, float]
    sigma_xz: Tuple[float, float]
    t_arrival: float
    tipped: bool = False
    cues: List[str] = field(default_factory=list)
    dominant_bin: float = 0.25
    pressure: float = 0.0


def fastball_prior(ctx: GameContext, memory: PitcherMemory) -> Tuple[float, List[str]]:
    cues = []
    base = LEAGUE_FB_BY_COUNT.get((ctx.balls, ctx.strikes), 0.55)
    cues.append("카운트 %d-%d 리그 직구 비율 %.0f%%" % (ctx.balls, ctx.strikes, 100 * base))
    p = base
    if memory.fb_n >= 5:
        w = min(0.5, memory.fb_n / 30.0)
        p = (1 - w) * p + w * memory.fb_share
        cues.append("이 투수 직구 비율 %.0f%% (본 공 %d개, 가중 %.0f%%)" % (100 * memory.fb_share, memory.fb_n, 100 * w))
    if memory.last_family == "FB":
        p += SEQ_AFTER_FB
        cues.append("직전 직구 → 변화구 경계")
    elif memory.last_family == "BR":
        p += SEQ_AFTER_BR
        cues.append("직전 변화구 → 직구 다소 예상")
    return float(np.clip(p, 0.05, 0.95)), cues


def _straight_fit(t: np.ndarray, pos: np.ndarray, n_first: int):
    """Straight + gravity model fitted on the first samples (absolute time); predictor(t)->(x,y,z)."""
    tt, pp = t[:n_first], pos[:n_first]
    ax_, bx_ = np.polyfit(tt, pp[:, 0], 1)[::-1]
    ay_, by_ = np.polyfit(tt, pp[:, 1], 1)[::-1]
    zc = pp[:, 2] + 0.5 * G * tt ** 2                    # remove gravity, fit the rest as a line
    az_, bz_ = np.polyfit(tt, zc, 1)[::-1]
    def pred(tq):
        return np.array([ax_ + bx_ * tq, ay_ + by_ * tq, az_ + bz_ * tq - 0.5 * G * tq ** 2])
    vel = np.array([bx_, by_, bz_ - G * float(tt.mean())])
    return pred, vel


def _quadratic_extrapolation(t: np.ndarray, pos: np.ndarray, y_c: float):
    """Constant-acceleration fit of all samples -> (t, x, z) at the contact plane; needs ~9 samples."""
    if len(t) < 9:
        return None
    cy, cx, cz = np.polyfit(t, pos[:, 1], 2), np.polyfit(t, pos[:, 0], 2), np.polyfit(t, pos[:, 2], 2)
    roots = np.roots([cy[0], cy[1], cy[2] - y_c])
    roots = [float(r.real) for r in roots if abs(r.imag) < 1e-9 and r.real > t[-1]]
    if not roots:
        return None
    tc = min(roots)
    return tc, float(np.polyval(cx, tc)), float(np.polyval(cz, tc))


def _read_at(t, pos, k, contact_y, memory, prior_fb, recognition) -> Optional[BinRead]:
    """One bin's read using samples 0..k (inclusive)."""
    tt, pp = t[:k + 1], pos[:k + 1]
    n_first = max(3, min(6, len(tt)))
    pred_straight, vel = _straight_fit(tt, pp, n_first)
    speed = float(np.linalg.norm(vel))
    if vel[1] >= 0:
        return None
    t_arr = tt[0] + (contact_y - pp[0, 1]) / vel[1]
    if t_arr <= tt[-1]:
        return None
    frac = float(np.clip((tt[-1] - tt[0]) / max(t_arr - tt[0], 1e-3), 0, 1))
    # bend seen so far: last observed vs straight prediction
    s_now = pred_straight(tt[-1])
    bend_x, bend_z = float(pp[-1, 0] - s_now[0]), float(pp[-1, 2] - s_now[2])
    # per-cluster likelihood: speed, and the bend accumulated so far vs what that cluster would show
    cl = memory.clusters
    fam_prior = {"FB": prior_fb, "BR": 1.0 - prior_fb}
    n_fam = {f: sum(c.n for c in cl if c.family == f) for f in ("FB", "BR")}
    sig_b = memory.bend_sigma * (0.5 + frac)                       # bend is easier to see later
    post = []
    s_end0 = pred_straight(t_arr)
    for c in cl:
        pri = fam_prior[c.family] * (c.n / n_fam[c.family] if n_fam[c.family] > 0 else 1.0)
        if c.z_n >= 3:      # v0.7: location cue - "starting low -> sinker/changeup" (learned arrival heights)
            pri *= float(np.exp(-0.5 * ((s_end0[2] + c.break_z - c.z_mean) / 0.30) ** 2)) + 0.05
        ls = np.exp(-0.5 * ((speed - c.speed) / memory.speed_sigma) ** 2)
        ex_bx, ex_bz = c.break_x * frac ** 2, c.break_z * frac ** 2
        lb = np.exp(-0.5 * (((bend_x - ex_bx) / sig_b) ** 2 + ((bend_z - ex_bz) / sig_b) ** 2))
        post.append(pri * ls * lb + 1e-9)
    post = np.array(post); post /= post.sum()
    p_fb = float(sum(w for w, c in zip(post, cl) if c.family == "FB"))
    # predicted plate location: straight prediction + bend so far + expected remaining break (cluster posterior)
    s_end = pred_straight(t_arr)
    rem = 1.0 - frac ** 2
    ex_x = float(sum(w * c.break_x for w, c in zip(post, cl)))
    ex_z = float(sum(w * c.break_z for w, c in zip(post, cl)))
    t_arrival = float(t_arr + sum(w * c.delay for w, c in zip(post, cl)))
    px = float(s_end[0] + bend_x + ex_x * rem)
    pz = float(s_end[2] + bend_z + ex_z * rem)
    # eyes: once ~9 samples are in, the observed curvature (constant-acceleration fit) is unbiased -> blend it in
    quad = _quadratic_extrapolation(tt, pp, contact_y)
    if quad is not None:
        q_w = float(np.clip((frac - QUAD_W_START) / 0.45, 0.0, QUAD_W_MAX)) * (0.75 + 0.25 * float(np.clip(recognition, 0.0, 1.0)))
        px = (1 - q_w) * px + q_w * quad[1]
        pz = (1 - q_w) * pz + q_w * quad[2]
    # learned correction of this hitter's own systematic read error vs this pitcher (v0.7: per shape, posterior-weighted)
    bx_c = float(sum(w * c.bias_x for w, c in zip(post, cl)))
    bz_c = float(sum(w * c.bias_z for w, c in zip(post, cl)))
    px, pz = px + bx_c, pz + bz_c
    var_x = float(sum(w * ((c.break_x - ex_x) * rem) ** 2 for w, c in zip(post, cl))) + (0.03 + 0.08 * (1 - frac)) ** 2
    var_z = float(sum(w * ((c.break_z - ex_z) * rem) ** 2 for w, c in zip(post, cl))) + (0.03 + 0.10 * (1 - frac)) ** 2
    return BinRead(frac, float(tt[-1]), speed, (bend_x, bend_z), float(p_fb), (px, pz),
                   (float(np.sqrt(var_x)), float(np.sqrt(var_z))), 0.0, t_arrival)


def judge(sightings: List[BallSighting], ctx: GameContext, memory: PitcherMemory, contact_y: float,
          recognition: float, release_seen: Optional[Vec3] = None, release_read: float = 0.5,
          rng: Optional[np.random.Generator] = None, t_now: Optional[float] = None,
          tracking: float = 0.5, composure: float = 0.5, guess: float = 0.5) -> Optional[Judgment]:
    if t_now is not None:
        sightings = [s for s in sightings if s.t <= t_now]
    if len(sightings) < 4:
        return None
    t = np.array([s.t for s in sightings])
    pos = np.array([s.pos for s in sightings])
    prior_fb, cues = fastball_prior(ctx, memory)
    # guess hitting (노림수): a good guess hitter sharpens the count/sequence prior toward its lean
    if guess != 0.5:
        k = 1.0 + 1.5 * (guess - 0.5)
        prior_fb = float(prior_fb ** k / (prior_fb ** k + (1 - prior_fb) ** k))
        if guess > 0.6:
            cues.append("노림수: 사전 예상을 %.0f%%로 날카롭게" % (100 * prior_fb))
    # composure: under pressure a hitter who is not calm guesses fastball and reads sloppily
    press = pressure_index(ctx)
    panic = (1.0 - float(np.clip(composure, 0, 1))) * press
    if panic > 0.05:
        prior_fb = float(np.clip(prior_fb + 0.10 * panic * (0.75 - prior_fb) * 2, 0.05, 0.95))
        cues.append("부담 상황(%.0f%%) → 침착성 %.0f: 직구 쪽으로 쏠린 예상" % (100 * press, 100 * composure))

    tipped = False
    if release_seen is not None and memory.release_mean is not None and memory.release_n >= 3:
        dev = np.hypot(release_seen[0] - memory.release_mean[0], release_seen[2] - memory.release_mean[2])
        if dev > 0.06 and (rng is None or rng.random() < release_read):
            tipped = True
            cues.append("릴리스 포인트가 평소와 다름 → 구종 팁")

    # rough flight time to place the bins
    vel0 = np.polyfit(t[:min(6, len(t))], pos[:min(6, len(t)), 1], 1)[0]
    if vel0 >= 0:
        return None
    t_arr0 = t[0] + (contact_y - pos[0, 1]) / vel0
    reads: List[BinRead] = []
    for b in BINS:
        tb = t[0] + b * (t_arr0 - t[0])
        k = int(np.searchsorted(t, tb))
        if k >= len(t):
            break
        k = max(k, 3)
        r = _read_at(t, pos, k, contact_y, memory, prior_fb, recognition)
        if r is None:
            continue
        r.weight = visibility(b, tracking) * memory.trust[b] * (0.6 + 0.4 * recognition)
        if panic > 0.05 and rng is not None:               # sloppy weighting under pressure
            r.weight *= float(np.clip(1.0 + rng.normal(0, 0.2 * panic), 0.2, 2.0))
        reads.append(r)
    if not reads:
        return None
    if tipped:
        for r in reads:
            r.p_fastball = float(r.p_fastball ** 2 / (r.p_fastball ** 2 + (1 - r.p_fastball) ** 2))
    W = np.array([r.weight for r in reads]); W /= W.sum()
    p_fb = float(sum(w * r.p_fastball for w, r in zip(W, reads)))
    px = float(sum(w * r.pred_xz[0] for w, r in zip(W, reads)))
    pz = float(sum(w * r.pred_xz[1] for w, r in zip(W, reads)))
    sx = float(np.sqrt(sum(w * r.sigma_xz[0] ** 2 for w, r in zip(W, reads))))
    sz = float(np.sqrt(sum(w * r.sigma_xz[1] ** 2 for w, r in zip(W, reads))))
    dom = reads[int(np.argmax(W))].frac
    last = reads[-1]
    cues.append("구속 %.0f mph, 지금까지 휨 %+.0f/%+.0f cm → 직구 %.0f%%" %
                (last.speed_est / 0.44704, 100 * last.bend_seen[0], 100 * last.bend_seen[1], 100 * p_fb))
    cues.append("판단 비중: " + ", ".join("%.0f%%@%.0f%%" % (100 * w, 100 * r.frac) for w, r in zip(W, reads)))
    t_arr = float(sum(w * r.t_arrival for w, r in zip(W, reads)))
    return Judgment(float(t[-1]), prior_fb, p_fb, cues[:3], reads, (px, pz), (sx, sz), t_arr, tipped, cues, dom, press)


def late_read(sightings: List[BallSighting], contact_y: float, t_until: float, memory: PitcherMemory,
              committed: Judgment) -> Optional[Tuple[float, float, float]]:
    """After commit: a last look (samples up to t_until) -> (x, z, t_arrival) with the committed family belief."""
    late = [s for s in sightings if s.t <= t_until]
    if len(late) < 6:
        return None
    t = np.array([s.t for s in late]); pos = np.array([s.pos for s in late])
    r = _read_at(t, pos, len(t) - 1, contact_y, memory, committed.p_fastball, 1.0)
    if r is None:
        return None
    return r.pred_xz[0], r.pred_xz[1], r.t_arrival


def timeline(sightings: List[BallSighting], ctx: GameContext, memory: PitcherMemory, contact_y: float,
             recognition: float, checkpoints=(0.08, 0.12, 0.16, 0.20, 0.24, 0.28)) -> List[Judgment]:
    out = []
    for tc in checkpoints:
        j = judge(sightings, ctx, memory, contact_y, recognition, t_now=tc)
        if j is not None:
            out.append(j)
    return out


def learn_from_flight(memory: PitcherMemory, sightings_full: List[BallSighting], contact_y: float,
                      release_seen: Optional[Vec3], ctx: Optional[GameContext] = None,
                      recognition: float = 0.6, attention: float = 1.0) -> Optional[Dict[str, float]]:
    """After the pitch: store (speed, break, family) and grade each bin's read against the arrival."""
    if len(sightings_full) < 6:
        return None
    t = np.array([s.t for s in sightings_full])
    pos = np.array([s.pos for s in sightings_full])
    n_first = min(6, len(t))
    pred_straight, vel = _straight_fit(t, pos, n_first)
    speed = float(np.linalg.norm(vel))
    if vel[1] >= 0:
        return None
    # v0.7: interpolate the crossing of the contact plane (samples end at arrival, so the nearest
    # sample was always early by ~half a frame = 8 ms -> systematic early timing)
    k = int(np.argmin(np.abs(pos[:, 1] - contact_y)))
    j2 = k if k < len(t) - 1 else k - 1
    dy = pos[j2 + 1, 1] - pos[j2, 1]
    f = float((contact_y - pos[j2, 1]) / dy) if abs(dy) > 1e-9 else 0.0
    f = float(np.clip(f, -1.0, 2.0))
    t_cross = float(t[j2] + f * (t[j2 + 1] - t[j2]))
    ax = float(pos[j2, 0] + f * (pos[j2 + 1, 0] - pos[j2, 0]))
    az = float(pos[j2, 2] + f * (pos[j2 + 1, 2] - pos[j2, 2]))
    t_arr_est = t[0] + (contact_y - pos[0, 1]) / vel[1]       # same reference the reads use
    s_end = pred_straight(t_arr_est)
    bx, bz = ax - s_end[0], az - s_end[2]
    delay = float(t_cross - t_arr_est)
    # grade the bins with the memory as it was before learning this pitch
    read55 = None
    if ctx is not None:
        prior_fb, _ = fastball_prior(ctx, memory)
        errs = {}
        for b in BINS:
            kb = max(3, int(np.searchsorted(t, t[0] + b * (t_cross - t[0]))))
            if kb >= len(t):
                continue
            r = _read_at(t, pos, kb, contact_y, memory, prior_fb, recognition)
            if r is not None:
                errs[b] = float(np.hypot(r.pred_xz[0] - ax, r.pred_xz[1] - az))
                if abs(b - 0.55) < 1e-6:
                    read55 = r
        memory.learn_trust(errs, attention)
    fam = memory.learn(speed, bx, bz, release_seen, delay, attention)
    memory.last_cluster.note_location(az)
    if read55 is not None:
        memory.learn_bias(fam, ax - read55.pred_xz[0], az - read55.pred_xz[1], attention)
        c = memory.last_cluster
        r = min(0.5, 0.25 * attention)
        c.bias_x += r * ((ax - read55.pred_xz[0]) - c.bias_x)
        c.bias_z += r * ((az - read55.pred_xz[1]) - c.bias_z)
    memory.history.append({"speed": speed, "break_x": bx, "break_z": bz, "delay": delay, "family": 1.0 if fam == "FB" else 0.0})
    return {"speed": speed, "break_x": bx, "break_z": bz, "delay": delay, "family": fam}
