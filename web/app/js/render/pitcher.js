/* bbsim app · pitcher delivery by forward kinematics from the bank's release joints */
/* ---------------- pitcher delivery ----------------------------------------
   Poses are built by forward kinematics from scalar channels (angles, pelvis,
   ankles), never by lerping joint coordinates, so every segment keeps a fixed
   length. The t = 0 posture is reconstructed exactly from the five trustworthy
   joints of the figure bank (release, shoulder, pelvis, front_foot, rear_foot);
   elbow / shoulder_c / shoulder_g / glove / head in that bank are build-time
   approximations and are ignored here.
   t = 0 is ball release; t < 0 wind-up, t > 0 follow-through.              */
const PSEG = { thigh: 0.245, shank: 0.245, trunk: 0.29, upper: 0.186, fore: 0.20, shHalf: 0.13, head: 0.13, hipHalf: 0.06 };
const PRUB = 0.254;                                   // mound height at the rubber (m)
const PFIG_DEF = {                                    // used when BANK.figures has no entry (profile B)
  hand: "R", height: 1.85, arm_angle: 32.0, rubber_y: 18.44,
  joints: { release: [-0.514, 16.495, 1.668], shoulder: [-0.095, 16.995, 1.406], pelvis: [-0.111, 17.321, 0.917], front_foot: [0.074, 16.886, 0.137], rear_foot: [-0.093, 17.818, 0.270] },
};
function pss(f) { f = f < 0 ? 0 : (f > 1 ? 1 : f); return f * f * (3 - 2 * f) }
function pkey(K, t) {                                 // smoothstep key table; values are numbers or [x,y,z]
  const n = K.length;
  if (t <= K[0][0]) return K[0][1];
  if (t >= K[n - 1][0]) return K[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    if (t < K[i + 1][0]) {
      const f = pss((t - K[i][0]) / (K[i + 1][0] - K[i][0])), a = K[i][1], b = K[i + 1][1];
      return (typeof a === "number") ? a + (b - a) * f : lerp3(a, b, f);
    }
  }
  return K[n - 1][1];
}
function plen(a) { return Math.hypot(a[0], a[1], a[2]) }
function pik2(A, B, l1, l2, bend) {                   // two-link IK: joint between A and B, elbow/knee toward `bend`
  const d = sub3(B, A); let L = plen(d); const dh = mul3(d, 1 / Math.max(L, 1e-9));
  L = Math.min(L, l1 + l2 - 1e-4);
  const q = (l1 * l1 - l2 * l2 + L * L) / (2 * L), hh = Math.sqrt(Math.max(0, l1 * l1 - q * q));
  let p = sub3(bend, mul3(dh, dot(bend, dh)));
  p = (plen(p) > 1e-6) ? norm(p) : [0, -1, 0];
  return add3(add3(A, mul3(dh, q)), mul3(p, hh));
}
function pgh(y) { return Math.max(0, Math.min(PRUB, PRUB - Math.max(0, 18.288 - y) * 0.0833)) }   // mound surface, same law as body.py
function preach(A, B, r) { const d = sub3(B, A), L = plen(d); return L <= r ? B : add3(A, mul3(d, r / L)) }

function pitcherPose(fig, t) {
  fig = (fig && fig.joints && fig.joints.release) ? fig : PFIG_DEF;
  const J = fig.joints, h = fig.height || 1.85, side = (fig.hand === "L") ? 1 : -1;   // +x is the throwing side for a lefty
  const ry = fig.rubber_y || 18.44, G = PRUB, D = Math.PI / 180;
  const Pr = J.pelvis, Sr = J.shoulder, Rr = J.release;
  const Af0 = [J.front_foot[0], J.front_foot[1], J.front_foot[2] + 0.04];             // ankle sits 4 cm above the foot mark
  const Ar0 = [J.rear_foot[0], J.rear_foot[1], J.rear_foot[2]];
  const trunk = PSEG.trunk * h, shH = PSEG.shHalf * h, ua = PSEG.upper * h, fa = PSEG.fore * h;
  const thL = PSEG.thigh * h, shL = PSEG.shank * h, leg = thL + shL, hipH = PSEG.hipHalf * h;

  /* --- 1. invert the release posture into the scalars body.py used --- */
  const dsv = sub3(Sr, Pr), sHat = [side, 0, 0];
  let u = norm(dsv), e = [0, 0, 0];
  for (let i = 0; i < 6; i++) {                       // trunk axis: shoulder = pelvis + trunk*u + shHalf*e
    e = norm(sub3(sHat, mul3(u, dot(sHat, u))));
    u = norm(mul3(sub3(dsv, mul3(e, shH)), 1 / trunk));
  }
  const clamp1 = (x) => x < -1 ? -1 : (x > 1 ? 1 : x);
  const lamR = Math.asin(clamp1(-u[1])) / D;                                          // forward trunk lean
  const tauR = Math.asin(clamp1(-side * u[0] / Math.max(Math.cos(lamR * D), 1e-6))) / D;   // lateral trunk tilt
  const El0 = pik2(Sr, Rr, ua, fa, [0, 1, 0]);        // elbow bends away from the plate
  const a0 = norm(sub3(El0, Sr));
  const fwdR = Math.asin(clamp1(-a0[1])) / D;         // upper arm angle toward the plate
  const F0 = mul3(sub3(a0, [0, -Math.sin(fwdR * D), 0]), 1 / Math.max(Math.cos(fwdR * D), 1e-6));
  const thR = Math.atan2(F0[2], side * F0[0]) / D;    // frontal-plane arm slot (= fig.arm_angle)
  const fore0 = norm(sub3(Rr, El0));
  const phiR = Math.acos(clamp1(dot(a0, fore0))) / D; // elbow flexion (20 deg by construction)
  const b1r = mul3(norm(cross(u, a0)), side), b2r = cross(a0, b1r);
  const rhoR = side * Math.atan2(dot(fore0, b2r), dot(fore0, b1r)) / D;               // forearm roll, mirrored for lefties
  const abdR = thR - tauR + 90;

  /* --- 2. scalar channels (deg) --- */
  const psiP = pkey([[-1.70, 90], [-1.35, 76], [-0.90, 30], [-0.765, 8], [-0.55, 10], [-0.35, 26], [-0.162, 48], [-0.09, 78], [-0.036, 88], [0, 90], [0.09, 93], [0.35, 108], [0.90, 95]], t);
  const psiS = pkey([[-1.70, 90], [-1.35, 72], [-0.90, 25], [-0.765, 5], [-0.55, 3], [-0.35, 6], [-0.162, 12], [-0.09, 45], [-0.036, 75], [0, 90], [0.09, 95], [0.35, 118], [0.90, 95]], t);
  const tau = pkey([[-1.70, 0], [-0.90, -4], [-0.765, -5], [-0.55, -8], [-0.35, -6], [-0.162, 0.35 * tauR], [-0.036, 0.85 * tauR], [0, tauR], [0.09, tauR + 4], [0.35, tauR - 6], [0.90, 5]], t);
  const lam = pkey([[-1.70, 3], [-0.90, 0], [-0.765, -5], [-0.55, -8], [-0.35, -2], [-0.162, 0.30 * lamR], [-0.036, 0.75 * lamR], [0, lamR], [0.09, lamR + 18], [0.35, Math.min(lamR + 35, 80)], [0.90, 12]], t);
  const abd = pkey([[-1.70, 15], [-0.90, 20], [-0.765, 25], [-0.55, 30], [-0.35, 62], [-0.162, 88], [-0.09, 92], [-0.036, abdR + 4], [0, abdR], [0.09, abdR - 15], [0.35, 35], [0.90, 25]], t);
  const fwd = pkey([[-1.70, 60], [-0.90, 50], [-0.765, 45], [-0.55, -30], [-0.35, -35], [-0.162, -22], [-0.09, -8], [-0.036, 8], [0, fwdR], [0.09, fwdR + 30], [0.35, fwdR + 55], [0.90, 40]], t);
  const phi = pkey([[-1.70, 75], [-0.90, 80], [-0.765, 85], [-0.55, 45], [-0.35, 60], [-0.162, 90], [-0.09, 93], [-0.036, 95], [0, phiR], [0.09, 15], [0.35, 55], [0.90, 70]], t);
  const rho = pkey([[-1.70, 250], [-0.90, 239], [-0.765, 237], [-0.55, 236], [-0.35, 243], [-0.26, 116], [-0.162, 95], [-0.09, 25], [-0.036, 0], [0, rhoR], [0.09, 172], [0.35, 210], [0.90, 150]], t);

  /* --- 3. pelvis and ankles --- */
  const xr = Ar0[0] + side * 0.03;
  const px = pkey([[-1.70, xr], [-0.765, xr], [-0.35, Pr[0]], [0, Pr[0]], [0.35, Pr[0] - side * 0.20], [0.90, Pr[0] - side * 0.30]], t);
  const fr = pkey([[-1.70, 0], [-0.90, 0], [-0.765, 0.017], [-0.55, 0.14], [-0.35, 0.475], [-0.26, 0.64], [-0.162, 0.833], [-0.09, 0.917], [-0.036, 0.97], [0, 1.0], [0.09, 1.10], [0.35, 1.27], [0.90, 1.35]], t);
  const pz = pkey([[-1.70, G + 0.88], [-0.90, G + 0.86], [-0.765, G + 0.88], [-0.55, G + 0.84], [-0.35, G + 0.77], [-0.162, Pr[2] - 0.13], [-0.09, Pr[2] - 0.06], [-0.036, Pr[2] - 0.02], [0, Pr[2]], [0.09, Pr[2] + 0.02], [0.35, Pr[2] - 0.02], [0.90, Pr[2] + 0.01]], t);
  const P = [px, 18.52 - fr * (18.52 - Pr[1]), pz];
  const Ar = pkey([[-1.70, [Ar0[0], ry + 0.02, G + 0.06]], [-0.90, [Ar0[0], ry + 0.02, G + 0.06]], [-0.55, [Ar0[0], ry + 0.01, G + 0.07]], [-0.35, [Ar0[0], ry - 0.02, G + 0.10]], [-0.162, [Ar0[0], ry - 0.08, G + 0.13]], [0, Ar0], [0.09, [Ar0[0] - side * 0.25, 17.55, 0.42]], [0.35, [Ar0[0] - side * 0.62, 17.15, 0.42]], [0.90, [Af0[0] - side * 0.50, 16.80, pgh(16.80) + 0.05]]], t);
  let Af = pkey([[-1.70, [Ar0[0] - side * 0.18, ry + 0.18, G + 0.05]], [-0.90, [Ar0[0] - side * 0.18, ry + 0.18, G + 0.05]], [-0.35, [Ar0[0] - side * 0.06, 17.85, G + 0.34]], [-0.26, [Af0[0], 17.35, 0.42]], [-0.162, Af0], [0.90, Af0]], t);
  const sp = [side * Math.sin(psiP * D), Math.cos(psiP * D), 0];        // pelvis line, toward the throwing side
  const fp = [side * Math.cos(psiP * D), -Math.sin(psiP * D), 0];       // pelvis facing
  const w = Math.max(0, Math.min(1, (t + 0.95) / 0.12)) * Math.max(0, Math.min(1, (-0.42 - t) / 0.13));
  if (w > 0) {                                        // leg lift: hang the front ankle off the hip so the thigh stays level
    const hf0 = sub3(P, mul3(sp, hipH));
    Af = lerp3(Af, add3(add3(hf0, mul3(fp, 0.34)), [0, 0, -0.40]), w);
  }
  let hipR = add3(P, mul3(sp, hipH)), hipF = sub3(P, mul3(sp, hipH));
  for (let i = 0; i < 14; i++) {                      // drop the pelvis until both legs can reach (body.py rule)
    hipR = add3(P, mul3(sp, hipH)); hipF = sub3(P, mul3(sp, hipH));
    const st = Math.max(plen(sub3(Ar, hipR)), plen(sub3(Af, hipF))) / leg;
    if (st <= 1.0) break;
    P[2] -= (st - 1.0) * leg * 1.5 + 0.005;
  }

  /* --- 4. trunk frame --- */
  const s0 = [side * Math.sin(psiS * D), Math.cos(psiS * D), 0];        // shoulder line, toward the throwing side
  const f0 = [side * Math.cos(psiS * D), -Math.sin(psiS * D), 0];       // chest facing
  const tr = tau * D, lr = lam * D;
  const U = norm(add3(add3(mul3(s0, -Math.sin(tr) * Math.cos(lr)), mul3(f0, Math.sin(lr))), [0, 0, Math.cos(lr) * Math.cos(tr)]));
  const E = norm(sub3(s0, mul3(U, dot(s0, U))));
  const shC = add3(P, mul3(U, trunk)), shT = add3(shC, mul3(E, shH)), shG = sub3(shC, mul3(E, shH));

  /* --- 5. throwing arm --- */
  const th = ((abd - 90) + tau) * D, fw = fwd * D;
  const Fv = add3(mul3(s0, Math.cos(th)), [0, 0, Math.sin(th)]);
  const av = norm(add3(mul3(Fv, Math.cos(fw)), mul3(f0, Math.sin(fw))));
  let elbow = add3(shT, mul3(av, ua));
  const B1 = mul3(norm(cross(U, av)), side), B2 = cross(av, B1), rr = side * rho * D;
  const fv = norm(add3(mul3(av, Math.cos(phi * D)), mul3(add3(mul3(B1, Math.cos(rr)), mul3(B2, Math.sin(rr))), Math.sin(phi * D))));
  let hand = add3(elbow, mul3(fv, fa));

  /* --- 6. glove arm --- */
  const oE = pkey([[-1.70, [0.20, -0.02, -0.30]], [-0.90, [0.24, -0.02, -0.20]], [-0.765, [0.26, -0.02, -0.10]], [-0.62, [0.24, -0.02, -0.16]]], t);
  const oL = pkey([[-0.45, [0.16, -0.28, -0.14]], [-0.35, [0.05, -0.45, -0.05]], [-0.162, [0.00, -0.62, 0.04]], [-0.036, [-0.10, -0.45, 0.00]], [0, [0.05, -0.22, -0.10]], [0.09, [0.00, -0.05, -0.28]], [0.35, [0.10, -0.05, -0.35]], [0.90, [0.25, 0.00, -0.10]]], t);
  const off = (o, base) => add3(add3(add3(base, mul3(f0, o[0])), mul3(s0, o[1])), [0, 0, o[2]]);
  let gHand = lerp3(off(oE, shC), off(oL, shG), pss((t + 0.62) / 0.17));
  gHand = preach(shG, gHand, (ua + fa) * 0.98);
  const gElbow = pik2(shG, gHand, ua, fa, [0, 0, -1]);

  /* --- 7. hands together before the break --- */
  if (t < -0.46) {
    const m = 1 - pss((t + 0.62) / 0.16);
    const tog = preach(shT, add3(add3(gHand, mul3(f0, 0.02)), [0, 0, -0.05]), (ua + fa) * 0.98);
    const ch = norm(sub3(hand, shT)), eo = sub3(elbow, shT);
    let bf = sub3(eo, mul3(ch, dot(eo, ch)));
    const bt = norm(add3(mul3(U, -0.7), mul3(s0, 0.6)));
    bf = (plen(bf) > 1e-6) ? norm(bf) : bt;
    hand = lerp3(hand, tog, m);
    elbow = pik2(shT, hand, ua, fa, add3(mul3(bf, 1 - m), mul3(bt, m)));   // continuous at t = -0.46
  }

  /* --- 8. legs, head, feet --- */
  const kneeF = pik2(hipF, Af, thL, shL, (w > 0) ? norm(add3(fp, [0, 0, 0.30 * w])) : fp);
  const kneeR = pik2(hipR, Ar, thL, shL, norm(sub3(fp, [0, 0, 0.35])));
  const head = add3(shC, mul3(norm(add3(mul3(U, 0.55), [0, 0, 0.45])), PSEG.head * h));
  const neck = add3(shC, mul3(U, 0.02 * h)), chest = add3(P, mul3(U, 0.17 * h));
  const tdF = norm([side * 0.18, -1, 0]);
  const toeF = add3(add3(Af, mul3(tdF, 0.16)), [0, 0, -0.04]);
  const toeR = add3(add3(Ar, mul3(fp, 0.16)), [0, 0, -0.04]);

  /* --- 9. standard skeleton (throwing side = T, glove side = L/R accordingly) --- */
  const TH = (fig.hand === "L") ? "L" : "R", GLV = (TH === "L") ? "R" : "L";
  const out = {
    head: head, neck: neck, chest: chest, pelvis: P,
    glove: gHand, facing: f0, mask: false,
    throwSide: TH, ball: (t < -0.62 || t >= 0) ? null : hand,
    hips: [hipR, hipF], shoulders: [shT, shG],
    arms: [[shT, elbow, hand], [shG, gElbow, gHand]],
    legs: [[hipR, kneeR, Ar, toeR], [hipF, kneeF, Af, toeF]],
  };
  out["shoulder" + TH] = shT; out["elbow" + TH] = elbow; out["hand" + TH] = hand;
  out["shoulder" + GLV] = shG; out["elbow" + GLV] = gElbow; out["hand" + GLV] = gHand;
  out["hip" + TH] = hipR; out["knee" + TH] = kneeR; out["ankle" + TH] = Ar; out["toe" + TH] = toeR;
  out["hip" + GLV] = hipF; out["knee" + GLV] = kneeF; out["ankle" + GLV] = Af; out["toe" + GLV] = toeF;
  return out;
}
