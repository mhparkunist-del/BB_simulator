/* bbsim app · human figure: capsule limbs, depth-sorted parts, fixed-length skeleton (IK) */
/* ---------------- human figure ---------------- */
function capsule(g, cam, A, B, rA, rB, col, edge) {
  const a = cam.proj(A), b = cam.proj(B); if (!a || !b) return;
  const wa = Math.max(1, cam.fl * rA / a[2]), wb = Math.max(1, cam.fl * rB / b[2]);
  let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const nx = -dy, ny = dx;
  g.beginPath();
  g.moveTo(a[0] + nx * wa, a[1] + ny * wa); g.lineTo(b[0] + nx * wb, b[1] + ny * wb);
  g.arc(b[0], b[1], wb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  g.lineTo(a[0] - nx * wa, a[1] - ny * wa);
  g.arc(a[0], a[1], wa, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  g.closePath(); g.fillStyle = col; g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 0.8; g.stroke() }
}
function ball3(g, cam, P, r, col, edge) {
  const q = cam.proj(P); if (!q) return; const rr = Math.max(1.2, cam.fl * r / q[2]);
  g.beginPath(); g.arc(q[0], q[1], rr, 0, 7); g.fillStyle = col; g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 0.8; g.stroke() }
  return [q, rr];
}
function depthOf(cam, P) { const q = cam.proj(P); return q ? q[2] : 1e9 }
function drawPerson(g, cam, J, o) {
  o = o || {};
  const jersey = o.jersey || "#e9e6dc", pants = o.pants || o.jersey || "#e9e6dc", skin = o.skin || "#c98d63";
  const edge = "rgba(0,0,0,0.45)";
  const parts = [];
  if (o.shadow !== false) {
    const f = J.legs[0][2], s = J.legs[1][2];
    const cx = (f[0] + s[0]) / 2, cy = (f[1] + s[1]) / 2;
    parts.push({ d: 1e8, f: () => { g.globalAlpha = 0.28; disc3(g, cam, cx, cy, 0.52, "#04120a", groundZ); g.globalAlpha = 1 } });
  }
  J.legs.forEach(L => {
    parts.push({ d: depthOf(cam, L[1]), f: () => { capsule(g, cam, L[0], L[1], 0.085, 0.062, pants, edge); capsule(g, cam, L[1], L[2], 0.062, 0.043, o.shin || pants, edge) } });
    parts.push({ d: depthOf(cam, L[2]) - 0.01, f: () => capsule(g, cam, L[2], L[3] || add3(L[2], [0, -0.16, 0.02]), 0.045, 0.035, "#20242a", edge) });
  });
  parts.push({
    d: depthOf(cam, J.chest), f: () => {
      fill3(g, cam, [J.hips[0], J.hips[1], J.shoulders[1], J.shoulders[0]], o.protector || jersey);
      capsule(g, cam, J.pelvis, J.chest, 0.135, 0.150, o.protector || jersey, edge);
      capsule(g, cam, J.shoulders[0], J.shoulders[1], 0.095, 0.095, jersey, edge);
      capsule(g, cam, J.neck, lerp3(J.neck, J.head, 0.55), 0.05, 0.05, skin, null);
      if (o.number) { const q = cam.proj(lerp3(J.chest, J.pelvis, 0.35)); if (q) { g.fillStyle = "rgba(0,0,0,0.55)"; g.font = "bold " + Math.max(6, cam.fl * 0.11 / q[2]) + "px Oswald, sans-serif"; g.textAlign = "center"; g.fillText(o.number, q[0], q[1]); g.textAlign = "start" } }
    }
  });
  J.arms.forEach(A => {
    parts.push({ d: depthOf(cam, A[1]), f: () => { capsule(g, cam, A[0], A[1], 0.058, 0.046, jersey, edge); capsule(g, cam, A[1], A[2], 0.046, 0.032, skin, edge) } });
  });
  parts.push({
    d: depthOf(cam, J.head) - 0.02, f: () => {
      const r = ball3(g, cam, J.head, 0.115, skin, edge);
      if (!r) return;
      const [q, rr] = r;
      if (o.helmet) { g.fillStyle = o.cap || "#20304a"; g.beginPath(); g.arc(q[0], q[1] - rr * 0.12, rr * 1.08, Math.PI, 0); g.fill(); g.fillRect(q[0] - rr * 1.5, q[1] - rr * 0.3, rr * 3, rr * 0.34) }
      else if (o.mask) {
        g.fillStyle = "rgba(18,22,28,0.88)"; g.beginPath(); g.arc(q[0], q[1], rr * 1.12, 0, 7); g.fill();
        g.strokeStyle = "#8a9099"; g.lineWidth = Math.max(0.8, rr * 0.10);
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(q[0] - rr, q[1] + i * rr * 0.4); g.lineTo(q[0] + rr, q[1] + i * rr * 0.4); g.stroke(); g.beginPath(); g.moveTo(q[0] + i * rr * 0.4, q[1] - rr); g.lineTo(q[0] + i * rr * 0.4, q[1] + rr); g.stroke() }
      }
      else if (o.cap !== null) { g.fillStyle = o.cap || "#20304a"; g.beginPath(); g.arc(q[0], q[1] - rr * 0.18, rr * 1.02, Math.PI, 0); g.fill(); g.fillRect(q[0] - rr * 0.2, q[1] - rr * 0.4, rr * 1.7, rr * 0.28) }
    }
  });
  if (J.glove) parts.push({ d: depthOf(cam, J.glove) - 0.03, f: () => ball3(g, cam, J.glove, o.mitt ? 0.145 : 0.125, o.gloveCol || "#6b4423", edge) });
  if (J.bat) parts.push({ d: depthOf(cam, J.bat[1]) - 0.03, f: () => { capsule(g, cam, J.bat[0], J.bat[1], 0.020, 0.034, "#c8a06a", edge) } });
  parts.sort((a, b) => b.d - a.d).forEach(P => P.f());
}
function dl(a, b, f) {
  if (typeof a === "number") return a + (b - a) * f;
  if (Array.isArray(a)) return a.map((x, i) => dl(x, b[i], f));
  return a;
}
function lerpBody(A, B, f) { const o = {}; for (const k in A) o[k] = (k in B) ? dl(A[k], B[k], f) : A[k]; return o }
function keyAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t < keys[i + 1][0]) {
      let f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
      f = f * f * (3 - 2 * f);
      return lerpBody(keys[i][1], keys[i + 1][1], f);
    }
  }
  return keys[keys.length - 1][1];
}
function body(sp) {                       // assemble the standard skeleton from side-agnostic points
  const { pelvis, chest, neck, head, hipA, hipB, kneeA, kneeB, ankleA, ankleB, toeA, toeB, shA, shB, elA, elB, hdA, hdB } = sp;
  return {
    pelvis, chest, neck, head, hips: [hipA, hipB], shoulders: [shA, shB],
    arms: [[shA, elA, hdA], [shB, elB, hdB]],
    legs: [[hipA, kneeA, ankleA, toeA], [hipB, kneeB, ankleB, toeB]],
    glove: sp.glove || null, bat: sp.bat || null,
  };
}
/* Fixed skeleton: after keyframe interpolation the hands/feet are kept within reach and the
   elbows/knees re-solved by two-link IK, so upper arm, forearm, thigh and shank never change length. */
function fixLimbs(J, h) {
  const ua = SEG.upper * h, fa = SEG.fore * h, th = SEG.thigh * h, sh = SEG.shank * h;
  J.arms = J.arms.map(A => {
    const S = A[0], H = preach(S, A[2], (ua + fa) * 0.995);
    let bend = sub3(A[1], lerp3(S, H, 0.5)); if (plen(bend) < 1e-3) bend = [0, 0, -1];
    return [S, pik2(S, H, ua, fa, bend), H];
  });
  J.legs = J.legs.map(L => {
    const Hp = L[0], A = preach(Hp, L[2], (th + sh) * 0.995);
    let bend = sub3(L[1], lerp3(Hp, A, 0.5)); if (plen(bend) < 1e-3) bend = [0, 1, 0];
    return [Hp, pik2(Hp, A, th, sh, bend), A, L[3] ? add3(A, sub3(L[3], L[2])) : null];
  });
  if (J.bat) { const u = norm(sub3(J.bat[1], J.bat[0])), knob = J.arms[0][2]; J.bat = [knob, add3(knob, mul3(u, 0.84))] }
  return J;
}
