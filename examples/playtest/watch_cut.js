/* watch_cut: 장면 연출(선발 등판·이닝 교체·승패) 프레임 캡처 + 실제 흐름에서 이닝 교체 연출이 나오는지와 소요 시간. 마지막 화면은 이닝 교체 화면. */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);   // 헤드리스 Firefox는 load 전 rAF가 오지 않아(0 fps) 연출이 멈춘다 → 대체
  window.NOCUT = false;
  PT.say("타이틀 → 새로 시작");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 1; document.getElementById("seed").value = 3;
  const t0 = performance.now();
  const startP = document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("scenePlay").hidden, 3000);
  await PT.wait(1200); await PT.shot("live_intro_a", "#play");
  await PT.wait(1500); await PT.shot("live_intro_b", "#play");
  await startP; const introMs = Math.round(performance.now() - t0);
  PT.note("intro cutscene (start.onclick) took " + introMs + " ms; scenePlay hidden now=" + document.getElementById("scenePlay").hidden);
  const GU = GameUI, G = GU.state();
  GU.setScene("play");
  const opp = (APP.roster.oppClub && APP.roster.oppClub.name) || "상대";
  for (const t of [0.3, 1.2, 2.6, 4.2]) { CUT.draw("intro", t, { pitcher: "양현종", club: "KIA 타이거즈", side: "them" }); await PT.shot("intro_t" + t.toFixed(1), "#play") }
  for (const t of [0.2, 1.0, 1.8, 2.9]) { CUT.draw("inning", t, { incoming: "us", inning: 1, half: "bottom" }); await PT.shot("inning_us_t" + t.toFixed(1), "#play") }
  CUT.draw("inning", 1.5, { incoming: "them", inning: 2, half: "top" }); await PT.shot("inning_them_t1.5", "#play");
  for (const t of [0.5, 1.6, 3.1, 4.6]) { CUT.draw("ending", t, { win: true, us: 5, them: 3, fielding: "us" }); await PT.shot("ending_win_t" + t.toFixed(1), "#play") }
  for (const t of [1.6, 3.1, 4.6]) { CUT.draw("ending", t, { win: false, us: 2, them: 6, fielding: "us" }); await PT.shot("ending_loss_t" + t.toFixed(1), "#play") }
  CUT.draw("ending", 3.1, { win: true, us: 5, them: 3, fielding: "them" }); await PT.shot("ending_win_fieldthem_t3.1", "#play");
  GU.setScene("pitch"); GU.drawAll(null, -2);
  // 실제 흐름: 1회초를 10배속으로 진행 → 이닝 교체 연출 → 교체 화면
  document.getElementById("spd").value = 10;
  const t1 = performance.now(); PT.click("#playInning");
  const sawCut = await PT.until(() => !document.getElementById("scenePlay").hidden && GameUI.state().half === "bottom", 90000);
  const tCut = Math.round(performance.now() - t1);
  if (sawCut) { await PT.shot("live_inning_cut_a", "#play"); await PT.wait(900); await PT.shot("live_inning_cut_b", "#play") }
  await PT.until(() => PT.visible("#sceneBreak"), 30000);
  const tBreak = Math.round(performance.now() - t1);
  PT.note("half inning at 10x: cut seen=" + sawCut + " at " + tCut + " ms, break screen at " + tBreak + " ms, pitches=" + G.pitches.them + " outs=" + G.outs + " half=" + G.half);
  PT.note("break title: " + PT.text("#breakTitle") + " | nextUp: " + PT.text("#nextUp") + " | page: " + PT.text("#breakPageNo"));
  const feedLines = [...document.querySelectorAll("#feed .l")].map(l => l.textContent.trim());
  PT.note("feed lines " + feedLines.length + "\n" + feedLines.slice(0, 40).join("\n"));
  await PT.done({ persona: "관전자", introMs, sawCut, tCut, tBreak, feed: feedLines });
})();
