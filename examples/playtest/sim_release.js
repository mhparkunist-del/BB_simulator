/* sim_release: sign FA → demote → release (buyout) → is he re-signable? release the worst 2군 in bulk; release blocked at low cash; relationships hit */
(async () => {
  const I = ClubInt, M = ClubMarket, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const clickAct = async (act, pid) => { for (let pg = 0; pg < 40; pg++) { const btn = document.querySelector("[data-act=" + act + "][data-pid='" + pid + "']"); if (btn) { btn.click(); await PT.wait(10); return true } const nb = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nb) return false; nb.click(); await PT.wait(10) } return false };
  try {
    ClubUI.fresh(APP.teamList()[5]); const S = ClubUI.state(); APP.show("roster"); await PT.wait(50);
    const fa = S.fa[0]; M.startNego(fa.id); M.offer(fa.asking, fa.age <= 29 ? 3 : 2); const q = I.P(fa.id); document.getElementById("negoModal").hidden = true; const b1 = S.budget;
    PT.note("(1) signed " + fa.name + " ask " + fa.asking + " → active=" + q.active + " budget 40 → " + b1 + " · release button exists for 1군? " + !!document.querySelector("[data-act=release][data-pid='" + q.id + "']"));
    const okDown = await clickAct("down", q.id); const rel0 = S.players.map(p => p.morale.relationships); const okRel = await clickAct("release", q.id);
    PT.note("(2) demote=" + okDown + " release=" + okRel + " → in players=" + !!I.P(q.id) + " in FA=" + S.fa.some(p => p.id === q.id) + " budget " + b1 + " → " + S.budget + " (buyout " + Math.max(0.2, r1(q.contract.salary * 0.5)) + ") · relationships avg " + r2(avg(rel0)) + " → " + r2(avg(S.players.map(p => p.morale.relationships))) + " · log " + S.log[0].t.slice(0, 80));
    // bulk release of the whole 2군: cost and payroll effect
    const farm = S.players.filter(p => !p.active); const pay0 = r1(S.players.reduce((a, p) => a + p.contract.salary, 0)); let n = 0; const bud0 = S.budget;
    for (const p of farm) { if (await clickAct("release", p.id)) n++ }
    PT.note("(3) released " + n + "/" + farm.length + " 2군 players: budget " + bud0 + " → " + S.budget + " · payroll all " + pay0 + " → " + r1(S.players.reduce((a, p) => a + p.contract.salary, 0)) + " · top40 " + r1(I.top40()) + " · players " + S.players.length + " · weekly salary saved ≈ " + r1((pay0 - S.players.reduce((a, p) => a + p.contract.salary, 0)) * 7 / 180) + "억/주 · relationships avg " + r2(avg(S.players.map(p => p.morale.relationships))));
    let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay();
    PT.note("(4) season with 26-man org: " + S.W + "-" + S.L + " budget " + S.budget + " injuries " + S.log.filter(l => l.t.includes("훈련 중 부상")).length + " · active " + S.players.filter(p => p.active).length + " · " + (S.log.find(l => l.t.includes("재정 결산")) || {}).t + " · " + JSON.stringify(S.fin.ledger.filter(l => l.kind.includes("기금") || l.kind.includes("제재"))));
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 200)) }
  await PT.done({ scenario: "release", errs: PT.errs });
})();
