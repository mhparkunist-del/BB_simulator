/* KBO fan playtest: balance sweep — quick-sim a full 30-game season for each of the 10 clubs and read W-L, runs, final standings, cap penalty; end on 키움's stats screen */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("10구단 시즌 시뮬");
  const T = APP.teamList(); const res = [];
  for (const t of T) {
    ClubUI.fresh(t); let n = 0; while (ClubUI.state().sched.some(g => !g.result) && n < 45) { ClubUI.simDay(); n++ }
    const S = ClubUI.state(); const rows = ClubInt.rankNow(); const me = rows.findIndex(r => r.me) + 1;
    const gp = S.opps.map(o => o.W + o.L);
    res.push(t.code + " " + S.W + "-" + S.L + " R" + S.runs + "/RA" + S.ra + " rank " + me + "/" + rows.length + " top40 " + ClubInt.top40().toFixed(1) + " budget " + S.budget + " oppGames " + Math.min(...gp) + "-" + Math.max(...gp) + " days " + n);
    if (t.code === "WO") { note("키움 final standings: " + rows.map((r, i) => (i + 1) + "." + r.name + " " + r.W + "-" + r.L).join(", ")); note("키움 last log: " + S.log.slice(0, 5).map(l => l.d + " " + l.t).join(" || ")); note("키움 ledger tail: " + ClubMarket.fin().ledger.slice(0, 4).map(l => l.d + " " + l.kind + " " + l.amt + " " + l.text).join(" || ")) }
  }
  note("SEASON RESULTS: " + res.join(" | "));
  APP.show("stats"); await PT.wait(300);
  note("strip: " + ["tDate", "tRec", "tRank", "tBudget", "tPay"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  await PT.done({ persona: "KBO 골수팬 · 밸런스", notes: L });
})();
