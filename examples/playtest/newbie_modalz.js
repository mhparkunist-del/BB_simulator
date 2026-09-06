/* probe: after 정비로 돌아가기, is the 경기 종료 modal actually on top of the setup screen? */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id);
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(100);
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(150);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(150);
  PT.click("#playFast"); await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 60000); await PT.wait(150);
  PT.click("#resume");
  const probe = label => { const m = $("eventModal"); const cs = getComputedStyle(m); const r = m.getBoundingClientRect(); const top = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)); return { label, hidden: m.hidden, display: cs.display, opacity: cs.opacity, z: cs.zIndex, rect: [Math.round(r.width), Math.round(r.height)], topElAtCenter: top ? (top.id || top.className || top.tagName) : null, ptVisible: PT.visible("#eventModal"), screen: txt(".nav .on"), setupVisible: PT.visible("#screen-game"), body: (txt("#eventBody") || "").slice(0, 40) } };
  const P = []; for (const ms of [0, 300, 1000, 3000, 6000]) { await PT.wait(ms === 0 ? 50 : ms - (P.length ? [0, 300, 1000, 3000, 6000][P.length - 1] : 0)); P.push(probe(ms + "ms")); }
  P.forEach(p => PT.note("모달 상태 " + JSON.stringify(p)));
  PT.click(".nav [data-screen=schedule]"); await PT.wait(300); const after = probe("일정 탭 누른 뒤"); PT.note("모달 상태 " + JSON.stringify(after));
  PT.say("경기 종료 모달 z-order 점검");
  await PT.done({ persona: "야구 초보", screen: "modalz", probes: P, after });
})();
