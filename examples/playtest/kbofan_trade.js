/* KBO fan playtest: 한화 GM tries to fleece LG — their best player for our worst, then the same with cash, then star-for-star; all through the trade UI */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("한화 → LG 트레이드 시도");
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); const S = ClubUI.state(); const M = ClubMarket;
  APP.show("market"); await PT.wait(300);
  const CODE = "LG";
  const sel = document.getElementById("tradeClub"); sel.value = CODE; sel.onchange(); await PT.wait(100);
  const roster = M.oppRoster(CODE).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
  const mine = S.players.filter(p => p.active).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
  const f = x => x.p.name + "(" + (x.p.pos || x.p.role) + " " + x.p.age + "세 ovr" + ClubInt.ovr(x.p).toFixed(2) + " " + x.p.contract.salary + "억 v" + x.v + ")";
  note("LG roster size " + roster.length + " top8 by value: " + roster.slice(0, 8).map(f).join(" | "));
  note("LG bottom3: " + roster.slice(-3).map(f).join(" | "));
  note("HH top8 by value: " + mine.slice(0, 8).map(f).join(" | "));
  note("HH bottom5: " + mine.slice(-5).map(f).join(" | "));
  const star = roster[0], junk = mine[mine.length - 1];
  async function tick(side, id) { for (let k = 0; k < 10; k++) { const el = document.querySelector("#trade" + (side === "theirs" ? "Theirs" : "Ours") + " input[data-id='" + id + "']"); if (el) { if (!el.checked) { el.checked = true; el.onchange() } await PT.wait(60); return true } const nx = document.querySelector("#trade" + (side === "theirs" ? "Theirs" : "Ours") + " [data-pg][data-d='1']"); if (!nx) break; nx.click(); await PT.wait(60) } note("checkbox not found " + side + " " + id); return false }
  // 1) star for junk, no cash
  await tick("theirs", star.p.id); await tick("ours", junk.p.id);
  document.getElementById("tradeCash").value = 0; PT.click("#tradeGo"); await PT.wait(200);
  note("T1 star-for-junk (" + star.p.name + " ⇄ " + junk.p.name + "): " + PT.text("#tradeMsg"));
  // 2) same with 40억 cash (max)
  await tick("theirs", star.p.id); await tick("ours", junk.p.id);
  document.getElementById("tradeCash").value = 40; PT.click("#tradeGo"); await PT.wait(200);
  const S2 = ClubUI.state();
  note("T2 star-for-junk + 40억: " + PT.text("#tradeMsg") + " · got star? " + S2.players.some(p => p.name === star.p.name) + " budget now " + S2.budget + " LG mods " + JSON.stringify(M.fin().oppMods[CODE] ? { removed: M.fin().oppMods[CODE].removed.length, added: M.fin().oppMods[CODE].added.map(p => p.name) } : null));
  note("valuation math: star v" + star.v + " ×1.3(top3) ×1.08 = need " + (star.v * 1.3 * 1.08).toFixed(1) + " ; junk v" + junk.v + " + 40억×0.7 = " + (junk.v + 28).toFixed(1));
  // 3) star for star (their #1 for our #1), no cash — after T2 the rosters may have changed, recompute
  const roster3 = M.oppRoster(CODE).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
  const mine3 = ClubUI.state().players.filter(p => p.active && !p.noTrade).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
  const r3 = M.proposeTrade(CODE, [roster3[0].p.id], [mine3[0].p.id], 0);
  note("T3 star-for-star (" + roster3[0].p.name + " v" + roster3[0].v + " ⇄ " + mine3[0].p.name + " v" + mine3[0].v + "): " + r3.msg + " ok=" + r3.ok);
  // 4) two of their mid players for one of ours mid (counter with player?)
  const r4 = M.proposeTrade(CODE, [roster3[4].p.id, roster3[5].p.id], [mine3[6].p.id], 0);
  note("T4 2-for-1 (" + roster3[4].p.name + "+" + roster3[5].p.name + " ⇄ " + mine3[6].p.name + "): " + r4.msg + " ok=" + r4.ok + (r4.counter ? " counter=" + JSON.stringify(r4.counter) : ""));
  // 5) 류현진 (39세) valuation and 문동주 (2군) — are the values sane for a fan?
  const S5 = ClubUI.state(); ["류현진", "노시환", "문동주", "폰세", "강백호", "김서현", "최재훈"].forEach(n => { const p = S5.players.find(x => x.name === n); if (p) note("VALUE " + n + " " + (p.pos || p.role) + " " + p.age + "세 ovr" + ClubInt.ovr(p).toFixed(2) + " sal " + p.contract.salary + " v=" + M.tradeValue(p) + (p.active ? "" : " [2군]")) });
  note("AI offers pending: " + M.fin().offers.length + " · ledger: " + M.fin().ledger.map(l => l.kind + " " + l.amt + " " + l.text).join(" | "));
  ClubUI.render(); await PT.wait(200);
  note("tradeMsg on screen: " + PT.text("#tradeMsg") + " · budget hint: " + (document.querySelector("#budget .hint") || {}).textContent);
  await PT.done({ persona: "KBO 골수팬 · 트레이드", notes: L });
})();
