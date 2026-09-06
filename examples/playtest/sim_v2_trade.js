/* sim_v2_trade: re-verify trade exploits on the patched build (max 2 per side, must bring something back, deadline on received offers)
   (a) lopsided reject  (c) cash-only SALE (API + UI path via promotion)  (c3) sell whole farm 2-at-a-time  (d) cash-only BUY
   (e) 3-for-1 refused / 2 farm gems for a star  (f) 1-for-3 refused  (g) all-star super team funded by farm sales + season + tax
   (h) injured sale, round trip  (i) AI offer accept  (j) deadline for proposeTrade and for answerOffer  (k) opp strength drift after dumping 20 players on one club */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const fresh = i => { ClubUI.fresh(APP.teamList()[i === undefined ? 3 : i]); return ClubUI.state() };
  const byVal = list => list.map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
  const mine = S => byVal(S.players.filter(p => p.active && !p.noTrade));
  const farm = S => byVal(S.players.filter(p => !p.active));
  const lineupOk = S => ({ nulls: S.lineup.filter(id => !I.P(id)).length, dup: new Set(S.lineup).size !== S.lineup.length, rot: S.rotation.length, active: S.players.filter(p => p.active).length });
  const depthBonus = (code, p) => M.oppRoster(code).filter(x => x.id !== p.id && x.type === p.type && (p.type == "B" ? x.pos === p.pos : x.role === p.role)).length <= 1 ? 1.15 : 1;
  const sellPrice = (code, x) => Math.floor(x.v * depthBonus(code, x.p) / 0.756 * 10) / 10;
  const findings = {};
  try {
    let S = fresh(); const code = S.opps[0].code; const codes = S.opps.filter(o => o.code).map(o => o.code);
    // (a) lopsided
    let ro = byVal(M.oppRoster(code)); let star = ro[0]; let worst = mine(S).slice(-1)[0];
    let r = M.proposeTrade(code, [star.p.id], [worst.p.id], 0);
    PT.note("(a) lopsided " + star.p.name + "(v" + star.v + ") <- " + worst.p.name + "(v" + worst.v + "): ok=" + r.ok + " " + r.msg);
    // (c) cash-only sale of one farm player via API
    S = fresh(); let sc = farm(S)[0]; let X = sellPrice(code, sc); const b0 = S.budget;
    r = M.proposeTrade(code, [], [sc.p.id], -X);
    PT.note("(c) API cash sale of 2군 " + sc.p.name + " (ovr " + r2(I.ovr(sc.p)) + ", v " + sc.v + ", salary " + sc.p.contract.salary + ") for " + X + "억: ok=" + r.ok + " " + r.msg + " budget " + b0 + " -> " + S.budget);
    findings.cashSaleApi = r.ok;
    // (c-UI) UI path: is a 2군 player listed in 보낼 선수? promote him, then sell through the form with negative cash
    S = fresh(); sc = farm(S)[0]; APP.show("market"); await PT.wait(80);
    const sel = document.getElementById("tradeClub"); sel.value = code; sel.dispatchEvent(new Event("change")); await PT.wait(50);
    const listedFarm = !![...document.querySelectorAll("#tradeOurs input")].find(b => +b.dataset.id === sc.p.id);
    // promote via roster screen (demote a bench batter first if 26 full)
    APP.show("roster"); await PT.wait(50);
    const clickAct = async (act, pid) => { for (let pg = 0; pg < 40; pg++) { const btn = document.querySelector("[data-act=" + act + "][data-pid='" + pid + "']"); if (btn) { btn.click(); await PT.wait(10); return true } const nb = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nb) return false; nb.click(); await PT.wait(10) } return false };
    const bench = S.players.find(p => p.active && p.type == sc.p.type && !S.lineup.includes(p.id) && !S.rotation.includes(p.id));
    const okDown = bench ? await clickAct("down", bench.id) : "n/a"; const okUp = await clickAct("up", sc.p.id);
    APP.show("market"); await PT.wait(80); sel.value = code; sel.dispatchEvent(new Event("change")); await PT.wait(50);
    let box = null; for (let pg = 0; pg < 40 && !box; pg++) { box = [...document.querySelectorAll("#tradeOurs input")].find(b => +b.dataset.id === sc.p.id); if (!box) { const nb = document.querySelector("#tradeOurs [data-pg][data-d='1']"); if (!nb) break; nb.click(); await PT.wait(10) } }
    if (box) { box.click(); await PT.wait(30); document.getElementById("tradeCash").value = -sellPrice(code, { p: sc.p, v: M.tradeValue(sc.p) }); PT.click("#tradeGo"); await PT.wait(80) }
    PT.note("(c-UI) 2군 listed in 보낼 선수=" + listedFarm + " · demote " + okDown + " promote " + (okUp && sc.p.active) + " · checkbox found=" + !!box + " · tradeMsg: " + (PT.text("#tradeMsg") || "").slice(0, 80) + " · budget " + S.budget + " · sold=" + !I.P(sc.p.id));
    findings.cashSaleUi = !I.P(sc.p.id);
    // (c3) sell the entire farm two at a time
    S = fresh(); const nFarm0 = S.players.filter(p => !p.active).length, t40a = I.top40(); let sold = 0, got = 0, rejected = 0, trades = 0; const fl = farm(S);
    for (let k = 0; k < fl.length; k += 2) { const pair = fl.slice(k, k + 2); const c = codes[trades % codes.length]; const Xk = r1(pair.reduce((a, x) => a + sellPrice(c, x), 0)); if (Xk < 0.5) continue; const rr = M.proposeTrade(c, [], pair.map(x => x.p.id), -Xk); trades++; if (rr.ok) { sold += pair.length; got += Xk } else { rejected += pair.length; if (rejected <= 2) PT.note("(c3) reject: " + rr.msg.slice(0, 80)) } }
    PT.note("(c3) sold farm 2-at-a-time: " + sold + "/" + nFarm0 + " players in " + trades + " trades (rejected " + rejected + ") for " + r1(got) + "억 · budget " + S.budget + " · top40 " + r1(t40a) + " -> " + r1(I.top40()) + " · opp roster sizes " + codes.map(c => M.oppRoster(c).length).join("/"));
    findings.farmSale = { sold, cash: r1(got), trades };
    // (d) cash-only buy
    S = fresh(); ro = byVal(M.oppRoster(code)); const top3 = ro.slice(0, 3).map(x => x.p.id);
    const target = ro.find(x => !top3.includes(x.p.id) && x.v * 1.08 / 0.7 <= 40); const Xb = Math.ceil(target.v * 1.08 / 0.7 * 10) / 10;
    r = M.proposeTrade(code, [target.p.id], [], Xb);
    PT.note("(d) cash buy " + target.p.name + " (ovr " + r2(I.ovr(target.p)) + " v " + target.v + ") for " + Xb + "억: ok=" + r.ok + " " + r.msg + " budget " + S.budget);
    findings.cashBuy = r.ok;
    // (e) 3-for-1 refused? 2 farm gems for their star
    S = fresh(); ro = byVal(M.oppRoster(code)); star = ro[0]; const need = star.v * 1.3 * 1.08; const fl2 = farm(S);
    r = M.proposeTrade(code, [star.p.id], fl2.slice(0, 3).map(x => x.p.id), 0); PT.note("(e) 3 farm for star: ok=" + r.ok + " " + r.msg);
    const two = fl2.slice(0, 2); const sum2 = two.reduce((a, x) => a + x.v * depthBonus(code, x.p), 0);
    r = M.proposeTrade(code, [star.p.id], two.map(x => x.p.id), 0);
    PT.note("(e2) 2 farm gems (" + two.map(x => x.p.name + " ovr " + r2(I.ovr(x.p)) + " sal " + x.p.contract.salary + " v" + x.v).join(", ") + " sum " + r1(sum2) + ") for star " + star.p.name + " (ovr " + r2(I.ovr(star.p)) + " sal " + star.p.contract.salary + " v " + star.v + " need " + r1(need) + "): ok=" + r.ok + " " + r.msg.slice(0, 80));
    findings.twoFarmForStar = r.ok;
    // farm gems count: how many 2군 players out-rate the 1군 lineup?
    { const S3 = fresh(); const lu = S3.lineup.map(I.P).filter(Boolean); const minLu = Math.min(...lu.map(I.ovr)); const gems = S3.players.filter(p => !p.active && p.type == "B" && I.ovr(p) > minLu); const rot = S3.rotation.map(I.P); const minRot = Math.min(...rot.map(I.ovr)); const pg = S3.players.filter(p => !p.active && p.type == "P" && I.ovr(p) > minRot);
      PT.note("(e3) roster gen: 2군 batters better than the worst lineup starter (" + r2(minLu) + "): " + gems.length + " (best " + gems.slice().sort((a, b) => I.ovr(b) - I.ovr(a)).slice(0, 3).map(p => p.name + " " + r2(I.ovr(p)) + " sal " + p.contract.salary).join(", ") + ") · 2군 pitchers better than worst SP (" + r2(minRot) + "): " + pg.length + " · all 10 clubs: " + APP.teamList().map((t, i) => { const s = fresh(i); const l = s.lineup.map(I.P).filter(Boolean); const m = Math.min(...l.map(I.ovr)); return t.short + " " + s.players.filter(p => !p.active && p.type == "B" && I.ovr(p) > m).length }).join(",")) }
    // (f) 1-for-3 refused
    S = fresh(); ro = byVal(M.oppRoster(code)); const best = mine(S)[0]; r = M.proposeTrade(code, ro.slice(-3).map(x => x.p.id), [best.p.id], 0); PT.note("(f) 1-for-3: ok=" + r.ok + " " + r.msg);
    // (g) all-star team
    S = fresh(); const t40s = I.top40(); const oppStr0 = S.opps.map(o => o.short + " " + o.bat + "/" + o.pitch).join(","); got = 0; sold = 0; trades = 0;
    { const fl3 = farm(S); for (let k = 0; k < fl3.length; k += 2) { const pair = fl3.slice(k, k + 2); const c = codes[trades % codes.length]; const Xk = r1(pair.reduce((a, x) => a + sellPrice(c, x), 0)); if (Xk < 0.5) continue; trades++; if (M.proposeTrade(c, [], pair.map(x => x.p.id), -Xk).ok) { sold += pair.length; got += Xk } } }
    PT.note("(g) funded: sold " + sold + " farm in " + trades + " trades for " + r1(got) + " budget " + S.budget);
    const bought = [];
    for (const c of codes) { const rr = byVal(M.oppRoster(c)); const st = rr[0]; const cst = Math.ceil(st.v * 1.3 * 1.08 / 0.7 * 10) / 10; if (cst > S.budget) { PT.note("(g) " + c + " star " + st.p.name + " costs " + cst + " > budget " + S.budget); continue } const q = M.proposeTrade(c, [st.p.id], [], cst); if (q.ok) bought.push(st.p.name + "(" + (st.p.pos || st.p.role) + " ovr " + r2(I.ovr(st.p)) + " " + cst + "억)"); else PT.note("(g) fail " + c + " " + q.msg) }
    PT.note("(g) bought stars: " + bought.join(", ") + " · budget " + S.budget + " · top40 " + r1(t40s) + " -> " + r1(I.top40()) + " (cap 137.4) · opp str before " + oppStr0 + " · after " + S.opps.map(o => o.short + " " + o.bat + "/" + o.pitch).join(","));
    const bats = S.players.filter(p => p.type == "B").sort((a, b) => I.ovr(b) - I.ovr(a)); const sps = S.players.filter(p => p.type == "P").sort((a, b) => I.ovr(b) - I.ovr(a));
    S.players.forEach(p => p.active = false); bats.slice(0, 13).forEach(p => p.active = true); sps.slice(0, 13).forEach(p => p.active = true); sps.slice(0, 5).forEach(p => p.role = "SP"); sps.slice(5, 13).forEach(p => p.role = "RP");
    S.lineup = bats.slice(0, 9).map(p => p.id); S.rotation = sps.slice(0, 5).map(p => p.id); I.save(); ClubUI.render();
    PT.note("(g) super team lineup ovr " + S.lineup.map(id => r2(I.ovr(I.P(id)))).join(",") + " rotation " + S.rotation.map(id => r2(I.ovr(I.P(id)))).join(",") + " · " + (PT.text("#nextGame") || "").replace(/\s+/g, " ").slice(0, 160));
    let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay();
    PT.note("(g) super team season: " + S.W + "-" + S.L + " runs " + S.runs + "/" + S.ra + " budget " + S.budget + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재") || l.kind.includes("기금"))) + " · " + S.log.filter(l => l.t.includes("결산")).map(l => l.t).join(" | "));
    findings.allStars = { W: S.W, L: S.L, budget: S.budget, bought: bought.length };
    // (h) injured sale + round trip
    S = fresh(); const inj = mine(S)[2]; const vH = inj.v; inj.p.injury = 25; const vI = M.tradeValue(inj.p);
    r = M.proposeTrade(code, [], [inj.p.id], -Math.floor(vI * depthBonus(code, inj.p) / 0.756 * 10) / 10); PT.note("(h) injured " + inj.p.name + " value " + vH + " -> " + vI + " sold for cash: ok=" + r.ok + " " + r.msg.slice(0, 60));
    S = fresh(); const pl = mine(S)[1]; const sellX = sellPrice(code, pl); M.proposeTrade(code, [], [pl.p.id], -sellX);
    const back = M.oppRoster(code).find(p => p.id === pl.p.id); const rr2 = byVal(M.oppRoster(code)); const isTop3 = rr2.slice(0, 3).some(x => x.p.id === pl.p.id); const buyX = Math.ceil(M.tradeValue(back) * (isTop3 ? 1.3 : 1) * 1.08 / 0.7 * 10) / 10;
    r = M.proposeTrade(code, [pl.p.id], [], buyX); PT.note("(h2) round trip " + pl.p.name + ": sold " + sellX + " bought back " + buyX + " ok=" + r.ok + " net " + r1(sellX - buyX));
    // (i) AI offer, (j) deadline for received offers
    S = fresh(); let dd = 0; while (!S.fin.offers.length && S.sched.filter(g => g.result).length < 19 && dd++ < 40) ClubUI.simDay();
    if (S.fin.offers.length) { const o = S.fin.offers[0]; const w = I.P(o.want); const rr3 = M.oppRoster(o.code); const gv = o.give.map(i => rr3.find(p => p.id === i)).filter(Boolean); PT.note("(i) AI offer from " + o.short + " day " + S.day + ": wants " + w.name + " (v " + M.tradeValue(w) + " ovr " + r2(I.ovr(w)) + " age " + w.age + ") gives " + gv.map(p => p.name + "(v" + M.tradeValue(p) + " ovr " + r2(I.ovr(p)) + " age " + p.age + ")").join(",") + " · value ratio " + r2(gv.reduce((a, p) => a + M.tradeValue(p), 0) / M.tradeValue(w)));
      // hold the offer past the deadline, then accept
      while (S.sched.filter(g => g.result).length < 20 && dd++ < 80) ClubUI.simDay(); const stillThere = S.fin.offers.some(x => x.id === o.id); const n0 = S.players.length; M.answerOffer(o.id, true);
      PT.note("(j) offer held to game " + S.sched.filter(g => g.result).length + ": still listed=" + stillThere + " · accept after deadline: players " + n0 + " -> " + S.players.length + " got " + gv.map(p => !!I.P(p.id)).join(",") + " lost " + !I.P(o.want) + " · log " + S.log[0].t.slice(0, 70)) } else PT.note("(i) no AI offer within " + dd + " days");
    r = M.proposeTrade(code, [byVal(M.oppRoster(code)).slice(-1)[0].p.id], [mine(S)[0].p.id], 0); PT.note("(j2) proposeTrade after " + S.sched.filter(g => g.result).length + " games: ok=" + r.ok + " " + r.msg.slice(0, 60));
    // (k) opp strength drift: dump 20 farm players on one club for cash → its bat/pitch, and season vs it
    S = fresh(); const o0 = S.opps[0]; const before = o0.bat + "/" + o0.pitch; let n = 0; const fl4 = farm(S);
    for (let k = 0; k < fl4.length && n < 20; k += 2) { const pair = fl4.slice(k, k + 2); const Xk = r1(pair.reduce((a, x) => a + sellPrice(code, x), 0)); if (Xk < 0.5) continue; if (M.proposeTrade(code, [], pair.map(x => x.p.id), -Xk).ok) n += pair.length }
    PT.note("(k) dumped " + n + " farm players (avg ovr " + r2(avg(fl4.slice(0, n).map(x => I.ovr(x.p)))) + ") on " + o0.short + ": bat/pitch " + before + " -> " + o0.bat + "/" + o0.pitch + " · their roster " + M.oppRoster(code).length + " · AI cash spent so far this test " + r1(40 - S.budget) + " (no AI budget field: " + (o0.budget === undefined) + ")");
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 300)) }
  APP.show("market"); await PT.wait(150);
  await PT.done({ scenario: "v2_trade", findings, errs: PT.errs });
})();
