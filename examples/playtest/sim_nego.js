/* sim_nego: negotiation exploits — lowball loop, restart-reset, optimal discount path, absurd years, no budget check (negative cash), mass signing + cap tax, release/buyout, noTrade, UI edge inputs */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const fresh = i => { ClubUI.fresh(APP.teamList()[i === undefined ? 3 : i]); return ClubUI.state() };
  const yp = p => p.age <= 29 ? 3 : (p.age <= 33 ? 2 : 1);
  let S = fresh();
  PT.note("FA pool: " + S.fa.map(p => p.name + "(" + (p.pos || p.role) + " " + p.age + " ovr " + r2(I.ovr(p)) + " ask " + p.asking + " pref " + yp(p) + "y)").join(", ") + " · budget " + S.budget + " · rank " + (I.rankNow().findIndex(r => r.me) + 1));
  // (a) lowball loop
  let fa = S.fa[0]; M.startNego(fa.id); const msgs = [];
  for (let k = 0; k < 4; k++) { const n = M.fin().nego; if (!n || n.done) break; M.offer(r1(fa.asking * 0.1), 1); msgs.push("r" + n.round + " pat " + n.patience + " ask " + n.ask + ": " + n.msg.slice(0, 40)) }
  PT.note("(a) lowball x3 on " + fa.name + ": " + msgs.join(" | ") + " · still in FA list=" + S.fa.some(p => p.id === fa.id) + " · modal hidden=" + document.getElementById("negoModal").hidden);
  // (b) restart reset
  S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(r1(fa.asking * 0.85), yp(fa)); const a1 = M.fin().nego.ask, p1 = M.fin().nego.patience; M.offer(r1(a1 * 0.85), yp(fa)); const a2 = M.fin().nego.ask, p2 = M.fin().nego.patience;
  M.startNego(fa.id); const n3 = M.fin().nego; PT.note("(b) restart: asking " + fa.asking + " -> after 2 counters ask " + a1 + "/" + a2 + " patience " + p1 + "/" + p2 + " -> startNego again: ask " + n3.ask + " patience " + n3.patience + " round " + n3.round + " (p.asking unchanged=" + (fa.asking === n3.ask) + ")");
  // infinite lowball without 결렬: repeat (counter, counter, restart) 5 times
  let cnt = 0; for (let k = 0; k < 5; k++) { M.offer(r1(M.fin().nego.ask * 0.85), yp(fa)); M.offer(r1(M.fin().nego.ask * 0.85), yp(fa)); cnt += 2; M.startNego(fa.id) } PT.note("(b2) " + cnt + " counter rounds without 결렬: in FA list=" + S.fa.some(p => p.id === fa.id) + " ask now " + M.fin().nego.ask);
  // (c) optimal discount path per FA: 2 counters at 0.84 then meet
  S = fresh(); const res = []; let bumps = 0, counters = 0;
  for (const p of S.fa.slice()) { M.startNego(p.id); let n = M.fin().nego; const ask0 = n.ask; let path = [];
    for (let k = 0; k < 2; k++) { const off = r1(n.ask * 0.84); const before = n.ask; M.offer(off, yp(p)); n = M.fin().nego; counters++; if (n.done) break; if (n.msg.includes("다른 구단")) bumps++; path.push(off + "->" + n.ask + (n.msg.includes("다른 구단") ? "^" : "")) }
    if (!n.done) { M.offer(n.ask, n.years); n = M.fin().nego }
    const q = I.P(p.id); res.push({ name: p.name, ask0, final: q ? q.contract.salary : null, ratio: q ? r2(q.contract.salary / ask0) : null, years: q ? q.contract.years : null, path: path.join(","), done: n.done, msg: n.msg.slice(0, 30) }) }
  PT.note("(c) 2 counters @0.84 then meet: " + res.map(x => x.name + " " + x.ask0 + "->" + x.final + " (x" + x.ratio + ", " + x.years + "y) [" + x.path + "] " + x.msg).join(" | ") + " · avg ratio " + r2(avg(res.filter(x => x.ratio).map(x => x.ratio))) + " · rival bumps " + bumps + "/" + counters + " counters · budget " + S.budget + " fees " + S.fin.exp.fees);
  // direct-accept threshold: what fraction of ask signs immediately at preferred years?
  S = fresh(); const thr = [];
  for (const p of S.fa.slice()) { let lo = 0.5, hi = 1.0; for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; M.startNego(p.id); M.offer(r1(p.asking * mid), yp(p)); if (M.fin().nego.done && I.P(p.id)) { hi = mid; const q = I.P(p.id); S.players = S.players.filter(x => x.id !== p.id); S.fa.push(q); q.noTrade = false; q.contract = { salary: p.asking, years: 1, status: "fa" }; S.budget = 40 } else lo = mid } thr.push(p.name + " " + r2(hi)) }
  PT.note("(c2) immediate-accept fraction of ask (pref years, rank " + (I.rankNow().findIndex(r => r.me) + 1) + "): " + thr.join(", "));
  // (d) absurd years
  S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(r1(fa.asking * 0.5), 30); let q = I.P(fa.id);
  PT.note("(d) 50% of ask with 30 years: signed=" + !!q + (q ? " years " + q.contract.years + " salary " + q.contract.salary + " bonus " + r1(fa.asking * 0.5 * 30 * 0.3) + " budget " + S.budget : " msg " + M.fin().nego.msg.slice(0, 60)));
  S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(r1(fa.asking * 0.25), 100); q = I.P(fa.id); PT.note("(d2) 25% of ask with 100 years: signed=" + !!q + " budget " + S.budget);
  // (e) no budget check: huge salary → negative cash
  S = fresh(); fa = S.fa[1]; M.startNego(fa.id); M.offer(500, 1); q = I.P(fa.id);
  PT.note("(e) offered 500억 x1: signed=" + !!q + " budget " + S.budget + " header BUDGET=" + PT.text("#tBudget") + " top40 " + r1(I.top40()) + " log: " + S.log[0].t.slice(0, 90));
  for (let k = 0; k < 8; k++) ClubUI.simDay();
  PT.note("(e2) after 8 days: budget " + S.budget + " weekly: " + JSON.stringify(S.fin.ledger.find(l => l.kind === "주간 결산")) + " · any owner event? log has 파산/경고: " + S.log.some(l => /파산|경고|해임/.test(l.t)));
  // what is still allowed at negative cash
  const farmP = S.players.find(p => !p.active); APP.show("roster"); await PT.wait(50);
  let relBtn = null; for (let pg = 0; pg < 20 && !relBtn; pg++) { relBtn = document.querySelector("[data-act=release][data-pid='" + farmP.id + "']"); if (!relBtn) { const nb = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nb) break; nb.click(); await PT.wait(20) } }
  const n0 = S.players.length; if (relBtn) relBtn.click(); await PT.wait(50);
  PT.note("(e3) at budget " + S.budget + ": release " + farmP.name + " (buyout " + Math.max(0.2, r1(farmP.contract.salary * 0.5)) + ") -> players " + n0 + "->" + S.players.length + " log: " + S.log[0].t.slice(0, 70));
  const code = S.opps[0].code; const rr = M.proposeTrade(code, [M.oppRoster(code)[5].id], [], 1); PT.note("(e4) trade with cash 1억 at negative budget: ok=" + rr.ok + " " + rr.msg.slice(0, 60));
  const fa2 = S.fa[0]; M.startNego(fa2.id); M.offer(fa2.asking * 2, 1); PT.note("(e5) sign another FA at 2x ask while negative: signed=" + !!I.P(fa2.id) + " budget " + S.budget);
  let dd = 0; while (S.sched.filter(g => g.result).length < 30 && dd++ < 60) ClubUI.simDay();
  PT.note("(e6) season end at budget " + S.budget + " · " + S.W + "-" + S.L + " · tax ledger " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재"))) + " · " + (S.log.find(l => l.t.includes("재정 결산")) || {}).t);
  // (f) sign all FAs at ask → cap, 1군 overflow, tax
  S = fresh(); const act0 = S.players.filter(p => p.active).length, t0 = I.top40();
  for (const p of S.fa.slice()) { M.startNego(p.id); M.offer(p.asking, yp(p)) }
  PT.note("(f) signed all: players " + S.players.length + " active " + act0 + "->" + S.players.filter(p => p.active).length + " top40 " + r1(t0) + "->" + r1(I.top40()) + " budget " + S.budget + " fees " + S.fin.exp.fees + " · cap warnings in log: " + S.log.filter(l => l.t.includes("샐러리캡")).length + " · header PAYROLL " + PT.text("#tPay") + " · FA left " + S.fa.length);
  dd = 0; while (S.sched.filter(g => g.result).length < 30 && dd++ < 60) ClubUI.simDay();
  PT.note("(f2) season: " + S.W + "-" + S.L + " budget " + S.budget + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재") || l.kind.includes("기금"))) + " · salary paid " + S.fin.exp.salary + " · signed players' morale playing_time " + r2(avg(S.players.filter(p => p.noTrade).map(p => p.morale.playing_time))) + " active " + S.players.filter(p => p.noTrade && p.active).length + "/" + S.players.filter(p => p.noTrade).length);
  // (g) release & re-sign
  S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(fa.asking, yp(fa)); q = I.P(fa.id); const bud1 = S.budget;
  APP.show("roster"); await PT.wait(50); relBtn = null; for (let pg = 0; pg < 30 && !relBtn; pg++) { relBtn = document.querySelector("[data-act=release][data-pid='" + q.id + "']"); if (!relBtn) { const nb = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nb) break; nb.click(); await PT.wait(20) } }
  if (relBtn) relBtn.click(); await PT.wait(50);
  PT.note("(g) signed " + fa.name + " at " + fa.asking + " (bonus " + r1(fa.asking * yp(fa) * 0.3) + ") then released: budget " + bud1 + " -> " + S.budget + " · in FA list again=" + S.fa.some(p => p.id === fa.id) + " · in players=" + !!I.P(fa.id) + " · log " + S.log[0].t.slice(0, 80) + " · relationships avg " + r2(avg(S.players.map(p => p.morale.relationships))));
  // release the most expensive player: buyout vs remaining season salary actually owed
  S = fresh(); const exp = S.players.slice().sort((a, b) => b.contract.salary - a.contract.salary)[0]; const owed = r1(exp.contract.salary * 35 / 180); PT.note("(g2) most expensive " + exp.name + " salary " + exp.contract.salary + ": buyout would be " + r1(exp.contract.salary * 0.5) + "억 vs season salary actually paid ≈ " + owed + "억 (35 days of 180) · so keeping him costs less than releasing");
  // (h) noTrade + AI offer exclusion
  S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(fa.asking, yp(fa)); q = I.P(fa.id); const rt = M.proposeTrade(code, [], [q.id], -1); PT.note("(h) trade FA signee: ok=" + rt.ok + " " + rt.msg + " · noTrade=" + q.noTrade + " signedDay=" + q.signedDay + " · any expiry logic? (noTrade never cleared in 30-game season)");
  // (i) UI edge inputs
  S = fresh(); fa = S.fa[2]; APP.show("market"); await PT.wait(50); M.startNego(fa.id); await PT.wait(30);
  document.getElementById("negoSalary").value = -5; document.getElementById("negoYears").value = 0; PT.click("#negoOffer"); await PT.wait(30); const nn = M.fin().nego;
  PT.note("(i) salary -5, years 0: signed=" + !!I.P(fa.id) + " round " + nn.round + " patience " + nn.patience + " msg " + nn.msg.slice(0, 50));
  document.getElementById("negoSalary").value = "abc"; document.getElementById("negoYears").value = 2.5; PT.click("#negoOffer"); await PT.wait(30);
  PT.note("(i2) salary 'abc', years 2.5: signed=" + !!I.P(fa.id) + " patience " + M.fin().nego.patience + " msg " + M.fin().nego.msg.slice(0, 50));
  PT.click("#negoMeet"); await PT.wait(30); const q2 = I.P(fa.id); PT.note("(i3) meet: signed=" + !!q2 + (q2 ? " salary " + q2.contract.salary + " years " + q2.contract.years : "") + " budget " + S.budget + " negoBody: " + (PT.text("#negoBody") || "").replace(/\s+/g, " ").slice(0, 160));
  await PT.done({ scenario: "nego", res, thr, errs: PT.errs });
})();
