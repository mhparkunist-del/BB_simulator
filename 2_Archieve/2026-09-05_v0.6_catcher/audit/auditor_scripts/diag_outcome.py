"""Outcome table diagnostic: feed an MLB-like EV/LA/spray distribution to fly()+resolve() and read BABIP/HR."""
import sys
sys.path.insert(0, "/home/mhpark/취미/2_BB_simulator")
import numpy as np
from bbsim.engine.outcome import fly, resolve, Park
from bbsim.physics.ball import AeroModel, BallState
from bbsim.physics.constants import MPH_TO_MS, RPM_TO_RADS

rng = np.random.default_rng(3)
aero, park = AeroModel(), Park()
N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
kinds, evs, las = [], [], []
for i in range(N):
    # MLB-like: EV mixture (mean 88.5, sd 13, skewed), LA N(12, 26), spray N(0, 22) truncated to fair
    ev = float(np.clip(rng.normal(89.0, 12.5), 40, 118))
    la = float(np.clip(rng.normal(12.0, 26.0), -60, 80))
    spray = float(np.clip(rng.normal(0, 20.0), -44, 44))
    v = ev * MPH_TO_MS
    vel = v * np.array([np.sin(np.radians(spray)) * np.cos(np.radians(la)), np.cos(np.radians(spray)) * np.cos(np.radians(la)), np.sin(np.radians(la))])
    # backspin roughly proportional to launch angle (Statcast-like ~ 1500-2500 rpm on fly balls)
    rpm = float(np.clip(1200 + 40 * la, -2000, 3500))
    spin = rpm * RPM_TO_RADS * np.array([1.0, 0.0, 0.0])
    bb = fly(BallState(0.0, np.array([0.0, 0.0, 0.9]), vel, spin), aero)
    r = resolve(bb, park, rng)
    kinds.append(r.kind); evs.append(ev); las.append(la)
kinds = np.array(kinds); las = np.array(las); evs = np.array(evs)
n = len(kinds)
hr = (kinds == "HR").sum(); hits = np.isin(kinds, ["single", "double", "triple"]).sum(); outs = (kinds == "out").sum()
print("N=%d HR %.1f%% BABIP %.3f (hits %d outs %d) XBH share of non-HR hits %.0f%%" % (n, 100 * hr / n, hits / (hits + outs), hits, outs,
      100 * np.isin(kinds, ["double", "triple"]).sum() / max(hits, 1)))
for name, m in (("GB", las < 10), ("LD", (las >= 10) & (las < 25)), ("FB", (las >= 25) & (las < 50)), ("PU", las >= 50)):
    k = kinds[m]; h = np.isin(k, ["single", "double", "triple"]).sum(); o = (k == "out").sum(); hh = (k == "HR").sum()
    print("%s n=%d babip %.3f HR %.1f%%" % (name, len(k), h / max(h + o, 1), 100 * hh / max(len(k), 1)))
# HR threshold: min EV among HR by LA bucket
m = kinds == "HR"
if m.any():
    print("HR: mean EV %.1f, min EV %.1f, LA range %.0f..%.0f" % (evs[m].mean(), evs[m].min(), las[m].min(), las[m].max()))
# distance check: 100 mph @ 28 deg
v = 100 * MPH_TO_MS; la = np.radians(28)
bb = fly(BallState(0.0, np.array([0.0, 0.0, 0.9]), v * np.array([0, np.cos(la), np.sin(la)]), 2000 * RPM_TO_RADS * np.array([1.0, 0, 0])), aero)
print("100 mph / 28 deg / 2000 rpm backspin -> %.1f m (%.0f ft), hang %.2f s" % (bb.landing_distance, bb.landing_distance / 0.3048, bb.hang_time))
v = 105 * MPH_TO_MS
bb = fly(BallState(0.0, np.array([0.0, 0.0, 0.9]), v * np.array([0, np.cos(la), np.sin(la)]), 2000 * RPM_TO_RADS * np.array([1.0, 0, 0])), aero)
print("105 mph / 28 deg -> %.1f m (%.0f ft)" % (bb.landing_distance, bb.landing_distance / 0.3048))
