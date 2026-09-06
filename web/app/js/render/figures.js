/* bbsim app · batter, catcher, umpire, standing fielder poses + uniforms + depth-sorted drawing */

/* ---------------- timing helpers shared by every figure ---------------- */
function swingKind(p) {                       // "none" | "swing" | "bunt" | "check"
  if (!p) return "none";
  if (p.swing_kind) return p.swing_kind;
  const n = p.decision_note || "";
  if (p.checked || n.indexOf("check") >= 0) return "check";
  if (!p.swing) return "none";
  return n.indexOf("bunt") >= 0 ? "bunt" : "swing";
}
function contactTime(p) {                     // when the pitch reaches the batter's contact plane
  if (!p) return 0.42;
  if (p.batted && p.batted.flight.t.length) return p.batted.flight.t[0];
  const T = p.flight.t, X = p.flight.xyz, cy = (typeof p.contact_y === "number") ? p.contact_y : 0.58;
  for (let i = 1; i < T.length; i++) if (X[i][1] <= cy) { const f = (X[i - 1][1] - cy) / ((X[i - 1][1] - X[i][1]) || 1e-9); return T[i - 1] + f * (T[i] - T[i - 1]) }
  return T[T.length - 1];
}
function pitchEnd(p) {                        // the catch: last samples extrapolated to the mitt plane
  const T = p.flight.t, X = p.flight.xyz, n = T.length, yM = -0.55;
  const last = X[n - 1];
  if (p.in_dirt || n < 2 || last[1] <= yM) return { t: T[n - 1], P: [last[0], last[1], Math.max(0.04, last[2])] };
  const v = mul3(sub3(last, X[n - 2]), 1 / Math.max(T[n - 1] - T[n - 2], 1e-4));
  const dt = (yM - last[1]) / Math.min(v[1], -1);
  const P = add3(last, mul3(v, dt));
  return { t: T[n - 1] + dt, P: [P[0], P[1], Math.max(0.04, P[2])] };
}

/* ---------------- batter ----------------
   The swing is a rotation: the pose is built from the hip-line and shoulder-line angles (0 deg =
   stance, side-on; 90 deg = square to the pitcher), hips leading the shoulders. Phases before the
   pitch arrives are keyed to the pitcher's clock (load at -0.35 s, plant at +0.20 s: fixed, so the
   pre-contact body cannot leak pitch speed); contact is at the real contact time, with the bat's
   sweet spot on the real contact point (a miss passes 11 cm under the ball). Bunt and check swing
   have their own poses. Limb lengths are fixed by fixLimbs.                                          */
function batterPose(p, t, h, hand) {
  hand = hand || (p ? p.batter_hand : "R");
  const side = hand === "L" ? 1 : -1;               // batter stands at x = side*0.92
  const bx = side * 0.92, by = 0.30;
  const kind = swingKind(p), tC = contactTime(p), hit = !!(p && p.batted);
  const cx = p && p.plate_xz ? p.plate_xz[0] : 0, cz = p && p.plate_xz ? p.plate_xz[1] : 0.80;
  const cy = p && typeof p.contact_y === "number" ? p.contact_y : 0.58;
  const dirOf = th => [(-side) * Math.sin(th * DEG), Math.cos(th * DEG), 0];   // front-shoulder direction
  const mk = (o) => {
    const pv = [bx + (o.dx || 0), by + (o.dy || 0), (o.pz || 0.48) * h];
    const hd = dirOf(o.hipTh), sd = dirOf(o.shTh);
    const nk = add3(pv, [(o.leanX !== undefined ? o.leanX : -side * 0.06), (o.leanY || 0), 0.36 * h]);
    const ch = lerp3(pv, nk, 0.62);
    const shA = add3(nk, mul3(sd, 0.19)), shB = sub3(nk, mul3(sd, 0.19));   // A = front side
    const hipA = add3(pv, mul3(hd, 0.12)), hipB = sub3(pv, mul3(hd, 0.12));
    const fF = o.footFront || [bx + side * 0.04, by + 0.42, 0];
    const fB = o.footBack || [bx - side * 0.04, by - 0.36, 0];
    const kneeA = o.kneeFront || add3(lerp3(hipA, fF, 0.5), [-side * 0.05, 0.06, 0]);
    const kneeB = o.kneeBack || add3(lerp3(hipB, fB, 0.5), [-side * 0.02, 0.02, 0]);
    const hands = o.hands, hands2 = o.hands2 || add3(hands, [-side * 0.03, -0.03, 0.03]);
    return {
      pelvis: pv, chest: ch, neck: nk, head: add3(nk, o.headOff || [-side * 0.06, 0.06, 0.13 * h]),
      hipA, hipB, kneeA, kneeB, ankleA: fF, ankleB: fB,
      toeA: add3(fF, [-side * 0.10, 0.10, 0]), toeB: add3(fB, [-side * 0.10, -0.08, 0]),
      shA, shB,
      elA: o.elA || add3(lerp3(shA, hands, 0.5), [0, -0.12, -0.12]), elB: o.elB || add3(lerp3(shB, hands2, 0.5), [side * 0.10, -0.06, -0.12]),
      hdA: hands, hdB: hands2, bat: [hands, o.tip],
    };
  };
  const stance = mk({ hipTh: 0, shTh: -8, pz: 0.48, hands: [bx + side * 0.10, by - 0.26, 0.79 * h], tip: [bx + side * 0.40, by - 0.56, 0.79 * h + 0.62] });
  const load = mk({
    hipTh: -6, shTh: -16, pz: 0.48, dx: side * 0.03, hands: [bx + side * 0.16, by - 0.34, 0.80 * h], tip: [bx + side * 0.50, by - 0.60, 0.80 * h + 0.58],
    footFront: [bx + side * 0.02, by + 0.30, 0.10], kneeFront: [bx + side * 0.02, by + 0.22, 0.30 * h],
  });
  const plant = mk({ hipTh: 18, shTh: -8, pz: 0.47, hands: [bx + side * 0.14, by - 0.30, 0.78 * h], tip: [bx + side * 0.46, by - 0.58, 0.78 * h + 0.60] });
  // full swing contact: hands above and behind the ball, barrel down to it, sweet spot on the ball
  const lowDrop = 0.15 * Math.max(0, Math.min(1, (0.90 - cz) / 0.5));
  const miss = (kind === "swing" && !hit) ? [0, 0, -0.11] : [0, 0, 0];
  const Cpt = add3([cx, cy, cz], miss);
  const handsNat = [bx - side * 0.33, cy - 0.12, Cpt[2] + 0.14];
  const u = norm(sub3(Cpt, handsNat));
  const knob = sub3(Cpt, mul3(u, 0.66)), tip = add3(Cpt, mul3(u, 0.18));
  const contact = mk({
    hipTh: 80, shTh: 60, pz: 0.48 - lowDrop, dx: -side * 0.05, dy: 0.02, hands: knob, tip,
    hands2: add3(knob, mul3(u, 0.06)),
    footFront: [bx + side * 0.02, by + 0.42, 0], kneeFront: [bx - side * 0.02, by + 0.34, 0.43 * h - lowDrop * 0.4],
    footBack: [bx - side * 0.02, by - 0.36, 0.05], kneeBack: [bx - side * 0.12, by - 0.18, 0.27 * h],
    elA: add3(lerp3(add3(handsNat, [0, 0, 0.3]), knob, 0.5), [0, -0.10, -0.06]),
    headOff: [-side * 0.08, 0.06, 0.12 * h],
  });
  const follow = mk({
    hipTh: 104, shTh: 116, pz: 0.48, dx: -side * 0.10, dy: 0.04,
    hands: [bx - side * 0.26, by + 0.12, 0.86 * h], tip: [bx - side * 0.26 + side * 0.40, by + 0.12 - 0.40, 0.86 * h - 0.40],
    footFront: [bx + side * 0.02, by + 0.42, 0], kneeFront: [bx - side * 0.02, by + 0.34, 0.44 * h],
    footBack: [bx - side * 0.06, by - 0.30, 0.10], kneeBack: [bx - side * 0.14, by - 0.12, 0.28 * h],
    headOff: [-side * 0.08, 0.02, 0.12 * h],
  });
  const watch = mk({ hipTh: 8, shTh: -8, pz: 0.47, hands: [bx + side * 0.13, by - 0.30, 0.78 * h], tip: [bx + side * 0.45, by - 0.58, 0.78 * h + 0.60], headOff: [-side * 0.07, 0.10, 0.13 * h] });
  // bunt: square round, hands apart, bat level across the plate, sweet spot on the ball
  const ub = norm([-side * 1.0, 0.25, 0.05]);
  const bC = [cx, cy, cz], bKnob = sub3(bC, mul3(ub, 0.62));
  const square = mk({ hipTh: 72, shTh: 72, pz: 0.44, dx: -side * 0.08, hands: [bx - side * 0.30, by + 0.10, 0.62 * h], hands2: [bx - side * 0.30 + ub[0] * 0.30, by + 0.10 + ub[1] * 0.30, 0.62 * h], tip: [bx - side * 0.30 + ub[0] * 0.84, by + 0.10 + ub[1] * 0.84, 0.62 * h], leanX: -side * 0.10 });
  const buntC = mk({ hipTh: 75, shTh: 75, pz: 0.44 - lowDrop * 0.6, dx: -side * 0.08, hands: bKnob, hands2: add3(bKnob, mul3(ub, 0.30)), tip: add3(bKnob, mul3(ub, 0.84)), leanX: -side * 0.10, headOff: [-side * 0.10, 0.10, 0.12 * h] });
  const check = mk({ hipTh: 45, shTh: 25, pz: 0.47, dx: -side * 0.03, hands: [bx - side * 0.05, by - 0.10, 0.62 * h], tip: [bx - side * 0.05 - side * 0.10, by - 0.10 + 0.55, 0.62 * h + 0.60] });
  let keys;
  if (kind === "swing") keys = [[-1.7, stance], [-0.35, load], [Math.min(0.20, tC - 0.16), plant], [tC, contact], [tC + 0.28, follow]];
  else if (kind === "bunt") keys = [[-1.7, stance], [-0.35, load], [0.10, square], [tC, buntC], [tC + 0.35, buntC], [tC + 0.9, square]];
  else if (kind === "check") keys = [[-1.7, stance], [-0.35, load], [Math.min(0.20, tC - 0.16), plant], [tC, check], [tC + 0.6, check]];
  else keys = [[-1.7, stance], [-0.35, load], [Math.min(0.20, tC - 0.16), plant], [tC + 0.05, watch]];
  return fixLimbs(body(keyAt(keys, t)), h);
}

/* ---------------- catcher ----------------
   Right-handed catcher (mitt on the left hand, -x), one-knee stance behind the plate. The mitt
   shows the target (gamer mode: a neutral spot that only depends on the count), moves to the ball
   over the last 0.20 s, receives it at the extrapolated catch point, then frames toward the zone.
   A pitch in the dirt is blocked from both knees. The ball stays in the mitt after the catch.     */
function catcherPose(p, t, tm) {
  const cnt = p && p.count ? p.count : [0, 0];
  const jx = (((cnt[0] * 7 + cnt[1] * 3) % 5) - 2) * 0.05, jz = (((cnt[0] * 5 + cnt[1] * 11) % 5) - 2) * 0.04;
  const tgt = (typeof BANK !== "undefined" && BANK.admin && p && p.target_xz) ? [p.target_xz[0], p.target_xz[1]] : [jx, 0.62 + jz];
  const home = [tgt[0] * 0.8, -0.60, Math.max(0.30, tgt[1])];
  const meet = tm ? tm.P : [0, -0.55, 0.62];
  const tMeet = tm ? tm.t : 0.42;
  const hit = !!(p && p.batted);
  const frame = [meet[0] * 0.75, meet[1] - 0.06, Math.min(Math.max(0.28, meet[2] * 0.92 + 0.06), 1.0)];
  let gl, held = null;
  if (!p || t < -0.3) gl = [-0.10, -0.62, 0.55];
  else if (t < tMeet - 0.20 || hit) gl = home;
  else if (t < tMeet) gl = lerp3(home, meet, (t - (tMeet - 0.20)) / 0.20);
  else { gl = lerp3(meet, frame, Math.min(1, (t - tMeet) / 0.22)); held = gl }
  const block = (p && p.in_dirt && !hit) ? Math.max(0, Math.min(1, (t - (tMeet - 0.28)) / 0.20)) : 0;
  // one-knee stance (segment lengths verified against body.py ratios for 1.83 m)
  const A = {
    pelvis: [0, -1.02, 0.44], chest: [0, -0.94, 0.75], neck: [0, -0.88, 1.02], head: [0, -0.84, 1.17],
    hipA: [-0.11, -1.00, 0.45], hipB: [0.11, -1.04, 0.43],                         // A = mitt side (-x)
    kneeA: [-0.28, -0.59, 0.49], kneeB: [0.16, -0.71, 0.13],
    ankleA: [-0.42, -0.66, 0.07], ankleB: [0.19, -1.16, 0.10],
    toeA: [-0.47, -0.40, 0.03], toeB: [0.21, -1.33, 0.05],
    shA: [-0.24, -0.84, 0.955], shB: [0.24, -0.94, 0.955],
    elA: [-0.36, -0.80, 0.72], elB: [0.34, -1.02, 0.68],
    hdA: gl, hdB: [0.30, -0.96, 0.42], glove: gl,
  };
  if (block > 0) {                                  // drop to both knees, chest over the ball, mitt to the ground
    const B = {
      pelvis: [0, -1.02, 0.36], chest: [0, -0.84, 0.66], neck: [0, -0.76, 0.92], head: [0, -0.70, 1.04],
      hipA: [-0.11, -1.00, 0.36], hipB: [0.11, -1.04, 0.36],
      kneeA: [-0.30, -0.75, 0.12], kneeB: [0.30, -0.75, 0.12],
      ankleA: [-0.34, -1.22, 0.08], ankleB: [0.34, -1.22, 0.08], toeA: [-0.36, -1.40, 0.04], toeB: [0.36, -1.40, 0.04],
      shA: [-0.24, -0.76, 0.86], shB: [0.24, -0.76, 0.86],
      elA: [-0.30, -0.66, 0.50], elB: [0.30, -0.66, 0.50],
      hdA: [meet[0] - 0.06, -0.62, 0.12], hdB: [meet[0] + 0.12, -0.62, 0.14], glove: [meet[0] - 0.06, -0.62, 0.12],
    };
    const M = lerpBody(A, B, block);
    if (t >= tMeet) { M.hdA = M.glove = [meet[0], Math.max(meet[1], -0.62), 0.12]; held = M.glove }
    const J = fixLimbs(body(M), 1.83); J.glove = J.arms[0][2]; J.held = held ? J.glove : null; return J;
  }
  const J = fixLimbs(body(A), 1.83); J.glove = J.arms[0][2]; J.held = held ? J.glove : null;
  return J;
}
/* ---------------- umpire: slot stance over the catcher's inside shoulder ---------------- */
function umpirePose(p, t, bhand, T) {
  const ux = (bhand === "L" ? 0.36 : -0.36), uy = -1.72;
  const swingK = p && p.result === "swinging_strike", calledK = p && p.result === "called_strike";
  const t0 = swingK ? T + 0.20 : T + 0.40;
  const call = (swingK || calledK) ? Math.max(0, Math.min(1, (t - t0) / 0.20)) : 0;
  const pv = [ux, uy - 0.24, 0.80], ch = [ux, uy - 0.10, 1.10], nk = [ux, uy - 0.04, 1.20], hd = [ux + 0.04, uy + 0.10, 1.34];
  const shA = add3(nk, [0.21, 0, 0]), shB = add3(nk, [-0.21, 0, 0]);     // A = right arm (+x)
  const rest = [ux + 0.30, uy + 0.16, 0.72], up = [ux + 0.78, uy - 0.06, 1.62];
  const hA = lerp3(rest, up, call);
  return fixLimbs(body({
    pelvis: pv, chest: ch, neck: nk, head: hd,
    hipA: add3(pv, [0.14, 0, 0]), hipB: add3(pv, [-0.14, 0, 0]),
    kneeA: [ux + 0.30, uy + 0.22, 0.50], kneeB: [ux - 0.30, uy + 0.18, 0.50],
    ankleA: [ux + 0.30, uy - 0.10, 0.06], ankleB: [ux - 0.30, uy - 0.14, 0.06],
    toeA: [ux + 0.32, uy + 0.10, 0.02], toeB: [ux - 0.32, uy + 0.06, 0.02],
    shA, shB,
    elA: add3(lerp3(shA, hA, 0.5), [0.10, 0.06, -0.10]), elB: [ux - 0.32, uy + 0.10, 0.86],
    hdA: hA, hdB: [ux - 0.30, uy + 0.20, 0.70],
  }), 1.85);
}
/* ---------------- standing fielder ---------------- */
function standPose(x, y, h, ready) {
  const d = norm([-x, -y, 0]), r = [d[1], -d[0], 0];    // d = toward home, r = to the person's right
  const pv = [x, y, (ready ? 0.46 : 0.52) * h], nk = add3(pv, [d[0] * 0.05, d[1] * 0.05, (ready ? 0.34 : 0.37) * h]);
  const ch = lerp3(pv, nk, 0.65), hd = add3(nk, [d[0] * 0.04, d[1] * 0.04, 0.13 * h]);
  const spread = ready ? 0.24 : 0.14;
  const footA = add3([x, y, 0], mul3(r, spread)), footB = sub3([x, y, 0], mul3(r, spread));
  const shA = add3(nk, mul3(r, 0.19)), shB = sub3(nk, mul3(r, 0.19));
  const handA = add3(add3(shA, mul3(d, 0.22)), [0, 0, -(ready ? 0.42 : 0.55) * h * 0.55]);
  const handB = add3(add3(shB, mul3(d, 0.22)), [0, 0, -(ready ? 0.42 : 0.55) * h * 0.55]);
  const J = fixLimbs(body({
    pelvis: pv, chest: ch, neck: nk, head: hd,
    hipA: add3(pv, mul3(r, 0.12)), hipB: sub3(pv, mul3(r, 0.12)),
    kneeA: add3(lerp3(add3(pv, mul3(r, 0.12)), footA, 0.5), [d[0] * 0.08, d[1] * 0.08, 0]),
    kneeB: add3(lerp3(sub3(pv, mul3(r, 0.12)), footB, 0.5), [d[0] * 0.08, d[1] * 0.08, 0]),
    ankleA: footA, ankleB: footB, toeA: add3(footA, mul3(d, 0.18)), toeB: add3(footB, mul3(d, 0.18)),
    shA, shB, elA: add3(lerp3(shA, handA, 0.5), mul3(d, -0.08)), elB: add3(lerp3(shB, handB, 0.5), mul3(d, -0.08)), hdA: handA, hdB: handB,
  }), h);
  J.glove = J.arms[1][2];
  return J;
}

/* ---------------- scene assembly ---------------- */
const UNI = {
  pitcher: { jersey: "#b9c0c8", pants: "#c3c9d0", cap: "#1d2a44", number: "31", gloveCol: "#5a3a1e" },
  fielder: { jersey: "#b9c0c8", pants: "#c3c9d0", cap: "#1d2a44", gloveCol: "#5a3a1e" },
  batter: { jersey: "#efece2", pants: "#efece2", cap: "#8a1f2b", helmet: true, number: "9" },
  catcher: { jersey: "#b9c0c8", pants: "#c3c9d0", cap: "#1d2a44", mask: true, mitt: true, gloveCol: "#4a2f18", protector: "#2b3340", shin: "#2b3340" },
  umpire: { jersey: "#26303c", pants: "#1b2029", cap: "#12161c" },
};
function currentFig() { const ks = Object.keys(BANK.figures); return BANK.figures[String(typeof G !== "undefined" && G ? G.pitcher : ks[0])] || BANK.figures[ks[0]] }
function currentBatter() { try { return (typeof G !== "undefined" && G && typeof batter === "function") ? batter() : null } catch (e) { return null } }
function drawBallAt(g, cam, q, t, rpm) {
  const r = ball3(g, cam, q, 0.0366, "#ffffff", "rgba(0,0,0,0.5)");
  if (r && r[1] > 3.2) { const ang = (t + 1) * (rpm || 0) / 60 * 2 * Math.PI; g.strokeStyle = "#d05050"; g.lineWidth = Math.max(1, r[1] * 0.22); g.beginPath(); g.arc(r[0][0], r[0][1], r[1] * 0.66, ang, ang + 2.1); g.stroke() }
}
function drawPeople(g, cam, people, ball, t, rpm) {   // depth-sorted, the ball slotted between figures
  people.forEach(P => { P.d = depthOf(cam, P.J.pelvis) });
  people.sort((a, b) => b.d - a.d);
  const bd = ball ? depthOf(cam, ball) : -1;
  let drawn = !ball;
  people.forEach(P => { if (!drawn && P.d < bd) { drawBallAt(g, cam, ball, t, rpm); drawn = true } drawPerson(g, cam, P.J, P.o) });
  if (!drawn) drawBallAt(g, cam, ball, t, rpm);
}

/* ---------------- the body view: behind the plate, first-base side, plus a pitcher inset ---------------- */
