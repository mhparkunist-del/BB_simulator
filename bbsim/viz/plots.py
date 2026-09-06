"""Matplotlib renderers for pitches, batted balls, collision sweeps, PAs.

Mark specs follow the dataviz skill: 2 px lines, >= 8 px markers, one
axis per panel, legend whenever >= 2 series, recessive grid, text in
text tokens (never series color).
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt                        # noqa: E402
from matplotlib.patches import Rectangle              # noqa: E402
import numpy as np                                     # noqa: E402

from ..physics.ball import AeroModel, BallState, integrate   # noqa: E402
from ..physics.constants import (M_TO_FT, MS_TO_MPH, PLATE_FRONT_Y, PLATE_HALF_WIDTH,
                                 STRIKE_ZONE_HALF_WIDTH)      # noqa: E402
from . import palette as P                                    # noqa: E402

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 11, "axes.titlesize": 12,
    "axes.labelsize": 11, "lines.linewidth": 2.0, "axes.edgecolor": P.GRID,
    "axes.labelcolor": P.TEXT_2, "xtick.color": P.TEXT_2, "ytick.color": P.TEXT_2,
    "text.color": P.TEXT, "figure.facecolor": P.SURFACE, "axes.facecolor": P.SURFACE,
    "savefig.facecolor": P.SURFACE, "legend.frameon": False,
})


def _style(ax):
    ax.grid(True, color=P.GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)


def _zone_patch(zone_top: float, zone_bottom: float):
    return Rectangle((-STRIKE_ZONE_HALF_WIDTH, zone_bottom), 2 * STRIKE_ZONE_HALF_WIDTH,
                     zone_top - zone_bottom, fill=False, edgecolor=P.TEXT_2, linewidth=1.2)


# ---------------------------------------------------------------- pitch
def plot_pitch(pitch, out_png: str, zone: Tuple[float, float] = (1.05, 0.50),
               sightings=None, predicted_xz: Optional[Tuple[float, float]] = None,
               title: str = None, aero: AeroModel = None):
    """Three views of one pitch plus a no-spin ghost to show the Magnus movement."""
    aero = aero or AeroModel()
    traj = pitch.trajectory
    p = traj.pos
    ghost0 = BallState(0.0, pitch.initial.pos.copy(), pitch.initial.vel.copy(), np.zeros(3))
    g = integrate(ghost0, aero, dt=1e-3, t_max=2.0,
                  stop=lambda s: s.pos[1] <= -0.3 or s.pos[2] <= 0).pos

    fig, axes = plt.subplots(1, 3, figsize=(15, 4.8))
    ax = axes[0]
    ax.plot(g[:, 1], g[:, 0], color=P.REFERENCE, linestyle="--", label="No spin (reference)")
    ax.plot(p[:, 1], p[:, 0], color=P.SERIES[0], label=pitch.pitch_type.name)
    ax.axvline(PLATE_FRONT_Y, color=P.TEXT_2, linewidth=1)
    ax.set_xlim(p[0, 1] + 0.5, -0.5)
    ax.set_xlabel("y  (m, release → plate)")
    ax.set_ylabel("x  (m, + = first-base side)")
    ax.set_title("Top view")
    _style(ax)
    ax.legend(loc="upper left")

    ax = axes[1]
    ax.plot(g[:, 1], g[:, 2], color=P.REFERENCE, linestyle="--", label="No spin (reference)")
    ax.plot(p[:, 1], p[:, 2], color=P.SERIES[0], label=pitch.pitch_type.name)
    ax.axvline(PLATE_FRONT_Y, color=P.TEXT_2, linewidth=1)
    ax.set_xlim(p[0, 1] + 0.5, -0.5)
    ax.set_ylim(0, 2.2)
    ax.set_xlabel("y  (m)")
    ax.set_ylabel("z  (m)")
    ax.set_title("Side view")
    _style(ax)
    ax.legend(loc="upper right")

    ax = axes[2]
    ax.add_patch(_zone_patch(*zone))
    ax.plot(g[:, 0], g[:, 2], color=P.REFERENCE, linestyle="--", label="No spin (reference)")
    ax.plot(p[:, 0], p[:, 2], color=P.SERIES[0], label="Ball path")
    if pitch.plate is not None:
        ax.plot(pitch.plate.pos[0], pitch.plate.pos[2], "o", color=P.SERIES[0], markersize=9,
                markeredgecolor=P.SURFACE, markeredgewidth=1.5, label="At plate")
    ax.plot(pitch.target_xz[0], pitch.target_xz[1], "o", markerfacecolor="none",
            markeredgecolor=P.SERIES[1], markersize=10, markeredgewidth=2, label="Target")
    if sightings:
        sp = np.array([s.pos for s in sightings])
        ax.plot(sp[:, 0], sp[:, 2], ".", color=P.SERIES[2], markersize=6, label="Batter sightings")
    if predicted_xz is not None:
        ax.plot(predicted_xz[0], predicted_xz[1], "x", color=P.SERIES[3], markersize=11,
                markeredgewidth=2.5, label="Batter prediction")
    ax.set_xlim(-1.0, 1.0)
    ax.set_ylim(0, 2.0)
    ax.set_aspect("equal")
    ax.set_xlabel("x  (m, catcher's view)")
    ax.set_ylabel("z  (m)")
    ax.set_title("Catcher's view")
    _style(ax)
    ax.legend(loc="upper right", fontsize=9)

    if pitch.plate is not None:
        pl = pitch.plate
        mv = pl.pos - g[np.argmin(np.abs(g[:, 1] - PLATE_FRONT_Y))]
        head = ("%s  %.1f mph release → %.1f mph at plate,  %.0f rpm,  movement vs no-spin: "
                "%+.1f in horizontal / %+.1f in vertical" %
                (pitch.pitch_type.name, pitch.initial.speed * MS_TO_MPH, pl.speed * MS_TO_MPH,
                 pitch.initial.spin_rpm, mv[0] * 39.37, mv[2] * 39.37))
    else:
        head = pitch.pitch_type.name
    fig.suptitle(title or head, fontsize=12, color=P.TEXT)
    fig.tight_layout()
    fig.savefig(out_png, dpi=150)
    plt.close(fig)
    return out_png


def animate_pitch(pitch, out_gif: str, batted=None, fps: int = 30, slow: float = 4.0):
    """Side + catcher's view animation (slow-motion factor `slow`)."""
    from matplotlib.animation import FuncAnimation, PillowWriter
    p = pitch.trajectory.pos
    t = pitch.trajectory.t
    frames_t = np.arange(0, t[-1], slow_step(fps, slow))
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.6))
    ax1.set_xlim(p[0, 1] + 0.5, -0.5)
    ax1.set_ylim(0, 2.2)
    ax1.set_xlabel("y (m)")
    ax1.set_ylabel("z (m)")
    ax1.set_title("Side view")
    ax1.axvline(PLATE_FRONT_Y, color=P.TEXT_2, linewidth=1)
    _style(ax1)
    ax2.add_patch(_zone_patch(1.05, 0.50))
    ax2.set_xlim(-1, 1)
    ax2.set_ylim(0, 2)
    ax2.set_aspect("equal")
    ax2.set_title("Catcher's view")
    _style(ax2)
    trail1, = ax1.plot([], [], color=P.SERIES[0], linewidth=1.5)
    dot1, = ax1.plot([], [], "o", color=P.SERIES[0], markersize=9)
    trail2, = ax2.plot([], [], color=P.SERIES[0], linewidth=1.5)
    dot2, = ax2.plot([], [], "o", color=P.SERIES[0], markersize=9)
    label = ax1.text(0.02, 0.92, "", transform=ax1.transAxes, color=P.TEXT)

    def update(i):
        tt = frames_t[i]
        k = np.searchsorted(t, tt)
        trail1.set_data(p[:k, 1], p[:k, 2])
        trail2.set_data(p[:k, 0], p[:k, 2])
        if k > 0:
            dot1.set_data([p[k - 1, 1]], [p[k - 1, 2]])
            dot2.set_data([p[k - 1, 0]], [p[k - 1, 2]])
        label.set_text("t = %.3f s" % tt)
        return trail1, dot1, trail2, dot2, label

    anim = FuncAnimation(fig, update, frames=len(frames_t), blit=True)
    anim.save(out_gif, writer=PillowWriter(fps=fps))
    plt.close(fig)
    return out_gif


def slow_step(fps: int, slow: float) -> float:
    return 1.0 / (fps * slow)


# ---------------------------------------------------------------- batted ball
def plot_batted_ball(bb, park, out_png: str, title: str = None):
    p = bb.trajectory.pos
    r = np.hypot(p[:, 0], p[:, 1])
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5.2))

    ax = ax1
    ang = np.radians(np.linspace(-park.foul_angle_deg, park.foul_angle_deg, 91))
    fd = np.array([park.fence_distance(np.degrees(a)) for a in ang])
    ax.plot(fd * np.sin(ang), fd * np.cos(ang), color=P.TEXT_2, linewidth=1.2, label="Fence")
    for s in (-1, 1):
        ax.plot([0, s * park.line_distance * np.sin(np.radians(45))],
                [0, park.line_distance * np.cos(np.radians(45))], color=P.GRID, linewidth=1)
    ax.plot(p[:, 0], p[:, 1], color=P.SERIES[0], label="Ball path")
    ax.plot(p[-1, 0], p[-1, 1], "o", color=P.SERIES[0], markersize=9, markeredgecolor=P.SURFACE,
            markeredgewidth=1.5, label="Landing")
    ax.set_aspect("equal")
    ax.set_xlim(-110, 110)
    ax.set_ylim(-5, 135)
    ax.set_xlabel("x (m, + = first-base side)")
    ax.set_ylabel("y (m)")
    ax.set_title("Top view")
    _style(ax)
    ax.legend(loc="upper left")

    ax = ax2
    ax.plot(r, p[:, 2], color=P.SERIES[0], label="Ball path")
    fence = park.fence_distance(bb.spray_angle)
    ax.plot([fence, fence], [0, park.fence_height], color=P.TEXT_2, linewidth=2.5, label="Fence")
    ax.set_xlim(0, max(135, r.max() + 5))
    ax.set_ylim(0, max(35, p[:, 2].max() + 3))
    ax.set_xlabel("distance from home (m)")
    ax.set_ylabel("z (m)")
    ax.set_title("Side view")
    _style(ax)
    ax.legend(loc="upper right")

    head = ("EV %.1f mph, LA %.1f°, spray %+.1f°, %.0f rpm  →  %.1f m, hang %.2f s" %
            (bb.exit_speed_mph, bb.launch_angle, bb.spray_angle, bb.spin_rpm,
             bb.landing_distance, bb.hang_time))
    fig.suptitle(title or head, fontsize=12)
    fig.tight_layout()
    fig.savefig(out_png, dpi=150)
    plt.close(fig)
    return out_png


# ---------------------------------------------------------------- collision sweep
def plot_collision_sweep(offsets_mm: Sequence[float], curves: Dict[str, Dict[str, Sequence[float]]],
                         out_png: str, title: str = "Bat–ball collision sweep"):
    """curves = {label: {"ev_mph": [...], "la_deg": [...], "spin_rpm": [...]}} (<= 4 series)."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.6))
    labels = list(curves.keys())[:4]
    for j, key, ylabel in ((0, "ev_mph", "exit velocity (mph)"), (1, "la_deg", "launch angle (deg)"),
                           (2, "spin_rpm", "batted-ball spin (rpm)")):
        ax = axes[j]
        for i, lab in enumerate(labels):
            y = np.array(curves[lab][key], dtype=float)
            ax.plot(offsets_mm, y, color=P.SERIES[i], label=lab)
            k = int(np.nanargmax(y))
            if j == 0 and np.isfinite(y[k]):        # direct labels only where curves separate
                ax.annotate(lab, (offsets_mm[k], y[k]), textcoords="offset points",
                            xytext=(4, 4), fontsize=9, color=P.TEXT_2)
        ax.axvline(0, color=P.GRID, linewidth=1)
        ax.set_xlabel("vertical offset E (mm, + = bat under ball)")
        ax.set_ylabel(ylabel)
        _style(ax)
        if len(labels) >= 2:
            ax.legend(loc="best", fontsize=9)
    fig.suptitle(title, fontsize=12)
    fig.tight_layout()
    fig.savefig(out_png, dpi=150)
    plt.close(fig)
    return out_png


# ---------------------------------------------------------------- plate appearance
def plot_plate_appearance(records, out_png: str, zone: Tuple[float, float], title: str = None):
    fig, ax = plt.subplots(figsize=(6.2, 6.2))
    ax.add_patch(_zone_patch(*zone))
    ax.plot([-PLATE_HALF_WIDTH, PLATE_HALF_WIDTH], [0.05, 0.05], color=P.TEXT_2, linewidth=3)
    seen = set()
    for r in records:
        if r.pitch.plate is None:
            continue
        x, z = r.pitch.plate.pos[0], r.pitch.plate.pos[2]
        c = P.RESULT_COLORS.get(r.result, P.MUTED)
        lab = P.RESULT_LABELS.get(r.result, r.result) if r.result not in seen else None
        seen.add(r.result)
        ax.plot(x, z, "o", color=c, markersize=13, markeredgecolor=P.SURFACE, markeredgewidth=1.5,
                label=lab)
        ax.text(x, z, str(r.index + 1), ha="center", va="center", fontsize=8, color=P.SURFACE)
        ax.annotate(r.call.code, (x, z), textcoords="offset points", xytext=(9, -3),
                    fontsize=8, color=P.TEXT_2)
    ax.set_xlim(-0.8, 0.8)
    ax.set_ylim(0, 1.6)
    ax.set_aspect("equal")
    ax.set_xlabel("x (m, catcher's view)")
    ax.set_ylabel("z (m)")
    _style(ax)
    ax.legend(loc="upper right", fontsize=9)
    ax.set_title(title or "Plate appearance — pitch locations at plate front")
    fig.tight_layout()
    fig.savefig(out_png, dpi=150)
    plt.close(fig)
    return out_png
