/* casual persona · day 0: the 새 시즌 button next to 오늘 경기 시작 — what does it ask, does it keep my club? Also the new 뒤로 button on the club pick screen. */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  PT.say("새 시즌 버튼 · 뒤로 버튼");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team")); await PT.wait(200);
  PT.note("team screen: " + M("#teamBack") + " | " + M("#teamStart"));
  PT.click("#teamBack"); await PT.wait(300); PT.note("after 뒤로: title visible " + PT.visible("#screen-title"));
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=schedule]"); await PT.wait(200);
  PT.click(".nav [data-screen=training]"); await PT.wait(100); PT.click(".pol[data-pol=balanced]"); await PT.wait(100); PT.click(".nav [data-screen=schedule]"); await PT.wait(100);
  const S0 = ClubUI.state(); PT.note("before: club " + S0.club.name + " policy " + S0.policy + " day " + S0.day + " · " + M("#reset") + " next to " + M("#nextDay"));
  let asked = null; const origConfirm = window.confirm;
  window.confirm = msg => { asked = msg; return false; };
  PT.click("#reset"); await PT.wait(300);
  PT.note("reset with 취소: confirm text '" + asked + "' · club still " + ClubUI.state().club.name + " policy " + ClubUI.state().policy);
  window.confirm = msg => { asked = msg; return true; };
  PT.click("#reset"); await PT.wait(500);
  const S1 = ClubUI.state(); PT.note("reset with 확인: club " + S1.club.name + " policy " + S1.policy + " day " + S1.day + " players " + S1.players.length + " · event modal " + PT.visible("#eventModal") + " '" + PT.text("#eventTitle") + "' · tutorial " + PT.visible("#tutorial") + " · screen " + (document.querySelector(".nav [data-screen].on") || {}).textContent);
  window.confirm = origConfirm;
  PT.say("새 시즌 → " + S1.club.name);
  await PT.done({ persona: "casual mobile", screen: "newseason", clubKept: S1.club.name === S0.club.name, confirmText: asked });
})();
