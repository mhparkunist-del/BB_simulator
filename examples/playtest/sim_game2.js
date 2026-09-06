/* sim_game2: 10 nine-inning 결과 바로보기 games with seeds 0..9 (every opp pitcher twice), default signs, our first card;
   auto-escape hangs by changing the sign; record score/hits/hangs. Then: does the club roster matter to the physics game? (trade a star in → engine_id?) */
(async () => {
  const I = ClubInt, M = ClubMarket, r2 = v => Math.round(v * 100) / 100, sum = a => a.reduce((x, y) => x + y, 0);
  const games = [], hangs = []; let S;
  const setup = async (seed, inn, card) => { APP.show("game"); await PT.wait(50); PT.click("#autoOrder"); const pc = document.querySelector("[data-p='" + card + "']"); if (pc) pc.click(); document.getElementById("seed").value = seed; document.getElementById("innings").value = inn; await document.getElementById("start").onclick(); await PT.until(() => !document.getElementById("game").hidden, 3000) };
  const fastWithGuard = async ms => { let stopped = false; const t = setTimeout(() => { stopped = true; PT.click("#stop") }, ms); await GameUI.fast(); clearTimeout(t); return stopped };
  const finish = async () => { PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 3000); PT.click("#eventOk"); await PT.wait(30) };
  const toGameDay = () => { let k = 0; while (!S.sched.find(g => g.date === I.today() && !g.result) && k++ < 5) ClubUI.simDay() };
  try {
    ClubUI.fresh(APP.teamList()[3]); S = ClubUI.state();
    PT.note("engine mapping: batters with engine_id " + S.players.filter(p => p.type == "B" && p.engine_id !== undefined).map(p => p.name + "→b" + p.engine_id).join(",") + " · pitchers " + S.players.filter(p => p.type == "P" && p.engine_id !== undefined).map(p => p.name + "→p" + p.engine_id).join(","));
    for (let gi = 0; gi < 10; gi++) {
      toGameDay(); const g = S.sched.find(x => x.date === I.today() && !x.result); const t0 = performance.now(); await setup(gi, 9, 0); let G = GameUI.state(); let nh = 0, keys = [];
      while (!G.over && nh < 6) { await fastWithGuard(1500); G = GameUI.state(); if (G.over) break; nh++; const key = (G.half == "top" ? "" : "D|") + (G.half == "top" ? G.lineup[G.idx.us % 9] : G.oppLineup[G.idx.them % 9]) + "|" + G.pitcher + "|" + (G.half == "top" ? "none" : "none") + "|" + G.balls + "|" + G.strikes; keys.push(key + "@" + G.inning + (G.half == "top" ? "T" : "B")); const btns = G.half == "top" ? [".call[data-call='take']", ".call[data-call='power']", ".call[data-call='bunt']"] : [".dcall[data-dcall='outside']", ".dcall[data-dcall='inside']", ".dcall[data-dcall='infield_in']"]; const b = document.querySelector(btns[(nh - 1) % 3]); if (b) b.click() }
      if (G.over) { const rec = { seed: gi, oppP: gi % 5, us: sum(G.score.us), them: sum(G.score.them), hits: G.hits.us + "/" + G.hits.them, pitches: G.pitches.us + G.pitches.them, hangs: nh, keys: keys.join(" "), ms: Math.round(performance.now() - t0) }; games.push(rec); if (nh) hangs.push(...keys); await finish(); PT.note("game " + g.g + " " + JSON.stringify(rec)) } else { PT.note("game " + g.g + " stuck after 6 sign changes: " + keys.join(" ")); break }
      ClubUI.simDay();
    }
    const n = games.length; PT.note("summary: " + n + " games · W " + games.filter(g => g.us > g.them).length + " L " + games.filter(g => g.us < g.them).length + " T " + games.filter(g => g.us === g.them).length + " · runs us " + sum(games.map(g => g.us)) + " them " + sum(games.map(g => g.them)) + " · games with hang " + games.filter(g => g.hangs).length + "/" + n + " total hangs " + sum(games.map(g => g.hangs)) + " · avg ms " + r2(sum(games.map(g => g.ms)) / Math.max(1, n)) + " · club W-L " + S.W + "-" + S.L);
    // does the club roster feed the physics game? trade for a star and look at the game screen
    if (GameUI.state() === null && M) { const code = S.opps[0].code; const ro = M.oppRoster(code).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v); const star = ro.find(x => x.p.type == "B"); const cost = Math.ceil(star.v * 1.3 * 1.08 / 0.7 * 10) / 10; S.budget = 500; const r = M.proposeTrade(code, [star.p.id], [], cost); const q = I.P(star.p.id);
      if (q) { S.lineup[3] = q.id; I.save(); APP.show("schedule"); APP.show("game"); await PT.wait(80); PT.note("(roster→physics) traded-in star " + q.name + " (ovr " + r2(I.ovr(q)) + ", engine_id=" + q.engine_id + ") put at #4: clubLineup.order=" + JSON.stringify(APP.clubLineup && APP.clubLineup.order) + " · game-screen batter cards: " + [...document.querySelectorAll("[data-b] b")].map(e => e.textContent.replace(/\s+/g, " ")).join("|").slice(0, 300) + " · is " + q.name + " selectable? " + [...document.querySelectorAll("[data-b] b")].some(e => e.textContent.includes(q.name))) } else PT.note("(roster→physics) trade failed " + r.msg) }
    // engine attrs vs club attrs of the same named player
    const eb = APP.roster.batters[0]; const cb = S.players.find(p => p.engine_id === 0 && p.type == "B"); PT.note("(archetype) engine batter b0 '" + eb.name + "' grades " + JSON.stringify({ contact: eb.contact, power: eb.power, eye: eb.eye, speed: eb.speed }) + " vs club player mapped to b0: " + (cb ? cb.name + " grades " + JSON.stringify(cb.grades) + " attrs " + JSON.stringify(cb.attrs) : "none") + " · engine attrs static=" + !!eb.attrs);
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 200)) }
  await PT.done({ scenario: "game2", games, hangs, errs: PT.errs });
})();
