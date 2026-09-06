/* casual persona · after tutorial skip, the schedule screen. name *_nextday: press the big button once and record where it goes; *_navgame: tap nav 경기 */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));  // PT 상태줄을 오른쪽 아래로 (헤더 가림 방지)
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, "");
  PT.say("일정 화면");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(300);
  PT.note("after skip on screen: " + (document.querySelector(".nav [data-screen].on") || {}).textContent + " → 일정 탭 누름"); PT.click(".nav [data-screen=schedule]"); await PT.wait(300);
  const S = ClubUI.state();
  PT.note("day " + S.day + " date " + PT.text("#tDate") + " nextDay label '" + PT.text("#nextDay") + "' " + M("#nextDay") + " disabled " + document.getElementById("nextDay").disabled);
  PT.note("nav buttons: " + [...document.querySelectorAll(".nav [data-screen]")].map(b => b.textContent + " " + Math.round(b.getBoundingClientRect().width) + "x" + Math.round(b.getBoundingClientRect().height)).join(", ") + " | " + M("#saveBtn") + " | " + M("#titleBtn"));
  PT.note("nav wrap: " + [...document.querySelectorAll(".nav button, .ctlmini button")].map(b => { const r = document.createRange(); r.selectNodeContents(b); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; return b.textContent + ":" + lines + "줄/" + Math.round(b.getBoundingClientRect().height) + "px"; }).join(" ") + " · header h " + Math.round(document.getElementById("apphead").getBoundingClientRect().height) + " · strip b heights " + [...document.querySelectorAll("#cstrip b")].map(b => Math.round(b.getBoundingClientRect().height)).join(","));
  PT.note("header strip: " + PT.text("#cstrip").replace(/\s+/g, " "));
  PT.note("schedule rows " + document.querySelectorAll("#schedule tr").length + " pager " + (PT.text("#schedule .pager") || "-") + " table font " + getComputedStyle(document.querySelector("#schedule td") || document.body).fontSize);
  PT.note("next game: " + PT.text("#nextGame").replace(/\s+/g, " "));
  PT.note("log: " + PT.text("#log").replace(/\s+/g, " ").slice(0, 300));
  PT.note("hint next to button: " + PT.text("#tab-schedule .ctl .hint") + " | reset btn " + M("#reset"));
  const sc = document.getElementById("schedule"); PT.note("schedule box " + sc.clientHeight + "/" + sc.scrollHeight);
  if (v.endsWith("_nextday")) {
    PT.click("#nextDay"); await PT.wait(500);
    PT.note("after big button: game screen visible " + PT.visible("#screen-game") + " setup " + PT.visible("#setup") + " day " + ClubUI.state().day + " log0: " + (ClubUI.state().log[0] || {}).t);
    PT.say("일정에서 큰 버튼 눌렀더니 → " + (PT.visible("#screen-game") ? "경기 준비 화면" : "그대로"));
  }
  if (v.endsWith("_navgame")) {
    PT.click(".nav [data-screen=game]"); await PT.wait(500);
    PT.note("nav 경기: gameDayNote '" + PT.text("#gameDayNote") + "' start disabled " + document.getElementById("start").disabled + " order " + PT.text("#order"));
  }
  await PT.done({ persona: "casual mobile", screen: v });
})();
