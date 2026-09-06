/* KBO fan playtest: 한화 signs from the FA/released pool through the negotiation modal — who is on the list, are the asks realistic, lowball then accept */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("한화 영입 협상");
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); const S = ClubUI.state(); const M = ClubMarket;
  const f = p => p.name + " (전 " + p.from + ", " + (p.pos || p.role) + " " + p.age + "세 " + p.hand + " ovr" + ClubInt.ovr(p).toFixed(2) + " 등급 " + Object.values(p.grades).join("") + " 요구 " + p.asking + "억" + (p.real ? "" : " est") + ")";
  note("FA LIST: " + S.fa.map(f).join(" | "));
  // are these players still on their own club's kbo roster (i.e. not actually free agents)?
  note("still on origin club roster (kbo.json): " + S.fa.map(p => { const kc = APP.kbo.clubs.find(c => c.short === p.from); const k = kc && kc.players.find(x => x.name === p.name); return p.name + "=" + (k ? (k.active ? "1군등록" : "2군명단") : "없음") }).join(", "));
  // comparable salaries on our roster for the same ovr band
  const cmp = S.fa.map(p => { const o = ClubInt.ovr(p); const near = S.players.filter(x => x.type === p.type && Math.abs(ClubInt.ovr(x) - o) < 0.03).slice(0, 4).map(x => x.name + " " + x.contract.salary + "억" + (x.active ? "" : "[2군]")); return p.name + " ovr" + o.toFixed(2) + " ask " + p.asking + " ~ 우리 비슷한 선수: " + near.join(", ") });
  note("ASK vs COMPARABLE: " + cmp.join(" | "));
  APP.show("market"); await PT.wait(300);
  const best = S.fa.slice().sort((a, b) => ClubInt.ovr(b) - ClubInt.ovr(a))[0];
  let btn = null; for (let k = 0; k < 6 && !btn; k++) { btn = document.querySelector("#signing [data-nego='" + best.id + "']"); if (!btn) { const nx = document.querySelector("#signing [data-pg][data-d='1']"); if (!nx) break; nx.click(); await PT.wait(60) } }
  if (!btn) { note("nego button not found for " + best.name); await PT.done({ notes: L }); return }
  btn.click(); await PT.until(() => PT.visible("#negoModal"), 2000);
  note("NEGO open: " + (document.getElementById("negoBody").innerText || "").replace(/\s+/g, " "));
  const ask = M.fin().nego.ask, yrs = M.fin().nego.years;
  document.getElementById("negoSalary").value = Math.round(ask * 0.5 * 10) / 10; document.getElementById("negoYears").value = 1; PT.click("#negoOffer"); await PT.wait(200);
  note("after 50% lowball 1yr: " + M.fin().nego.msg + " patience " + M.fin().nego.patience + " ask now " + M.fin().nego.ask);
  document.getElementById("negoSalary").value = Math.round(ask * 0.85 * 10) / 10; document.getElementById("negoYears").value = yrs; PT.click("#negoOffer"); await PT.wait(200);
  note("after 85% same years: " + M.fin().nego.msg + " patience " + M.fin().nego.patience + " ask now " + M.fin().nego.ask + " done " + M.fin().nego.done);
  if (!M.fin().nego.done) { PT.click("#negoMeet"); await PT.wait(200); note("after 요구 수용: " + M.fin().nego.msg) }
  const S2 = ClubUI.state(); const signed = S2.players.find(p => p.id === best.id);
  note("signed? " + !!signed + (signed ? " active=" + signed.active + " noTrade=" + signed.noTrade + " contract " + JSON.stringify(signed.contract) + " budget " + S2.budget + " top40 " + ClubInt.top40().toFixed(1) : "") + " · ledger " + M.fin().ledger.map(l => l.kind + " " + l.amt + " " + l.text).join(" | "));
  note("1군 count after signing: " + S2.players.filter(p => p.active).length + " · FA left " + S2.fa.length);
  note("nego modal text now: " + (document.getElementById("negoBody").innerText || "").replace(/\s+/g, " "));
  await PT.done({ persona: "KBO 골수팬 · FA", notes: L });
})();
