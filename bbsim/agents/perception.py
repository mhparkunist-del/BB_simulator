"""Batter's eye: turns a ground-truth trajectory into noisy sightings.

This is the ONLY place ground truth touches the batter side, and it only
emits (t, position + noise) up to the commit deadline, plus a noisy copy
of the release point. Noise is angular (sigma_deg) so that far-away
samples are less precise than close ones.
"""
from __future__ import annotations

from typing import List

import numpy as np

from ..physics.ball import Trajectory
from .base import BallSighting, Vec3


def observe(traj: Trajectory, eye_pos: Vec3, t_deadline: float,
            rng: np.random.Generator, fps: float = 60.0,
            sigma_deg: float = 0.05, t_first: float = 0.03,
            blur_fn=None, t_end: float = None) -> List[BallSighting]:
    """blur_fn(frac) multiplies the angular noise as the flight progresses (eyes lose the ball late)."""
    sightings: List[BallSighting] = []
    sig = np.radians(sigma_deg)
    t = t_first
    t_end = t_end or t_deadline
    while t <= t_deadline:
        s = traj.state_at(t)
        d = float(np.linalg.norm(s.pos - eye_pos))
        k = blur_fn(float(np.clip(t / max(t_end, 1e-6), 0, 1))) if blur_fn else 1.0
        noise = rng.normal(0.0, sig * d * k, size=3)
        noise[1] *= 2.0
        sightings.append(BallSighting(t, s.pos + noise))
        t += 1.0 / fps
    return sightings


def observe_release(traj: Trajectory, eye_pos: Vec3, rng: np.random.Generator,
                    sigma_deg: float = 0.05) -> Vec3:
    s = traj.states[0]
    d = float(np.linalg.norm(s.pos - eye_pos))
    noise = rng.normal(0.0, np.radians(sigma_deg) * d, size=3)
    noise[1] *= 2.0
    return s.pos + noise
