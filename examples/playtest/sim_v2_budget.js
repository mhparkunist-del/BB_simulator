/* sim_v2_budget: money loop on the patched build — do-nothing season cash curve, gate only on played home games?, cap floor by salary dump (2-at-a-time), what money buys */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const season = S => { let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay() };
  try {
    // (1) do-nothing season: cash curve
    ClubUI.fresh(APP.teamList()[7]); let S = ClubUI.state(); const track = []; let d = 0;
    while (S.sched.filter(g => g.result).length < 30 && d++ < 60) { const g = S.sched.find(x => x.date === I.today() && !x.result); ClubUI.simDay(); track.push((g ? (g.home ? "H" : "A") : "-") + S.budget) }
    const gates = S.fin.ledger.filter(l => l.kind === "입장 수입"); const homeG = S.sched.filter(g => g.result && g.home).length;
    PT.note("(1) do-nothing: budget 40 -> " + S.budget + " · gate entries " + gates.length + " vs home games played " + homeG + " · att avg " + Math.round(S.fin.att / Math.max(1, gates.length)) + " · inc " + JSON.stringify(S.fin.inc) + " exp " + JSON.stringify(S.fin.exp) + " · track " + track.join(" "));
    // (2) sim a day without a game on a game day? advanceDay(false) on game day is refused; recordExternalGame path gives gate too
    ClubUI.fresh(APP.teamList()[7]); S = ClubUI.state(); const b0 = S.budget; const g0 = S.sched.find(x => x.date === I.today() && !x.result);
    if (g0 && g0.home) { ClubUI.recordExternalGame({ us: 3, them: 3, sp: "-", ip: 0, er: 0 }); PT.note("(2) external draw 3:3 on home game day: budget " + b0 + " -> " + S.budget + " record " + S.W + "-" + S.L + "-" + (S.D || 0) + " header " + PT.text("#tRec") + " · sched result " + JSON.stringify(g0.result) + " · log " + S.log[0].t.slice(0, 60)); ClubUI.advanceDay(); PT.note("(2b) advanceDay after external game: day " + S.day + " budget " + S.budget + " gate entries " + S.fin.ledger.filter(l => l.kind === "입장 수입").length) } else PT.note("(2) first game not home (home=" + (g0 && g0.home) + "), skip");
    // (3) cap floor by salary dump, 2 at a time, non-starters only
    ClubUI.fresh(APP.teamList()[7]); S = ClubUI.state(); const t40 = I.top40(); const codes = S.opps.filter(o => o.code).map(o => o.code); let n = 0, cash = 0, tr = 0;
    const cand = S.players.filter(p => !S.lineup.includes(p.id) && !S.rotation.includes(p.id)).sort((a, b) => b.contract.salary - a.contract.salary);
    for (let k = 0; k < cand.length && I.top40() >= 60.65; k += 2) { const pair = cand.slice(k, k + 2); const X = Math.floor(pair.reduce((a, p) => a + M.tradeValue(p), 0) / 0.756 * 10) / 10; if (X < 0.5) continue; const c = codes[tr % codes.length]; tr++; if (M.proposeTrade(c, [], pair.map(p => p.id), -X).ok) { n += pair.length; cash += X } }
    PT.note("(3) salary dump: sold " + n + " in " + tr + " trades for " + r1(cash) + "억, top40 " + r1(t40) + " -> " + r1(I.top40()) + " budget " + S.budget + " active " + S.players.filter(p => p.active).length);
    season(S);
    PT.note("(3b) season: " + S.W + "-" + S.L + " budget " + S.budget + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("기금") || l.kind.includes("제재"))) + " · " + (S.log.find(l => l.t.includes("재정 결산")) || {}).t);
    // (4) what money buys: 40억 cash-buy of the best affordable non-top3 player from each club → W-L vs control
    ClubUI.fresh(APP.teamList()[7]); S = ClubUI.state(); const ctrlB = { ...S }; season(S); const ctrl = S.W + "-" + S.L;
    ClubUI.fresh(APP.teamList()[7]); S = ClubUI.state(); const buys = [];
    for (const c of codes) { const ro = M.oppRoster(c).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v); const top3 = ro.slice(0, 3).map(x => x.p.id); const t = ro.find(x => !top3.includes(x.p.id) && x.p.type == "B" && Math.ceil(x.v * 1.08 / 0.7 * 10) / 10 <= S.budget); if (!t) continue; const X = Math.ceil(t.v * 1.08 / 0.7 * 10) / 10; if (M.proposeTrade(c, [t.p.id], [], X).ok) buys.push(t.p.name + " ovr " + r2(I.ovr(t.p)) + " " + X + "억") }
    // put bought batters into the lineup replacing the worst
    const bought = S.players.filter(p => p.id >= 10000 && p.type == "B"); bought.forEach(b => { b.active = true; const worstIdx = S.lineup.map(I.P).map((p, i) => [p ? I.ovr(p) : 9, i]).sort((a, b) => a[0] - b[0])[0][1]; if (I.ovr(I.P(S.lineup[worstIdx])) < I.ovr(b)) S.lineup[worstIdx] = b.id }); I.save(); season(S);
    PT.note("(4) 40억 spent on " + buys.length + " cash buys (" + buys.join(", ") + "): " + S.W + "-" + S.L + " vs control " + ctrl + " · budget end " + S.budget);
    PT.note("(5) sinks: FA bonus, trade cash, buyout, tax. No staff/scouting/facility/wage-rise sink. Income this run " + r1(S.fin.inc.gate + S.fin.inc.ads + S.fin.inc.parent) + " vs expense " + r1(S.fin.exp.salary + S.fin.exp.ops + S.fin.exp.tax + S.fin.exp.fees + S.fin.exp.buyout));
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 300)) }
  APP.show("market"); await PT.wait(150);
  await PT.done({ scenario: "v2_budget", errs: PT.errs });
})();
