/* KBO fan playtest: 새 시즌 — finish a 한화 season, press 새 시즌, dismiss the owner event, verify the club is kept and the record/day/budget/schedule reset; also check standings naming and the "N위 / 6" header vs 10 clubs, and the team-screen claim text */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("새 시즌 · 순위 표기");
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); ClubUI.render();
  let n = 0; while (ClubUI.state().sched.some(g => !g.result) && n < 45) { ClubUI.simDay(); n++ }
  let S = ClubUI.state(); const before = { W: S.W, L: S.L, D: S.D || 0, day: S.day, budget: S.budget, fatigueAvg: (S.players.filter(p => p.active).reduce((a, p) => a + p.fatigue, 0) / 24).toFixed(2), statsG: S.players.filter(p => p.stats.G > 0).length };
  note("before 새 시즌: " + JSON.stringify(before) + " · rankNow: " + ClubInt.rankNow().map((r, i) => (i + 1) + "." + r.name + " " + r.W + "-" + r.L).join(", "));
  APP.show("schedule"); await PT.wait(300);
  note("header: " + ["tDate", "tRec", "tRank", "tBudget", "tPay"].map(id => id + "=" + PT.text("#" + id)).join(" ") + " · rankNow length " + ClubInt.rankNow().length);
  window.confirm = () => true;   // headless: the 새 시즌 button asks confirm(), which never returns true without a user
  document.getElementById("reset").onclick(); await PT.wait(600);
  note("after reset click: event " + PT.text("#eventTitle") + " · modal visible " + PT.visible("#eventModal"));
  if (PT.visible("#eventModal")) { PT.click("#eventOk"); await PT.wait(400) }
  if (PT.visible("#tutorial")) { note("tutorial shown again: " + PT.text("#tutText")); PT.click("#tutSkip"); await PT.wait(200) }
  S = ClubUI.state();
  const after = { club: S.club.name, W: S.W, L: S.L, D: S.D || 0, day: S.day, budget: S.budget, players: S.players.length, sched0: S.sched[0].date, results: S.sched.filter(g => g.result).length, fatigueAvg: (S.players.filter(p => p.active).reduce((a, p) => a + p.fatigue, 0) / 24).toFixed(2), statsG: S.players.filter(p => p.stats.G > 0).length, ledger: ClubMarket.fin().ledger.length, log0: S.log[0] && S.log[0].t.slice(0, 80) };
  note("after 새 시즌: " + JSON.stringify(after));
  note("header after: " + ["tDate", "tRec", "tRank", "tBudget", "tPay"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  // standings naming / rank denominator
  APP.show("stats"); await PT.wait(300);
  note("standings rows: " + [...document.querySelectorAll("#standings tr")].slice(0, 3).map(tr => tr.textContent.replace(/\s+/g, " ").trim()).join(" | ") + " · rows " + document.querySelectorAll("#standings tr").length);
  const src = document.documentElement.innerHTML; note("'상대 5구단' text present in page: " + /상대 5구단/.test(src) + " · '/ 6' in tRank: " + PT.text("#tRank"));
  await PT.done({ persona: "KBO 골수팬 · 새 시즌", notes: L });
})();
