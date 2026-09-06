/* casual persona · roster screen. name default: as opened · *_card: tap the first player row → card modal · *_swap: 교체 then tap a 1군 batter · *_pos: change a position select · *_down: send a player to 2군 */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  const M = sel => { const el = typeof sel === "string" ? document.querySelector(sel) : sel; if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return (typeof sel === "string" ? sel : el.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, ""); const is = s => v.endsWith(s);
  PT.say("선수단 화면");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(300);
  PT.note("on screen: " + (document.querySelector(".nav [data-screen].on") || {}).textContent);
  const rl = document.getElementById("rosterList"), lu = document.getElementById("lineup");
  PT.note("lineup rows " + lu.querySelectorAll("tr").length + " box " + lu.clientHeight + "/" + lu.scrollHeight + " · rosterList rows " + rl.querySelectorAll("tr").length + " box " + rl.clientHeight + "/" + rl.scrollHeight + " pager '" + (PT.text("#rosterList .pager") || "-") + "' · " + M(".swap") + " | " + M(".posSel") + " | " + M("[data-act=down]") + " | " + M("#rosterList .pr td") + " | badge " + M(".gi, .grade, td i, td b") + " · h2s: " + [...document.querySelectorAll("#tab-roster h2")].map(h => h.textContent).join(" / "));
  PT.note("lineup warn/hint: " + (lu.querySelector(".warn, .hint") || {}).textContent + " · market rows " + document.querySelectorAll("#market tr").length + " rotation hint: " + (document.querySelector("#rotation .hint") || {}).textContent);
  const hit = (sel, panelSel) => { const el = document.querySelector(sel); if (!el) return sel + " 없음"; const r = el.getBoundingClientRect(); const pr = document.querySelector(panelSel).getBoundingClientRect(); const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2); const under = document.elementFromPoint(cx, cy); return sel + " center " + cx + "," + cy + " right " + Math.round(r.right) + " vs panel right " + Math.round(pr.right) + " viewport " + innerWidth + " · elementFromPoint = " + (under ? under.tagName + (under.id ? "#" + under.id : "") + (under === el || el.contains(under) ? " (탭 가능)" : " (다른 요소! 탭 불가)") : "없음(화면 밖)"); };
  PT.note("HIT " + hit(".swap", "#tab-roster > .panel:first-child"));
  PT.note("HIT " + hit("[data-act=down]", "#tab-roster > .panel:last-child"));
  PT.note("HIT " + hit("#market [data-sign]", "#tab-roster > .col"));
  PT.note("HIT " + hit(".rot", "#tab-roster > .col"));
  PT.note("HIT " + hit(".posSel", "#tab-roster > .panel:last-child"));
  PT.note("row1 text: " + rl.querySelector("tr.pr").textContent.replace(/\s+/g, " "));
  if (is("_card")) {
    const row = rl.querySelector("tr.pr"); const name = row.querySelector("td").textContent; row.querySelector("td").click(); await PT.until(() => PT.visible("#cardModal"), 3000); await PT.wait(300);
    PT.note("card modal visible " + PT.visible("#cardModal") + " for " + name + " · " + M("#cardClose") + " · box " + M("#cardModal .modalbox") + " · text: " + PT.text("#playerCard").replace(/\s+/g, " ").slice(0, 400));
    PT.say("선수 카드 열림");
  }
  if (is("_swap")) {
    const before = ClubUI.state().lineup.slice(); PT.click(".swap"); await PT.wait(200); PT.note("after 교체: button text '" + document.querySelector(".swap").textContent + "' row class " + lu.querySelector("tr:nth-child(2)").className);
    const cand = [...rl.querySelectorAll("tr.pr")].find(r => { const p = ClubInt.P(+r.dataset.pid); return p && p.type === "B" && p.active && !before.includes(p.id); });
    PT.note("candidate " + (cand ? cand.querySelector("td").textContent : "없음") + " (on this page? " + !!cand + ")");
    if (cand) { cand.querySelector("td").click(); await PT.wait(200); const after = ClubUI.state().lineup; PT.note("lineup[0] " + ClubInt.P(before[0]).name + " → " + ClubInt.P(after[0]).name + " · card opened instead? " + PT.visible("#cardModal") + " · warn: " + (lu.querySelector(".warn, .hint") || {}).textContent); }
    PT.say("타순 교체 시도");
  }
  if (is("_pos")) { const s = rl.querySelector(".posSel"); const pid = +s.dataset.pid; const old = s.value; s.value = s.options[(s.selectedIndex + 1) % s.options.length].value; s.dispatchEvent(new Event("change")); await PT.wait(200); PT.note("pos " + old + " → " + (ClubInt.P(pid).pos || ClubInt.P(pid).role) + " · warn: " + (lu.querySelector(".warn, .hint") || {}).textContent); PT.say("포지션 바꿔봄"); }
  if (is("_down")) { const b = rl.querySelector("[data-act=down]"); const pid = +b.dataset.pid; const nm = ClubInt.P(pid).name; b.click(); await PT.wait(200); PT.note("2군 보냄 " + nm + " active " + ClubInt.P(pid).active + " · confirm asked? no · log0 " + (ClubUI.state().log[0] || {}).t + " · 1군 header: " + rl.querySelector("th").textContent); PT.say("1군 선수 2군으로"); }
  await PT.done({ persona: "casual mobile", screen: v });
})();
