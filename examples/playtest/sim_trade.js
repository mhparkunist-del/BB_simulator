/* sim_trade: trade AI exploits — lopsided, counter loop, cash-only sale/buy, N-for-1 via API, 1-for-N, every club's star, junk, injured, AI offers, deadline, UI checks */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const fresh = i => { ClubUI.fresh(APP.teamList()[i === undefined ? 3 : i]); return ClubUI.state() };
  const byVal = list => list.map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
  const mine = S => byVal(S.players.filter(p => p.active && !p.noTrade));
  const farm = S => byVal(S.players.filter(p => !p.active));
  const names = ids => ids.map(id => { const p = I.P(id); return p ? p.name : "null" }).join("/");
  const lineupOk = S => ({ nulls: S.lineup.filter(id => !I.P(id)).length, dup: new Set(S.lineup).size !== S.lineup.length, nonBat: S.lineup.map(I.P).filter(p => p && p.type != "B").length, rot: S.rotation.length, rotNonSP: S.rotation.map(I.P).filter(p => p && p.role != "SP").length, active: S.players.filter(p => p.active).length });
  const findings = [];
  try {
  // ---- (a) lopsided: their best for our worst
  let S = fresh(); let code = S.opps[0].code, oppName = S.opps[0].short;
  let ro = byVal(M.oppRoster(code)); let star = ro[0]; let worst = mine(S).slice(-1)[0];
  let r = M.proposeTrade(code, [star.p.id], [worst.p.id], 0);
  PT.note("(a) lopsided " + star.p.name + "(v" + star.v + ") <- " + worst.p.name + "(v" + worst.v + "): ok=" + r.ok + " " + r.msg + " e=" + JSON.stringify(r.e));
  // ---- (b) counter loop: their best for our best, follow counters until accept
  S = fresh(); ro = byVal(M.oppRoster(code)); star = ro[0]; let best = mine(S)[0];
  let ours = [best.p.id], cash = 0, steps = [];
  for (let k = 0; k < 6; k++) { r = M.proposeTrade(code, [star.p.id], ours, cash); steps.push((r.ok ? "OK " : "") + r.msg.slice(0, 60) + " vIn=" + (r.e && r.e.vIn) + " need=" + (r.e && r.e.need)); if (r.ok) break; if (r.counter && r.counter.cash !== undefined) cash = r.counter.cash; else if (r.counter && r.counter.add) ours.push(r.counter.add); else break }
  PT.note("(b) counter loop for " + star.p.name + "(v" + star.v + ", ovr " + r2(I.ovr(star.p)) + ") giving " + best.p.name + "(v" + best.v + ", ovr " + r2(I.ovr(best.p)) + "): " + steps.join(" -> ") + " | budget " + S.budget + " lineup " + JSON.stringify(lineupOk(S)) + " newStarActive=" + (I.P(star.p.id) || {}).active + " inLineup=" + S.lineup.includes(star.p.id));
  // ---- (c) cash-only SALE: give a player, receive cash (negative cash)
  S = fresh(); let sc = farm(S)[0]; const depthBonus = p => M.oppRoster(code).filter(x => x.id !== p.id && x.type === p.type && (p.type == "B" ? x.pos === p.pos : x.role === p.role)).length <= 1 ? 1.15 : 1;
  let vIn = sc.v * depthBonus(sc.p); let X = Math.floor(vIn / (0.7 * 1.08) * 10) / 10; const b0 = S.budget;
  r = M.proposeTrade(code, [], [sc.p.id], -X);
  PT.note("(c) cash sale of farm player " + sc.p.name + " (ovr " + r2(I.ovr(sc.p)) + ", v " + sc.v + ", salary " + sc.p.contract.salary + ") for " + X + "억: ok=" + r.ok + " " + r.msg + " budget " + b0 + " -> " + S.budget + " ledger0=" + JSON.stringify(S.fin.ledger[0]) + " inc.parent=" + S.fin.inc.parent);
  { const sc2 = farm(S)[0]; const X2 = Math.floor(sc2.v * depthBonus(sc2.p) / 0.756 * 10) / 10; r = M.proposeTrade(code, [], [sc2.p.id], -(X2 + 2)); PT.note("(c2) overask: " + sc2.p.name + " v " + sc2.v + " max " + X2 + " asked " + (X2 + 2) + ": ok=" + r.ok + " " + r.msg.slice(0, 70)) }
  // sell the ENTIRE farm for cash
  S = fresh(); const nFarm0 = S.players.filter(p => !p.active).length, t40a = I.top40(), pay0 = S.players.reduce((a, p) => a + p.contract.salary, 0); let sold = 0, got = 0, rejected = 0;
  const codes = S.opps.filter(o => o.code).map(o => o.code);
  for (const x of farm(S)) { const c = codes[sold % codes.length]; const db = M.oppRoster(c).filter(y => y.id !== x.p.id && y.type === x.p.type && (x.p.type == "B" ? y.pos === x.p.pos : y.role === x.p.role)).length <= 1 ? 1.15 : 1; const Xk = Math.floor(x.v * db / 0.756 * 10) / 10; if (Xk < 0.5) continue; const rr = M.proposeTrade(c, [], [x.p.id], -Xk); if (rr.ok) { sold++; got += Xk } else rejected++ }
  PT.note("(c3) sold entire farm: " + sold + " players (rejected " + rejected + ", farm was " + nFarm0 + ") for " + r1(got) + "억 · budget now " + S.budget + " · players left " + S.players.length + " · payroll all " + r1(pay0) + " -> " + r1(S.players.reduce((a, p) => a + p.contract.salary, 0)) + " · top40 " + r1(t40a) + " -> " + r1(I.top40()) + " · opp rosters now " + codes.map(c => M.oppRoster(c).length).join("/"));
  findings.push({ name: "cash sale", farmSold: sold, cash: r1(got) });
  // now also sell bench 1군 and see how much cash is possible in total
  let got2 = 0, sold2 = 0; for (const x of mine(S).filter(x => !S.lineup.includes(x.p.id) && !S.rotation.includes(x.p.id))) { const c = codes[sold2 % codes.length]; const Xk = Math.floor(x.v / 0.756 * 10) / 10; const rr = M.proposeTrade(c, [], [x.p.id], -Xk); if (rr.ok) { sold2++; got2 += Xk } }
  PT.note("(c4) sold 1군 bench/bullpen too: " + sold2 + " for " + r1(got2) + "억 · budget " + S.budget + " · active " + S.players.filter(p => p.active).length + " · lineup " + JSON.stringify(lineupOk(S)));
  // ---- (d) cash-only BUY
  S = fresh(); ro = byVal(M.oppRoster(code)); const top3 = ro.slice(0, 3).map(x => x.p.id);
  let target = ro.find(x => !top3.includes(x.p.id) && x.v * 1.08 / 0.7 <= 40); let Xb = Math.ceil(target.v * 1.08 / 0.7 * 10) / 10;
  r = M.proposeTrade(code, [target.p.id], [], Xb);
  PT.note("(d) cash buy " + target.p.name + " (ovr " + r2(I.ovr(target.p)) + " v " + target.v + ") for " + Xb + "억: ok=" + r.ok + " " + r.msg + " budget " + S.budget + " active=" + I.P(target.p.id).active + " noTrade=" + I.P(target.p.id).noTrade + " lineup " + JSON.stringify(lineupOk(S)));
  // ---- (e) N-for-1 via API (UI caps at 2)
  S = fresh(); ro = byVal(M.oppRoster(code)); star = ro[0]; const need = star.v * 1.3 * 1.08; let give = [], sum = 0;
  for (const x of farm(S)) { if (sum >= need) break; give.push(x.p.id); sum += x.v * depthBonus(x.p) }
  const giveOvr = r2(avg(give.map(id => I.ovr(I.P(id)))));
  r = M.proposeTrade(code, [star.p.id], give, 0);
  PT.note("(e) " + give.length + " farm scrubs (sum v " + r1(sum) + ", avg ovr " + giveOvr + ") for star " + star.p.name + " (ovr " + r2(I.ovr(star.p)) + " v " + star.v + " need " + r1(need) + "): ok=" + r.ok + " " + r.msg.slice(0, 80) + " · opp roster " + M.oppRoster(code).length + " · opp bat/pitch " + S.opps[0].bat + "/" + S.opps[0].pitch);
  findings.push({ name: "N-for-1", n: give.length, ok: r.ok });
  // ---- (f) 1-for-N: our best for their many
  S = fresh(); ro = byVal(M.oppRoster(code)); best = mine(S)[0]; let take = [], tv = 0; const top3b = ro.slice(0, 3).map(x => x.p.id);
  for (const x of ro.slice().reverse()) { const nv = x.v * (top3b.includes(x.p.id) ? 1.3 : 1); if ((tv + nv) * 1.08 > best.v * depthBonus(best.p)) continue; take.push(x.p.id); tv += nv; if (take.length >= 12) break }
  const act0 = S.players.filter(p => p.active).length;
  r = M.proposeTrade(code, take, [best.p.id], 0);
  PT.note("(f) " + best.p.name + " (v " + best.v + ") for " + take.length + " of theirs (v sum " + r1(tv) + "): ok=" + r.ok + " " + r.msg.slice(0, 60) + " · active " + act0 + " -> " + S.players.filter(p => p.active).length + " players " + S.players.length + " lineup " + JSON.stringify(lineupOk(S)));
  // ---- (g) every club's #1 by value: fund with farm sales, buy with cash + junk
  S = fresh(); const t40s = I.top40(); const oppStr0 = S.opps.map(o => o.short + " " + o.bat + "/" + o.pitch).join(",");
  got = 0; sold = 0; for (const x of farm(S)) { const c = codes[sold % codes.length]; const Xk = Math.floor(x.v / 0.756 * 10) / 10; if (Xk < 0.5) continue; if (M.proposeTrade(c, [], [x.p.id], -Xk).ok) { sold++; got += Xk } }
  PT.note("(g) funded: sold " + sold + " farm for " + r1(got) + " budget " + S.budget);
  const bought = [];
  for (const c of codes) { const rr = byVal(M.oppRoster(c)); const st = rr[0]; const cst = Math.ceil(st.v * 1.3 * 1.08 / 0.7 * 10) / 10; if (cst > S.budget) { PT.note("(g) " + c + " star " + st.p.name + " costs " + cst + " > budget " + S.budget); continue } const q = M.proposeTrade(c, [st.p.id], [], cst); if (q.ok) bought.push(st.p.name + "(" + (st.p.pos || st.p.role) + " ovr " + r2(I.ovr(st.p)) + " " + cst + "억)"); else PT.note("(g) fail " + c + " " + q.msg) }
  PT.note("(g) bought stars: " + bought.join(", ") + " · budget " + S.budget + " · active " + S.players.filter(p => p.active).length + " · top40 " + r1(t40s) + " -> " + r1(I.top40()) + " (cap 137.4) · opp str before " + oppStr0);
  PT.note("(g) opp str after " + S.opps.map(o => o.short + " " + o.bat + "/" + o.pitch).join(",") + " · lineup " + JSON.stringify(lineupOk(S)) + " · new stars active? " + S.players.filter(p => p.id >= 10000).map(p => p.name + ":" + (p.active ? "1군" : "2군")).join(","));
  // persistence: save → reload state → oppRoster still excludes
  I.save(); const saved = await APP.kv.get("club"); const starIds = S.players.filter(p => p.id >= 10000).map(p => p.id);
  ClubUI.setState(saved); const S2 = ClubUI.state(); const still = codes.map(c => M.oppRoster(c).filter(p => starIds.includes(p.id)).length).reduce((a, b) => a + b, 0);
  PT.note("(g) persistence after save/setState: oppMods clubs " + Object.keys(S2.fin.oppMods).length + " · stars still on opp rosters: " + still + " · our stars " + S2.players.filter(p => p.id >= 10000).length);
  // build super lineup/rotation, sim to 30
  S = S2; const bats = S.players.filter(p => p.type == "B").sort((a, b) => I.ovr(b) - I.ovr(a)); const sps = S.players.filter(p => p.type == "P").sort((a, b) => I.ovr(b) - I.ovr(a));
  S.players.forEach(p => p.active = false); bats.slice(0, 13).forEach(p => p.active = true); sps.slice(0, 13).forEach(p => p.active = true); sps.slice(0, 5).forEach(p => p.role = "SP"); sps.slice(5, 13).forEach(p => p.role = "RP");
  S.lineup = bats.slice(0, 9).map(p => p.id); S.rotation = sps.slice(0, 5).map(p => p.id); I.save(); ClubUI.render();
  PT.note("(g) super team: lineup ovr " + S.lineup.map(id => r2(I.ovr(I.P(id)))).join(",") + " rotation ovr " + S.rotation.map(id => r2(I.ovr(I.P(id)))).join(",") + " strengths " + (PT.text("#nextGame") || "").replace(/\s+/g, " ").slice(0, 160));
  let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay();
  PT.note("(g) super team season: " + S.W + "-" + S.L + " runs " + S.runs + "/" + S.ra + " budget " + S.budget + " tax ledger: " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("제재") || l.kind.includes("기금"))) + " season log: " + S.log.filter(l => l.t.includes("결산")).map(l => l.t).join(" | "));
  findings.push({ name: "all-stars", W: S.W, L: S.L, runs: S.runs, ra: S.ra, budget: S.budget });
  // ---- (h) junk & injured
  S = fresh(); ro = byVal(M.oppRoster(code)); const theirScrub = ro.slice(-1)[0]; const ourScrub = farm(S).slice(-1)[0];
  r = M.proposeTrade(code, [theirScrub.p.id], [ourScrub.p.id], 0); PT.note("(h) our worst farm " + ourScrub.p.name + "(v" + ourScrub.v + ") for their worst " + theirScrub.p.name + "(v" + theirScrub.v + "): ok=" + r.ok + " " + r.msg.slice(0, 70));
  const inj = mine(S)[2]; const vH = inj.v; inj.p.injury = 25; const vI = M.tradeValue(inj.p); PT.note("(h2) injured player value " + vH + " -> " + vI + " (x" + r2(vI / vH) + ")");
  r = M.proposeTrade(code, [], [inj.p.id], -Math.floor(vI * depthBonus(inj.p) / 0.756 * 10) / 10); PT.note("(h3) sold injured " + inj.p.name + " for cash: ok=" + r.ok + " " + r.msg.slice(0, 60) + " · on opp roster with injury=" + (M.oppRoster(code).find(p => p.id === inj.p.id) || {}).injury);
  // trade the same player away and back: value/cash asymmetry
  S = fresh(); const pl = mine(S)[1]; const v1 = pl.v; const sellX = Math.floor(v1 * depthBonus(pl.p) / 0.756 * 10) / 10; M.proposeTrade(code, [], [pl.p.id], -sellX);
  const back = M.oppRoster(code).find(p => p.id === pl.p.id); const rr2 = byVal(M.oppRoster(code)); const isTop3 = rr2.slice(0, 3).some(x => x.p.id === pl.p.id); const buyX = Math.ceil(M.tradeValue(back) * (isTop3 ? 1.3 : 1) * 1.08 / 0.7 * 10) / 10;
  r = M.proposeTrade(code, [pl.p.id], [], buyX); PT.note("(h4) round trip " + pl.p.name + ": sold for " + sellX + " bought back for " + buyX + " ok=" + r.ok + " net " + r1(sellX - buyX) + " · budget " + S.budget + " · back in club=" + !!I.P(pl.p.id) + " active=" + (I.P(pl.p.id) || {}).active);
  // ---- (i) AI offers: sim until one appears, accept it
  S = fresh(); let dd = 0; while (!S.fin.offers.length && S.sched.filter(g => g.result).length < 19 && dd++ < 40) ClubUI.simDay();
  if (S.fin.offers.length) { const o = S.fin.offers[0]; const w = I.P(o.want); const rr3 = M.oppRoster(o.code); const gv = o.give.map(i => rr3.find(p => p.id === i)).filter(Boolean); PT.note("(i) AI offer from " + o.short + ": wants " + w.name + " (v " + M.tradeValue(w) + " ovr " + r2(I.ovr(w)) + ") gives " + gv.map(p => p.name + "(v" + M.tradeValue(p) + " ovr " + r2(I.ovr(p)) + " age " + p.age + ")").join(",") + " · value ratio " + r2(gv.reduce((a, p) => a + M.tradeValue(p), 0) / M.tradeValue(w)) + " · day " + S.day); const n0 = S.players.length; M.answerOffer(o.id, true); PT.note("(i) accepted: players " + n0 + " -> " + S.players.length + " have " + gv.map(p => !!I.P(p.id)).join(",") + " lost " + !I.P(o.want) + " lineup " + JSON.stringify(lineupOk(S))) } else PT.note("(i) no AI offer within " + dd + " days");
  // ---- (j) deadline
  while (S.sched.filter(g => g.result).length < 20 && dd++ < 80) ClubUI.simDay();
  r = M.proposeTrade(code, [byVal(M.oppRoster(code)).slice(-1)[0].p.id], [mine(S)[0].p.id], 0); PT.note("(j) after " + S.sched.filter(g => g.result).length + " games: ok=" + r.ok + " " + r.msg + " · tradeGo disabled=" + (document.getElementById("tradeGo") || {}).disabled);
  // ---- (k) UI: 3rd checkbox refused, propose via button
  S = fresh(); APP.show("market"); await PT.wait(100);
  const sel = document.getElementById("tradeClub"); sel.value = code; sel.dispatchEvent(new Event("change")); await PT.wait(50);
  const boxes = [...document.querySelectorAll("#tradeTheirs input")]; boxes[0].click(); boxes[1].click(); boxes[2].click(); await PT.wait(50);
  const checked = [...document.querySelectorAll("#tradeTheirs input")].filter(b => b.checked).length;
  const ob = [...document.querySelectorAll("#tradeOurs input")]; ob[0].click(); await PT.wait(50);
  document.getElementById("tradeCash").value = 10; PT.click("#tradeGo"); await PT.wait(100);
  PT.note("(k) UI: theirs checked after 3 clicks = " + checked + " · tradeMsg: " + PT.text("#tradeMsg") + " · budget " + ClubUI.state().budget + " · cash field now " + document.getElementById("tradeCash").value);
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 300)) }
  await PT.done({ scenario: "trade", findings, errs: PT.errs });
})();
