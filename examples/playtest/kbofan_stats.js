/* KBO fan playtest: 한화 after 12 sim days — standings/records screen (club naming, 10-club table, stat lines) */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("한화 12일 진행 → 순위·기록");
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH"));
  for (let i = 0; i < 12; i++) ClubUI.simDay();
  const S = ClubUI.state();
  APP.show("stats"); await PT.wait(400);
  note("standings: " + (document.getElementById("standings").innerText || "").replace(/\s+/g, " "));
  note("teamStats: " + (document.getElementById("teamStats").innerText || "").replace(/\s+/g, " "));
  note("batStats: " + (document.getElementById("batStats").innerText || "").replace(/\s+/g, " ").slice(0, 500));
  note("pitStats: " + (document.getElementById("pitStats").innerText || "").replace(/\s+/g, " ").slice(0, 500));
  note("strip: " + ["tDate", "tRec", "tRank", "tBudget", "tPay", "tMorale"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  const sp = S.players.filter(p => p.type == "P" && p.stats.G > 0).map(p => p.name + " G" + p.stats.G + " IP" + p.stats.IP + " ER" + p.stats.ER + " W" + p.stats.W + " L" + p.stats.L + " SV" + p.stats.SV + " K" + p.stats.KP + (S.rotation.includes(p.id) ? "(SP)" : "(RP)"));
  note("pitchers used: " + sp.join(" | "));
  note("opp W-L sum check: " + S.opps.map(o => o.short + " " + o.W + "-" + o.L).join(", ") + " · total games logged us " + (S.W + S.L));
  await PT.done({ persona: "KBO 골수팬 · 기록", notes: L });
})();
