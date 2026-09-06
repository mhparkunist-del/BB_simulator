/* newbie persona · after the game ends: where am I, does the event modal show, can the same game be replayed?
   plus: 결과 바로보기 with the default seed twice (same score?) and once with seed 7 */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id);
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const strip = () => [...document.querySelectorAll("#cstrip .s")].map(e => e.innerText.replace(/\n/g, "=")).join(" · ");
  const seen = { games: [] };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(100);
  async function playFast(seed) {
    for (let k = 0; k < 6 && txt("#nextDay") !== "오늘 경기 시작"; k++) { PT.click("#nextDay"); await PT.wait(120) }
    const date = txt("#tDate");
    PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(150);
    if (seed !== undefined) $("seed").value = seed;
    const pre = { date, note: txt("#gameDayNote"), seed: $("seed").value, inn: $("innings").value, startDisabled: $("start").disabled, order: txt("#order") };
    if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
    PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(150);
    PT.click("#playFast"); await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 60000); await PT.wait(150);
    const G = GameUI.state(); const sc = G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0);
    const title = txt("#breakTitle"), resume = txt("#resume"), opp = txt("#breakScore");
    PT.click("#resume");
    const t0 = performance.now(); let firstSeen = null, lastSeen = null;
    while (performance.now() - t0 < 3000) { if (PT.visible("#eventModal")) { if (firstSeen === null) firstSeen = Math.round(performance.now() - t0); lastSeen = Math.round(performance.now() - t0) } await PT.wait(50) }
    const post = { modalFirstSeenMs: firstSeen, modalLastSeenMs: lastSeen, modalVisibleNow: PT.visible("#eventModal"), eventTitle: txt("#eventTitle"), eventBody: (txt("#eventBody") || "").replace(/\n/g, " "), screen: txt(".nav .on"), gameHidden: $("game").hidden, setupVisible: PT.visible("#screen-game"), setupNote: txt("#gameDayNote"), startDisabled: $("start").disabled, lock: PT.visible("#lockBadge"), strip: strip() };
    if (PT.visible("#eventModal")) { PT.click("#eventOk"); await PT.wait(250) }
    post.afterOkScreen = txt(".nav .on"); post.afterOkNextDay = txt("#nextDay"); post.afterOkStrip = strip(); post.afterOkSetupVisible = PT.visible("#screen-game");
    return { pre, sc, title, resume, scoreLine: (opp || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "), post };
  }
  const g1 = await playFast(); seen.games.push(g1); PT.note("1경기: " + JSON.stringify(g1));
  if (PT.visible("#screen-game")) PT.note("GUESS: 경기가 끝났는데 다시 '플레이 볼' 화면이라 한 번 더 해야 하는 줄 알았음 (안내문: " + txt("#gameDayNote") + ")");
  PT.click(".nav [data-screen=schedule]"); await PT.wait(150);
  const g2 = await playFast(); seen.games.push(g2); PT.note("2경기(시드 그대로): " + JSON.stringify(g2));
  PT.click(".nav [data-screen=schedule]"); await PT.wait(150);
  const g3 = await playFast(7); seen.games.push(g3); PT.note("3경기(시드 7): " + JSON.stringify(g3));
  seen.sameScore12 = g1.sc === g2.sc; seen.sameScore13 = g1.sc === g3.sc;
  PT.note("점수 1/2/3경기: " + [g1.sc, g2.sc, g3.sc].join(" / ") + " · 1=2? " + seen.sameScore12 + " · 1=3? " + seen.sameScore13 + " · 시드 " + [g1.pre.seed, g2.pre.seed, g3.pre.seed].join("/"));
  PT.click(".nav [data-screen=schedule]"); await PT.wait(150);
  seen.sched = [...document.querySelectorAll("#schedule tr")].slice(1, 5).map(r => r.innerText.replace(/\t/g, " | "));
  seen.log = (txt("#log") || "").split("\n").slice(0, 6);
  PT.note("일정: " + seen.sched.join(" ‖ ")); PT.note("일지: " + seen.log.join(" ‖ "));
  PT.say("경기 후 흐름 점검 · 3경기");
  await PT.done({ persona: "야구 초보", screen: "postgame", seen });
})();
