/* KBO fan playtest: 한화 two weeks of season — gate receipts, attendance, weekly settlement, payroll vs cap on the budget screen */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("한화 2주 진행 → 예산");
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); const M = ClubMarket;
  const S0 = ClubUI.state(); const pay = S0.players.reduce((a, p) => a + p.contract.salary, 0);
  note("start budget " + S0.budget + " total payroll(all players) " + pay.toFixed(1) + " top40 " + ClubInt.top40().toFixed(1) + " expected weekly salary " + (pay * 7 / 180).toFixed(2) + "억 · 1군 avg " + (S0.players.filter(p => p.active).reduce((a, p) => a + p.contract.salary, 0) / S0.players.filter(p => p.active).length).toFixed(2) + " 2군 avg " + (S0.players.filter(p => !p.active).reduce((a, p) => a + p.contract.salary, 0) / S0.players.filter(p => !p.active).length).toFixed(2));
  for (let i = 0; i < 14; i++) ClubUI.simDay();
  const S = ClubUI.state(); const f = M.fin();
  note("day " + S.day + " rec " + S.W + "-" + S.L + " budget " + S.budget + " inc " + JSON.stringify(f.inc) + " exp " + JSON.stringify(f.exp) + " att total " + f.att + " home games " + S.sched.filter(g => g.result && g.home).length + " avg att " + Math.round(f.att / Math.max(1, S.sched.filter(g => g.result && g.home).length)));
  note("LEDGER: " + f.ledger.slice().reverse().map(l => l.d + " " + l.kind + " " + (l.amt >= 0 ? "+" : "") + l.amt + " " + l.text).join(" || "));
  APP.show("market"); await PT.wait(300);
  note("BUDGET SCREEN: " + (document.getElementById("budget").innerText || "").replace(/\s+/g, " ").slice(0, 900));
  note("strip: " + ["tDate", "tRec", "tRank", "tBudget", "tPay", "tMorale"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  await PT.done({ persona: "KBO 골수팬 · 예산", notes: L });
})();
