/* sim_v2_nego: re-verify negotiation exploits on the patched build (salary 0.3~30, years 1~4, bonus must fit cash)
   (a) 500억/100년 inputs now  (b) restart-reset of patience  (c) best legal discount path (2 counters at U≈0.80 then meet) per FA at rank 1
   (d) negative cash: max legal contracts until bonus > cash, then weekly settlement drives cash negative → what is blocked  (e) release/buyout math
   (f) sign all 8 FAs → cap tax + playing time morale  (g) noTrade never expires */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const fresh = i => { ClubUI.fresh(APP.teamList()[i === undefined ? 3 : i]); return ClubUI.state() };
  const yp = p => p.age <= 29 ? 3 : (p.age <= 33 ? 2 : 1);
  const depthAct = (S, p) => S.players.filter(x => x.active && x.id !== p.id && x.type === p.type && (p.type == "B" ? x.pos === p.pos : x.role === p.role)).length;
  const mods = (S, p, years) => { const yq = yp(p); let m = years >= yq ? 1 + 0.03 * (years - yq) : 1 - 0.06 * (yq - years); const rank = I.rankNow().findIndex(r => r.me) + 1; const succ = rank <= 2 ? 1.06 : rank >= 5 ? 0.94 : 1; m *= 1 + (succ - 1) * (0.5 + p.personality.ambition); const d = depthAct(S, p); m *= d <= 1 ? 1.08 : d >= 3 ? 0.93 : 1; return m };
  const out = {};
  try {
    let S = fresh(); let fa = S.fa[0];
    PT.note("FA pool: " + S.fa.map(p => p.name + "(" + (p.pos || p.role) + " " + p.age + " ovr " + r2(I.ovr(p)) + " ask " + p.asking + " amb " + p.personality.ambition + " depth " + depthAct(S, p) + ")").join(", ") + " · budget " + S.budget);
    // (a) absurd inputs
    M.startNego(fa.id); M.offer(500, 1); let q = I.P(fa.id); PT.note("(a) 500억x1 on ask " + fa.asking + ": signed=" + !!q + (q ? " salary " + q.contract.salary + " years " + q.contract.years : "") + " budget " + S.budget + " msg " + M.fin().nego.msg.slice(0, 70));
    S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(r1(fa.asking * 0.25), 100); q = I.P(fa.id); PT.note("(a2) 25% ask x100y: signed=" + !!q + " msg " + M.fin().nego.msg.slice(0, 70) + " · budget " + S.budget);
    S = fresh(); fa = S.fa[2]; M.startNego(fa.id); M.offer(30, 4); q = I.P(fa.id); PT.note("(a3) 30억x4y (bonus 36) on " + fa.name + " ask " + fa.asking + ": signed=" + !!q + " budget " + S.budget + " · then 30x4 again on next FA: "); const fb = S.fa[0]; M.startNego(fb.id); M.offer(30, 4); PT.note("(a4) second 30x4 with budget " + S.budget + ": signed=" + !!I.P(fb.id) + " msg " + M.fin().nego.msg.slice(0, 80));
    // (b) restart reset
    S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(r1(fa.asking * 0.5), 1); M.offer(r1(fa.asking * 0.5), 1); const p2 = M.fin().nego.patience; M.startNego(fa.id); const n3 = M.fin().nego;
    let cnt = 0; for (let k = 0; k < 5; k++) { M.offer(r1(fa.asking * 0.5), 1); M.offer(r1(fa.asking * 0.5), 1); cnt += 2; M.startNego(fa.id) }
    PT.note("(b) patience after 2 lowballs " + p2 + " -> startNego again patience " + n3.patience + " round " + n3.round + " · " + cnt + " lowballs with restarts: still in FA=" + S.fa.some(p => p.id === fa.id) + " ask " + M.fin().nego.ask + " (결렬 avoided=" + S.fa.some(p => p.id === fa.id) + ")");
    out.restartReset = n3.patience === 3;
    // (c) best legal discount: offer at U=0.80 twice, then meet; rank 1 assumed at day 0
    S = fresh(); const res = []; let bumps = 0;
    for (const p of S.fa.slice()) { const yrs = 4; const m = mods(S, p, yrs); M.startNego(p.id); let n = M.fin().nego; const ask0 = n.ask; const path = [];
      for (let k = 0; k < 2; k++) { const off = Math.max(0.3, Math.ceil(n.ask * 0.80 / m * 10 + 0.01) / 10); M.offer(off, yrs); n = M.fin().nego; if (n.done) break; if (n.msg.includes("다른 구단")) bumps++; path.push(off + "->" + n.ask + (n.msg.includes("다른 구단") ? "^" : "")) }
      if (!n.done) { M.offer(n.ask, yrs); n = M.fin().nego }
      const q = I.P(p.id); res.push({ name: p.name, ask0, final: q ? q.contract.salary : null, ratio: q ? r2(q.contract.salary / ask0) : null, mods: r2(m), path: path.join(","), msg: n.msg.slice(0, 20) }) }
    PT.note("(c) 2 counters at U≈0.80 (4y) then meet: " + res.map(x => x.name + " " + x.ask0 + "->" + x.final + " (x" + x.ratio + ", mods " + x.mods + ") [" + x.path + "] " + x.msg).join(" | ") + " · avg ratio " + r2(avg(res.filter(x => x.ratio).map(x => x.ratio))) + " · rival bumps " + bumps + " · budget " + S.budget);
    out.discount = res;
    // immediate-accept threshold with 4 years at rank 1
    S = fresh(); const thr = [];
    for (const p of S.fa.slice()) { let lo = 0.5, hi = 1.0; for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; M.startNego(p.id); M.offer(r1(p.asking * mid), 4); if (M.fin().nego.done && I.P(p.id)) { hi = mid; const q = I.P(p.id); S.players = S.players.filter(x => x.id !== p.id); S.fa.push(q); q.noTrade = false; q.contract = { salary: p.asking, years: 1, status: "fa" }; S.budget = 40 } else lo = mid } thr.push(p.name + " " + r2(hi) + " (mods " + r2(mods(S, p, 4)) + ")") }
    PT.note("(c2) immediate-accept fraction of ask at 4y, rank 1: " + thr.join(", "));
    // (d) negative cash through weekly settlement
    S = fresh(); let signed = 0; for (const p of S.fa.slice()) { M.startNego(p.id); M.offer(30, 4); if (I.P(p.id)) signed++ }
    PT.note("(d) signed " + signed + " FA at 30억x4y: budget " + S.budget + " top40 " + r1(I.top40()) + " payroll/wk " + r1(S.players.reduce((a, p) => a + p.contract.salary, 0) * 7 / 180));
    const track = []; for (let k = 0; k < 21; k++) { ClubUI.simDay(); track.push(S.budget) }
    PT.note("(d2) budget by day: " + track.join(",") + " · weekly: " + S.fin.ledger.filter(l => l.kind === "주간 결산").map(l => l.amt).join("/") + " · owner/warning events: " + S.log.filter(l => /파산|경고|해임|구단주/.test(l.t)).length);
    const code = S.opps[0].code; const rr = M.proposeTrade(code, [M.oppRoster(code)[5].id], [], 1); PT.note("(d3) at budget " + S.budget + ": trade with +1억 cash ok=" + rr.ok + " " + rr.msg.slice(0, 50) + " · cash sale ok=" + M.proposeTrade(code, [], [S.players.find(p => !p.active).id], -1).ok + " budget " + S.budget);
    const fa2 = S.fa[0]; if (fa2) { M.startNego(fa2.id); M.offer(fa2.asking, 1); PT.note("(d4) sign FA at ask while budget " + S.budget + ": signed=" + !!I.P(fa2.id) + " msg " + M.fin().nego.msg.slice(0, 60)) }
    let dd = 0; while (S.sched.filter(g => g.result).length < 30 && dd++ < 60) ClubUI.simDay();
    PT.note("(d5) season end: budget " + S.budget + " · " + S.W + "-" + S.L + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재"))) + " · " + (S.log.find(l => l.t.includes("재정 결산")) || {}).t + " · consequences: " + (S.log.filter(l => /파산|경고|해임|구단주/.test(l.t)).map(l => l.t).join("|") || "none"));
    out.negativeCash = { budget: S.budget, W: S.W };
    // (e) release/buyout math
    S = fresh(); const exp = S.players.slice().sort((a, b) => b.contract.salary - a.contract.salary)[0]; PT.note("(e) most expensive " + exp.name + " salary " + exp.contract.salary + " years " + exp.contract.years + ": buyout " + r1(exp.contract.salary * 0.5) + "억 vs salary actually paid over the 35-day season ≈ " + r1(exp.contract.salary * 35 / 180) + "억 · farm player buyout min 0.2 vs his season pay " + r1(0.3 * 35 / 180));
    // (f) sign all at ask, season
    S = fresh(); const act0 = S.players.filter(p => p.active).length, t0 = I.top40(); for (const p of S.fa.slice()) { M.startNego(p.id); M.offer(p.asking, yp(p)) }
    PT.note("(f) signed all 8 at ask: active " + act0 + "->" + S.players.filter(p => p.active).length + " top40 " + r1(t0) + "->" + r1(I.top40()) + " budget " + S.budget + " · FA left " + S.fa.length);
    dd = 0; while (S.sched.filter(g => g.result).length < 30 && dd++ < 60) ClubUI.simDay();
    PT.note("(f2) season " + S.W + "-" + S.L + " budget " + S.budget + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재") || l.kind.includes("기금"))) + " · signees playing_time " + r2(avg(S.players.filter(p => p.noTrade).map(p => p.morale.playing_time))) + " active " + S.players.filter(p => p.noTrade && p.active).length + "/8 · transfer requests " + S.log.filter(l => l.t.includes("이적 요청")).length);
    // (g) noTrade expiry
    S = fresh(); fa = S.fa[0]; M.startNego(fa.id); M.offer(fa.asking, yp(fa)); q = I.P(fa.id); dd = 0; while (S.sched.filter(g => g.result).length < 19 && dd++ < 40) ClubUI.simDay(); const rt = M.proposeTrade(code, [], [q.id], -1); PT.note("(g) FA signee trade at game 19: ok=" + rt.ok + " " + rt.msg + " noTrade=" + q.noTrade);
    // (h) UI: modal numbers with clamped input
    S = fresh(); fa = S.fa[1]; APP.show("market"); await PT.wait(50); M.startNego(fa.id); await PT.wait(30); document.getElementById("negoSalary").value = 999; document.getElementById("negoYears").value = 50; document.getElementById("negoSalary").dispatchEvent(new Event("input")); await PT.wait(30);
    PT.note("(h) UI hint with 999억/50년 typed: " + (PT.text("#negoBody") || "").replace(/\s+/g, " ").slice(0, 200)); PT.click("#negoOffer"); await PT.wait(50); PT.note("(h2) after 제안: signed=" + !!I.P(fa.id) + " salary " + (I.P(fa.id) || { contract: {} }).contract.salary + " years " + (I.P(fa.id) || { contract: {} }).contract.years + " budget " + S.budget + " msg " + M.fin().nego.msg.slice(0, 80));
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 300)) }
  await PT.done({ scenario: "v2_nego", out, errs: PT.errs });
})();
