/* bbsim app · the play after contact: runners, fielders, throws, ground ball, cameras, body/broadcast views */

/* ---------------- v1.7 the play after contact: batter-runner, fielders running / fielding / throwing ----------------
   The engine writes timed events (seconds after contact) into p.fielding.events:
     run   {who:"BR", path:[[x,y]...], t0, arrive:[t1..], vmax, tau, safe, bases, out_t}
     move  {who:pos, from, to, t0, t1}          field {who:pos, at, t, how, success}
     throw {who:pos, from, to, t0, t1, base, error}   call {base, t, out}
   Everything here replays those events; nothing is decided in the renderer.                                 */
const BASEXY = [[0, 0], [19.4, 19.4], [0, 38.8], [-19.4, 19.4], [0, 0]];
const RUN_H = 1.83, FIELDER_H = 1.83;
function playEvents(p) { return (p && p.fielding && p.fielding.events) ? p.fielding.events : [] }
function fieldPositions(p) {
  const m = {}; (BANK.fielders || []).forEach(f => { m[f.pos] = f.xy });
  if (p && p.fielding && p.fielding.positions) for (const k in p.fielding.positions) m[k] = p.fielding.positions[k];
  return m;
}
function sprintDist(u, v, tau) { return u <= 0 ? 0 : v * (u - tau * (1 - Math.exp(-u / tau))) }
function unit2(a, b) { const d = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(d[0], d[1]) || 1; return [d[0] / n, d[1] / n] }
function lerp2(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] }

/* batter-runner state at tp seconds after contact */
function runnerState(ev, tp) {
  const path = ev.path, arr = ev.arrive;
  const out = (ev.out_t !== null && ev.out_t !== undefined) ? ev.out_t : null;
  if (tp <= ev.t0) return { xy: path[0], dir: unit2(path[0], path[1]), spd: 0, dist: 0, done: false, out: false };
  let tt = tp, outNow = false;
  if (out !== null && tp > out + 0.9) { tt = out + 0.9; outNow = true }       // retired: coasts to a stop
  const u = tt - ev.t0, u1 = arr[0] - ev.t0, s1 = sprintDist(u1, ev.vmax, ev.tau);
  const L1 = Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]);
  if (u <= u1) {
    const f = sprintDist(u, ev.vmax, ev.tau) / Math.max(s1, 1e-6);
    const spd = Math.min(1, (1 - Math.exp(-u / ev.tau)));
    return { xy: lerp2(path[0], path[1], f), dir: unit2(path[0], path[1]), spd: outNow ? 0 : spd, dist: f * L1, done: false, out: outNow };
  }
  let dist = L1;
  for (let i = 1; i < arr.length; i++) {
    const Li = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    if (tt <= arr[i]) {
      const f = (tt - arr[i - 1]) / Math.max(arr[i] - arr[i - 1], 1e-6);
      return { xy: lerp2(path[i], path[i + 1], f), dir: unit2(path[i], path[i + 1]), spd: outNow ? 0 : 1, dist: dist + f * Li, done: false, out: outNow };
    }
    dist += Li;
  }
  const n = arr.length;
  // past the last base: safe runners stand on it (or cross home), retired runners jog off toward the dugout
  const last = path[n], prev = path[n - 1];
  const over = Math.min(0.9, (tp - arr[n - 1]) * 0.5);
  const d = unit2(prev, last);
  if (!ev.safe || n === 1 && !ev.safe) return { xy: [last[0] + d[0] * over * 3, last[1] + d[1] * over * 3], dir: d, spd: Math.max(0, 0.6 - over), dist: dist + over * 3, done: true, out: true };
  if (ev.bases >= 4) return { xy: last, dir: [0, 1], spd: 0, dist, done: true, out: false };
  return { xy: [last[0] + d[0] * over * 1.2, last[1] + d[1] * over * 1.2], dir: [-d[0], -d[1]], spd: 0, dist: dist + over, done: true, out: false };
}

/* base runners other than the batter (page-level state): before/after base flags -> timed advance */
function runnerDests(anim, batterBases) {
  const before = anim.before || [false, false, false], after = anim.after || [false, false, false];
  const B = [3, 2, 1].filter(b => before[b - 1]);                                  // lead runner first
  const A = [3, 2, 1].filter(b => after[b - 1] && b !== batterBases);
  const scored = Math.max(0, (anim.runs || 0) - (batterBases >= 4 ? 1 : 0));
  const dests = []; for (let i = 0; i < scored; i++) dests.push(4); A.forEach(b => dests.push(b));
  return B.map((b, i) => ({ from: b, to: (i < dests.length) ? dests[i] : Math.min(4, b + 1), out: i >= dests.length }));
}
function baseRunnerState(rd, tp) {
  const speed = 8.0, t0 = 0.35;
  if (rd.to <= rd.from) return { xy: BASEXY[rd.from], dir: unit2(BASEXY[rd.from], BASEXY[Math.min(4, rd.from + 1)]), spd: 0, dist: 0, done: true, out: false };
  const total = (rd.to - rd.from) * 27.43;
  const dist = Math.max(0, Math.min(total, (tp - t0) * speed));
  const seg = Math.min(rd.to - rd.from - 1, Math.floor(dist / 27.43)), f = (dist - seg * 27.43) / 27.43;
  const a = BASEXY[rd.from + seg], b = BASEXY[rd.from + seg + 1];
  const done = dist >= total - 1e-6;
  return { xy: lerp2(a, b, Math.min(1, f)), dir: unit2(a, b), spd: done ? 0 : 1, dist, done, out: rd.out && done };
}

/* fielder state at tp: where, which way, what it is doing */
function fielderState(pos, evs, home, tp) {
  let xy = home, dir = null, mode = "ready", phase = 0, hasBall = false, runDist = 0;
  const my = evs.filter(e => e.who === pos);
  my.forEach(e => {
    if (e.kind !== "move") return;
    if (tp >= e.t0) {
      const L = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);
      if (tp <= e.t1) { const f = (tp - e.t0) / Math.max(e.t1 - e.t0, 0.05); xy = lerp2(e.from, e.to, f); dir = unit2(e.from, e.to); mode = "run"; runDist = f * L; phase = Math.min(1, L / 3) }
      else { xy = e.to; if (mode === "run") mode = "ready"; dir = unit2(e.from, e.to); runDist = L }
    }
  });
  my.forEach(e => {
    if (e.kind === "field" && tp >= e.t - 0.30 && tp <= e.t + 0.50) { mode = e.how === "catch" ? "catch" : "ground"; phase = (tp - (e.t - 0.30)) / 0.80; xy = e.at; if (tp >= e.t && e.success) hasBall = true }
    else if (e.kind === "field" && tp > e.t + 0.50 && e.success) hasBall = true;
  });
  my.forEach(e => {
    if (e.kind === "throw") {
      if (tp >= e.t0 - 0.40 && tp <= e.t0 + 0.30) { mode = "throw"; phase = (tp - (e.t0 - 0.40)) / 0.70; dir = unit2(e.from, e.to); xy = e.from; hasBall = tp < e.t0 }
      else if (tp > e.t0) hasBall = false;
    }
  });
  // the receiver at a base: catch when the throw arrives
  evs.forEach(e => {
    if (e.kind === "throw" && !e.error) {
      const cov = evs.find(m => m.kind === "move" && m.who === pos && Math.hypot(m.to[0] - e.to[0], m.to[1] - e.to[1]) < 0.5);
      if (cov && tp >= e.t1 - 0.25 && tp <= e.t1 + 0.6) { mode = "catch"; phase = (tp - (e.t1 - 0.25)) / 0.85; dir = unit2(e.to, e.from); if (tp >= e.t1) hasBall = true }
    }
  });
  return { xy, dir: dir || unit2(home, [0, 0]), mode, phase, hasBall, runDist };
}

/* a throw segment's ball position: an arc (apex from the flight time) or a one-hop (arc to the hop, then a low run-in) */
function throwBallPos(th, tp) {
  const s01 = (a, b, t) => Math.max(0, Math.min(1, (t - a) / Math.max(b - a, 1e-3)));
  if (th.hop && tp >= th.t_hop) {
    const s = s01(th.t_hop, th.t1, tp);
    return { xy: lerp2(th.hop, th.to, s), z: 0.05 + 4 * 0.45 * s * (1 - s) };
  }
  const tEnd = th.hop ? th.t_hop : th.t1, end = th.hop || th.to;
  const s = s01(th.t0, tEnd, tp), T = Math.max(tEnd - th.t0, 0.05);
  const apex = 9.81 * T * T / 8;
  return { xy: lerp2(th.from, end, s), z: 1.6 + 4 * apex * s * (1 - s) - (th.hop ? 1.55 : 0.4) * s };
}
/* where the ball is after contact (null = still on its batted flight / on the ground before anyone has it) */
function ballAfterContact(p, tp, evs, tC) {
  const items = evs.filter(e => (e.kind === "field" && e.success) || e.kind === "throw").map(e => ({ e, t: e.kind === "field" ? e.t : e.t0 })).sort((a, b) => a.t - b.t);
  let cur = null; for (const it of items) { if (it.t <= tp) cur = it; else break }
  if (!cur) return null;
  if (cur.e.kind === "field") return { xy: cur.e.at, z: cur.e.how === "catch" ? 1.5 : (cur.e.how === "relay" ? 1.4 : 0.9), held: cur.e.who };
  const th = cur.e;
  if (tp <= th.t1) { const b = throwBallPos(th, tp); return { xy: b.xy, z: b.z, held: null } }
  if (th.error) { const over = Math.min(1, (tp - th.t1) * 0.4); return { xy: lerp2(th.to, [th.to[0] * 1.15, th.to[1] * 1.15], over), z: 0.04, held: null } }
  return { xy: th.to, z: 1.2, held: "recv" };
}
/* the batted ball from contact on: flight -> on the ground (engine samples: hops, bounces, roll) -> fielded / thrown */
function battedBall(p, t, tp, evs) {
  const fl = p.batted.flight;
  const after = ballAfterContact(p, tp, evs, contactTime(p));
  if (after) return { xyz: [after.xy[0], after.xy[1], after.z], held: after.held };
  if (t <= fl.t[fl.t.length - 1]) return { xyz: interp(fl, t), held: null };
  const gr = p.fielding && p.fielding.ground;
  if (gr && gr.t && gr.t.length && tp <= gr.t[gr.t.length - 1] + 0.02) return { xyz: interp(gr, Math.max(gr.t[0], tp)), held: null };
  return null;
}

/* ---------------- poses: running, fielding, throwing ---------------- */
function runPose(x, y, d, h, dist, spd) {
  const r = [d[1], -d[0], 0], ph = (dist / 2.2) * 2 * Math.PI;
  const lean = 0.06 + 0.16 * spd, stride = 0.16 + 0.42 * spd;
  const pv = [x - d[0] * 0.05, y - d[1] * 0.05, (0.50 - 0.03 * spd) * h];
  const nk = add3(pv, [d[0] * lean, d[1] * lean, 0.36 * h]);
  const ch = lerp3(pv, nk, 0.62), hd = add3(nk, [d[0] * 0.05, d[1] * 0.05, 0.13 * h]);
  const sA = Math.sin(ph), sB = -Math.sin(ph), lA = Math.max(0, -Math.cos(ph)), lB = Math.max(0, Math.cos(ph));
  const ankleA = [x + d[0] * stride * sA + r[0] * 0.13, y + d[1] * stride * sA + r[1] * 0.13, 0.05 + 0.32 * lA * spd];
  const ankleB = [x + d[0] * stride * sB - r[0] * 0.13, y + d[1] * stride * sB - r[1] * 0.13, 0.05 + 0.32 * lB * spd];
  const hipA = add3(pv, mul3(r, 0.12)), hipB = sub3(pv, mul3(r, 0.12));
  const shA = add3(nk, mul3(r, 0.19)), shB = sub3(nk, mul3(r, 0.19));
  const swing = 0.10 + 0.22 * spd;
  const hdA = add3(add3(shA, [d[0] * (-swing * sA + 0.05), d[1] * (-swing * sA + 0.05), -0.30 * h]), mul3(r, 0.06));
  const hdB = sub3(add3(shB, [d[0] * (-swing * sB + 0.05), d[1] * (-swing * sB + 0.05), -0.30 * h]), mul3(r, 0.06));
  return fixLimbs(body({
    pelvis: pv, chest: ch, neck: nk, head: hd, hipA, hipB,
    kneeA: add3(lerp3(hipA, ankleA, 0.5), [d[0] * (0.10 + 0.25 * lA), d[1] * (0.10 + 0.25 * lA), 0.05 * lA]),
    kneeB: add3(lerp3(hipB, ankleB, 0.5), [d[0] * (0.10 + 0.25 * lB), d[1] * (0.10 + 0.25 * lB), 0.05 * lB]),
    ankleA, ankleB, toeA: add3(ankleA, [d[0] * 0.16, d[1] * 0.16, -0.03]), toeB: add3(ankleB, [d[0] * 0.16, d[1] * 0.16, -0.03]),
    shA, shB, elA: add3(lerp3(shA, hdA, 0.5), [-d[0] * 0.12, -d[1] * 0.12, -0.02]), elB: add3(lerp3(shB, hdB, 0.5), [-d[0] * 0.12, -d[1] * 0.12, -0.02]),
    hdA, hdB,
  }), h);
}
function fielderPose(st, h) {
  const x = st.xy[0], y = st.xy[1], d = [st.dir[0], st.dir[1], 0], r = [d[1], -d[0], 0];
  if (st.mode === "run") return withGlove(runPose(x, y, st.dir, h, st.runDist, 0.9), 1);
  if (st.mode === "ready") return standPose(x, y, h, true);
  const ph = Math.max(0, Math.min(1, st.phase));
  let pv, nk, hG, hT, kneeHint = 0.08;
  if (st.mode === "ground") {                         // crouch, glove down in front, throwing hand beside it
    const dip = Math.sin(ph * Math.PI);
    pv = [x - d[0] * 0.15, y - d[1] * 0.15, (0.46 - 0.16 * dip) * h];
    nk = add3(pv, [d[0] * (0.15 + 0.15 * dip), d[1] * (0.15 + 0.15 * dip), (0.36 - 0.06 * dip) * h]);
    hG = [x + d[0] * 0.30, y + d[1] * 0.30, 0.12 + 0.5 * (1 - dip)];
    hT = add3(hG, [r[0] * 0.18, r[1] * 0.18, 0.12]);
    kneeHint = 0.22;
  } else if (st.mode === "catch") {                   // glove up to the ball, chest high
    const up = Math.sin(Math.min(1, ph * 1.4) * Math.PI / 2);
    pv = [x, y, 0.50 * h]; nk = add3(pv, [d[0] * 0.04, d[1] * 0.04, 0.36 * h]);
    hG = add3(nk, [d[0] * 0.40, d[1] * 0.40, (0.02 + 0.30 * up)]);
    hT = add3(nk, [d[0] * 0.20 + r[0] * 0.28, d[1] * 0.20 + r[1] * 0.28, -0.25 * h]);
  } else {                                            // throw: arm back then forward, step toward the target
    const back = Math.max(0, 1 - ph / 0.55), fwd = Math.max(0, (ph - 0.55) / 0.45);
    pv = [x - d[0] * 0.10 * fwd, y - d[1] * 0.10 * fwd, 0.49 * h];
    nk = add3(pv, [d[0] * (0.06 + 0.16 * fwd), d[1] * (0.06 + 0.16 * fwd), 0.36 * h]);
    hT = add3(nk, [(-d[0] * 0.45 * back + d[0] * 0.55 * fwd) - r[0] * 0.30, (-d[1] * 0.45 * back + d[1] * 0.55 * fwd) - r[1] * 0.30, 0.10 + 0.30 * back - 0.10 * fwd]);
    hG = add3(nk, [d[0] * (0.35 - 0.25 * fwd) + r[0] * 0.25, d[1] * (0.35 - 0.25 * fwd) + r[1] * 0.25, -0.05 - 0.25 * fwd]);
  }
  const ch = lerp3(pv, nk, 0.62), hd = add3(nk, [d[0] * 0.05, d[1] * 0.05, 0.13 * h]);
  const footG = add3([x, y, 0], mul3(r, 0.20)), footT = sub3([x, y, 0], mul3(r, 0.20));
  const hipG = add3(pv, mul3(r, 0.12)), hipT = sub3(pv, mul3(r, 0.12));
  const shG = add3(nk, mul3(r, 0.19)), shT = sub3(nk, mul3(r, 0.19));
  const J = fixLimbs(body({
    pelvis: pv, chest: ch, neck: nk, head: hd, hipA: hipG, hipB: hipT,
    kneeA: add3(lerp3(hipG, footG, 0.5), [d[0] * kneeHint, d[1] * kneeHint, 0]), kneeB: add3(lerp3(hipT, footT, 0.5), [d[0] * kneeHint, d[1] * kneeHint, 0]),
    ankleA: footG, ankleB: footT, toeA: add3(footG, [d[0] * 0.18, d[1] * 0.18, 0]), toeB: add3(footT, [d[0] * 0.18, d[1] * 0.18, 0]),
    shA: shG, shB: shT, elA: add3(lerp3(shG, hG, 0.5), [0, 0, -0.10]), elB: add3(lerp3(shT, hT, 0.5), [-d[0] * 0.10, -d[1] * 0.10, 0.02]),
    hdA: hG, hdB: hT,
  }), h);
  J.glove = J.arms[0][2];
  return J;
}
function withGlove(J, i) { J.glove = J.arms[i][2]; return J }

/* ---------------- scene assembly (replaces the v1.6 sceneAt / drawBody / drawCam) ---------------- */
function sceneAt(p, t) {
  const fig = currentFig(), cb = currentBatter();
  const bh = (cb && cb.height) ? cb.height : 1.85, bhand = p ? p.batter_hand : ((cb && cb.hand) || "R");
  const tt = p ? t : -1.7;
  const T = p ? p.flight.t[p.flight.t.length - 1] : 0.42;
  const tm = p ? pitchEnd(p) : null;
  const tC = contactTime(p), tp = tt - tC;
  const evs = playEvents(p);
  const pit = pitcherPose(fig, tt), cat = catcherPose(p, tt, tm), ump = umpirePose(p, tt, bhand, T);
  // the batter becomes a runner once the follow-through is done and a run event exists
  const runEv = evs.find(e => e.kind === "run" && e.who === "BR");
  let bat = null, runner = null;
  if (runEv && tp > 0.30) { runner = runnerState(runEv, tp); bat = runPose(runner.xy[0], runner.xy[1], runner.dir, bh, runner.dist, runner.spd) }
  else bat = batterPose(p, tt, bh, bhand);
  // fielders
  const homes = fieldPositions(p);
  const fielders = [];
  (BANK.fielders || []).forEach(f => {
    if (f.pos === "P" && tp <= 0.3) return;                          // the pitcher figure comes from pitcherPose until the play starts
    if (f.pos === "C") return;
    const st = (p && p.fielding) ? fielderState(f.pos, evs, homes[f.pos] || f.xy, tp) : { xy: homes[f.pos] || f.xy, dir: unit2(f.xy, [0, 0]), mode: "ready", phase: 0, hasBall: false, runDist: 0 };
    if (f.pos === "P" && st.mode === "ready" && (!p || !p.fielding)) return;
    fielders.push({ pos: f.pos, st, J: fielderPose(st, FIELDER_H) });
  });
  // other base runners (page-level state on the pitch object)
  const others = [];
  if (p && p.runnersAnim) {
    const bb = runEv ? (runEv.safe ? runEv.bases : 0) : (p.runnersAnim.batterBases || 0);
    runnerDests(p.runnersAnim, bb).forEach(rd => {
      const st = (tp > 0.3 || !p.fielding) ? baseRunnerState(rd, tp > 0.3 ? tp : -1) : { xy: BASEXY[rd.from], dir: unit2(BASEXY[rd.from], BASEXY[rd.from + 1]), spd: 0, dist: 0, done: true, out: false };
      others.push({ st, J: st.spd > 0 ? runPose(st.xy[0], st.xy[1], st.dir, RUN_H, st.dist, 1) : standPose(st.xy[0], st.xy[1], RUN_H, true) });
    });
  }
  // the ball
  let ball = null;
  if (p) {
    const tCb = p.batted ? p.batted.flight.t[0] : null;
    if (t < 0) ball = pit.ball || null;
    else if (tCb !== null && t >= tCb) {
      const bb = battedBall(p, t, tp, evs);
      if (bb) {
        if (bb.held) { const holder = fielders.find(f => f.st.hasBall); ball = holder ? holder.J.glove : bb.xyz }
        else ball = bb.xyz;
      }
    }
    else if (t <= T) ball = interp(p.flight, t);
    else if (t <= tm.t) ball = lerp3(p.flight.xyz[p.flight.xyz.length - 1], tm.P, (t - T) / Math.max(tm.t - T, 1e-3));
    else ball = cat.held || null;
  }
  return { fig, bh, bhand, T, tm, tp, pit, bat, cat, ump, fielders, others, runner, ball, showPitcher: !(fielders.some(f => f.pos === "P")) };
}
const BODY_CAM_DEF = { C: [5.0, -4.8, 3.0], T: [-0.80, 3.2, 0.90], fov: 54 };
const PIP_CAM = { C: [5.4, 14.2, 1.7], T: [-0.20, 17.7, 1.10], fov: 30 };
function bodyCam() { return (typeof window !== "undefined" && window.CAMOVR) || BODY_CAM_DEF }
function scenePeople(S, withFielders) {
  const people = [{ J: S.bat, o: UNI.batter }, { J: S.cat, o: UNI.catcher }, { J: S.ump, o: UNI.umpire }];
  if (S.showPitcher) people.push({ J: S.pit, o: UNI.pitcher });
  if (withFielders) { S.fielders.forEach(f => people.push({ J: f.J, o: f.pos === "P" ? UNI.pitcher : UNI.fielder })); S.others.forEach(r => people.push({ J: r.J, o: UNI.batter })) }
  return people;
}
function drawBody(p, t) {
  const c = $("body"), g = c.getContext("2d"); const w = c.width, hgt = c.height;
  const BC = bodyCam();
  const cam = camera(BC.C, BC.T, w, hgt, BC.fov);
  drawBallpark(g, cam, w, hgt, "body" + (typeof window !== "undefined" && window.CAMOVR ? JSON.stringify(window.CAMOVR) : ""));
  const S = sceneAt(p, t);
  const rpm = p ? p.flight.rpm : 0;
  drawPeople(g, cam, scenePeople(S, true), S.ball, t, rpm);
  const tt = p ? t : -1.7;
  if (tt < 0.12 && !(typeof window !== "undefined" && window.CAMOVR)) {
    const pw = Math.round(w * 0.36), ph = Math.round(hgt * 0.50), x0 = w - pw - 8, y0 = 8;
    g.save(); g.beginPath(); g.rect(x0, y0, pw, ph); g.clip(); g.translate(x0, y0);
    const pc = camera(PIP_CAM.C, PIP_CAM.T, pw, ph, PIP_CAM.fov);
    drawBallpark(g, pc, pw, ph, "pip");
    drawPeople(g, pc, [{ J: S.pit, o: UNI.pitcher }], (S.ball && tt < 0.12) ? S.ball : null, t, rpm);
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
    g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x0, y0 + ph - 16, 44, 16);
    g.fillStyle = "#e8e4d8"; g.font = "11px IBM Plex Mono, monospace"; g.fillText("투수", x0 + 6, y0 + ph - 4);
  }
  const note = $("bodyNote");
  if (note) note.textContent = S.fig ? ("투수 팔각도 " + S.fig.arm_angle + "° · 스트라이드 " + S.fig.stride + " m · 익스텐션 " + (S.fig.extension || "-") + " m · 릴리스 높이 " + S.fig.joints.release[2].toFixed(2) + " m · 타자 키 " + S.bh.toFixed(2) + " m") : "";
}
/* broadcast camera: centre field for the pitch, then a high home-plate camera that follows the play */
const CAM_CF = { C: [2.4, 118, 9.5], T: [0.1, 9.0, 1.05], fov: 8.3 };
const CAM_HIGH = { C: [6.0, -22.0, 16.0], T: [0.0, 30.0, 1.0], fov: 46 };
function playCam(p, t, w, hgt) {
  const tc = throwCam(p, t, w, hgt); if (tc) return tc;
  const evs = playEvents(p);
  const tC = contactTime(p), tp = t - tC;
  if (!p || !evs.length || tp < 0.25) return camera(CAM_CF.C, CAM_CF.T, w, hgt, CAM_CF.fov);
  // hard cut to the high home-plate camera; frame everything that is happening (ball, runner, moving fielders, throws)
  const pts = [];
  if (p.batted) { const bb = battedBall(p, t, tp, evs); if (bb) pts.push([bb.xyz[0], bb.xyz[1]]) }
  evs.forEach(e => {
    if (e.kind === "run" && e.who === "BR") pts.push(runnerState(e, tp).xy);
    if (e.kind === "move" && tp >= e.t0 - 0.2 && tp <= e.t1 + 0.6) pts.push(lerp2(e.from, e.to, Math.max(0, Math.min(1, (tp - e.t0) / Math.max(e.t1 - e.t0, 0.05)))));
    if (e.kind === "throw" && tp >= e.t0 - 0.6 && tp <= e.t1 + 0.8) { pts.push(e.from); pts.push(e.to) }
    if (e.kind === "call" && tp >= e.t - 1.0 && tp <= e.t + 1.6) pts.push(BASEXY[e.base]);
  });
  if (!pts.length) pts.push([0, 30]);
  const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  let spread = 0; pts.forEach(a => pts.forEach(b => { spread = Math.max(spread, Math.hypot(a[0] - b[0], a[1] - b[1])) }));
  const T = [cx, cy, 1.0];
  const far = Math.max(0, Math.min(0.6, (Math.hypot(cx, cy) - 40) / 80));          // deep plays: the camera floats out over the infield
  const C = lerp3(CAM_HIGH.C, [cx * 0.3, cy * 0.35, 18], far);
  const dist = Math.hypot(T[0] - C[0], T[1] - C[1], T[2] - C[2]);
  const fov = Math.max(14, Math.min(55, 2 * Math.atan((spread / 2 + 7) / dist) * 180 / Math.PI * 1.25));
  return camera(C, T, w, hgt, fov);
}
function actionPoint(p, t, evs) {                  // where the ball-side action is (for the zoom inset)
  const tC = contactTime(p), tp = t - tC;
  if (p.batted) { const bb = battedBall(p, t, tp, evs); if (bb) return [bb.xyz[0], bb.xyz[1]] }
  const fe = evs.filter(e => e.kind === "field").sort((a, b) => a.t - b.t)[0];
  return fe ? fe.at : null;
}
function drawCam(p, t, id) {
  const c = $(id || "cam"), g = c.getContext("2d"); const w = c.width, hgt = c.height;
  const cam = playCam(p, t, w, hgt);
  drawBallpark(g, cam, w, hgt, "cam");
  const S = sceneAt(p, t);
  const people = scenePeople(S, true);
  drawPeople(g, cam, people, S.ball, t, p ? p.flight.rpm : 0);
  // zoom inset on the fielding action while the wide shot is wide
  const evsA = playEvents(p);
  if (p && evsA.length && S.tp >= 0.25 && cam.fl < 900) {
    const ap = actionPoint(p, t, evsA);
    if (ap) {
      const pw = Math.round(w * 0.34), ph = Math.round(hgt * 0.42), x0 = w - pw - 8, y0 = hgt - ph - 8;
      const Cz = [ap[0] * 0.25 + 4, ap[1] * 0.25 - 16, 12], Tz = [ap[0], ap[1], 1.0];
      const dz = Math.hypot(Tz[0] - Cz[0], Tz[1] - Cz[1], Tz[2] - Cz[2]);
      const fz = Math.max(4, Math.min(14, 2 * Math.atan(4.5 / dz) * 180 / Math.PI * 1.3));
      g.save(); g.beginPath(); g.rect(x0, y0, pw, ph); g.clip(); g.translate(x0, y0);
      const zc = camera(Cz, Tz, pw, ph, fz);
      drawBallpark(g, zc, pw, ph, "zoom" + Math.round(ap[0] / 3) + "," + Math.round(ap[1] / 3));
      drawPeople(g, zc, people, S.ball, t, 0);
      g.restore();
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
      g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x0, y0, 44, 16); g.fillStyle = "#e8e4d8"; g.font = "11px IBM Plex Mono, monospace"; g.fillText("수비", x0 + 6, y0 + 12);
    }
  }
  // safe / out call banner
  const evs = playEvents(p);
  const call = evs.find(e => e.kind === "call" && S.tp >= e.t && S.tp <= e.t + 1.6);
  if (call) { g.fillStyle = call.out ? "rgba(180,40,40,0.85)" : "rgba(40,140,70,0.85)"; g.fillRect(w / 2 - 60, 12, 120, 30); g.fillStyle = "#fff"; g.font = "bold 18px Oswald, sans-serif"; g.textAlign = "center"; g.fillText(call.out ? "OUT" : "SAFE", w / 2, 34); g.textAlign = "start" }
}
