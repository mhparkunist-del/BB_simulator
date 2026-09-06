/* casual persona · 새로 시작 → club pick screen. name *_sel: after tapping LG 트윈스 card */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));  // PT 상태줄을 오른쪽 아래로 (헤더 가림 방지)
  const M = sel => { const el = typeof sel === "string" ? document.querySelector(sel) : sel; if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return (typeof sel === "string" ? sel : el.className) + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, "");
  PT.say("새로 시작 → 구단 고르기");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  await PT.wait(300);
  const cards = [...document.querySelectorAll("#teamCards .tc")];
  const tc = document.getElementById("teamCards");
  PT.note("cards " + cards.length + " first card " + M(cards[0]) + " hint font " + getComputedStyle(cards[0].querySelector(".hint")).fontSize);
  PT.note("teamCards box " + tc.clientWidth + "x" + tc.clientHeight + " scrollH " + tc.scrollHeight + " overflow " + getComputedStyle(tc).overflowY);
  PT.note("card0 text: " + cards[0].textContent.trim().replace(/\s+/g, " "));
  PT.note("h2: " + PT.text("#screen-team h2").replace(/\s+/g, " "));
  PT.note("teamStart disabled " + document.getElementById("teamStart").disabled + " " + M("#teamStart") + " pick hint: " + PT.text("#teamPick"));
  const lastRect = cards[cards.length - 1].getBoundingClientRect(); PT.note("last card bottom " + Math.round(lastRect.bottom) + " vs viewport " + innerHeight + (lastRect.bottom > innerHeight ? " (잘림)" : " (보임)"));
  if (v.endsWith("_sel")) {
    let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
    cards[i].click(); await PT.wait(400);
    PT.say("LG 트윈스 선택함");
    PT.note("pick text: " + PT.text("#teamPick") + " start disabled " + document.getElementById("teamStart").disabled + " theme " + JSON.stringify(APP.themeNow));
  }
  await PT.done({ persona: "casual mobile", screen: v, cards: cards.length });
})();
