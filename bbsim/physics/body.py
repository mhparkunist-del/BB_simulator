"""Simplified pitcher kinematic chain at ball release (audit-corrected, v0.3).

Reads bbsim/data/pitching_params.json ("body" block). The HTML viewer
carries a JavaScript port of `release_pose`; keep the two in step.

Definitions
    abd    shoulder abduction (deg, angle of the upper arm from the trunk axis)
    tilt   lateral trunk tilt toward the glove side (deg, +)
    lean   forward trunk tilt (deg)
    stride stride length as a fraction of height
    fwd    forward angle of the arm at release (deg)

    arm angle (Statcast, 0 = sidearm, 90 = over the top)
           = (abd - 90) + tilt + elbow term (~5 deg)   ... reported from the
             shoulder->ball vector, which is what Statcast measures.
    release point = hand position of the chain.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Dict

import numpy as np

_PARAMS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "pitching_params.json")
with open(_PARAMS_PATH, encoding="utf-8") as _f:
    PARAMS = json.load(_f)
BODY = PARAMS["body"]


def _unit(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def ground_height(y: float, mound_y: float) -> float:
    """Height of the mound surface (m) at distance y from the plate."""
    m = BODY["mound"]
    beyond = max(0.0, (mound_y - m["flat_len"]) - y)
    return float(np.clip(m["rubber_height"] - beyond * m["slope"], 0.0, m["rubber_height"]))


def ik_knee(hip, foot, l1, l2, bend_dir):
    hip, foot = np.asarray(hip, float), np.asarray(foot, float)
    d = foot - hip
    L = np.linalg.norm(d)
    dh = d / max(L, 1e-9)
    L = min(L, l1 + l2 - 1e-4)
    a = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
    hh = np.sqrt(max(0.0, l1 * l1 - a * a))
    perp = np.asarray(bend_dir, float) - np.dot(bend_dir, dh) * dh
    perp = _unit(perp) if np.linalg.norm(perp) > 1e-6 else np.array([0.0, -1.0, 0.0])
    return hip + dh * a + perp * hh, L


@dataclass
class ReleasePose:
    release: np.ndarray            # hand / ball centre (m)
    shoulder: np.ndarray
    pelvis: np.ndarray
    com: np.ndarray
    front_foot: np.ndarray
    rear_foot: np.ndarray
    arm_angle_deg: float           # Statcast-style, from shoulder->ball
    extension: float               # rubber y - release y
    leg_stretch: float             # max(leg length used / anatomical length), 1.0 = exactly reachable
    velocity_mult: float
    command_mult: float
    com_out_x: float
    com_behind_front: float
    chain: Dict[str, float] = None


def release_pose(height: float, hand: str, abd: float, tilt: float, lean: float,
                 stride: float, fwd: float, mound_y: float = 18.44) -> ReleasePose:
    seg, rel = BODY["segments"], BODY["release"]
    h = height
    side = -1.0 if hand.upper().startswith("R") else 1.0
    stride_m = stride * h
    Lth, Lsh = seg["thigh"] * h, seg["shank"] * h

    # feet on the mound surface
    ff_y = mound_y - stride_m
    rf_y = mound_y - rel["rear_foot_drag"] * stride_m
    front_foot = np.array([-side * rel["front_foot_x"] * h, ff_y, ground_height(ff_y, mound_y)])
    rear_foot = np.array([side * rel["rear_foot_x"] * h, rf_y, ground_height(rf_y, mound_y) + rel["rear_toe_lift"] * h])

    # pelvis: forward on the stride, lowered if a leg cannot reach
    pel_y = mound_y - rel["pelvis_forward"] * stride_m
    pel_z = ground_height(pel_y, mound_y) + rel["pelvis_height"] * h
    pelvis = np.array([side * rel["pelvis_x"] * h, pel_y, pel_z])   # hips shifted toward throwing side
    hip_half = seg["hip_half"] * h
    leg = Lth + Lsh
    stretch = 1.0
    for _ in range(12):
        rear_hip = pelvis + np.array([side * hip_half, 0, 0])
        front_hip = pelvis + np.array([-side * hip_half, 0, 0])
        dr = np.linalg.norm(rear_foot - rear_hip) / leg
        df = np.linalg.norm(front_foot - front_hip) / leg
        stretch = max(dr, df)
        if stretch <= 1.0:
            break
        pelvis[2] -= (stretch - 1.0) * leg * 1.5 + 0.005   # drop the pelvis until reachable

    # trunk axis: up, rotated forward by lean, laterally toward glove side by tilt
    ln, tl = np.radians(lean), np.radians(tilt)
    up = _unit([-side * np.sin(tl) * np.cos(ln), -np.sin(ln), np.cos(ln) * np.cos(tl)])
    shC = pelvis + up * seg["trunk"] * h
    e_side = _unit(np.array([side, 0.0, 0.0]) - np.dot([side, 0, 0], up) * up)   # toward throwing side, ⊥ trunk
    e_fwd = _unit(np.array([0.0, -1.0, 0.0]) - np.dot([0, -1, 0], up) * up)
    shT = shC + e_side * seg["shoulder_half"] * h
    head = shC + up * seg["head"] * h

    # arm: frontal-plane angle theta = (abd - 90) + tilt (Escamilla 2018: abduction stays
    # ~90 deg, trunk tilt makes the slot), then rotated toward the plate by fwd;
    # the forearm carries an extra elbow flexion toward the plate
    theta = np.radians((abd - 90.0) + tilt)
    fw = np.radians(fwd)
    frontal = np.array([side * np.cos(theta), 0.0, np.sin(theta)])
    toward_plate = np.array([0.0, -1.0, 0.0])
    upper = _unit(np.cos(fw) * frontal + np.sin(fw) * toward_plate)
    elbow = shT + upper * seg["upper_arm"] * h
    # elbow flexion at release is applied as extra forward rotation of the forearm (toward the plate).
    # audit 02 #9 asked for 30 deg; with this geometry 30 deg lowers high-slot releases 4 cm below the
    # Statcast regression, so 20 deg is kept (partial accept, see audit/04 review).
    ef = fw + np.radians(rel["elbow_flex_deg"])
    fore = _unit(np.cos(ef) * frontal + np.sin(ef) * toward_plate)
    release = elbow + fore * seg["forearm_ball"] * h

    dx, dz = release[0] - shT[0], release[2] - shT[2]
    arm_angle = float(np.degrees(np.arctan2(dz, abs(dx))))

    com = 0.55 * pelvis + 0.35 * shC + 0.10 * head
    cmd = BODY["command"]
    com_out_x = abs(com[0] - front_foot[0])
    com_behind = com[1] - front_foot[1]
    command_mult = (1.0 + cmd["com_x_coef"] * max(0.0, com_out_x - cmd["com_x_free"]) / cmd["com_x_step"]
                    + cmd["com_y_coef"] * max(0.0, com_behind - cmd["com_y_free"]) / cmd["com_y_step"])
    ce = chain_efficiency(abd, tilt, lean, stride, arm_angle)
    return ReleasePose(release, shT, pelvis, com, front_foot, rear_foot, arm_angle,
                       float(mound_y - release[1]), float(stretch), float(ce["velocity_mult"]),
                       float(command_mult), float(com_out_x), float(com_behind), ce)


def chain_efficiency(abd: float, tilt: float, lean: float, stride: float, arm_angle: float,
                     core: float = 1.0) -> Dict[str, float]:
    """Posture -> how much of the kinetic chain reaches the ball (velocity multiplier).

    Components (each a loss 0..max, biomechanics-based):
        abd   : wrist velocity peaks with abduction 90-110 deg (Matsuo 2002); Gaussian loss away from 95
        tilt  : lateral trunk tilt beyond -20..45 deg costs trunk-rotation transfer (Matsuo 2006)
        slot  : arm angle below 0 deg (submarine) loses shoulder internal-rotation contribution
        lean  : forward tilt helps up to ~32 deg (Matsuo 2001); beyond 50 deg it costs
        stride: +-2 % per 0.10 h around 0.83 h
    core (0..1): the player's core/rotational strength realises the posture's potential:
        realised = 1 - (1 - potential) * (1 + core_weight*(1-core)) - core_weight*(1-core)*0.05
    """
    c = PARAMS["chain_efficiency"]
    vc = BODY["velocity_chain"]
    gain = 1.0
    gain += float(np.clip(vc["stride_coef"] * (stride - vc["stride_ref"]) / vc["stride_step"], -vc["clamp"], vc["clamp"]))
    gain += float(np.clip(vc["lean_coef"] * (min(lean, c["lean_opt"]) - vc["lean_ref"]) / vc["lean_step"], -vc["clamp"], vc["clamp"]))
    abd_loss = c["abd_max_loss"] * (1.0 - np.exp(-0.5 * ((abd - c["abd_opt"]) / c["abd_sigma"]) ** 2))
    tilt_excess = max(0.0, tilt - c["tilt_hi"]) + max(0.0, c["tilt_lo"] - tilt)
    tilt_loss = min(c["tilt_max_loss"], c["tilt_loss_per_deg"] * tilt_excess)
    slot_loss = min(c["slot_max_loss"], c["slot_loss_per_deg"] * max(0.0, c["slot_lo"] - arm_angle))
    lean_loss = min(c["lean_max_loss"], c["lean_loss_per_deg"] * max(0.0, lean - c["lean_hi"]))
    potential = gain * (1 - abd_loss) * (1 - tilt_loss) * (1 - slot_loss) * (1 - lean_loss)
    core = float(np.clip(core, 0.0, 1.0))
    realised = 1.0 - (1.0 - potential) * (1.0 + c["core_weight"] * (1.0 - core)) - c["core_weight"] * (1.0 - core) * 0.05
    el = c["elbow_load"]
    elbow = el["base"] + el["abd_coef"] * abs(abd - c["abd_opt"]) + el["tilt_coef"] * max(0.0, tilt - 30.0)
    return {"velocity_mult": float(realised), "potential": float(potential), "gain": float(gain),
            "abd_loss": float(abd_loss), "tilt_loss": float(tilt_loss), "slot_loss": float(slot_loss),
            "lean_loss": float(lean_loss), "elbow_load": float(elbow), "core": core}


def form_preset(name: str) -> Dict[str, float]:
    return dict(PARAMS["forms"][name])


def perceived_at_plate(release, plate_pos, plate_vel, extension: float, height: float = 1.85,
                       release_vel=None) -> Dict[str, float]:
    """How the pitch reads from the batter's side: approach angles and effective velocity."""
    vx, vy, vz = plate_vel
    vaa = float(np.degrees(np.arctan2(vz, -vy)))           # negative = coming down
    haa = float(np.degrees(np.arctan2(vx, -vy)))
    speed = float(np.linalg.norm(release_vel)) if release_vel is not None else float(np.linalg.norm(plate_vel))
    eff = speed / 0.44704 + (extension - 1.95) / 0.3048 * 1.4   # release speed, ~+1.4 mph per extra foot of extension
    return {"vaa_deg": vaa, "haa_deg": haa, "effective_mph": float(eff)}


def arm_angle_simple(abd: float, tilt: float) -> float:
    """Closed-form arm angle used by the axis rule: (abd-90) + tilt + elbow term."""
    return (abd - 90.0) + tilt + BODY["release"]["arm_angle_elbow_term"]


def statcast_release_height(arm_angle_deg: float) -> float:
    """Statcast 2024 regression (1_Reference/arm_angle_research.md)."""
    return 1.377 + 0.0099 * arm_angle_deg


def spin_from_card(mph: float, wrist_speed: float, finger_len: float, grip_force: float,
                   grip_skill: float, grip_code: str) -> Dict[str, float]:
    """Spin model: rpm = BU x mph x f_grip x f_force; BU from wrist speed & finger length."""
    sm, g = PARAMS["spin_model"], PARAMS["grips"][grip_code]
    bu = sm["bu_base"] + sm["bu_span"] * (sm["wrist_w"] * wrist_speed / 100.0 + sm["finger_w"] * finger_len)
    need = sm["force_need_base"] + sm["force_need_slope"] * (mph - 85.0)
    f_force = min(1.0, grip_force / max(need, 1.0))
    f_grip = sm["grip_skill_base"] + sm["grip_skill_span"] * grip_skill / 100.0
    rpm = bu * mph * f_grip * f_force * g["spin"]
    return {"bauer": bu, "f_force": f_force, "f_grip": f_grip, "rpm": rpm}
