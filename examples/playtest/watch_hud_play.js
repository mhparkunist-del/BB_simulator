/* watch_hud_play: 타구 뒤 수비 장면(#scenePlay) HUD 확인용 — 인플레이 표본을 골라 장면을 켠 채 마지막 화면으로 남긴다. */
(async () => {
  window.NOCUT = true;
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 2; await document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("game").hidden, 3000);
  const GU = GameUI, G = GU.state();
  let p = null; const save = { b: G.balls, s: G.strikes, i: G.idx.us };
  outer: for (let bi = 0; bi < 9; bi++) for (const [b, s] of [[0, 0], [1, 1], [2, 2], [3, 2], [0, 2]]) for (let r = 0; r < 2; r++) { G.idx.us = bi; G.balls = b; G.strikes = s; const q = await GU.pickPitch(); if (q.result == "in_play" && q.fielding && q.fielding.events && q.fielding.events.some(e => e.kind == "throw")) { p = q; break outer } }
  G.balls = save.b; G.strikes = save.s; G.idx.us = save.i;
  if (!p) { await PT.done({ fatal: "no in-play sample" }); return }
  PT.note("sample: " + p.text);
  const tc = p.batted.flight.t[0];
  GU.setScene("play"); document.getElementById("playText").textContent = p.text; GU.drawAll(p, tc + 1.2);
  await PT.done({ persona: "관전자", text: p.text });
})();
