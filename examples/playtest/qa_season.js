/* generated QA scenario: season/clubs/theme */
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

    let e0; PT.say("season / clubs / theme"); await newSeason(4); // SSG
    // game-day training intensity: a 2군 batter on 'rest' with fatigue .5 (rest: -0.10*inten, recovery -0.06 only on non-game days)
    e0 = errMark(); const b2 = S().players.find(p => p.type == "B" && !p.active && !p.injury); S().program[b2.id] = "rest"; b2.fatigue = 0.5; b2.injury = 0; const gate0 = S().fin.inc.gate;
    chk("day 0 is a home game day", ClubUI.gameToday() && ClubUI.gameToday().home, JSON.stringify(ClubUI.gameToday())); ClubUI.simDay();
    chk("EXPECT game-day rest = -0.05 (half intensity, no rest-day recovery) -> 0.45", Math.abs(b2.fatigue - 0.45) < 1e-6, b2.name + " fatigue 0.5 -> " + b2.fatigue.toFixed(3) + " (0.34 = full-day training + rest-day recovery applied on a game day)");
    chk("quick-sim home game credits gate income", S().fin.inc.gate > gate0, S().fin.inc.gate);
    newErrs(e0, "isGame");
    // schedule page follows today?
    for (let i = 0; i < 19; i++) ClubUI.simDay(); APP.show("schedule"); const todayRow = document.querySelector("#schedule tr.today"); const nextIdx = S().sched.findIndex(x => !x.result);
    chk("EXPECT schedule table page shows today's/next game (game " + (nextIdx + 1) + ")", !!todayRow || (PT.text("#schedule .pager span") || "").startsWith(String(Math.floor(nextIdx / 8) + 1) + "/"), "pager=" + PT.text("#schedule .pager span") + " todayRowVisible=" + !!todayRow + " day=" + S().day);
    // to season end
    e0 = errMark(); let k = 0; while (S().day < ClubInt.DATA.days && k++ < 60) ClubUI.simDay();
    chk("reached day limit " + ClubInt.DATA.days, S().day === ClubInt.DATA.days, S().day + " W-L " + S().W + "-" + S().L);
    chk("all 30 games have results", S().sched.every(x => x.result), S().sched.filter(x => x.result).length);
    chk("season-end log exactly once", S().log.filter(l => l.t.includes("정규 시즌 30경기 종료")).length === 1 && S().done === true, S().log.filter(l => l.t.includes("정규 시즌 30경기 종료")).length);
    chk("season-end tax/fine ledger at most once", S().fin.ledger.filter(l => /제재금|기금/.test(l.kind)).length <= 1, S().fin.ledger.filter(l => /제재금|기금/.test(l.kind)).map(l => l.kind + l.amt).join(","));
    chk("다음 날 button disabled at the day limit", $("nextDay").disabled, $("nextDay").disabled);
    const endLogs0 = S().log.filter(l => l.t.startsWith("시즌 종료")).length; ClubUI.advanceDay(); ClubUI.advanceDay(); ClubUI.simDay(); PT.click("#nextDay"); await PT.wait(30);
    chk("EXPECT '시즌 종료' log not duplicated by repeated 다음 날 (API)", S().log.filter(l => l.t.startsWith("시즌 종료")).length <= 1, endLogs0 + " -> " + S().log.filter(l => l.t.startsWith("시즌 종료")).length + " day=" + S().day);
    APP.show("game"); chk("game after season end is practice", (PT.text("#gameDayNote") || "").includes("연습"), PT.text("#gameDayNote"));
    newErrs(e0, "seasonEnd");
    // all 10 clubs integrity
    e0 = errMark(); const probs = []; APP.teamList().forEach((t, i) => { ClubUI.fresh(t); const s = S(); const lu = s.lineup.map(id => s.players.find(p => p.id === id)); const rot = s.rotation.map(id => s.players.find(p => p.id === id)); const act = s.players.filter(p => p.active);
      const lg = ClubUI.lineupForGame(); const cnt = {}; s.players.forEach(p => cnt[p.name] = (cnt[p.name] || 0) + 1); const dupRisk = Object.keys(cnt).filter(n => cnt[n] > 1).filter(n => { const l = s.players.filter(p => p.name === n); const e = l.find(p => p.engine_id !== undefined); return e && l[0] !== e });
      const line = t.code + " players=" + s.players.length + " active=" + act.length + " lineup=" + lu.filter(Boolean).length + "/9 distinct=" + new Set(s.lineup).size + " rot=" + rot.filter(p => p && p.role == "SP" && p.engine_id !== undefined).length + "/" + s.rotation.length + " order=" + (lg.order ? "ok" : "NULL") + " pitcher=" + lg.pitcher + " bats1군=" + act.filter(p => p.type == "B").length + " pits1군=" + act.filter(p => p.type == "P").length + " pos=" + JSON.stringify(ClubInt.positionWarnings()) + " dupRisk=" + dupRisk.join("/");
      PT.note(line); if (lu.filter(Boolean).length !== 9 || new Set(s.lineup).size !== 9 || s.rotation.length !== 5 || act.length > 26 || !lg.order || lg.pitcher === null || act.filter(p => p.type == "B").length < 9 || act.filter(p => p.type == "P").length < 5) probs.push(t.code); if (dupRisk.length) probs.push(t.code + ":dupname(" + dupRisk.join("/") + ")") });
    chk("all 10 clubs: lineup 9 distinct, rotation 5, ≤26 active, game order/pitcher present, no dup-name stat risk", probs.length === 0, probs.join(", "));
    newErrs(e0, "clubs");
    // theme abuse
    e0 = errMark(); const gv = () => getComputedStyle(document.documentElement).getPropertyValue("--bulb").trim();
    [["#000000"], [], ["bogus"], [null, null], ["#fff"], [123], [{}], ["#000000", "#000000"], ["#12"], ["rgb(1,2,3)"]].forEach(a => { APP.theme.apply(null, a); PT.note("theme(" + JSON.stringify(a) + ") -> bulb " + gv() + " go " + getComputedStyle(document.documentElement).getPropertyValue("--go").trim()) });
    chk("theme edge inputs: no errors, bulb is a hex colour", PT.errs.length === e0 && /^#[0-9a-f]{6}$/.test(gv()), gv() + " " + PT.errs.slice(e0).join("|"));
    APP.theme("#000000", "#000000"); chk("EXPECT black club + black accent still yields a visible accent (not #000000)", gv() !== "#000000", gv()); ClubUI.render();
    newErrs(e0, "theme");
    // new season (reset) while a game is running (API: the button is hidden by the lock)
    e0 = errMark(); ClubUI.fresh(APP.teamList()[6]); await startGame(1, 1); window.confirm = () => true; $("reset").click(); await PT.wait(50);
    chk("reset under lock replaced the club state (day 0, generic club)", S().day === 0 && S().club.name === "덕아웃 나이트", S().club.name + " locked=" + APP.locked);
    const rr = await finishGame(); chk("EXPECT the running game is not written into the brand-new season", !S().sched[0].result, "sched[0].result=" + JSON.stringify(S().sched[0].result) + " W-L " + S().W + "-" + S().L + " txt=" + (rr.txt || "").slice(0, 30));
    newErrs(e0, "reset-under-lock"); APP.show("schedule");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · season/clubs/theme", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
