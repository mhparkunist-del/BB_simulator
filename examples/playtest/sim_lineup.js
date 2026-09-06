/* sim_lineup: lineup abuse — pitcher in lineup, duplicates, empty slots (UI-reachable), position relabel, injured starter, game-screen coping, seed determinism, 1-inning game counted */
(async () => {
  const I = ClubInt, r2 = v => Math.round(v * 100) / 100, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const fresh = i => { ClubUI.fresh(APP.teamList()[i === undefined ? 4 : i]); return ClubUI.state() };
  const strengths = () => { ClubUI.render(); const t = PT.text("#nextGame") || ""; const m = t.match(/타선 ([\d.]+) · 수비 ([\d.]+)/); return m ? { B: +m[1], D: +m[2] } : null };
  const season = () => { const S = ClubUI.state(); let d = 0; while (S.sched.filter(g => g.result).length < 30 && d++ < 60) ClubUI.simDay(); return { W: S.W, L: S.L, runs: S.runs, ra: S.ra } };
  const batScore = p => 0.4 * p.attrs.contact + 0.3 * p.attrs.power + 0.3 * p.attrs.eye;
  const fastWithGuard = async ms => { let stopped = false; const t = setTimeout(() => { stopped = true; PT.click("#stop") }, ms); await GameUI.fast(); clearTimeout(t); return stopped };
  let ctrl = null, topN = {}, rUI = null, rDup = null;
  try {
  // control
  let S = fresh(); ctrl = { ...strengths(), ...season() }; PT.note("control full lineup: " + JSON.stringify(ctrl));
  // (c) top-N lineup with empty slots (API), same seed
  const bats = () => ClubUI.state().players.filter(p => p.type == "B" && p.active).sort((a, b) => batScore(b) - batScore(a));
  for (const N of [7, 5, 3, 1]) { S = fresh(); const b = bats(); S.lineup = b.slice(0, N).map(p => p.id).concat(Array(9 - N).fill(null)); I.save(); const st = strengths(); const r = season(); topN[N] = { ...st, ...r }; PT.note("top-" + N + " + " + (9 - N) + " empty: " + JSON.stringify(topN[N]) + " warn: " + (document.querySelector("#lineup .warn") || {}).textContent) }
  // (d) position relabel: full lineup but relabel so all 8 positions are covered → D
  S = fresh(); const w0 = I.positionWarnings(); const st0 = strengths(); const need = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]; S.lineup.map(I.P).forEach((p, i) => { if (p) p.pos = need[i] }); I.save(); const st1 = strengths();
  PT.note("(d) relabel positions: warnings before " + JSON.stringify(w0) + " D " + st0.D + " -> after " + JSON.stringify(I.positionWarnings()) + " D " + st1.D + " · positions of a real C now? " + S.lineup.map(I.P).map(p => p.name + ":" + p.pos).join(","));
  // best 9 bats regardless of position, relabeled to cover
  S = fresh(); let b = bats(); S.lineup = b.slice(0, 9).map(p => p.id); S.lineup.map(I.P).forEach((p, i) => p.pos = need[i]); I.save(); const st2 = strengths(); const r2s = season(); PT.note("(d2) best-9-bats relabeled: " + JSON.stringify({ ...st2, ...r2s }) + " vs control " + JSON.stringify(ctrl));
  // top-5 relabeled to 5 positions
  S = fresh(); b = bats(); S.lineup = b.slice(0, 5).map(p => p.id).concat(Array(4).fill(null)); S.lineup.map(I.P).filter(Boolean).forEach((p, i) => p.pos = need[i]); I.save(); const st3 = strengths(); const r3 = season(); PT.note("(d3) top-5 relabeled + 4 empty: " + JSON.stringify({ ...st3, ...r3 }));
  // (d4) best 13 bats + 13 pitchers from the whole organisation (farm gems), best 9 / best 5 SP
  S = fresh(); { const all = S.players; const bb = all.filter(p => p.type == "B").sort((a, b) => I.ovr(b) - I.ovr(a)); const pp = all.filter(p => p.type == "P").sort((a, b) => I.ovr(b) - I.ovr(a)); const farmGems = bb.slice(0, 13).filter(p => !p.active).length + pp.slice(0, 13).filter(p => !p.active).length;
    all.forEach(p => p.active = false); bb.slice(0, 13).forEach(p => p.active = true); pp.slice(0, 13).forEach(p => p.active = true); pp.slice(0, 5).forEach(p => p.role = "SP"); pp.slice(5, 13).forEach(p => p.role = "RP"); S.lineup = bb.slice(0, 9).map(p => p.id); S.lineup.map(I.P).forEach((p, i) => p.pos = need[i]); S.rotation = pp.slice(0, 5).map(p => p.id); I.save();
    const st4 = strengths(); const r4 = season(); PT.note("(d4) best-from-whole-org (" + farmGems + " of 26 came from 2군): lineup ovr " + r2(avg(S.lineup.map(id => I.ovr(I.P(id))))) + " rot ovr " + r2(avg(S.rotation.map(id => I.ovr(I.P(id))))) + " " + JSON.stringify({ ...st4, ...r4 }) + " vs control " + JSON.stringify(ctrl)) }
  // (c-UI) empty slots reachable through the UI: demote bench batters, then demote lineup batters
  S = fresh(); APP.show("roster"); await PT.wait(50); const bench = S.players.filter(p => p.type == "B" && p.active && !S.lineup.includes(p.id));
  const clickAct = async (act, pid) => { for (let pg = 0; pg < 30; pg++) { const btn = document.querySelector("[data-act=" + act + "][data-pid='" + pid + "']"); if (btn) { btn.click(); await PT.wait(10); return true } const nb = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nb) return false; nb.click(); await PT.wait(10) } return false };
  for (const p of bench) await clickAct("down", p.id);
  const worst = S.lineup.map(I.P).filter(Boolean).sort((a, b) => batScore(a) - batScore(b)).slice(0, 4);
  for (const p of worst) await clickAct("down", p.id);
  PT.note("(c-UI) after demoting bench(" + bench.length + ") + 4 worst starters: lineup " + S.lineup.map(id => { const p = I.P(id); return p ? p.name : "null" }).join("/") + " active " + S.players.filter(p => p.active).length + " lineup table shows: " + (document.querySelector("#lineup") || {}).textContent.replace(/\s+/g, " ").slice(0, 120) + " · " + JSON.stringify(strengths()));
  rUI = season(); PT.note("(c-UI) season with 5-man lineup via UI: " + JSON.stringify(rUI) + " errs " + PT.errs.length);
  // (a) pitcher in lineup
  S = fresh(); const sp = I.P(S.rotation[0]); const orig = S.lineup[0]; S.lineup[0] = sp.id; I.save(); const stP = strengths();
  ClubUI.simDay(); const g1 = S.sched.find(g => g.result); PT.note("(a) pitcher " + sp.name + " in lineup slot 1: strengths " + JSON.stringify(stP) + " · game result " + JSON.stringify(g1.result) + " · pitcher stats " + JSON.stringify(sp.stats) + " · errs " + JSON.stringify(PT.errs));
  APP.show("game"); await PT.wait(150); const CL = APP.clubLineup; const selNames = [...document.querySelectorAll("[data-b].sel")].map(e => e.querySelector("b").textContent);
  PT.note("(a2) game screen with pitcher in lineup: clubLineup.order=" + JSON.stringify(CL && CL.order) + " pick.order=" + JSON.stringify(GameUI.pick.order) + " selected cards=" + selNames.join("/") + " · lineup names " + S.lineup.map(id => I.P(id).name).join("/") + " · start disabled=" + document.getElementById("start").disabled);
  document.getElementById("innings").value = 1; if (!document.getElementById("start").disabled) { await document.getElementById("start").onclick(); await PT.until(() => !document.getElementById("game").hidden, 3000); const stopped = await fastWithGuard(5000); const G = GameUI.state(); PT.note("(a3) played 1 inning: stopped=" + stopped + " over=" + G.over + " pitches " + (G.pitches.us + G.pitches.them) + " inning " + G.inning + G.half + " count " + G.balls + "-" + G.strikes + " batter idx " + G.lineup[G.idx.us % 9] + " pitcher " + G.pitcher + " score " + G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0) + " lineup used " + G.lineup.map(i => (APP.roster.batters[i] || {}).name).join("/") + " errs " + JSON.stringify(PT.errs)); await PT.shot("pitcher_in_lineup"); if (!G.over) { document.querySelector(".call[data-call='take']").click(); await fastWithGuard(5000); PT.note("(a3b) after sign change: over=" + GameUI.state().over + " pitches " + (GameUI.state().pitches.us + GameUI.state().pitches.them)) } if (GameUI.state().over) { PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 3000); PT.note("(a4) event: " + (PT.text("#eventBody") || "").slice(0, 80)); PT.click("#eventOk") } else PT.note("(a4) game stuck; locked=" + APP.locked) }
  // (b) duplicate best hitter x9
  S = fresh(); b = bats(); const hero = b[0]; S.lineup = Array(9).fill(hero.id); I.save(); const stD = strengths(); ClubUI.simDay(); const gD = S.sched.find(g => g.result);
  PT.note("(b) 9x " + hero.name + ": strengths " + JSON.stringify(stD) + " warnings " + JSON.stringify(I.positionWarnings()) + " result " + JSON.stringify(gD.result) + " hero stats after 1 game " + JSON.stringify(hero.stats) + " lineup table rows " + document.querySelectorAll("#lineup tr").length);
  rDup = season(); PT.note("(b2) 9x hero season: " + JSON.stringify(rDup) + " hero G/PA " + hero.stats.G + "/" + hero.stats.PA + " fatigue " + r2(hero.fatigue));
  APP.show("game"); await PT.wait(150); PT.note("(b3) game screen: pick.order=" + JSON.stringify(GameUI.pick.order) + " selected cards=" + document.querySelectorAll("[data-b].sel").length + " start disabled=" + document.getElementById("start").disabled);
  // (f) injured starter stays in lineup
  S = fresh(); const L = S.lineup.map(I.P); const bad = L.slice().sort((a, b) => batScore(a) - batScore(b))[0]; const stI0 = strengths(); bad.injury = 30; const stI1 = strengths();
  ClubUI.simDay(); PT.note("(f) worst starter " + bad.name + " injured 30d, left in lineup: B " + stI0.B + " -> " + stI1.B + " D " + stI0.D + " -> " + stI1.D + " · after a game his G=" + bad.stats.G + " · lineup still has him=" + S.lineup.includes(bad.id) + " · log: " + S.log.slice(0, 2).map(l => l.t.slice(0, 60)).join(" | "));
  // (e) game screen with empty lineup slots → order null → autoOrder
  S = fresh(); S.lineup[8] = null; I.save(); APP.show("game"); await PT.wait(150); PT.note("(e) 8-man lineup: clubLineup.order=" + JSON.stringify(APP.clubLineup && APP.clubLineup.order) + " selected=" + document.querySelectorAll("[data-b].sel").length + " start disabled=" + document.getElementById("start").disabled); PT.click("#autoOrder"); await PT.wait(30); PT.note("(e2) after autoOrder: selected=" + document.querySelectorAll("[data-b].sel").length + " start disabled=" + document.getElementById("start").disabled + " order=" + GameUI.pick.order.map(i => APP.roster.batters[i].name).join("/"));
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 300)) }
  APP.show("roster"); await PT.wait(200);
  await PT.done({ scenario: "lineup", ctrl, topN, rUI, rDup, errs: PT.errs });
})();
