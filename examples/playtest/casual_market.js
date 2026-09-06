/* casual persona · 예산·이적 screen. name default: as opened · *_nego: tap the first 협상 → modal · *_low: offer half of the ask · *_meet: 요구 수용 · *_trade: tick one player each side and press 제안 */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, ""); const is = s => v.endsWith(s);
  PT.say("예산·이적 화면");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=market]"); await PT.wait(400);
  PT.note("budget: " + PT.text("#budget").replace(/\s+/g, " ").slice(0, 300));
  PT.note("trade: " + PT.text("#trade").replace(/\s+/g, " ").slice(0, 200) + " · checkbox " + M("#tradeTheirs input") + " · " + M("#tradeGo") + " · " + M("#tradeClub"));
  PT.note("signing rows " + document.querySelectorAll("#signing tr").length + " · " + M("[data-nego]") + " · first: " + (document.querySelector("#signing tr:nth-child(2)") || {}).textContent + " · hint: " + PT.text("#tab-market .panel:last-child .hint"));
  const S = ClubUI.state(); PT.note("cash " + S.budget + " fa " + S.fa.length);
  const hit = (sel, panelSel) => { const el = document.querySelector(sel); if (!el) return sel + " 없음"; const r = el.getBoundingClientRect(); const pr = document.querySelector(panelSel).getBoundingClientRect(); const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2); const under = document.elementFromPoint(cx, cy); return sel + " center " + cx + "," + cy + " right " + Math.round(r.right) + " vs panel right " + Math.round(pr.right) + " · bottom " + Math.round(r.bottom) + " vs panel bottom " + Math.round(pr.bottom) + " · elementFromPoint = " + (under ? under.tagName + (under.id ? "#" + under.id : "") + (under === el || el.contains(under) ? " (자기 자신, 탭 가능)" : " (다른 요소! 탭 불가)") : "없음"); };
  PT.note("HIT " + hit("[data-nego]", "#tab-market .panel:nth-child(3)"));
  PT.note("HIT " + hit("#tradeGo", "#tab-market .panel:nth-child(2)"));
  PT.note("HIT " + hit("#tradeCash", "#tab-market .panel:nth-child(2)"));
  PT.note("HIT " + hit("#tradeOurs input", "#tab-market .panel:nth-child(2)"));
  PT.note("ours names: " + [...document.querySelectorAll("#tradeOurs label")].map(l => l.textContent.trim() + "@" + Math.round(l.getBoundingClientRect().right)).join(",") + " · panel2 right " + Math.round(document.querySelector("#tab-market .panel:nth-child(2)").getBoundingClientRect().right));
  if (is("_nego") || is("_low") || is("_meet")) {
    PT.click("[data-nego]"); await PT.until(() => PT.visible("#negoModal"), 3000); await PT.wait(300);
    const n = ClubMarket.fin().nego; PT.note("nego modal: body '" + PT.text("#negoBody").replace(/\s+/g, " ") + "' salary input " + document.getElementById("negoSalary").value + " years " + document.getElementById("negoYears").value + " ask " + n.ask + "×" + n.years + " · " + M("#negoOffer") + " | " + M("#negoMeet") + " | " + M("#negoSalary"));
    if (is("_low")) { document.getElementById("negoSalary").value = Math.round(n.ask * 0.5 * 10) / 10; document.getElementById("negoSalary").dispatchEvent(new Event("input")); PT.click("#negoOffer"); await PT.wait(300); PT.note("after low offer: msg '" + (ClubMarket.fin().nego || {}).msg + "' body: " + PT.text("#negoBody").replace(/\s+/g, " ") + " · modal visible " + PT.visible("#negoModal")); PT.say("반값 제안"); }
    if (is("_meet")) { const before = S.budget; PT.click("#negoMeet"); await PT.wait(300); const signed = ClubUI.state().players.some(p => p.id === n.id); PT.note("요구 수용: signed " + signed + " cash " + before + " → " + ClubUI.state().budget + " · body: " + PT.text("#negoBody").replace(/\s+/g, " ") + " · modal visible " + PT.visible("#negoModal") + " · log0 " + (ClubUI.state().log[0] || {}).t); PT.say("요구 수용 → 영입"); }
    if (is("_nego")) PT.say("협상 모달");
  }
  if (is("_trade")) {
    const a = document.querySelector("#tradeTheirs input:not([disabled])"), b = document.querySelector("#tradeOurs input:not([disabled])");
    if (a) { a.click(); await PT.wait(150); } const b2 = document.querySelector("#tradeOurs input:not([disabled])"); if (b2) { b2.click(); await PT.wait(150); }
    PT.note("ticked theirs " + document.querySelectorAll("#tradeTheirs input:checked").length + " ours " + document.querySelectorAll("#tradeOurs input:checked").length + " · go disabled " + document.getElementById("tradeGo").disabled);
    PT.click("#tradeGo"); await PT.wait(400); PT.note("trade msg: '" + PT.text("#tradeMsg") + "' · players now " + ClubUI.state().players.length); PT.say("트레이드 제안");
  }
  await PT.done({ persona: "casual mobile", screen: v });
})();
