/* watch_views: 관전자 시점 — 투구/타격/수비/주루 장면을 여러 시점(t)과 세 뷰(중계/인체/궤적)에서 캡처한다.
   사인(번트/강공)을 걸어 타격 자세 차이도 캡처한다. 마지막 화면은 중계 뷰 투구 도중(HUD 확인용). */
(async () => {
  window.NOCUT = true;
  PT.say("타이틀 → 새로 시작");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 2; await document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("game").hidden, 3000);
  const GU = GameUI, G = GU.state();
  const view = v => document.querySelector(".viewsel [data-view=" + v + "]").click();
  const T = p => p.flight.t[p.flight.t.length - 1];
  const tC = p => (p.batted && p.batted.flight.t.length) ? p.batted.flight.t[0] : T(p);
  const cat = p => {
    if (p.result == "in_play") { const th = (p.fielding && p.fielding.events || []).some(e => e.kind == "throw"); const k = p.kind; if (k == "HR") return "hr"; if (k == "single" || k == "double" || k == "triple") return "hit"; return th ? "groundout" : "flyout" }
    if (p.result == "foul") return "foul"; if (p.result == "swinging_strike") return "swing_miss"; if (p.result == "called_strike") return "called"; if (p.result == "ball") return p.in_dirt ? "dirt" : "ball"; return p.result;
  };
  // 여러 타자·카운트에서 표본을 모아 장면 종류별로 하나씩 고른다
  const want = ["swing_miss", "called", "ball", "dirt", "foul", "groundout", "flyout", "hit", "hr"], got = {}, stats = {};
  const save = { b: G.balls, s: G.strikes, i: G.idx.us };
  let picks = 0;
  outer: for (let bi = 0; bi < 9; bi++) for (const [b, s] of [[0, 0], [1, 1], [2, 2], [3, 2], [0, 2], [3, 0]]) for (let r = 0; r < 2; r++) {
    G.idx.us = bi; G.balls = b; G.strikes = s;
    let p; try { p = await GU.pickPitch() } catch (e) { PT.note("pick fail " + e.message); continue }
    picks++; const c = cat(p); stats[c] = (stats[c] || 0) + 1;
    if (!got[c]) { got[c] = p; PT.note("sample " + c + " ← batter#" + bi + " count " + b + "-" + s + " · " + p.text) }
    if (want.every(w => got[w])) break outer;
    if (picks > 110) break outer;
  }
  PT.note("picks " + picks + " stats " + JSON.stringify(stats) + " got " + Object.keys(got).join(","));
  // 번트 사인 표본
  document.querySelector(".call[data-call=bunt]").click();
  for (let bi = 0; bi < 9 && !got.bunt; bi++) for (const [b, s] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]]) {
    G.idx.us = bi; G.balls = b; G.strikes = s; let p; try { p = await GU.pickPitch() } catch (e) { continue }
    const bk = p.swing_kind || ""; if (p.swing && (bk == "bunt" || (p.decision_note || "").indexOf("bunt") >= 0)) { got.bunt = p; PT.note("sample bunt ← batter#" + bi + " " + b + "-" + s + " · " + p.text + " · swing_kind=" + bk + " note=" + p.decision_note); break }
    if (!got.buntAny && p.swing) { got.buntAny = p; PT.note("bunt-call swing sample: " + p.text + " swing_kind=" + bk + " note=" + p.decision_note) }
  }
  document.querySelector(".call[data-call=none]").click();
  G.balls = save.b; G.strikes = save.s; G.idx.us = save.i;

  async function shotAt(label, p, t, sel) { GU.drawAll(p, t); await PT.shot(label, sel) }
  async function pitchViews(name, p) {
    if (!p) { PT.note("no sample for " + name); return }
    const Tp = T(p), tc = tC(p);
    PT.note(name + ": result=" + p.result + " kind=" + (p.kind || "-") + " T=" + Tp.toFixed(2) + " tC=" + tc.toFixed(2) + " mph=" + p.mph + " hand=" + p.batter_hand + " text=" + p.text);
    GU.setScene("pitch"); view("cam");
    for (const t of [-1.0, -0.4, 0.0, 0.2, Tp + 0.3]) await shotAt(name + "_cam_t" + t.toFixed(1), p, t, "#cam");
    await PT.shot(name + "_kz", "#kz");
    view("body");
    for (const t of [-1.0, -0.3, 0.0, 0.25, tc, Tp + 0.3]) await shotAt(name + "_body_t" + t.toFixed(2), p, t, "#body");
    view("seam");
    for (const t of [-0.5, 0.0, 0.2, Tp]) await shotAt(name + "_seam_t" + t.toFixed(1), p, t, "#seam");
    view("cam");
    if (p.fielding && p.fielding.events && p.fielding.events.length) {
      const evs = p.fielding.events; const tEnd = evs.reduce((m, e) => Math.max(m, e.t1 || 0, e.t || 0, (e.arrive && e.arrive.length) ? e.arrive[e.arrive.length - 1] : 0, e.out_t || 0), 0);
      PT.note(name + " play events: " + evs.map(e => e.kind + ":" + (e.who || e.base) + "@" + (e.t0 !== undefined ? e.t0 : e.t)).join(" "));
      GU.setScene("play");
      for (const dt of [0.5, 1.0, 1.5, 2.2, 3.0, 4.0, Math.min(tEnd + 0.3, 7)]) { await shotAt(name + "_play_tc" + dt.toFixed(1), p, tc + dt, "#play"); }
      await PT.shot(name + "_field2", "#field2");
      GU.setScene("pitch");
    }
  }
  for (const k of ["swing_miss", "called", "ball", "dirt", "foul", "groundout", "flyout", "hit", "hr", "bunt", "buntAny"]) await pitchViews(k, got[k]);
  // 마지막 화면: 중계 뷰, 스윙 직전(HUD와 함께 보이도록)
  const fin = got.swing_miss || got.foul || got.ball;
  GU.setScene("pitch"); view("cam"); GU.drawAll(fin, 0.12);
  await PT.done({ persona: "관전자", picks, stats, samples: Object.keys(got), notes: ["views captured"] });
})();
