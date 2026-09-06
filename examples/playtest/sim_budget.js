/* sim_budget: cash to exactly 0, then negative through weekly settlement; what is blocked and what is not; cap floor by dumping salary; money value */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10;
  ClubUI.fresh(APP.teamList()[7]); let S = ClubUI.state();
  // spend exactly 40: bonus = salary*years*0.3 → salary = 40/0.3 with 1 year
  const fa = S.fa[0]; M.startNego(fa.id); M.offer(r1(40 / 0.3), 1);
  PT.note("(1) signed " + fa.name + " at " + r1(40 / 0.3) + "억 x1: budget " + S.budget + " header " + PT.text("#tBudget") + " top40 " + r1(I.top40()));
  const track = []; for (let k = 0; k < 14; k++) { ClubUI.simDay(); track.push(S.budget) }
  PT.note("(2) budget by day: " + track.join(",") + " · weekly ledger: " + S.fin.ledger.filter(l => l.kind === "주간 결산").map(l => l.amt + " (" + l.text + ")").join(" | "));
  // at 0/negative: what still works
  const code = S.opps[0].code; const ro = M.oppRoster(code);
  const t1 = M.proposeTrade(code, [ro[3].id], [], 0.5); PT.note("(3) trade with +0.5억 cash at budget " + S.budget + ": ok=" + t1.ok + " " + t1.msg.slice(0, 50));
  const t2 = M.proposeTrade(code, [], [S.players.find(p => !p.active).id], -1); PT.note("(3b) cash sale at negative budget: ok=" + t2.ok + " budget " + S.budget);
  const fa2 = S.fa[0]; M.startNego(fa2.id); M.offer(fa2.asking, 1); PT.note("(3c) FA signing at " + fa2.asking + " while budget " + S.budget + ": signed=" + !!I.P(fa2.id) + " budget " + S.budget);
  let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay();
  PT.note("(4) season end: budget " + S.budget + " W-L " + S.W + "-" + S.L + " · " + (S.log.find(l => l.t.includes("재정 결산")) || {}).t + " · tax " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재"))) + " · consequences of negative cash: " + (S.log.some(l => /파산|경고|해임|구단주/.test(l.t)) ? S.log.filter(l => /파산|경고|해임|구단주/.test(l.t)).map(l => l.t).join("|") : "none"));
  // cap floor: dump salary via cash sales until top40 < 60.65
  ClubUI.fresh(APP.teamList()[7]); S = ClubUI.state(); const t40 = I.top40();
  const codes = S.opps.filter(o => o.code).map(o => o.code); let n = 0, cash = 0;
  const cand = S.players.slice().sort((a, b) => b.contract.salary - a.contract.salary);
  for (const p of cand) { if (I.top40() < 60.65) break; if (S.lineup.includes(p.id) || S.rotation.includes(p.id)) continue; const v = M.tradeValue(p); const X = Math.floor(v / 0.756 * 10) / 10; if (X < 0.5) continue; const c = codes[n % codes.length]; if (M.proposeTrade(c, [], [p.id], -X).ok) { n++; cash += X } }
  PT.note("(5) salary dump: sold " + n + " non-starters for " + r1(cash) + "억, top40 " + r1(t40) + " -> " + r1(I.top40()) + " budget " + S.budget + " active " + S.players.filter(p => p.active).length);
  d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay();
  PT.note("(6) season: " + S.W + "-" + S.L + " budget " + S.budget + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("기금") || l.kind.includes("제재"))) + " · " + (S.log.find(l => l.t.includes("재정 결산")) || {}).t + " · weekly salary line: " + (S.fin.ledger.find(l => l.kind === "주간 결산") || {}).text);
  // money value: what can 40억 buy that changes wins? (nothing else spends money)
  PT.note("(7) sinks for cash in a 30-game season: FA signing bonus, trade cash, buyout, season-end tax. No staff/scouting/facilities. Income " + r1(S.fin.inc.gate + S.fin.inc.ads + S.fin.inc.parent) + " vs expense " + r1(S.fin.exp.salary + S.fin.exp.ops + S.fin.exp.tax + S.fin.exp.fees + S.fin.exp.buyout));
  APP.show("market"); await PT.wait(200);
  await PT.done({ scenario: "budget", track, errs: PT.errs });
})();
