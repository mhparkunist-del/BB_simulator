/* newbie persona · after 정비로 돌아가기: how long until the 경기 종료 modal shows, and what happens if 플레이 볼 is pressed again meanwhile.
   Also: which starter is pre-selected for the next game (rotation / fatigue). */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id);
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const strip = () => [...document.querySelectorAll("#cstrip .s")].map(e => e.innerText.replace(/\n/g, "=")).join(" · ");
  const S = () => ClubUI.state(); const rot = () => { const s = S(); return { rotIdx: s.rotIdx, rotation: s.rotation.map(id => { const p = s.players.find(x => x.id === id); return p ? p.name + "(" + Math.round(p.fatigue) + "%)" : "?" }) } };
  const seen = {};
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(100);
  seen.rot0 = rot();
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(150);
  seen.pitcher1 = txt("[data-p].on b, [data-p].sel b") || txt("#pitchers .on") || null; seen.pitcherCardsOn = [...document.querySelectorAll("[data-p]")].filter(e => e.className.match(/on|sel/)).map(e => e.innerText.split("\n")[0]);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(150);
  PT.click("#playFast"); await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 60000); await PT.wait(150);
  const sc1 = (() => { const G = GameUI.state(); return G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0) })();
  const rec0 = strip();
  PT.click("#resume"); const t0 = performance.now();
  // press 플레이 볼 again right away if the setup screen is showing
  await PT.wait(300);
  seen.rightAfterResume = { setupVisible: PT.visible("#screen-game"), modal: PT.visible("#eventModal"), startDisabled: $("start").disabled, note: txt("#gameDayNote"), strip: strip(), lock: PT.visible("#lockBadge"), gameHidden: $("game").hidden };
  PT.note("정비로 돌아가기 0.3초 뒤: " + JSON.stringify(seen.rightAfterResume));
  let second = null;
  if (PT.visible("#screen-game") && !$("start").disabled && !PT.visible("#eventModal")) {
    PT.note("GUESS: 아직 안내가 없어서 '플레이 볼'을 한 번 더 누름");
    PT.click("#start"); await PT.wait(400);
    second = { gameShown: !$("game").hidden, inn: txt("#sInn"), runs: txt("#sRuns"), feedTop: [...document.querySelectorAll("#feed .l")].slice(0, 2).map(e => e.innerText.replace(/\n/g, " ")), modal: PT.visible("#eventModal") };
    PT.note("두 번째 플레이 볼: " + JSON.stringify(second));
    if (!$("game").hidden) { PT.click("#playFast"); await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 60000); await PT.wait(150); second.sc = (() => { const G = GameUI.state(); return G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0) })(); PT.click("#resume"); await PT.wait(300); second.stripAfter = strip(); second.rot = rot(); }
  }
  let first = null; const tA = performance.now();
  while (performance.now() - tA < 15000) { if (PT.visible("#eventModal")) { first = Math.round(performance.now() - t0); break } await PT.wait(100) }
  seen.modalDelayMs = first; seen.modalBody = (txt("#eventBody") || "").replace(/\n/g, " ");
  PT.note("경기 종료 모달이 보이기까지 " + first + "ms (정비로 돌아가기 기준) · 본문: " + seen.modalBody);
  if (PT.visible("#eventModal")) { PT.click("#eventOk"); await PT.wait(300) }
  seen.final = { screen: txt(".nav .on"), strip: strip(), sched: [...document.querySelectorAll("#schedule tr")].slice(1, 4).map(r => r.innerText.replace(/\t/g, " | ")), log: (txt("#log") || "").split("\n").slice(0, 4), rot: rot(), nextGame: (txt("#nextGame") || "").replace(/\n/g, " ") };
  PT.note("최종: " + JSON.stringify(seen.final));
  seen.sc1 = sc1; seen.second = second; seen.rec0 = rec0;
  PT.say("경기 후 재시작 점검");
  await PT.done({ persona: "야구 초보", screen: "replay", seen });
})();
