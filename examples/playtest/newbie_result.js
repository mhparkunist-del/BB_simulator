/* newbie persona · game result: 결과 바로보기 to the end, the final break screen, then the 경기 종료 event */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note('rAF polyfilled (headless)');
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(200);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(200);
  const t0 = performance.now(); PT.click("#playFast"); await PT.wait(100);
  const fastLabel = txt("#playFast");
  const ok = await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 120000); const ms = Math.round(performance.now() - t0);
  await PT.wait(300);
  const G = GameUI.state();
  const seen = { reached: ok, ms, fastLabelWhileRunning: fastLabel, title: txt("#breakTitle"), nextUp: txt("#nextUp"), scorePage: (txt("#breakScore") || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "), resume: txt("#resume"), feedTop: [...document.querySelectorAll("#feed .l")].slice(0, 3).map(e => e.innerText.replace(/\n/g, " ")), score: G ? { us: G.score.us, them: G.score.them, inning: G.inning, total: G.total } : null };
  PT.note("결과 바로보기 " + ms + "ms · 진행 중 라벨 '" + fastLabel + "' · 제목: " + seen.title + " · 버튼: " + seen.resume);
  PT.note("점수판: " + seen.scorePage);
  PT.click("#resume"); const ev = await PT.until(() => PT.visible("#eventModal"), 4000); await PT.wait(200);
  seen.event = { shown: ev, title: txt("#eventTitle"), body: txt("#eventBody"), behindScreen: txt(".nav .on"), lockBadge: PT.visible("#lockBadge") };
  PT.note("경기 종료 이벤트: " + seen.event.title + " / " + seen.event.body);
  PT.note("초보 시선: '결과 바로보기'를 누르면 화면이 순식간에 결과로 바뀌어 무슨 일이 있었는지 모름(하이라이트 요약 없음). 점수표는 이해됨. 이벤트 '이겼습니다/졌습니다 N : M'은 명확. '정비 시간입니다'의 정비는 여기서 처음 정의 없이 나옴. 승리 보상(돈·팬)이 표시되지 않아 이겨도 뭐가 좋아졌는지 모름.");
  PT.say("경기 종료 이벤트");
  await PT.done({ persona: "야구 초보", screen: "result", seen });
})();
