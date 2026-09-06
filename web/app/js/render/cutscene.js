/* bbsim app · cutscenes on the full play view: the starter walks to the mound before the first pitch, the fielding sides
   change over between halves, and the game ends with a celebration (win) or heads-down walk (loss).
   Pure per-frame drawing (CUT.draw) plus a small player (CUT.play); a tap on the view skips. Uses the renderer globals
   (runPose, standPose, drawBallpark, camera, drawPeople, UNI). */
(function () {
  const POS = { P: [0, 18.44], C: [0, -1.6], "1B": [22, 27], "2B": [12, 43], SS: [-12, 43], "3B": [-22, 27], LF: [-40, 80], CF: [0, 97], RF: [40, 80] };
  const DUG = { us: [26, 6], them: [-26, 6] };                 // dugout mouths: ours first-base side, theirs third-base side
  const H = 1.83, $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = f => { f = clamp(f, 0, 1); return f * f * (3 - 2 * f) };
  function walk(from, to, f, spd, h) {                          // a person walking/jogging along a straight line, phase from distance covered
    const L = Math.hypot(to[0] - from[0], to[1] - from[1]), d = unit2(from, to), fe = ease(f), xy = lerp2(from, to, fe);
    if (f >= 1) return standPose(to[0], to[1], h, false);
    return withGlove(runPose(xy[0], xy[1], d, h, fe * L, spd), 1);
  }
  function cheerPose(x, y, h, up, jump) {                       // arms rising, feet leaving the ground
    const d = norm([-x, -y + 0.01, 0]), r = [d[1], -d[0], 0], z = jump * 0.30 * h;
    const pv = [x, y, 0.52 * h + z], nk = add3(pv, [0, 0, 0.37 * h]), ch = lerp3(pv, nk, 0.65), hd = add3(nk, [d[0] * 0.02, d[1] * 0.02, 0.13 * h]);
    const hipA = add3(pv, mul3(r, 0.12)), hipB = sub3(pv, mul3(r, 0.12)), ankleA = [x + r[0] * 0.16, y + r[1] * 0.16, 0.05 + z], ankleB = [x - r[0] * 0.16, y - r[1] * 0.16, 0.05 + z];
    const shA = add3(nk, mul3(r, 0.19)), shB = sub3(nk, mul3(r, 0.19)), lift = 0.34 * h * up - 0.30 * h * (1 - up);
    const hdA = add3(shA, [r[0] * 0.14, r[1] * 0.14, lift]), hdB = add3(shB, [-r[0] * 0.14, -r[1] * 0.14, lift]);
    return fixLimbs(body({ pelvis: pv, chest: ch, neck: nk, head: hd, hipA, hipB, kneeA: add3(lerp3(hipA, ankleA, 0.5), [d[0] * 0.04, d[1] * 0.04, 0]), kneeB: add3(lerp3(hipB, ankleB, 0.5), [d[0] * 0.04, d[1] * 0.04, 0]),
      ankleA, ankleB, toeA: add3(ankleA, [d[0] * 0.16, d[1] * 0.16, -0.03]), toeB: add3(ankleB, [d[0] * 0.16, d[1] * 0.16, -0.03]),
      shA, shB, elA: add3(lerp3(shA, hdA, 0.5), [r[0] * 0.12, r[1] * 0.12, 0]), elB: add3(lerp3(shB, hdB, 0.5), [-r[0] * 0.12, -r[1] * 0.12, 0]), hdA, hdB }), h);
  }
  function sadPose(x, y, h, dir) {                              // shoulders forward, head down, hands hanging
    const d = dir ? [dir[0], dir[1], 0] : norm([-x, -y + 0.01, 0]), r = [d[1], -d[0], 0];
    const pv = [x, y, 0.50 * h], nk = add3(pv, [d[0] * 0.12, d[1] * 0.12, 0.33 * h]), ch = lerp3(pv, nk, 0.6), hd = add3(nk, [d[0] * 0.12, d[1] * 0.12, 0.06 * h]);
    const hipA = add3(pv, mul3(r, 0.12)), hipB = sub3(pv, mul3(r, 0.12)), ankleA = [x + r[0] * 0.14, y + r[1] * 0.14, 0.05], ankleB = [x - r[0] * 0.14, y - r[1] * 0.14, 0.05];
    const shA = add3(nk, mul3(r, 0.18)), shB = sub3(nk, mul3(r, 0.18)), hdA = add3(shA, [d[0] * 0.04, d[1] * 0.04, -0.31 * h]), hdB = add3(shB, [d[0] * 0.04, d[1] * 0.04, -0.31 * h]);
    return fixLimbs(body({ pelvis: pv, chest: ch, neck: nk, head: hd, hipA, hipB, kneeA: add3(lerp3(hipA, ankleA, 0.5), [d[0] * 0.06, d[1] * 0.06, 0]), kneeB: add3(lerp3(hipB, ankleB, 0.5), [d[0] * 0.06, d[1] * 0.06, 0]),
      ankleA, ankleB, toeA: add3(ankleA, [d[0] * 0.16, d[1] * 0.16, -0.03]), toeB: add3(ankleB, [d[0] * 0.16, d[1] * 0.16, -0.03]),
      shA, shB, elA: add3(lerp3(shA, hdA, 0.5), [r[0] * 0.05, r[1] * 0.05, 0]), elB: add3(lerp3(shB, hdB, 0.5), [-r[0] * 0.05, -r[1] * 0.05, 0]), hdA, hdB }), h);
  }
  const KEYS = Object.keys(POS), HOME = { jersey: "#efece2", pants: "#efece2", cap: "#8a1f2b", gloveCol: "#5a3a1e" };   // the batting side in the field (no helmet, no bat)
  /* --- scene builders: return { cam, people, caption } for a time t (seconds) --- */
  function intro(t, o) {                                       // o: { pitcher, club, opp, side:"us"|"them" } — the defence walks out, the starter last
    const dug = DUG[o.side], people = [];
    KEYS.forEach((k, i) => { if (k === "P") return; const st = clamp((t - 0.12 * i) / 2.2, 0, 1); people.push({ J: walk(dug, POS[k], st, 0.6, H), o: k === "C" ? UNI.catcher : UNI.fielder }) });
    const pf = clamp((t - 0.6) / 3.0, 0, 1); people.push({ J: walk(dug, POS.P, pf, 0.35, H), o: UNI.pitcher });
    people.push({ J: standPose(0.9, -2.6, 1.85, false), o: UNI.umpire });
    const f = ease(clamp(t / 3.8, 0, 1)), C = lerp3([20, -4, 2.6], [9, 4, 2.2], f), T = lerp3([2, 14, 1.2], [0, 18.4, 1.4], f);
    return { C, T, fov: 30 - 6 * f, people, caption: t > 0.8 ? ["선발 등판", (o.pitcher || "") + (o.club ? " · " + o.club : "")] : null };
  }
  function inning(t, o) {                                      // o: { incoming:"us"|"them", inning, half } — one side jogs off, the other jogs on
    const people = [], out = o.incoming === "us" ? "them" : "us";
    KEYS.forEach((k, i) => {
      const so = clamp((t - 0.08 * i) / 1.9, 0, 1); if (so < 1) people.push({ J: walk(POS[k], DUG[out], so, 0.6, H), o: HOME });
      const si = clamp((t - 0.5 - 0.08 * i) / 2.0, 0, 1); if (si > 0) people.push({ J: walk(DUG[o.incoming], POS[k], si, 0.6, H), o: k === "C" ? UNI.catcher : (k === "P" ? UNI.pitcher : UNI.fielder) });
    });
    people.push({ J: standPose(0.9, -2.6, 1.85, false), o: UNI.umpire });
    return { C: [6, -22, 16], T: [0, 30, 1], fov: 46, people, caption: [o.inning + "회" + (o.half === "top" ? "초" : "말"), (o.incoming === "us" ? "우리 수비" : "우리 공격")] };
  }
  function ending(t, o) {                                      // o: { win, us, them, fielding:"us"|"them" } — winners gather and jump, losers walk off
    const people = [], meet = [1.5, 16], winnersField = (o.win && o.fielding === "us") || (!o.win && o.fielding === "them");
    KEYS.forEach((k, i) => {
      const fromField = POS[k], fromDug = DUG[winnersField ? "them" : "us"];
      if (winnersField) {                                      // the fielding side won: run to the mound and celebrate; losers leave the dugout area quietly
        const f = clamp((t - 0.05 * i) / 1.6, 0, 1), dest = [meet[0] + 3.2 * Math.cos(i * 0.7), meet[1] + 3.2 * Math.sin(i * 0.7)];
        if (f < 1) people.push({ J: walk(fromField, dest, f, 0.95, H), o: k === "C" ? UNI.catcher : UNI.fielder });
        else { const ph = Math.max(0, Math.sin((t - 1.6 - 0.1 * i) * 5)); people.push({ J: cheerPose(dest[0], dest[1], H, 1, ph), o: k === "C" ? UNI.catcher : UNI.fielder }) }
      } else {                                                 // the fielding side lost: heads down, walk to the dugout; the batting side pours out of its dugout
        const f = clamp((t - 0.1 * i) / 3.2, 0, 1), xy = lerp2(fromField, DUG[o.fielding], ease(f)), d = unit2(fromField, DUG[o.fielding]);
        people.push({ J: f < 1 ? withGlove(runPose(xy[0], xy[1], d, H, ease(f) * 30, 0.22), 1) : sadPose(xy[0], xy[1], H, d), o: k === "C" ? UNI.catcher : UNI.fielder });
        const g = clamp((t - 0.3 - 0.07 * i) / 1.5, 0, 1), dest = [meet[0] - 8 + 3.0 * Math.cos(i * 0.7), 6 + 3.0 * Math.sin(i * 0.7)];
        if (g < 1) people.push({ J: walk(fromDug, dest, g, 0.95, H), o: HOME });
        else { const ph = Math.max(0, Math.sin((t - 1.8 - 0.1 * i) * 5)); people.push({ J: cheerPose(dest[0], dest[1], H, 1, ph), o: HOME }) }
      }
    });
    const f = ease(clamp(t / 4, 0, 1)), C = lerp3([2, -14, 3.2], [3, -8, 2.6], f);
    return { C, T: [0.5, 12, 1.3], fov: 40, people, caption: [o.win ? "승리!" : "패배", "우리 " + o.us + " : 상대 " + o.them] };
  }
  const BUILD = { intro, inning, ending }, DUR = { intro: 4.6, inning: 3.0, ending: 4.8 };
  function draw(kind, t, o, canvasId) {
    const c = $(canvasId || "play"), g = c.getContext("2d"), w = c.width, h = c.height, S = BUILD[kind](t, o || {});
    const cam = camera(S.C, S.T, w, h, S.fov);
    drawBallpark(g, cam, w, h, "cut");
    drawPeople(g, cam, S.people, null, t, 0);
    if (S.caption) {
      g.save(); g.textAlign = "center"; g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, h - 78, w, 62);
      g.fillStyle = "#fff"; g.font = "700 26px 'Black Han Sans','Jua',sans-serif"; g.fillText(S.caption[0], w / 2, h - 46);
      g.font = "16px 'Jua','Gothic A1',sans-serif"; g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(S.caption[1] || "", w / 2, h - 24); g.restore();
    }
  }
  function play(kind, o, canvasId) {
    if (window.NOCUT) return Promise.resolve();
    return new Promise(res => {
      const c = $(canvasId || "play"); let skip = false; const onTap = () => { skip = true }; c.addEventListener("pointerdown", onTap);
      const t0 = performance.now();
      function fr(now) { const t = (now - t0) / 1000; draw(kind, t, o, canvasId); if (t < DUR[kind] && !skip) requestAnimationFrame(fr); else { c.removeEventListener("pointerdown", onTap); res() } }
      requestAnimationFrame(fr);
    });
  }
  window.CUT = { draw, play, DUR };
})();
