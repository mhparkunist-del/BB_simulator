/* casual persona · tutorial: name *_1 / *_2 / *_3 ends on that step; *_done presses 다음 through all three and ends where it lands; *_skip presses 건너뛰기 at step 1 */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));  // PT 상태줄을 오른쪽 아래로 (헤더 가림 방지)
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, "");
  const want = v.endsWith("_2") ? 2 : v.endsWith("_3") ? 3 : v.endsWith("_done") ? 4 : v.endsWith("_skip") ? 0 : 1;
  PT.say("튜토리얼");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  const shown = await PT.until(() => PT.visible("#tutorial"), 3000);
  PT.note("tutorial shown " + shown);
  const screenName = () => { const b = document.querySelector(".nav [data-screen].on"); return b ? b.textContent : "?"; };
  const rec = step => {
    const tb = document.querySelector("#tutorial .tbox").getBoundingClientRect();
    PT.note("step " + step + " [" + PT.text("#tutStep") + "] on screen '" + screenName() + "' text: " + PT.text("#tutText"));
    PT.note("  tbox " + Math.round(tb.left) + "," + Math.round(tb.top) + " " + Math.round(tb.width) + "x" + Math.round(tb.height) + " font " + getComputedStyle(document.getElementById("tutText")).fontSize + " | " + M("#tutNext") + " | " + M("#tutSkip"));
    const under = document.elementFromPoint(innerWidth / 2, tb.top - 10); PT.note("  element just above box: " + (under ? under.tagName + "." + under.className : "-"));
  };
  rec(1);
  if (want === 0) { PT.click("#tutSkip"); await PT.wait(300); PT.note("after skip: tutorial visible " + PT.visible("#tutorial") + " screen '" + screenName() + "'"); }
  if (want >= 2) { PT.click("#tutNext"); await PT.wait(300); rec(2); }
  if (want >= 3) { PT.click("#tutNext"); await PT.wait(300); rec(3); }
  if (want >= 4) { PT.click("#tutNext"); await PT.wait(300); PT.note("after last 다음: tutorial visible " + PT.visible("#tutorial") + " screen '" + screenName() + "' nextDay label '" + PT.text("#nextDay") + "' tutorial_done " + await APP.kv.get("tutorial_done")); }
  PT.say("튜토리얼 " + (want === 0 ? "건너뛰기" : want === 4 ? "끝까지" : "단계 " + want));
  await PT.done({ persona: "casual mobile", screen: v });
})();
