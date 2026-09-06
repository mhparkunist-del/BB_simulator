/* newbie persona · back on the schedule after the first game: did the record/rank/money change and can I tell? */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note('rAF polyfilled (headless)');
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const strip = () => [...document.querySelectorAll("#cstrip .s")].map(e => e.innerText.replace(/\n/g, "=")).join(" · ");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  const before = strip();
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(200);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(200);
  PT.click("#playFast"); await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 120000); await PT.wait(200);
  const score = (() => { const G = GameUI.state(); return G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0) })();
  PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 4000); PT.click("#eventOk"); await PT.wait(400);
  const seen = { score, stripBefore: before, stripAfter: strip(), screen: txt(".nav .on"), nextDay: txt("#nextDay"), nextGame: txt("#nextGame"), schedRow1: txt("#schedule tr:nth-child(2)"), log: (txt("#log") || "").split("\n").slice(0, 4), lock: PT.visible("#lockBadge") };
  PT.note("경기 전 스트립: " + seen.stripBefore);
  PT.note("경기 후 스트립: " + seen.stripAfter + " · 버튼 '" + seen.nextDay + "'");
  PT.note("일정 1행: " + (seen.schedRow1 || "").replace(/\t/g, " | ") + " · 일지: " + seen.log.join(" ‖ "));
  PT.note("초보 시선: REC 1-0, RANK 1위 / 6 로 바뀐 건 눈에 띔. 그런데 BUDGET은 그대로(입장 수입이 '다음 날'을 눌러야 들어옴) → 이겨도 돈이 안 들어온 것처럼 보임. 일정 표에서 '승 4:2 · 양현종 3이닝 2자책'의 '자책' 뜻 모름. 이제 '다음 날'을 누르면 되는 건 버튼이 바뀌어서 알 수 있음.");
  PT.say("첫 경기 뒤 일정 화면");
  await PT.done({ persona: "야구 초보", screen: "after-result", seen });
})();
