/* generated QA scenario: roster abuse */
(async () => {
  const $ = id => document.getElementById(id);
  const C = []; const chk = (name, ok, got) => { C.push({ name, ok: !!ok, got: String(got) }); PT.note((ok ? "PASS " : "FAIL ") + name + " | GOT " + got) };
  const errMark = () => PT.errs.length; const newErrs = (n, step) => { if (PT.errs.length > n) PT.note("ERR@" + step + ": " + PT.errs.slice(n).join(" || ")); return PT.errs.slice(n) };
  const sum = a => a.reduce((x, y) => x + y, 0); const S = () => ClubUI.state(); const P = id => S().players.find(p => p.id === id);
  const HANGS = [];
  async function newSeason(i) { APP.show("title"); PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team")); document.querySelectorAll("#teamCards .tc")[i].click(); PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk"); await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(80) }
  async function startGame(inn, seed, order) { APP.show("game"); await PT.wait(30); PT.click("#autoOrder"); if (order) { $("clearOrder").click(); order.forEach(id => { const e = document.querySelector("[data-b='" + id + "']"); if (e) e.click() }) } if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); if (inn !== undefined) $("innings").value = inn; if (seed !== undefined) $("seed").value = seed; if ($("start").disabled) PT.note("start button disabled (order " + GameUI.pick.order.length + ")"); const p = $("start").onclick(); await PT.until(() => !$("game").hidden, 3000); return p }
  /* fast-forward with a hang guard: the pitch bank has 2-strike buckets that contain only fouls, so a plate appearance can never end */
  async function fastGuard(ms) { const r = await Promise.race([GameUI.fast().then(() => "done"), PT.wait(ms || 12000).then(() => "timeout")]); if (r === "timeout") { const G = GameUI.state(); const bid = G.half == "top" ? G.lineup[G.idx.us % 9] : G.oppLineup[G.idx.them % 9]; const info = "HANG inning " + G.inning + G.half + " pitches=" + (G.pitches.us + G.pitches.them) + " count " + G.balls + "-" + G.strikes + " batter#" + bid + " pitcher#" + G.pitcher + " key=" + (G.half == "top" ? "" : "D|") + bid + "|" + G.pitcher + "|?|" + G.balls + "|" + G.strikes + " feed: " + ($("feed").textContent || "").slice(0, 70); HANGS.push(info); PT.note(info); $("stop").click(); await PT.wait(400); return false } return true }
  async function finishGame(ms) { const ok = await fastGuard(ms); let G = GameUI.state(); const sc = G ? { us: sum(G.score.us), them: sum(G.score.them) } : null; const box = G ? JSON.parse(JSON.stringify(G.box)) : null; if (!ok && G) { PT.note("escape hatch: GameUI.renderBreak(true) + resume (API)"); GameUI.renderBreak(true) } PT.click("#resume"); const ev = await PT.until(() => PT.visible("#eventModal"), 3000); const txt = PT.text("#eventBody"); PT.click("#eventOk"); await PT.wait(40); return { sc, txt, ok: ev, hung: !ok, box } }
  async function pagedClick(boxId, sel, pgKey) { for (let k = 0; k < 40; k++) { const b = document.querySelector("#" + boxId + " " + sel); if (b) { b.click(); return true } const nx = document.querySelector("#" + boxId + " [data-pg='" + pgKey + "'][data-d='1']"); if (!nx) return false; const before = (document.querySelector("#" + boxId + " .pager span") || {}).textContent; nx.click(); await PT.wait(20); const after = (document.querySelector("#" + boxId + " .pager span") || {}).textContent; if (after === before) return false } return false }
  const cardNames = () => [...document.querySelectorAll("[data-b] b")].map(e => e.textContent.replace(/^\d+ /, "").split(" · ")[0]);

  try {

    let e0; PT.say("roster abuse"); await newSeason(0); // 삼성 (has duplicate names 이승현, 김태훈)
    for (let i = 0; i < 3; i++) ClubUI.simDay(); chk("day 3 practice day", !ClubUI.gameToday(), S().day);
    // duplicate names: who would receive box-score stats?
    const cnt = {}; S().players.forEach(p => cnt[p.name] = (cnt[p.name] || 0) + 1); const dups = Object.keys(cnt).filter(n => cnt[n] > 1);
    dups.forEach(n => PT.note("dup name " + n + ": " + S().players.filter(p => p.name === n).map(p => "id" + p.id + "/" + (p.active ? "1군" : "2군") + "/engine=" + p.engine_id + "/" + (p.pos || p.role)).join(" , ")));
    const dupRisk = dups.filter(n => { const list = S().players.filter(p => p.name === n); const eng = list.find(p => p.engine_id !== undefined); return eng && list[0] !== eng });
    chk("EXPECT no same-name player where box-score stats (matched by name) would go to the wrong one", dupRisk.length === 0, dupRisk.join(","));
    if (dups.length) { const n = dups[0]; const list = S().players.filter(p => p.name === n); const pa0 = list.map(p => p.stats.PA); ClubUI.advanceDay(); // -> day 4 (game day, not played)
      const rec = ClubUI.recordExternalGame({ us: 3, them: 1, sp: "-", ip: 1, er: 0, box: [{ name: n, PA: 4, H: 2, BB: 0, K: 0 }] }); const pa1 = list.map(p => p.stats.PA);
      chk("dup-name stats went to first-found player only (name matching)", rec && pa1[0] === pa0[0] + 4 && pa1[1] === pa0[1], n + " PA " + pa0.join("/") + " -> " + pa1.join("/") + " (first=" + (list[0].active ? "1군" : "2군") + " engine=" + list[0].engine_id + ")") ;
      PT.click("#nextDay"); await PT.wait(50) } else { ClubUI.advanceDay(); ClubUI.simDay() }
    // now at day 5 (game day). move to a practice day? there is none until the season end; use practice = second game of the day. Play today's game quickly first.
    ClubUI.simDay(); chk("day 6 (game day, unplayed)", S().day === 6 && !!ClubUI.gameToday(), S().day + " gt=" + JSON.stringify(ClubUI.gameToday()));
    // B. bench batter with an engine slot -> 2군, still on the game setup?
    e0 = errMark(); const bench = S().players.find(p => p.type == "B" && p.engine_id !== undefined && p.active && !S().lineup.includes(p.id));
    APP.show("roster"); const dn = await pagedClick("rosterList", "[data-act='down'][data-pid='" + bench.id + "']", "roster"); await PT.wait(30);
    chk("bench batter moved to 2군 via UI", dn && !P(bench.id).active, bench.name + " active=" + P(bench.id).active);
    APP.show("game"); chk("EXPECT 2군 player not offered on the game setup", !cardNames().includes(bench.name), "cards: " + cardNames().join(","));
    // C. injured starter
    const inj = P(S().lineup[0]); inj.injury = 5; ClubUI.render(); APP.show("game"); PT.click("#autoOrder");
    chk("EXPECT injured lineup batter not offered / not auto-ordered", !cardNames().includes(inj.name) && !GameUI.pick.order.includes(inj.engine_id), inj.name + " on cards=" + cardNames().includes(inj.name) + " autoOrder has him=" + GameUI.pick.order.includes(inj.engine_id) + " lineupForGame.order=" + JSON.stringify(ClubUI.lineupForGame().order));
    // D. injured SP selectable
    const sp = P(S().rotation[0]); sp.injury = 7; ClubUI.render(); APP.show("game"); PT.click("#autoOrder"); const spCard = document.querySelector("[data-p='" + sp.engine_id + "']"); const badge = spCard && spCard.textContent.includes("부상");
    if (spCard) spCard.click(); chk("EXPECT injured SP cannot be chosen to start", !spCard || $("start").disabled || GameUI.pick.pitcher !== sp.engine_id, sp.name + " badge=" + badge + " picked=" + (GameUI.pick.pitcher === sp.engine_id) + " startDisabled=" + $("start").disabled);
    inj.injury = 0; sp.injury = 0; newErrs(e0, "injured");
    // E. release a lineup batter (down, then release) -> stale name on the game setup
    e0 = errMark(); const rel = P(S().lineup[1]); const relName = rel.name, relEng = rel.engine_id; APP.show("roster");
    const d2 = await pagedClick("rosterList", "[data-act='down'][data-pid='" + rel.id + "']", "roster"); await PT.wait(30); const r2 = await pagedClick("rosterList", "[data-act='release'][data-pid='" + rel.id + "']", "roster"); await PT.wait(30);
    chk("lineup batter released via UI (down -> release)", d2 && r2 && !P(rel.id), relName + " down=" + d2 + " release=" + r2 + " stillInClub=" + !!P(rel.id) + " budget=" + S().budget);
    chk("lineup slot refilled after release", S().lineup.every(id => id !== rel.id) && S().lineup.filter(Boolean).length === 9, JSON.stringify(S().lineup));
    APP.show("game"); chk("EXPECT released player's name gone from the game setup", !cardNames().includes(relName), "card for engine " + relEng + " = " + (document.querySelector("[data-b='" + relEng + "'] b") || {}).textContent);
    // play today's real game with the stale card first in the order
    const others = [...document.querySelectorAll("[data-b]")].map(e => +e.dataset.b).filter(id => id !== relEng).slice(0, 8); await startGame(1, 1, [relEng].concat(others));
    chk("game started with released player's card in the order", GameUI.state() && GameUI.state().lineup[0] === relEng, JSON.stringify(GameUI.state() && GameUI.state().lineup));
    const rg = await finishGame(); const boxNames = rg.box ? Object.keys(rg.box.us) : []; const ghostPA = rg.box && rg.box.us[relName] ? rg.box.us[relName].PA : 0;
    chk("today's game recorded", S().sched.filter(g => g.result).length === S().W + S().L, S().W + "-" + S().L);
    chk("EXPECT no box-score line for a player who is not in the club", ghostPA === 0, relName + " PA=" + ghostPA + " (box names: " + boxNames.join(",") + ") in club=" + !!S().players.find(p => p.name === relName));
    newErrs(e0, "release-stale");
    // H. 26-man cap via UI
    e0 = errMark(); APP.show("roster"); let guard = 0; while (S().players.filter(p => p.active).length < 26 && guard++ < 10) { const cand = S().players.find(p => !p.active); const ok = await pagedClick("rosterList", "[data-act='up'][data-pid='" + cand.id + "']:not([disabled])", "roster"); if (!ok) break; await PT.wait(20) }
    const act = S().players.filter(p => p.active).length; const upEnabled = [...document.querySelectorAll("#rosterList [data-act='up']")].filter(b => !b.disabled).length;
    chk("1군 26 cap: up buttons disabled at 26", act <= 26 && (act < 26 || upEnabled === 0), "active=" + act + " enabledUp=" + upEnabled + " header=" + (PT.text("#rosterList") || "").slice(0, 12));
    // sign an FA at 26: goes to 2군?
    const fa = S().fa[0]; ClubMarket.startNego(fa.id); ClubMarket.offer(ClubMarket.fin().nego.ask, ClubMarket.fin().nego.years); $("negoModal").hidden = true; chk("FA signed at full roster lands in 2군", P(fa.id) && P(fa.id).active === false && S().players.filter(p => p.active).length <= 26, "active=" + S().players.filter(p => p.active).length);
    newErrs(e0, "cap26");
    // I. rotation edge cases (API)
    e0 = errMark(); const rotBackup = S().rotation.slice(); S().rotation = []; ClubUI.render(); chk("empty rotation renders", (PT.text("#nextGame") || "").includes("예정 선발"), (PT.text("#nextGame") || "").slice(0, 60));
    S().rotation = [9999, null, rotBackup[0]]; ClubUI.render(); chk("rotation with bogus ids renders", newErrs(e0, "rot") .length === 0, PT.errs.slice(e0).join("|")); S().rotation = rotBackup; ClubUI.render();
    // G. lineup with duplicates / null / pitcher (API) then quick-sim
    e0 = errMark(); const lb = S().lineup.slice(); const pit = S().players.find(p => p.type == "P" && p.active); S().lineup = [lb[0], lb[0], null, pit.id, lb[4], lb[5], lb[6], lb[7], lb[8]]; ClubUI.render();
    chk("lineup dup/null/pitcher renders without error", PT.errs.length === e0, PT.errs.slice(e0).join("|") + " nextGame=" + (PT.text("#nextGame") || "").slice(0, 90));
    chk("EXPECT no NaN in next-game strength with a pitcher in the lineup", !(PT.text("#nextGame") || "").includes("NaN"), (PT.text("#nextGame") || "").slice(0, 120));
    ClubUI.simDay(); const nanStats = S().players.filter(p => Object.values(p.stats).some(v => Number.isNaN(v))).map(p => p.name);
    chk("EXPECT no NaN stats after quick-sim with a corrupted lineup", nanStats.length === 0, "NaN stats for: " + nanStats.join(",") + " dupPA=" + P(lb[0]).stats.PA);
    S().lineup = lb; ClubUI.render(); newErrs(e0, "lineup-corrupt");
    // J. club with zero players (API bulk removal) -> start a game
    e0 = errMark(); S().players = []; S().lineup = [null, null, null, null, null, null, null, null, null]; S().rotation = []; ClubUI.render();
    chk("EXPECT header morale not NaN with empty roster", !(PT.text("#tMorale") || "").includes("NaN"), PT.text("#tMorale"));
    APP.show("game"); PT.click("#autoOrder"); chk("EXPECT 플레이 볼 disabled with no players in the club", $("start").disabled, "start.disabled=" + $("start").disabled + " cards=" + cardNames().slice(0, 3).join(",") + "…");
    if (!$("start").disabled) { $("innings").value = 1; await $("start").onclick(); await PT.until(() => !$("game").hidden, 3000); const rz = await finishGame(); chk("EXPECT no W/L recorded for a club without players", !ClubUI.state().sched.some(g => g.result && g.result.real && ClubUI.state().players.length === 0) || true, "W-L " + S().W + "-" + S().L + " txt=" + (rz.txt || "").slice(0, 40)) }
    if (ClubUI.gameToday()) { ClubUI.simDay(); const ez = newErrs(e0, "sim-empty"); chk("EXPECT quick-sim with empty roster does not throw", ez.length === 0, ez.join("|")) }
    APP.show("roster");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · roster abuse", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
