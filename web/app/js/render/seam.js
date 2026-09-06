/* bbsim app · pitch-tracking view with seams, throw camera */

/* ---------------- v1.8 ball close-up: the seams from the batter's eye ----------------
   Seam curve on the unit sphere (Thompson): theta = pi/2 - (pi/2 - a) cos t, phi = t/2 + a sin 2t, a = 0.4, t in [0, 4pi).
   The ball spins about p.flight.axis at p.flight.rpm; the seam frame is set four-seam (its symmetry axis
   perpendicular to the spin axis). View: from home plate looking at the pitcher, +x right, +z up.      */
const SEAM_PTS = (() => { const o = [], a = 0.4; for (let i = 0; i < 360; i++) { const t = i / 360 * 4 * Math.PI; const th = Math.PI / 2 - (Math.PI / 2 - a) * Math.cos(t), ph = t / 2 + a * Math.sin(2 * t); o.push([Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]) } return o })();
function seamFrame(axis) {
  const e1 = norm(axis && axis.length === 3 ? axis : [1, 0, 0]);
  let ref = Math.abs(e1[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e2 = norm(cross(e1, ref)), e3 = cross(e1, e2);
  return { e1, e2, e3 };
}
function seamBall(g, cx, cy, R, axis, psi, fr) {     // ball with seams, hemisphere facing camera frame fr = {r,u,f}
  const sh = g.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R * 1.05);
  sh.addColorStop(0, "#ffffff"); sh.addColorStop(0.7, "#e6e1d6"); sh.addColorStop(1, "#8f887c");
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = sh; g.fill();
  if (R < 3) return;
  const F = seamFrame(axis), cs = Math.cos(psi), sn = Math.sin(psi);
  const pts = SEAM_PTS.map(s => {
    const u = s[0], v = s[1] * cs - s[2] * sn, wv = s[1] * sn + s[2] * cs;
    const P = [u * F.e1[0] + v * F.e3[0] + wv * F.e2[0], u * F.e1[1] + v * F.e3[1] + wv * F.e2[1], u * F.e1[2] + v * F.e3[2] + wv * F.e2[2]];
    return [dot(P, fr.r), dot(P, fr.u), -dot(P, fr.f)];                    // screen x, screen up, toward the camera
  });
  g.lineCap = "round";
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a[2] <= 0.02 || b[2] <= 0.02) continue;
    const ax = cx + a[0] * R, ay = cy - a[1] * R, bx = cx + b[0] * R, by = cy - b[1] * R;
    g.strokeStyle = "rgba(178,34,52," + (0.55 + 0.45 * Math.min(1, a[2])).toFixed(2) + ")"; g.lineWidth = Math.max(1, R * 0.028);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (i % 6 === 0 && R > 9) {
      const nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny) || 1, k = R * 0.09 / L;
      g.lineWidth = Math.max(1, R * 0.02);
      g.beginPath(); g.moveTo(ax - nx * k, ay - ny * k); g.lineTo(ax + nx * k, ay + ny * k); g.stroke();
    }
  }
}
/* the pitch flight: camera behind and above the plate (the classic pitch-tracking view), the pitcher,
   batter, catcher and umpire in frame, the ball flying in along its real trajectory with a trail of where
   it has been, the zone frame at the plate front, and a magnified inset of the ball with its seams turning
   about the real spin axis. */
function drawSeam(p, t) {
  const c = $("seam"); if (!c || !c.getContext) return; const g = c.getContext("2d"); const w = c.width, h = c.height;
  const cb = currentBatter();
  const hand = p ? p.batter_hand : ((cb && cb.hand) || "R"), side = hand === "L" ? 1 : -1;
  const bh = (cb && cb.height) ? cb.height : 1.85;
  const cam = camera([side * 0.3, -11.0, 4.6], [0.0, 10.5, 0.8], w, h, 28);
  drawBallpark(g, cam, w, h, "track" + hand);
  const zt = p ? p.zone_top : 1.05, zb = p ? p.zone_bottom : 0.5;
  const fig = currentFig(), tt = p ? t : -1.7, T = p ? p.flight.t[p.flight.t.length - 1] : 0.42, tm = p ? pitchEnd(p) : null;
  const people = [{ J: pitcherPose(fig, tt), o: UNI.pitcher }, { J: batterPose(p, tt, bh, hand), o: UNI.batter },
                  { J: catcherPose(p, tt, tm), o: UNI.catcher }, { J: umpirePose(p, tt, hand, T), o: UNI.umpire }];
  drawPeople(g, cam, people, null, t, 0);
  stroke3(g, cam, [[-0.216, 0.432, zb], [0.216, 0.432, zb], [0.216, 0.432, zt], [-0.216, 0.432, zt]], "rgba(240,235,220,0.7)", 1.2, true);
  g.fillStyle = "#5c6b60"; g.font = "11px IBM Plex Mono, monospace"; g.fillText("투구 궤적 · 포수 뒤 시점", 10, 16);
  if (!p) return;
  // trail: the path flown so far (fades with age)
  if (t > 0) {
    const tEnd = Math.min(t, T);
    for (let tau = 0; tau <= tEnd; tau += 0.010) {
      const q = interp(p.flight, tau), s = cam.proj(q); if (!s) continue;
      const age = (tEnd - tau) / Math.max(tEnd, 0.05);
      const rr = Math.max(2.0, cam.fl * 0.0366 / s[2] * 0.7);
      g.globalAlpha = 0.15 + 0.6 * (1 - age);
      g.fillStyle = "#f4f1e8"; g.beginPath(); g.arc(s[0], s[1], rr, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  // the ball now (in flight, then into the mitt)
  let q = null;
  if (t >= 0 && t <= T) q = interp(p.flight, t);
  else if (t > T && t <= tm.t) q = lerp3(p.flight.xyz[p.flight.xyz.length - 1], tm.P, (t - T) / Math.max(tm.t - T, 1e-3));
  else if (t < 0) { const pb = pitcherPose(fig, tt).ball; if (pb) q = pb }
  const psi = (p.flight.rpm || 0) / 60 * 2 * Math.PI * Math.max(0, Math.min(t, T));
  if (q) {
    const s = cam.proj(q);
    if (s) seamBall(g, s[0], s[1], Math.max(1.5, cam.fl * 0.0366 / s[2]), p.flight.axis, psi, cam);
  }
  // magnified ball inset: the seams as the camera would see them right now
  const iw = 96, x0 = w - iw - 8, y0 = 24;
  g.fillStyle = "rgba(6,13,18,0.85)"; g.fillRect(x0, y0, iw, iw); g.strokeStyle = "rgba(255,255,255,0.3)"; g.strokeRect(x0 + 0.5, y0 + 0.5, iw - 1, iw - 1);
  seamBall(g, x0 + iw / 2, y0 + iw / 2, 38, p.flight.axis, psi, cam);
  g.fillStyle = "#c9c2ae"; g.font = "10px IBM Plex Mono, monospace"; g.fillText("실밥 확대", x0 + 6, y0 + iw - 5);
  g.font = "11px IBM Plex Mono, monospace";
  const y = (t >= 0 && t <= T && q) ? q[1] : null;
  g.fillText((p.mph ? p.mph.toFixed(0) + " mph" : "") + " · " + Math.round(p.flight.rpm || 0) + " rpm · " + (t < 0 ? "릴리스 전" : (t > T ? "도달 (궤적 전체)" : (y.toFixed(1) + " m 앞"))), 10, h - 10);
}

/* ---------------- v1.8 the camera rides the throw ---------------- */
function throwCam(p, t, w, hgt) {                     // returns a camera while a throw is in flight (or just landed), else null
  const evs = playEvents(p); if (!p || !evs.length) return null;
  const tC = contactTime(p), tp = t - tC;
  const th = evs.find(e => e.kind === "throw" && tp >= e.t0 - 0.15 && tp <= e.t1) || evs.filter(e => e.kind === "throw" && tp > e.t1 && tp <= e.t1 + 1.3).pop();
  if (!th) return null;
  const d = unit2(th.from, th.to), dist = Math.hypot(th.to[0] - th.from[0], th.to[1] - th.from[1]);
  if (tp <= th.t1) {                                  // behind the ball, looking at the target (base or cutoff man)
    const bp = throwBallPos(th, Math.max(th.t0, tp)), b = bp.xy, bz = bp.z;
    const back = 6 + 0.06 * dist;
    const C = [b[0] - d[0] * back, b[1] - d[1] * back, bz + 3.0 + 0.03 * dist];
    return camera(C, [th.to[0], th.to[1], 1.0], w, hgt, 38);
  }
  const hold = Math.min(1, (tp - th.t1) / 0.4);       // the ball has arrived: settle on the base for the call
  const C = [th.to[0] - d[0] * (13 - 2 * hold), th.to[1] - d[1] * (13 - 2 * hold), 5.0];
  return camera(C, [th.to[0], th.to[1], 0.9], w, hgt, 30);
}
