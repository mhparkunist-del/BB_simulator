"""Blind audit measurement: run N PA for one configuration and dump per-pitch rows + summary JSON."""
import json, os, sys, time
sys.path.insert(0, "/home/mhpark/취미/2_BB_simulator")
import numpy as np
from bbsim.agents import BatterProfile, CatcherProfile, GameContext, HeuristicBatter, PerceptiveBatter, HeuristicCatcher, HeuristicPitcher
from bbsim.agents.pitcher import PitcherProfile
from bbsim.engine import EngineConfig, PlateAppearance, Umpire
from bbsim.physics import constants as C

OUT = "/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/runs"
os.makedirs(OUT, exist_ok=True)

CONFIGS = {
    "base_B_perc":   dict(pitcher="B", batter="perc", bp={}),
    "base_B_heur":   dict(pitcher="B", batter="heur", bp={}),
    "pit_A_perc":    dict(pitcher="A", batter="perc", bp={}),
    "pit_C_perc":    dict(pitcher="C", batter="perc", bp={}),
    "pit_D_perc":    dict(pitcher="D", batter="perc", bp={}),
    "pit_E_perc":    dict(pitcher="E", batter="perc", bp={}),
    "react_01":      dict(pitcher="B", batter="perc", bp=dict(reaction=0.1)),
    "react_09":      dict(pitcher="B", batter="perc", bp=dict(reaction=0.9)),
    "disc_02":       dict(pitcher="B", batter="perc", bp=dict(discipline=0.2)),
    "disc_09":       dict(pitcher="B", batter="perc", bp=dict(discipline=0.9)),
    "recog_03":      dict(pitcher="B", batter="perc", bp=dict(recognition=0.3)),
    "recog_09":      dict(pitcher="B", batter="perc", bp=dict(recognition=0.9)),
    "track_01":      dict(pitcher="B", batter="perc", bp=dict(tracking=0.1)),
    "track_09":      dict(pitcher="B", batter="perc", bp=dict(tracking=0.9)),
    "bold_01":       dict(pitcher="B", batter="perc", bp=dict(boldness=0.1)),
    "bold_09":       dict(pitcher="B", batter="perc", bp=dict(boldness=0.9)),
    "batspd_28":     dict(pitcher="B", batter="perc", bp=dict(bat_speed=28.0)),
    "batspd_35":     dict(pitcher="B", batter="perc", bp=dict(bat_speed=35.0)),
    "power_09":      dict(pitcher="B", batter="perc", bp=dict(power=0.9, bat_speed=34.0)),
    "timing_09":     dict(pitcher="B", batter="perc", bp=dict(timing=0.9, barrel_placement=0.9, barrel_accuracy=0.9)),
    "timing_01":     dict(pitcher="B", batter="perc", bp=dict(timing=0.1, barrel_placement=0.1, barrel_accuracy=0.1)),
    "elite_bat":     dict(pitcher="B", batter="perc", bp=dict(recognition=0.9, discipline=0.9, tracking=0.9, reaction=0.9, timing=0.9, barrel_placement=0.9, barrel_accuracy=0.9, power=0.9, composure=0.9)),
    "weak_bat":      dict(pitcher="B", batter="perc", bp=dict(recognition=0.2, discipline=0.2, tracking=0.2, reaction=0.2, timing=0.2, barrel_placement=0.2, barrel_accuracy=0.2, power=0.2)),
    "no_ump_shift":  dict(pitcher="B", batter="perc", bp={}, low_shift=0.0),
    "same_batter":   dict(pitcher="B", batter="perc", bp={}, persistent=True),
}


def run(name, n):
    cfgd = CONFIGS[name]
    cfg = EngineConfig(umpire=Umpire(low_shift=cfgd.get("low_shift", 0.02)))
    pitcher = HeuristicPitcher(PitcherProfile.from_params(cfgd["pitcher"]))
    catcher = HeuristicCatcher(CatcherProfile())
    Bat = PerceptiveBatter if cfgd["batter"] == "perc" else HeuristicBatter
    rows, pas = [], []
    persistent = cfgd.get("persistent", False)
    pbat = {}
    t0 = time.time()
    for seed in range(n):
        hand = "L" if seed % 3 == 0 else "R"
        bp = dict(cfgd["bp"]); bp.update(hand=hand, power_zone=["middle", "in", "low", "away"][seed % 4])
        if persistent:
            if hand not in pbat:
                pbat[hand] = Bat(BatterProfile(**bp))
            batter = pbat[hand]
        else:
            batter = Bat(BatterProfile(**bp))
        runners = (seed % 4 == 1, False, seed % 7 == 2)
        ctx = GameContext(outs=seed % 3, inning=1 + seed % 9, runners=runners, score_diff=(seed % 5) - 2, runner_speed=0.7)
        pa = PlateAppearance(pitcher, catcher, batter, cfg, seed=seed, new_game=(seed % 25 == 0))
        res = pa.run(ctx)
        zone = pa.zone
        pas.append(dict(seed=seed, outcome=res.outcome, n_pitches=len(res.pitches), hand=hand, pitcher_hand=pitcher.hand,
                        pitch_count_end=pitcher.pitch_count))
        for r in res.pitches:
            plate = r.pitch.plate
            in_zone = bool(zone.contains(plate.pos)) if plate is not None else False
            # strict zone (ball centre inside plate width, no ball radius margin) for a second definition
            strict = bool(plate is not None and abs(plate.pos[0]) <= C.PLATE_HALF_WIDTH and zone.bottom <= plate.pos[2] <= zone.top)
            row = dict(seed=seed, pitch_no=r.index + 1, balls=r.context_before.balls, strikes=r.context_before.strikes,
                       code=r.call.code, intent=r.intent.code, sign=r.sign.code, agreed=int(r.call.agreed),
                       shake_offs=r.call.shake_offs, zone_name=r.call.zone,
                       mph=float(r.pitch.initial.speed * C.MS_TO_MPH), rpm=float(r.pitch.initial.spin_rpm),
                       sigma=float(r.sigma_used),
                       plate_x=float(plate.pos[0]) if plate is not None else None,
                       plate_z=float(plate.pos[2]) if plate is not None else None,
                       in_zone=in_zone, strict_zone=strict, swing=int(r.decision.swing), note=r.decision.note,
                       result=r.result, umpire=r.umpire_call, pitch_count=r.context_before.pitch_count,
                       hand=hand, pitcher_hand=pitcher.hand, tipped=int(r.decision.tipped),
                       adjusted=int(getattr(r.decision, "adjusted", False)), checked=int(getattr(r.decision, "checked", False)),
                       miss_reason=(r.collision.reason if r.collision is not None else ""))
            if r.contact_offsets:
                row.update(dt_err=r.contact_offsets["timing_error_s"], off_v=r.contact_offsets["vertical_m"], off_a=r.contact_offsets["axial_m"])
            if r.collision is not None and r.collision.hit:
                row.update(ev=float(r.collision.exit_speed * C.MS_TO_MPH), la=float(r.collision.launch_angle),
                           spray=float(r.collision.spray_angle), bb_rpm=float(r.collision.spin_rpm))
            if r.batted is not None:
                row.update(dist=float(r.batted.landing_distance), hang=float(r.batted.hang_time))
            if r.play is not None:
                row.update(play=r.play.kind, p_hit=float(r.play.p_hit))
            rows.append(row)
    dt = time.time() - t0
    json.dump(dict(name=name, n=n, seconds=dt, pas=pas, pitches=rows), open(os.path.join(OUT, name + ".json"), "w"))
    print(name, "done", n, "PA", len(rows), "pitches", "%.0fs" % dt)


if __name__ == "__main__":
    run(sys.argv[1], int(sys.argv[2]))
