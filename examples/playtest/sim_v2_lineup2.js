/* sim_v2_lineup2: UI-legal path to empty lineup slots (demote bench → cash-sell lineup starters) and the season it produces; draw mark in schedule; 9x-hero game screen */
(async () => {
  const I = ClubInt, M = ClubMarket, r2 = v => Math.round(v * 100) / 100;
  const strengths = () => { ClubUI.render(); const t = PT.text("#nextGame") || ""; const m = t.match(/타선 ([\d.]+) · 수비 ([\d.]+)/); return m ? { B: +m[1], D: +m[2] } : null };
  const season = () => { const S = ClubUI.state(); let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay(); return { W: S.W, L: S.L, runs: S.runs, ra: S.ra } };
  const batScore = p => 0.4 * p.attrs.contact + 0.3 * p.attrs.power + 0.3 * p.attrs.eye;
  const clickAct = async (act, pid) => { for (let pg = 0; pg < 40; pg++) { const btn = document.querySelector("[data-act=" + act + "][data-pid='" + pid + "']"); if (btn) { btn.click(); await PT.wait(10); return true } const nb = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nb) return false; nb.click(); await PT.wait(10) } return false };
  try {
    ClubUI.fresh(APP.teamList()[4]); let S = ClubUI.state(); const ctrl = { ...strengths() }; const code = S.opps[0].code;
    APP.show("roster"); await PT.wait(50); const bench = S.players.filter(p => p.type == "B" && p.active && !S.lineup.includes(p.id)); let nd = 0; for (const p of bench) if (await clickAct("down", p.id)) nd++;
    const hasDownForStarter = !!document.querySelector("[data-act=down][data-pid='" + S.lineup[0] + "']");
    // sell the 4 worst starters for cash through the market form (2 per trade)
    const worst = S.lineup.map(I.P).filter(Boolean).sort((a, b) => batScore(a) - batScore(b)).slice(0, 4); let sold = 0; const msgs = [];
    APP.show("market"); await PT.wait(80); const sel = document.getElementById("tradeClub"); sel.value = code; sel.dispatchEvent(new Event("change")); await PT.wait(50);
    for (let k = 0; k < 4; k += 2) { const pair = worst.slice(k, k + 2); for (const p of pair) { let box = null; for (let pg = 0; pg < 40 && !box; pg++) { box = [...document.querySelectorAll("#tradeOurs input")].find(b => +b.dataset.id === p.id); if (!box) { const nb = document.querySelector("#tradeOurs [data-pg][data-d='1']"); if (!nb) break; nb.click(); await PT.wait(10) } } if (box && !box.checked) { box.click(); await PT.wait(30) } }
      const X = Math.floor(pair.reduce((a, p) => a + M.tradeValue(p), 0) / 0.756 * 10) / 10; document.getElementById("tradeCash").value = -X; PT.click("#tradeGo"); await PT.wait(80); msgs.push((PT.text("#tradeMsg") || "").slice(0, 50)); sold += pair.filter(p => !I.P(p.id)).length; sel.value = code; sel.dispatchEvent(new Event("change")); await PT.wait(40) }
    const st = strengths(); PT.note("(1) UI path: demoted bench " + nd + "/" + bench.length + " (down button on starters? " + hasDownForStarter + ") · sold starters " + sold + "/4 via form [" + msgs.join(" | ") + "] · lineup now " + S.lineup.map(id => { const p = I.P(id); return p ? p.name : "null" }).join("/") + " · nulls " + S.lineup.filter(id => !I.P(id)).length + " · strengths " + JSON.stringify(ctrl) + " -> " + JSON.stringify(st) + " budget " + S.budget + " · roster screen warn: " + ((document.querySelector("#lineup .warn") || {}).textContent || "none"));
    const r = season(); PT.note("(1b) season with " + S.lineup.filter(id => I.P(id)).length + "-man lineup (UI path): " + JSON.stringify(r));
    // (2) schedule mark for a draw
    ClubUI.fresh(APP.teamList()[4]); S = ClubUI.state(); ClubUI.recordExternalGame({ us: 1, them: 1, sp: I.P(S.rotation[0]).name, ip: 5, er: 1 }); ClubUI.simDay(); APP.show("schedule"); await PT.wait(60);
    const rows = [...document.querySelectorAll("#schedList tr, #schedule tr, #tab-schedule tr")].map(r => r.textContent.replace(/\s+/g, " ")).filter(t => t.includes("1차전") || t.includes("삼성")).slice(0, 2);
    PT.note("(2) draw 1:1 → schedule rows: " + rows.join(" || ") + " · header " + PT.text("#tRec") + " · log " + S.log.filter(l => l.t.includes("1:1")).map(l => l.t.slice(0, 30)).join(" | ") + " · stats screen W-L text: " + ((document.getElementById("tab-stats") || {}).textContent || "").replace(/\s+/g, " ").slice(0, 0));
    // (3) 9x hero → game screen
    ClubUI.fresh(APP.teamList()[4]); S = ClubUI.state(); const hero = S.players.filter(p => p.type == "B" && p.active).sort((a, b) => batScore(b) - batScore(a))[0]; S.lineup = Array(9).fill(hero.id); I.save(); APP.show("schedule"); await PT.wait(30); APP.show("game"); await PT.wait(150);
    PT.note("(3) 9x " + hero.name + " game screen: clubLineup.order=" + JSON.stringify(APP.clubLineup && APP.clubLineup.order) + " pick.order=" + JSON.stringify(GameUI.pick.order) + " selected cards=" + document.querySelectorAll("[data-b].sel").length + " start disabled=" + document.getElementById("start").disabled);
    document.getElementById("innings").value = 1; document.getElementById("seed").value = 2; await document.getElementById("start").onclick(); await PT.wait(100); const started = !document.getElementById("game").hidden;
    if (started) { let stopped = false; const t = setTimeout(() => { stopped = true; PT.click("#stop") }, 6000); await GameUI.fast(); clearTimeout(t); const G = GameUI.state(); PT.note("(3b) 9x hero 1-inning game: over=" + G.over + " stopped=" + stopped + " lineup used " + G.lineup.join(",") + " box keys " + Object.keys(G.box.us).join(",") + " score " + G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0)); if (G.over) { PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 3000).catch(() => 0); PT.click("#eventOk") } } else PT.note("(3b) start refused: " + (PT.text("#feed") || "").slice(-60));
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 300)) }
  await PT.done({ scenario: "v2_lineup2", errs: PT.errs });
})();
