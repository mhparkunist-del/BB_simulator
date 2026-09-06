/* watch_hud_pitch: 투구 도중(중계 뷰) HUD 확인용 — 주자 2명·1아웃·2-1 카운트 상태를 만들어 마지막 화면으로 남긴다. 세 뷰의 전체 화면 비율도 캔버스 캡처로 남긴다. */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);   // 헤드리스 Firefox rAF 0 fps 대체
  window.NOCUT = true;
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 2; await document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("game").hidden, 3000);
  const GU = GameUI, G = GU.state();
  // 두 구 실제 진행(자막·배지 생성) 후 상태를 꾸민다
  document.getElementById("spd").value = 10;
  for (let i = 0; i < 2 && !G.over; i++) { PT.click("#playPitch"); await PT.until(() => document.getElementById("playPitch").disabled, 1000); await PT.until(() => !document.getElementById("playPitch").disabled, 30000) }
  G.runners = [true, false, true]; G.outs = 1; G.balls = 2; G.strikes = 1; G.score.us[0] = 2;
  document.querySelector(".call[data-call=power]").click();   // feed + (다음 투구부터)
  // render는 비공개라 한 구 더 진행해 HUD를 갱신한다(카운트가 바뀌더라도 주자·아웃은 남는다)
  PT.click("#playPitch"); await PT.until(() => document.getElementById("playPitch").disabled, 1000); await PT.until(() => !document.getElementById("playPitch").disabled, 30000);
  PT.note("state after: " + G.inning + G.half + " b" + G.balls + " s" + G.strikes + " o" + G.outs + " runners " + G.runners.join(",") + " sBatter=" + PT.text("#sBatter") + " onDeck=" + PT.text("#onDeck") + " sRuns=" + PT.text("#sRuns"));
  const p = await GU.pickPitch();
  document.querySelector(".viewsel [data-view=body]").click(); GU.drawAll(p, 0.1);
  document.querySelector(".viewsel [data-view=seam]").click(); GU.drawAll(p, 0.3);
  document.querySelector(".viewsel [data-view=cam]").click(); GU.drawAll(p, 0.15);
  const r = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return id + "=" + Math.round(b.left) + "," + Math.round(b.top) + " " + Math.round(b.width) + "x" + Math.round(b.height) };
  PT.note("layout " + ["cam", "strip", "kz", "field", "feedLast", "offCalls", "playPitch", "bodyNote"].map(r).join(" | ") + " win=" + innerWidth + "x" + innerHeight);
  await PT.done({ persona: "관전자", layout: ["cam", "strip", "kz", "field", "feedLast", "offCalls", "bodyNote"].map(r) });
})();
