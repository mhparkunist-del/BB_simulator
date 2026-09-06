"""Audit probes: performance, determinism, robustness, packaging facts."""
import cProfile, pstats, io, json, os, sys, time, pickle, copy
import numpy as np
sys.path.insert(0, "/home/mhpark/취미/2_BB_simulator")
from bbsim.agents import (BatterProfile, GameContext, HeuristicBatter, HeuristicCatcher, HeuristicPitcher,
                          PerceptiveBatter, PitcherProfile, CatcherProfile)
from bbsim.engine import EngineConfig, PlateAppearance
from bbsim.physics import throw_spec, DEFAULT_REPERTOIRE, throw, AeroModel
from bbsim.physics.pitch import _aim_and_throw

out = {}

# ---- 1. per-pitch physics cost
p = HeuristicPitcher(PitcherProfile.from_params("B"))
sp = p.spec_for("FF")
t0 = time.perf_counter(); n = 20
for _ in range(n):
    throw_spec(sp, (0.0, 0.75))
out["throw_spec_ms"] = (time.perf_counter() - t0) / n * 1e3
t0 = time.perf_counter()
for _ in range(n):
    throw_spec(sp, (0.0, 0.75), aim_iterations=1)
out["throw_spec_1iter_ms"] = (time.perf_counter() - t0) / n * 1e3

# ---- 2. PlateAppearance construction cost (learn_pitcher) vs run
t0 = time.perf_counter()
for s in range(5):
    PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), PerceptiveBatter(), seed=s)
out["pa_ctor_newgame_ms"] = (time.perf_counter() - t0) / 5 * 1e3
t0 = time.perf_counter()
for s in range(5):
    PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), PerceptiveBatter(), seed=s, new_game=False)
out["pa_ctor_nogame_ms"] = (time.perf_counter() - t0) / 5 * 1e3

# ---- 3. 300 PA runtime (persistent agents, new_game only first)
pit, cat, bat = HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), PerceptiveBatter()
t0 = time.perf_counter(); pitches = 0
for s in range(300):
    r = PlateAppearance(pit, cat, bat, EngineConfig(), seed=s, new_game=(s == 0)).run()
    pitches += len(r.pitches)
out["pa300_s"] = time.perf_counter() - t0
out["pa300_pitches"] = pitches
out["ms_per_pitch_incl_agents"] = out["pa300_s"] / pitches * 1e3

# ---- 4. profile hot spots on 30 PA
pr = cProfile.Profile(); pr.enable()
for s in range(30):
    PlateAppearance(pit, cat, bat, EngineConfig(), seed=s, new_game=False).run()
pr.disable()
sio = io.StringIO(); pstats.Stats(pr, stream=sio).sort_stats("cumulative").print_stats(18)
out["profile_top"] = sio.getvalue()

# ---- 5. determinism: full record comparison (positions, results) across two runs; and with agent reuse
def sig(res):
    return [(rec.call.code, rec.result, round(float(rec.pitch.plate.pos[0]), 9) if rec.pitch.plate is not None else None,
             rec.decision.swing, round(rec.decision.t_contact, 9)) for rec in res.pitches]
a = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), PerceptiveBatter(), seed=7).run()
b = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), PerceptiveBatter(), seed=7).run()
out["deterministic_fresh_agents"] = sig(a) == sig(b)
# reused agents: same seed, second time -> differs because agents carry state
c = PlateAppearance(pit, cat, bat, seed=7, new_game=False).run()
d = PlateAppearance(pit, cat, bat, seed=7, new_game=False).run()
out["same_seed_reused_agents_identical"] = sig(c) == sig(d)
# feel silently zero when new_game=False with a fresh pitcher
fp = HeuristicPitcher(PitcherProfile.from_params("B"))
PlateAppearance(fp, HeuristicCatcher(), PerceptiveBatter(), seed=1, new_game=False)
out["fresh_pitcher_feel_when_new_game_False"] = dict(fp.feel)
# ctx mutation side effect
ctx = GameContext(balls=2)
PlateAppearance(pit, cat, bat, seed=3, new_game=False).run(ctx)
out["caller_ctx_mutated_fields"] = {"batter_hand": ctx.batter_hand, "zone_top": ctx.zone_top, "pitcher_id": ctx.pitcher_id, "balls": ctx.balls}

# ---- 6. HeuristicBatter uses sightings past its own commit deadline?
hb = HeuristicBatter()
pa = PlateAppearance(HeuristicPitcher(PitcherProfile.from_params("B")), HeuristicCatcher(), hb, seed=11)
rec = pa.pitch_once(GameContext(batter_hand="R", pitcher_hand="R", zone_top=1.045, zone_bottom=0.5))
last_t = max(s.t for s in rec.observation.sightings)
out["heuristic_batter_last_sighting_vs_deadline"] = {"last_sighting_t": last_t, "t_deadline": rec.observation.t_deadline,
                                                     "reaction_time": hb.reaction_time, "late_window": hb.late_window()}

# ---- 7. GameContext fields visible to batter (info boundary via context)
import dataclasses
out["batter_obs_context_fields"] = [f.name for f in dataclasses.fields(GameContext)]

# ---- 8. robustness probes
rob = {}
try:
    r = throw(DEFAULT_REPERTOIRE["FF"], "R", (0.0, -0.5))   # target below ground
    rob["target_below_ground_plate_none"] = r.plate is None
except Exception as e:
    rob["target_below_ground"] = repr(e)
try:
    r = throw(DEFAULT_REPERTOIRE["CU"], "R", (0.0, 3.0))
    rob["target_3m_high_miss"] = r.miss_xz
except Exception as e:
    rob["target_3m_high"] = repr(e)
try:
    sp2 = p.spec_for("FF"); sp2.speed_mps = 5.0        # lob
    r = throw_spec(sp2, (0.0, 0.75))
    rob["lob_5mps_plate"] = None if r.plate is None else float(r.plate.pos[2])
except Exception as e:
    rob["lob_5mps"] = repr(e)
# extreme pitch count -> negative velocity?
pp = HeuristicPitcher(PitcherProfile.from_params("B")); pp.pitch_count = 3000
rob["mph_at_3000_pitches"] = pp.traits("FF")["mph"]
# few sightings to batter
from bbsim.agents.base import BallSighting, BatterObservation
obs = BatterObservation(GameContext(), np.array([-0.75, 0.3, 1.66]), [BallSighting(0.03 + i / 60, np.array([0.0, 16 - 40 * i / 60, 1.7])) for i in range(4)], 0.2, 0.58, None)
try:
    rob["heuristic_4_sightings"] = HeuristicBatter().decide(obs, np.random.default_rng(0)).note
except Exception as e:
    rob["heuristic_4_sightings"] = repr(e)
try:
    rob["perceptive_4_sightings"] = PerceptiveBatter().decide(obs, np.random.default_rng(0)).note
except Exception as e:
    rob["perceptive_4_sightings"] = repr(e)
# identical timestamps (degenerate polyfit)
obs2 = BatterObservation(GameContext(), np.array([-0.75, 0.3, 1.66]), [BallSighting(0.05, np.array([0.0, 16.0, 1.7])) for i in range(6)], 0.2, 0.58, None)
import warnings
with warnings.catch_warnings():
    warnings.simplefilter("error")
    try:
        rob["perceptive_degenerate_t"] = PerceptiveBatter().decide(obs2, np.random.default_rng(0)).note
    except Exception as e:
        rob["perceptive_degenerate_t"] = repr(e)[:160]
out["robustness"] = rob

# ---- 9. serialization: can agent memory be pickled / json'd?
ser = {}
try:
    pickle.dumps(bat.memory); ser["pickle_batter_memory"] = True
except Exception as e:
    ser["pickle_batter_memory"] = repr(e)
try:
    json.dumps(dataclasses.asdict(list(bat.memory.values())[0])); ser["json_pitcher_memory"] = True
except Exception as e:
    ser["json_pitcher_memory"] = repr(e)[:120]
try:
    rec = a.pitches[0]
    ser["pickle_pitch_record_bytes"] = len(pickle.dumps(rec))
    ser["trajectory_states"] = len(rec.pitch.trajectory.states)
except Exception as e:
    ser["pickle_pitch_record"] = repr(e)
out["serialization"] = ser

# ---- 10. RK4 step sensitivity: dt 1ms vs 0.25ms plate position
sp = p.spec_for("SL")
r1 = throw_spec(sp, (0.0, 0.75), dt=1e-3).plate.pos
r2 = throw_spec(sp, (0.0, 0.75), dt=2.5e-4).plate.pos
r3 = throw_spec(sp, (0.0, 0.75), dt=4e-3).plate.pos
out["dt_sensitivity_mm"] = {"1ms_vs_0.25ms": float(np.linalg.norm(r1 - r2) * 1e3), "4ms_vs_0.25ms": float(np.linalg.norm(r3 - r2) * 1e3)}
# aim solver convergence per iteration
miss = []
for it in (1, 2, 3, 4, 6):
    r = throw_spec(p.spec_for("CU"), (0.3, 0.55), aim_iterations=it)
    miss.append((it, float(np.hypot(*r.miss_xz)) * 1e3))
out["aim_miss_mm_by_iter_CU"] = miss

print(json.dumps({k: v for k, v in out.items() if k != "profile_top"}, indent=1, ensure_ascii=False, default=str))
print(out["profile_top"])
