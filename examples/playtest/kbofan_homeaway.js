/* KBO fan playtest: 한화 — who bats top/bottom at home vs away, a full 9-inning game at 10x (foul-hang check), season recording (W/L/무, real flag), reliever box lines, fatigue after the game */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("홈/원정 초말 · 9이닝 완주");
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); ClubUI.render();
  const S = ClubUI.state(); const nm = id => { const p = S.players.find(x => x.id === id); return p ? p.name : "?" };
  // --- HOME game (game 1 vs 삼성, 홈)
  APP.show("game"); await PT.wait(400);
  note("HOME gameDayNote: " + PT.text("#gameDayNote") + " · today " + JSON.stringify(ClubUI.gameToday()));
  if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); if (GameUI.pick.order.length < 9) PT.click("#autoOrder");
  document.getElementById("innings").value = 9; document.getElementById("spd").value = 10;
  const t0 = performance.now(); await document.getElementById("start").onclick(); await PT.until(() => !document.getElementById("game").hidden, 3000);
  let G = GameUI.state();
  note("HOME start: half=" + G.half + " → offense=" + (G.half == "top" ? "us" : "them") + " · first feed: " + (document.querySelector("#feed .l") || {}).textContent + " · HUD " + PT.text("#sInn") + " AT BAT " + PT.text("#sBatter"));
  await PT.shot("home_top1", "#cam");
  await GameUI.fast(); G = GameUI.state();
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  note("HOME 9-inning fast done in " + secs + "s · over " + G.over + " · inning " + G.inning + " " + G.half + " · score us " + G.score.us.join(",") + " (" + G.score.us.reduce((a, b) => a + b, 0) + ") them " + G.score.them.join(",") + " (" + G.score.them.reduce((a, b) => a + b, 0) + ") · innings us " + G.score.us.length + " them " + G.score.them.length + " · hits " + JSON.stringify(G.hits) + " pitches " + JSON.stringify(G.pitches));
  await PT.until(() => PT.visible("#sceneBreak"), 3000);
  note("SCORE TABLE: " + (document.getElementById("breakScore").innerText || "").replace(/\s+/g, " "));
  note("PITCHERS: " + (document.getElementById("breakPitchers").innerText || "").replace(/\s+/g, " ").slice(0, 500));
  note("used pitchers: " + JSON.stringify(G.used) + " · ourPitcher " + G.ourPitcher + " pitcher now " + G.pitcher);
  // back to club: was it recorded?
  PT.click("#resume"); await PT.wait(500);
  const S1 = ClubUI.state(); const g1 = S1.sched[0];
  note("recorded game1: " + JSON.stringify(g1.result) + " · rec " + S1.W + "-" + S1.L + "-" + (S1.D || 0) + " · day " + S1.day + " · locked " + APP.locked + " · log head: " + S1.log.slice(0, 2).map(l => l.d + " " + l.t).join(" || "));
  note("ledger head: " + ClubMarket.fin().ledger.slice(0, 2).map(l => l.d + " " + l.kind + " " + l.amt + " " + l.text).join(" || "));
  const sp = S1.players.find(p => p.name === (g1.result && g1.result.sp)); note("starter after game: " + (sp ? sp.name + " fatigue " + sp.fatigue + " condition " + sp.condition : "?") + " · rotIdx " + S1.rotIdx + " · stats " + (sp ? JSON.stringify(sp.stats) : ""));
  const rps = S1.players.filter(p => p.type == "P" && p.active && !S1.rotation.includes(p.id) && p.stats.G > 0); note("relievers credited: " + rps.map(p => p.name + " G" + p.stats.G + " IP" + p.stats.IP + " K" + p.stats.KP + " ER" + p.stats.ER).join(", "));
  // --- AWAY game: advance to game 4 (LG 원정) without auto-playing it
  let guard = 0; while (guard++ < 10) { const gt = ClubUI.gameToday(); if (gt && !gt.home && !S1.sched.find(x => x.g === gt.g).result) break; ClubUI.simDay() }
  const S2 = ClubUI.state(); note("advanced to day " + S2.day + " rec " + S2.W + "-" + S2.L + "-" + (S2.D || 0) + " today " + JSON.stringify(ClubUI.gameToday()));
  APP.show("game"); await PT.wait(400);
  note("AWAY gameDayNote: " + PT.text("#gameDayNote") + " · opp " + JSON.stringify(APP.clubLineup && APP.clubLineup.oppClub));
  if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); if (GameUI.pick.order.length < 9) PT.click("#autoOrder");
  document.getElementById("innings").value = 3; document.getElementById("spd").value = 10;
  await document.getElementById("start").onclick(); await PT.until(() => !document.getElementById("game").hidden, 3000);
  G = GameUI.state();
  note("AWAY start: half=" + G.half + " → offense=" + (G.half == "top" ? "us" : "them") + " · first feed: " + (document.querySelector("#feed .l") || {}).textContent + " · HUD " + PT.text("#sInn") + " AT BAT " + PT.text("#sBatter") + " · 대기 " + PT.text("#onDeck"));
  note("AWAY opp pitchers: " + APP.roster.opp.pitchers.map(p => p.name + "/" + p.hand).join(",") + " · opp batters " + APP.roster.opp.batters.map(b => b.name + "/" + (b.pos || "") + "/" + b.hand).join(","));
  await GameUI.fast(); G = GameUI.state(); await PT.until(() => PT.visible("#sceneBreak"), 3000);
  note("AWAY done: " + PT.text("#breakTitle") + " · SCORE TABLE: " + (document.getElementById("breakScore").innerText || "").replace(/\s+/g, " "));
  await PT.done({ persona: "KBO 골수팬 · 홈/원정", notes: L });
})();
