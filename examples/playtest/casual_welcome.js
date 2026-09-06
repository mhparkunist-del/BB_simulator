/* casual persona · pick LG 트윈스 → 부임하기 → 구단주 인사 modal (end there) */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));  // PT 상태줄을 오른쪽 아래로 (헤더 가림 방지)
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  PT.say("부임하기 → 환영 이벤트");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  const t0 = performance.now();
  PT.click("#teamStart");
  const ok = await PT.until(() => PT.visible("#eventModal"), 6000);
  PT.note("event modal after " + Math.round(performance.now() - t0) + "ms visible " + ok);
  PT.note("title: " + PT.text("#eventTitle") + " || body: " + PT.text("#eventBody").replace(/\s+/g, " "));
  PT.note("ok button " + M("#eventOk") + " modalbox " + M("#eventModal .modalbox") + " body font " + getComputedStyle(document.getElementById("eventBody")).fontSize);
  PT.note("behind modal: schedule visible " + PT.visible("#tab-schedule") + " header strip: " + PT.text("#cstrip").replace(/\s+/g, " "));
  const S = ClubUI.state(); PT.note("club " + S.club.name + " day " + S.day + " players " + S.players.length + " budget " + S.budget);
  await PT.done({ persona: "casual mobile", screen: "welcome" });
})();
