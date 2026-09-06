import json, os, sys, glob
import numpy as np
OUT = "/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/runs"

def pct(a, b):
    return 100.0 * a / b if b else float("nan")

def summarize(d):
    P, A = d["pitches"], d["pas"]
    n_pa, n_p = len(A), len(P)
    oc = {}
    for a in A:
        oc[a["outcome"]] = oc.get(a["outcome"], 0) + 1
    K = oc.get("strikeout", 0); BB = oc.get("walk", 0); HR = oc.get("HR", 0)
    hits = sum(oc.get(k, 0) for k in ("single", "double", "triple"))
    inplay_pa = sum(oc.get(k, 0) for k in ("single", "double", "triple", "out"))
    babip = hits / inplay_pa if inplay_pa else float("nan")
    AB = n_pa - BB
    avg = (hits + HR) / AB if AB else float("nan")
    obp = (hits + HR + BB) / n_pa
    tb = oc.get("single", 0) + 2 * oc.get("double", 0) + 3 * oc.get("triple", 0) + 4 * HR
    slg = tb / AB if AB else float("nan")
    res = {}
    for p in P:
        res[p["result"]] = res.get(p["result"], 0) + 1
    swings = [p for p in P if p["swing"]]
    takes = [p for p in P if not p["swing"]]
    whiff = [p for p in swings if p["result"] == "swinging_strike"]
    oz = [p for p in P if not p["in_zone"]]
    iz = [p for p in P if p["in_zone"]]
    chase = [p for p in oz if p["swing"]]
    zswing = [p for p in iz if p["swing"]]
    zcontact = [p for p in zswing if p["result"] != "swinging_strike"]
    ocontact = [p for p in chase if p["result"] != "swinging_strike"]
    cs_takes = [p for p in takes if p["result"] == "called_strike"]
    first = [p for p in P if p["balls"] == 0 and p["strikes"] == 0]
    fps = [p for p in first if p["result"] != "ball"]
    fp_swing = [p for p in first if p["swing"]]
    bip = [p for p in P if p["result"] == "in_play"]
    ev = np.array([p["ev"] for p in bip]) if bip else np.array([])
    la = np.array([p["la"] for p in bip]) if bip else np.array([])
    gb = (la < 10).sum(); ld = ((la >= 10) & (la < 25)).sum(); fb = ((la >= 25) & (la < 50)).sum(); pu = (la >= 50).sum()
    nb = max(len(la), 1)
    hard = (ev >= 95).mean() * 100 if len(ev) else float("nan")
    barrel = ((ev >= 98) & (la >= 26) & (la <= 30)).mean() * 100 if len(ev) else float("nan")
    fouls = [p for p in P if p["result"] == "foul"]
    contact = [p for p in swings if p["result"] != "swinging_strike"]
    ev_foul = np.array([p.get("ev", np.nan) for p in fouls]) if fouls else np.array([])
    mix = {}
    for p in P:
        mix[p["code"]] = mix.get(p["code"], 0) + 1
    shake = sum(p["shake_offs"] for p in P)
    agreed = sum(p["agreed"] for p in P)
    miss = {}
    for p in whiff:
        miss[p["miss_reason"]] = miss.get(p["miss_reason"], 0) + 1
    # pitch mix by count group
    def mixgrp(sel):
        m = {}
        for p in sel:
            m[p["code"]] = m.get(p["code"], 0) + 1
        t = sum(m.values()) or 1
        return {k: round(100 * v / t) for k, v in sorted(m.items())}
    fb_codes = ("FF", "SI", "CT")
    fb_first = pct(sum(p["code"] in fb_codes for p in first), len(first))
    two_k = [p for p in P if p["strikes"] == 2]
    fb_2k = pct(sum(p["code"] in fb_codes for p in two_k), len(two_k))
    three_0 = [p for p in P if p["balls"] == 3 and p["strikes"] < 2]
    fb_30 = pct(sum(p["code"] in fb_codes for p in three_0), len(three_0))
    # fatigue: by pitch count bucket
    fat = {}
    for lo, hi in ((0, 30), (30, 60), (60, 90), (90, 200)):
        sel = [p for p in P if lo <= p["pitch_count"] < hi]
        if sel:
            fat["%d-%d" % (lo, hi)] = dict(n=len(sel), mph=round(np.mean([p["mph"] for p in sel]), 1),
                                            sigma=round(np.mean([p["sigma"] for p in sel]), 3),
                                            zone=round(pct(sum(p["in_zone"] for p in sel), len(sel)), 1),
                                            ball=round(pct(sum(p["result"] == "ball" for p in sel), len(sel)), 1))
    # platoon
    plat = {}
    for h in ("L", "R"):
        sa = [a for a in A if a["hand"] == h]
        sp = [p for p in P if p["hand"] == h]
        sw = [p for p in sp if p["swing"]]
        if sa:
            plat[h] = dict(PA=len(sa), K=round(pct(sum(a["outcome"] == "strikeout" for a in sa), len(sa)), 1),
                           BB=round(pct(sum(a["outcome"] == "walk" for a in sa), len(sa)), 1),
                           whiff=round(pct(sum(p["result"] == "swinging_strike" for p in sw), len(sw)), 1),
                           HRpa=round(pct(sum(a["outcome"] == "HR" for a in sa), len(sa)), 1))
    notes = {}
    for p in P:
        notes[p["note"]] = notes.get(p["note"], 0) + 1
    # in-zone whiff by pitch code
    whiff_code = {}
    for c in mix:
        sw = [p for p in swings if p["code"] == c]
        whiff_code[c] = round(pct(sum(p["result"] == "swinging_strike" for p in sw), len(sw)), 1)
    # umpire: called strike rate in strict zone / margin band / outside
    strict_takes = [p for p in takes if p["strict_zone"]]
    edge_takes = [p for p in takes if p["in_zone"] and not p["strict_zone"]]
    out_takes = [p for p in takes if not p["in_zone"]]
    ump = dict(strict=round(pct(sum(p["result"] == "called_strike" for p in strict_takes), len(strict_takes)), 1),
               edge=round(pct(sum(p["result"] == "called_strike" for p in edge_takes), len(edge_takes)), 1),
               out=round(pct(sum(p["result"] == "called_strike" for p in out_takes), len(out_takes)), 1))
    # contact quality: timing error, offsets
    dt = np.array([abs(p["dt_err"]) for p in swings if "dt_err" in p]) if swings else np.array([])
    offv = np.array([p["off_v"] for p in swings if "off_v" in p]) if swings else np.array([])
    dist = np.array([p["dist"] for p in bip]) if bip else np.array([])
    # play outcome table: hit prob by BB type
    def hitrate(sel):
        return round(pct(sum(p.get("play") in ("single", "double", "triple", "HR") for p in sel), len(sel)), 1)
    bbt = {"GB": hitrate([p for p in bip if p["la"] < 10]), "LD": hitrate([p for p in bip if 10 <= p["la"] < 25]),
           "FB": hitrate([p for p in bip if 25 <= p["la"] < 50]), "PU": hitrate([p for p in bip if p["la"] >= 50])}
    xbh = sum(oc.get(k, 0) for k in ("double", "triple"))
    return dict(
        name=d["name"], PA=n_pa, pitches=n_p, pitches_per_pa=round(n_p / n_pa, 2), outcomes=oc,
        K=round(pct(K, n_pa), 1), BB=round(pct(BB, n_pa), 1), HRpa=round(pct(HR, n_pa), 1), BABIP=round(babip, 3),
        AVG=round(avg, 3), OBP=round(obp, 3), SLG=round(slg, 3), XBH_per_hit=round(pct(xbh, hits + HR), 1) if hits + HR else None,
        results={k: round(pct(v, n_p), 1) for k, v in sorted(res.items())},
        swing=round(pct(len(swings), n_p), 1), whiff=round(pct(len(whiff), len(swings)), 1),
        zone=round(pct(len(iz), n_p), 1), chase=round(pct(len(chase), len(oz)), 1), zswing=round(pct(len(zswing), len(iz)), 1),
        zcontact=round(pct(len(zcontact), len(zswing)), 1), ocontact=round(pct(len(ocontact), len(chase)), 1),
        cs_of_takes=round(pct(len(cs_takes), len(takes)), 1), first_strike=round(pct(len(fps), len(first)), 1),
        first_swing=round(pct(len(fp_swing), len(first)), 1),
        foul_per_swing=round(pct(len(fouls), len(swings)), 1), inplay_per_swing=round(pct(len(bip), len(swings)), 1),
        foul_of_contact=round(pct(len(fouls), len(contact)), 1),
        EV=round(float(ev.mean()), 1) if len(ev) else None, EV_sd=round(float(ev.std()), 1) if len(ev) else None,
        EV_p90=round(float(np.percentile(ev, 90)), 1) if len(ev) else None, EV_max=round(float(ev.max()), 1) if len(ev) else None,
        LA=round(float(la.mean()), 1) if len(la) else None, LA_sd=round(float(la.std()), 1) if len(la) else None,
        GB=round(pct(gb, nb), 1), LD=round(pct(ld, nb), 1), FB=round(pct(fb, nb), 1), PU=round(pct(pu, nb), 1),
        hard_hit=round(hard, 1), barrel=round(barrel, 1), dist_mean=round(float(dist.mean()), 1) if len(dist) else None,
        hit_by_type=bbt,
        mix={k: round(pct(v, n_p), 1) for k, v in sorted(mix.items())}, fb_first=round(fb_first, 1), fb_2k=round(fb_2k, 1), fb_30=round(fb_30, 1),
        mix_00=mixgrp(first), mix_2k=mixgrp(two_k), mix_30=mixgrp(three_0),
        shake_per_pitch=round(pct(shake, n_p), 1), agreed=round(pct(agreed, n_p), 1), miss_reasons=miss,
        mph_FF=round(np.mean([p["mph"] for p in P if p["code"] == "FF"]), 1) if any(p["code"] == "FF" for p in P) else None,
        sigma_mean=round(np.mean([p["sigma"] for p in P]), 3), fatigue=fat, platoon=plat, notes=notes, whiff_by_code=whiff_code,
        umpire=ump, dt_abs_ms=round(float(dt.mean() * 1000), 1) if len(dt) else None,
        offv_mean_mm=round(float(offv.mean() * 1000), 1) if len(offv) else None, offv_sd_mm=round(float(offv.std() * 1000), 1) if len(offv) else None,
        tipped=round(pct(sum(p["tipped"] for p in P), n_p), 1), checked=round(pct(sum(p["checked"] for p in P), n_p), 1),
        seconds=round(d["seconds"]))

if __name__ == "__main__":
    names = sys.argv[1:] or [os.path.basename(f)[:-5] for f in sorted(glob.glob(OUT + "/*.json"))]
    allsum = {}
    for n in names:
        f = os.path.join(OUT, n + ".json")
        if not os.path.exists(f):
            continue
        s = summarize(json.load(open(f)))
        allsum[n] = s
        print(json.dumps(s, ensure_ascii=False))
        print()
    json.dump(allsum, open(os.path.join(OUT, "..", "summary_all.json"), "w"), ensure_ascii=False, indent=1)
