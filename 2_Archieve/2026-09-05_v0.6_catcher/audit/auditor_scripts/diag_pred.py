"""Prediction bias diagnostic: for each pitch code of pitcher B, throw at a zone target with command noise,
let a PerceptiveBatter judge, and compare its committed prediction (x,z) with the true crossing at contact_y.
Fresh memory (first pitch seen) vs learned memory (after 30 pitches of this pitcher)."""
import sys, json
sys.path.insert(0, "/home/mhpark/취미/2_BB_simulator")
import numpy as np
from bbsim.agents import BatterProfile, PerceptiveBatter, GameContext, HeuristicPitcher, PitcherProfile
from bbsim.agents.perception import observe, observe_release
from bbsim.agents.base import BatterObservation
from bbsim.engine import EngineConfig
from bbsim.engine.rules import StrikeZone
from bbsim.physics.constants import PLATE_FRONT_Y, MS_TO_MPH
from bbsim.physics.pitch import throw_spec

rng = np.random.default_rng(1)
cfg = EngineConfig()
pitcher = HeuristicPitcher(PitcherProfile.from_params(sys.argv[1] if len(sys.argv) > 1 else "B"))
pitcher.begin_game(rng)
out = {}
for learned in (False, True):
    for code in pitcher.repertoire_codes:
        bat = PerceptiveBatter(BatterProfile())
        zone = StrikeZone.for_height(bat.height)
        ctx = GameContext(pitcher_id="P", zone_top=zone.top, zone_bottom=zone.bottom, pitcher_hand=pitcher.hand)
        errs = []
        n_pre = 30 if learned else 0
        for i in range(n_pre + 40):
            c = code if i >= n_pre else str(rng.choice(pitcher.repertoire_codes))
            tgt = (rng.normal(0, 0.15), rng.normal(0.5 * (zone.top + zone.bottom), 0.15))
            spec = pitcher.spec_for(c, 1.0, rng)
            pitch = throw_spec(spec, tgt, cfg.aero, dt=cfg.dt)
            contact_y = PLATE_FRONT_Y + 0.15
            arrival = pitch.trajectory.crossing(1, contact_y)
            if arrival is None:
                continue
            eye = bat.eye_position(contact_y)
            sig = cfg.eye_sigma_deg * bat.eye_sigma_factor()
            t_seen = arrival.t - min(bat.reaction_time, bat.late_window())
            sightings = observe(pitch.trajectory, eye, t_seen, rng, cfg.eye_fps, sig, blur_fn=bat.late_blur, t_end=arrival.t)
            rel = observe_release(pitch.trajectory, eye, rng, sig)
            obs = BatterObservation(ctx, eye, sightings, arrival.t - bat.reaction_time, contact_y, rel)
            dec = bat.decide(obs, rng)
            j = bat.last_judgment
            # full-flight learn as engine does
            full = observe(pitch.trajectory, eye, pitch.plate.t, rng, cfg.eye_fps, sig, blur_fn=bat.late_blur, t_end=pitch.plate.t)
            bat.learn(BatterObservation(ctx, eye, full, pitch.plate.t, contact_y, rel))
            if i >= n_pre and j is not None:
                # committed read (before late correction) and final plan
                errs.append(dict(dx_commit=j.pred_xz[0] - arrival.pos[0], dz_commit=j.pred_xz[1] - arrival.pos[2],
                                 dx_final=dec.predicted_xz[0] - arrival.pos[0], dz_final=dec.predicted_xz[1] - arrival.pos[2],
                                 dt=(dec.t_contact - arrival.t) if dec.swing else np.nan, sx=j.sigma_xz[0], sz=j.sigma_xz[1],
                                 p_fb=j.p_fastball, swing=dec.swing, mph=pitch.initial.speed * MS_TO_MPH))
        a = {k: float(np.nanmean([e[k] for e in errs])) for k in errs[0] if k != "swing"}
        a.update({k + "_sd": float(np.nanstd([e[k] for e in errs])) for k in ("dx_final", "dz_final", "dt")})
        a["n"] = len(errs)
        out["%s_%s" % (code, "learned" if learned else "fresh")] = a
for k, v in out.items():
    print(k, " ".join("%s=%+.3f" % (kk, vv) for kk, vv in v.items()))
