/* bbsim app · ballpark: rulebook geometry, near-plane clipping, cached background */
/* ---------------- ballpark + human figures (night game) ----------------
   Field coordinates: origin = rear point of home plate, +y toward the mound (front of the rubber
   at y = 18.44), +x toward first base, z up, metres. All dimensions are the rulebook ones.
   Mound: centre 18 in in front of the rubber, r 2.74 m, h 0.254 m, surface law = physics/body.py. */
const PARK = {
  fenceLine: 100, fenceCenter: 122, fenceH: 2.6, track: 4.6, backstop: 18.29,
  arcR: 28.96, rubberY: 18.44, mound: { y: 18.44 - 0.457, r: 2.74, h: 0.254 }, homeCircle: 3.96, baseSide: 0.457,
  sky0: "#060d18", sky1: "#12243a",
  grassA: "#1a4527", grassB: "#256036", grassIn: "#20522f", dirt: "#8a5c36", dirtDark: "#6f4a29",
  track_c: "#9a6b40", chalk: "#f4f1e8", wall: "#17402a", wallTop: "#e8c84f",
  seats: "#3a3740", seatsHi: "#46424c", concourse: "#5c5763", board: "#0a0f16", boardLit: "#42642e",
  tower: "#2a3340", lamp: "#fff6d8",
};
const DEG = Math.PI / 180;
const SEG = { upper: 0.186, fore: 0.20, thigh: 0.245, shank: 0.245 };   // body.py segment ratios (x height)

function groundZ(x, y) {                       // mound surface: body.py law along y, feathered at the rim
  const r = Math.hypot(x, y - PARK.mound.y);
  if (r >= PARK.mound.r) return 0;
  return Math.min(pgh(y), PARK.mound.h * Math.max(0, Math.min(1, (PARK.mound.r - r) / 1.2)));
}
function fenceR(aDeg) {                       // distance to the wall at azimuth a (0 = straight to centre)
  const f = Math.pow(Math.cos(Math.min(Math.abs(aDeg), 45) * DEG), 2);
  return PARK.fenceLine + (PARK.fenceCenter - PARK.fenceLine) * f;
}
function az(a, r, z) { return [r * Math.sin(a * DEG), r * Math.cos(a * DEG), z || 0] }
function hash01(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

function clipNear(cam, pts, closed) {          // Sutherland-Hodgman against the camera's near plane
  const eps = 0.08, out = [], n = pts.length;
  const dep = P => dot(sub3(P, cam.C), cam.f) - eps;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const A = pts[i], B = pts[(i + 1) % n], da = dep(A), db = dep(B);
    if (da >= 0) out.push(A);
    if ((da >= 0) !== (db >= 0)) out.push(lerp3(A, B, da / (da - db)));
  }
  if (!closed && n && dep(pts[n - 1]) >= 0) out.push(pts[n - 1]);
  return out;
}
function fill3(g, cam, pts, col) {
  const cp = clipNear(cam, pts, true); if (cp.length < 3) return;
  g.beginPath(); cp.forEach((P, i) => { const q = cam.proj(P); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]) });
  g.closePath(); g.fillStyle = col; g.fill();
}
function stroke3(g, cam, pts, col, w, close) {
  const cp = clipNear(cam, pts, !!close); if (cp.length < 2) return;
  g.beginPath(); cp.forEach((P, i) => { const q = cam.proj(P); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]) });
  if (close) g.closePath(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
}
function disc3(g, cam, cx, cy, r, col, zf) {   // filled circle on the ground plane
  const pts = []; for (let a = 0; a < 360; a += 12) { const x = cx + r * Math.cos(a * DEG), y = cy + r * Math.sin(a * DEG); pts.push([x, y, zf ? zf(x, y) : 0]) }
  fill3(g, cam, pts, col);
}
function ring3(g, cam, cx, cy, r, col, w) {
  const pts = []; for (let a = 0; a <= 360; a += 15) pts.push([cx + r * Math.cos(a * DEG), cy + r * Math.sin(a * DEG), 0.01]);
  stroke3(g, cam, pts, col, w, true);
}

/* ---------------- ballpark (cached to an offscreen canvas per camera) ---------------- */
let _parkCache = {};
function drawBallpark(g, cam, w, h, key) {
  const ck = (key || "body") + "|" + w + "x" + h + "|" + cam.C.map(v => v.toFixed(2)).join(",") + "|" + cam.f.map(v => v.toFixed(3)).join(",") + "|" + cam.fl.toFixed(1);
  let c = _parkCache[key];
  if (!c || c.key !== ck) {
    const ks = Object.keys(_parkCache); if (ks.length > 5) delete _parkCache[ks[0]];
    const off = document.createElement("canvas"); off.width = w; off.height = h;
    paintPark(off.getContext("2d"), cam, w, h);
    c = _parkCache[key] = { key: ck, canvas: off };
  }
  g.drawImage(c.canvas, 0, 0);
}
function paintPark(g, cam, w, h) {
  // sky
  const sg = g.createLinearGradient(0, 0, 0, h); sg.addColorStop(0, PARK.sky0); sg.addColorStop(1, PARK.sky1);
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  // horizon: projection of points at infinity on the ground plane (skipped for a straight-down camera)
  const fh0 = [cam.f[0], cam.f[1], 0];
  if (Math.hypot(fh0[0], fh0[1]) > 1e-4) {
    const fh = norm(fh0), rh = [-fh[1], fh[0], 0];
    const inf = d => { const z = dot(d, cam.f); return [w / 2 + cam.fl * dot(d, cam.r) / z, h / 2 - cam.fl * dot(d, cam.u) / z] };
    const H1 = inf(norm(add3(fh, mul3(rh, -1.2)))), H2 = inf(norm(add3(fh, mul3(rh, 1.2))));
    const hy = x => H1[1] + (H2[1] - H1[1]) * (x - H1[0]) / ((H2[0] - H1[0]) || 1);
    g.fillStyle = PARK.grassA; g.beginPath(); g.moveTo(-50, hy(-50)); g.lineTo(w + 50, hy(w + 50)); g.lineTo(w + 50, h + 50); g.lineTo(-50, h + 50); g.closePath(); g.fill();
  } else { g.fillStyle = PARK.grassA; g.fillRect(0, 0, w, h) }
  // light towers behind the stands
  [-72, -34, 34, 72].forEach(a => {
    const R = 168, base = az(a, R, 0), top = az(a, R, 44);
    const q0 = cam.proj(base), q1 = cam.proj(top); if (!q0 || !q1) return;
    g.strokeStyle = PARK.tower; g.lineWidth = Math.max(1.5, 40 / q0[2]);
    g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke();
    const bw = Math.max(6, 900 / q1[2]);
    g.fillStyle = PARK.tower; g.fillRect(q1[0] - bw / 2, q1[1] - bw * 0.30, bw, bw * 0.30);
    for (let k = 0; k < 10; k++) {
      g.fillStyle = PARK.lamp; g.globalAlpha = 0.85;
      g.fillRect(q1[0] - bw / 2 + (k % 5) * bw / 5 + 1, q1[1] - bw * 0.30 + Math.floor(k / 5) * bw * 0.15 + 1, bw / 6, bw * 0.09);
    }
    g.globalAlpha = 1;
    const gl = g.createRadialGradient(q1[0], q1[1], 2, q1[0], q1[1], bw * 3);
    gl.addColorStop(0, "rgba(255,246,216,0.20)"); gl.addColorStop(1, "rgba(255,246,216,0)");
    g.fillStyle = gl; g.beginPath(); g.arc(q1[0], q1[1], bw * 3, 0, 7); g.fill();
  });
  // seating bowl all the way round: behind the wall in fair ground, closing to ~21 m behind the plate
  const bowlR = a1 => { const aa = Math.abs(a1); return (aa <= 45 ? fenceR(a1) : Math.max(21, 100 - (100 - 21) * (aa - 45) / 135)) + 2.5 };
  for (let a = -180; a < 180; a += 4) {
    const q = [az(a, bowlR(a), 1.0), az(a + 4, bowlR(a + 4), 1.0), az(a + 4, bowlR(a + 4) + 34, 15.5), az(a, bowlR(a) + 34, 15.5)];
    fill3(g, cam, q, (Math.floor((a + 200) / 8) % 2) ? PARK.seats : PARK.seatsHi);
    fill3(g, cam, [az(a, bowlR(a) + 15, 7.4), az(a + 4, bowlR(a + 4) + 15, 7.4), az(a + 4, bowlR(a + 4) + 16.6, 8.1), az(a, bowlR(a) + 16.6, 8.1)], PARK.concourse);
  }
  // crowd
  for (let i = 0; i < 12000; i++) {
    const a = -180 + 360 * hash01(i * 3.1), t = hash01(i * 7.7);
    const P = az(a + 0.9 * (hash01(i * 5.3) - 0.5), bowlR(a) + 0.7 + t * 32, 1.3 + t * 13.6);
    const q = cam.proj(P); if (!q) continue;
    const v = hash01(i * 1.3);
    g.fillStyle = v > 0.80 ? "#eef0f4" : (v > 0.62 ? "#c9ced8" : (v > 0.40 ? "#8f96a3" : (v > 0.30 ? "#b8433e" : (v > 0.20 ? "#3b6db3" : "#5b616c"))));
    g.globalAlpha = 0.45 + 0.45 * v;
    const s2 = Math.max(1.1, 46 / q[2]);
    g.fillRect(q[0], q[1], s2, s2 * 1.25);
  }
  g.globalAlpha = 1;
  // scoreboard in centre field
  const sb = [az(-9, 143, 7), az(9, 143, 7), az(9, 143, 20), az(-9, 143, 20)];
  fill3(g, cam, sb, PARK.board); stroke3(g, cam, sb, "#3b475a", 1.5, true);
  fill3(g, cam, [az(-7.6, 142.4, 8.4), az(7.6, 142.4, 8.4), az(7.6, 142.4, 18.4), az(-7.6, 142.4, 18.4)], PARK.boardLit);
  // outfield grass: mowing wedges
  for (let a = -46; a < 46; a += 7.5) {
    const R = Math.max(fenceR(a), fenceR(a + 7.5));
    fill3(g, cam, [[0, 0, 0], az(a, R), az(a + 3.75, R), az(a + 7.5, R)], (Math.floor((a + 90) / 7.5) % 2) ? PARK.grassA : PARK.grassB);
  }
  // warning track + wall
  for (let a = -45; a < 45; a += 3) {
    const R1 = fenceR(a), R2 = fenceR(a + 3);
    fill3(g, cam, [az(a, R1 - PARK.track), az(a + 3, R2 - PARK.track), az(a + 3, R2), az(a, R1)], PARK.track_c);
    fill3(g, cam, [az(a, R1, 0), az(a + 3, R2, 0), az(a + 3, R2, PARK.fenceH), az(a, R1, PARK.fenceH)], PARK.wall);
    fill3(g, cam, [az(a, R1, PARK.fenceH * 0.62), az(a + 3, R2, PARK.fenceH * 0.62), az(a + 3, R2, PARK.fenceH * 0.70), az(a, R1, PARK.fenceH * 0.70)], "#0e2a1b");
    stroke3(g, cam, [az(a, R1, PARK.fenceH), az(a + 3, R2, PARK.fenceH)], PARK.wallTop, 2.4, false);
  }
  [-45, 45].forEach(a => { const R = fenceR(a); stroke3(g, cam, [az(a, R, PARK.fenceH), az(a, R, 13)], "#f0c53c", 2, false) });   // foul poles
  // backstop: padded wall and net 60 ft behind the plate
  const bsy = -PARK.backstop;
  fill3(g, cam, [[-11, bsy, 0], [11, bsy, 0], [11, bsy, 1.2], [-11, bsy, 1.2]], "#1d3b2a");
  stroke3(g, cam, [[-11, bsy, 1.2], [11, bsy, 1.2]], PARK.wallTop, 1.5, false);
  fill3(g, cam, [[-9, bsy, 1.2], [9, bsy, 1.2], [9, bsy, 10], [-9, bsy, 10]], "rgba(190,200,210,0.10)");
  for (let k = -9; k <= 9; k += 3) stroke3(g, cam, [[k, bsy, 1.2], [k, bsy, 10]], "rgba(190,200,210,0.22)", 1, false);
  // dugouts in foul ground, parallel to the lines
  [-1, 1].forEach(sx => {
    const u = [sx * Math.SQRT1_2, Math.SQRT1_2, 0], vv = [sx * Math.SQRT1_2, -Math.SQRT1_2, 0];
    const A = add3(mul3(u, 14), mul3(vv, 15)), B = add3(mul3(u, 26), mul3(vv, 15));
    fill3(g, cam, [A, B, add3(B, [0, 0, 1.0]), add3(A, [0, 0, 1.0])], "#141a22");
    const A2 = add3(A, mul3(vv, 3)), B2 = add3(B, mul3(vv, 3));
    fill3(g, cam, [add3(A, [0, 0, 1.0]), add3(B, [0, 0, 1.0]), add3(B2, [0, 0, 2.4]), add3(A2, [0, 0, 2.4])], "#0f141b");
  });
  // infield: dirt fan inside the 95 ft arc (centred on the rubber, meets the foul lines at 27.5 m)
  const xi = 27.5, aMax = Math.atan2(xi, xi - PARK.rubberY) / DEG;
  const fan = [[0, 0, 0], [xi, xi, 0]];
  for (let a = aMax; a > -aMax; a -= 3) fan.push([PARK.arcR * Math.sin(a * DEG), PARK.rubberY + PARK.arcR * Math.cos(a * DEG), 0]);
  fan.push([-xi, xi, 0]);
  fill3(g, cam, fan, PARK.dirt);
  const C = [0, 19.4], s = 0.89;
  const gd = [[0, 0], [19.4, 19.4], [0, 38.8], [-19.4, 19.4]].map(v => [C[0] + s * (v[0] - C[0]), C[1] + s * (v[1] - C[1]), 0]);
  fill3(g, cam, gd, PARK.grassIn);
  disc3(g, cam, 0, 0, PARK.homeCircle, PARK.dirt);
  disc3(g, cam, 0, PARK.mound.y, PARK.mound.r, PARK.dirtDark, groundZ);
  stroke3(g, cam, (() => { const o = []; for (let a = 0; a <= 360; a += 12) { const x = PARK.mound.r * Math.cos(a * DEG), y = PARK.mound.y + PARK.mound.r * Math.sin(a * DEG); o.push([x, y, groundZ(x, y)]) } return o })(), "#8a6a45", 1, true);
  // rubber (front edge at 18.44, 6 in deep), bases (sides on the baselines), plate, chalk
  fill3(g, cam, [[-0.305, PARK.rubberY, PARK.mound.h], [0.305, PARK.rubberY, PARK.mound.h], [0.305, PARK.rubberY + 0.152, PARK.mound.h], [-0.305, PARK.rubberY + 0.152, PARK.mound.h]], "#f2efe6");
  const bs = PARK.baseSide, K = 19.396, e = Math.SQRT1_2;
  [1, -1].forEach(sx => {
    const Kp = [sx * K, K], u = [sx * e, e], v = [-sx * e, e];
    disc3(g, cam, Kp[0], Kp[1], 3.9, PARK.dirt);
    const pts = [Kp, [Kp[0] - u[0] * bs, Kp[1] - u[1] * bs], [Kp[0] - u[0] * bs + v[0] * bs, Kp[1] - u[1] * bs + v[1] * bs], [Kp[0] + v[0] * bs, Kp[1] + v[1] * bs]];
    fill3(g, cam, pts.map(q => [q[0], q[1], 0.02]), "#f4f1e8");
  });
  disc3(g, cam, 0, 2 * K, 3.9, PARK.dirt);
  const hb = bs * e;
  fill3(g, cam, [[0, 2 * K + hb, 0.02], [hb, 2 * K, 0.02], [0, 2 * K - hb, 0.02], [-hb, 2 * K, 0.02]], "#f4f1e8");
  const FR = fenceR(45) * Math.SQRT1_2;
  stroke3(g, cam, [[0.09, 0.09, 0.01], [FR, FR, 0.01]], PARK.chalk, 2, false);
  stroke3(g, cam, [[-0.09, 0.09, 0.01], [-FR, FR, 0.01]], PARK.chalk, 2, false);
  fill3(g, cam, [[0, 0, 0.02], [0.216, 0.216, 0.02], [0.216, 0.432, 0.02], [-0.216, 0.432, 0.02], [-0.216, 0.216, 0.02]], "#f6f4ec");   // point toward the catcher
  [-1, 1].forEach(sx => stroke3(g, cam, [[sx * 0.366, -0.699, 0.01], [sx * 1.586, -0.699, 0.01], [sx * 1.586, 1.131, 0.01], [sx * 0.366, 1.131, 0.01]], PARK.chalk, 1.5, true));
  stroke3(g, cam, [[-0.545, -0.699, 0.01], [-0.545, -3.137, 0.01], [0.545, -3.137, 0.01], [0.545, -0.699, 0.01]], PARK.chalk, 1.5, false);
  [-1, 1].forEach(sx => ring3(g, cam, sx * 10.5, -4.2, 0.76, "#c9c2ae", 1));
}

