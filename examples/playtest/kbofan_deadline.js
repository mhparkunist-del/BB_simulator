/* KBO fan playtest: trade deadline (20 games) and AI-initiated offers over a simulated season; end on the market screen after the deadline */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("한화 시즌 진행 → 트레이드 마감·AI 제안");
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); const M = ClubMarket;
  const seen = [];
  let d = 0; while (ClubUI.state().sched.filter(g => g.result).length < 20 && d < 40) { ClubUI.simDay(); d++; M.fin().offers.forEach(o => { if (!seen.find(s => s.id === o.id)) seen.push(Object.assign({}, o)) }) }
  const S = ClubUI.state();
  note("days " + d + " games " + S.sched.filter(g => g.result).length + " rec " + S.W + "-" + S.L + " budget " + S.budget);
  note("AI OFFERS seen " + seen.length + ": " + seen.map(o => { const r = M.oppRoster(o.code); const w = S.players.find(p => p.id === o.want); return o.short + " wants " + (w ? w.name + "(v" + M.tradeValue(w) + ")" : o.want) + " gives " + o.give.map(i => { const p = r.find(x => x.id === i); return p ? p.name + "(v" + M.tradeValue(p) + ")" : "?" }).join("+") + " day" + o.day }).join(" | "));
  const opp = S.opps.find(o => o.code === "HT"); const roster = M.oppRoster("HT");
  const r = M.proposeTrade("HT", [roster[0].id], [S.players.filter(p => p.active)[0].id], 0);
  note("propose after 20 games: " + r.msg + " ok=" + r.ok);
  APP.show("market"); await PT.wait(300);
  note("tradeGo disabled: " + document.getElementById("tradeGo").disabled + " · budget hint: " + (document.querySelector("#budget .hint") || {}).textContent);
  note("trade-related log: " + S.log.filter(l => /트레이드|제안/.test(l.t)).map(l => l.d + " " + l.t).join(" | "));
  note("morale complaints: " + S.log.filter(l => /불만/.test(l.t)).map(l => l.d + " " + l.t).slice(0, 6).join(" | "));
  note("injuries: " + S.log.filter(l => /부상/.test(l.t)).map(l => l.d + " " + l.t).slice(0, 6).join(" | "));
  await PT.done({ persona: "KBO 골수팬 · 마감", notes: L });
})();
