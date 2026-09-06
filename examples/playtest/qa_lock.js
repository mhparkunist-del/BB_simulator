/* generated QA scenario: lock/record */
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

    let e0; const results = () => S().sched.filter(g => g.result).length; const directLogs = () => S().log.filter(l => l.t.includes("직접 경기")).length;
    PT.say("lock rules"); await newSeason(3); // KIA, day 0 = 2026-04-03 (Fri), game 1 home
    const gt = ClubUI.gameToday(); chk("day 0 has a home game", gt && gt.g === 1 && gt.home, JSON.stringify(gt));
    chk("nextDay label = 오늘 경기 시작", PT.text("#nextDay") === "오늘 경기 시작", PT.text("#nextDay"));
    PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 2000); chk("nextDay routes to game screen on a game day", PT.visible("#screen-game") && !APP.locked, PT.visible("#screen-game"));
    chk("game day note says result is recorded", (PT.text("#gameDayNote") || "").includes("기록됩니다"), PT.text("#gameDayNote"));
    APP.show("schedule"); chk("can leave the game screen before starting", PT.visible("#screen-club"), PT.visible("#screen-club"));
    e0 = errMark(); await startGame(1, 1);
    chk("locked after start", APP.locked === true && !$("lockBadge").hidden, APP.locked);
    APP.show("schedule"); chk("APP.show(schedule) while locked stays on game", PT.visible("#screen-game") && $("screen-club").hidden, location.hash);
    APP.show("title"); chk("APP.show(title) while locked stays on game", PT.visible("#screen-game") && $("screen-title").hidden, location.hash);
    APP.show("team"); chk("APP.show(team) while locked stays on game", PT.visible("#screen-game") && $("screen-team").hidden, location.hash);
    const navDis = [...document.querySelectorAll(".nav [data-screen]")].filter(b => b.disabled).length; chk("5 nav buttons disabled", navDis === 5, navDis);
    document.querySelector(".nav [data-screen='market']").click(); chk("nav click while locked ignored", PT.visible("#screen-game"), PT.visible("#screen-game"));
    chk("saveBtn/titleBtn disabled", $("saveBtn").disabled && $("titleBtn").disabled, $("saveBtn").disabled + "/" + $("titleBtn").disabled);
    PT.click("#titleBtn"); chk("titleBtn click ignored while locked", PT.visible("#screen-game"), PT.visible("#screen-game"));
    chk("reset button not visible while locked", !PT.visible("#reset"), PT.visible("#reset"));
    location.hash = "#schedule"; await PT.wait(100); chk("hash change while locked does not switch screen", PT.visible("#screen-game") && $("screen-club").hidden, location.hash);
    newErrs(e0, "lock");
    e0 = errMark(); const r1 = await finishGame();
    chk("event shown after 정비로 돌아가기", r1.ok, r1.txt);
    chk("unlocked after game over", APP.locked === false && $("lockBadge").hidden && !$("saveBtn").disabled, APP.locked);
    chk("schedule screen after eventOk", PT.visible("#screen-club"), location.hash);
    chk("result recorded once (sched)", results() === 1 && S().sched[0].result && S().sched[0].result.us === r1.sc.us, results() + " " + JSON.stringify(S().sched[0].result));
    chk("W+L == 1 after one game", S().W + S().L === 1, S().W + "-" + S().L);
    chk("played list == [1]", JSON.stringify(S().played) === "[1]", JSON.stringify(S().played));
    chk("one 직접 경기 log line", directLogs() === 1, directLogs());
    const opp1 = S().opps.find(o => o.id === S().sched[0].opp); chk("opponent record +1 once", opp1.W + opp1.L === 1, opp1.W + "-" + opp1.L);
    if (r1.sc.us === r1.sc.them) chk("EXPECT tie (" + r1.sc.us + ":" + r1.sc.them + ") not reported/recorded as a loss", !r1.txt.includes("졌습니다") && S().L === 0, r1.txt + " W-L " + S().W + "-" + S().L); else PT.note("game 1 was not a tie: " + JSON.stringify(r1.sc));
    chk("nextDay label = 다음 날 after the game", PT.text("#nextDay") === "다음 날", PT.text("#nextDay"));
    newErrs(e0, "gameover");
    // same day again: must be practice only
    e0 = errMark(); APP.show("game"); chk("second game today flagged as practice", (PT.text("#gameDayNote") || "").includes("연습"), PT.text("#gameDayNote"));
    await startGame(1, 1); const r2 = await finishGame(); chk("practice result not recorded", results() === 1 && S().W + S().L === 1 && directLogs() === 1, results() + " " + S().W + "-" + S().L + " logs " + directLogs());
    chk("practice event says not recorded", (r2.txt || "").includes("연습"), r2.txt);
    newErrs(e0, "replay");
    // ties in the engine (practice games, seeds 3..6)
    let tie = null; for (let sd = 3; sd < 7 && !tie; sd++) { await startGame(1, sd); const r = await finishGame(); if (r.sc && !r.hung && r.sc.us === r.sc.them) tie = { sd, r } }
    if (tie) chk("EXPECT tie event not '졌습니다' (practice seed " + tie.sd + ")", !tie.r.txt.includes("졌습니다"), tie.r.txt); else PT.note("no clean tie found in seeds 3..6");
    // double click on 정비로 돌아가기 (button is hidden after the first click; API-level only)
    e0 = errMark(); await startGame(1, 1); await fastGuard(); if (GameUI.state() && !GameUI.state().over) GameUI.renderBreak(true); $("resume").click(); $("resume").click(); await PT.wait(100); const dbl = newErrs(e0, "double-resume");
    chk("EXPECT double click on 정비로 돌아가기 throws nothing", dbl.length === 0, dbl.join(" | "));
    if (PT.visible("#eventModal")) PT.click("#eventOk"); await PT.wait(40);
    chk("after double resume still 1 recorded game", results() === 1 && S().W + S().L === 1, results() + " " + S().W + "-" + S().L);
    // 다음 날: no double play, gate revenue?
    e0 = errMark(); const gate0 = S().fin.inc.gate; PT.click("#nextDay"); await PT.wait(60);
    chk("day advanced to 1", S().day === 1, S().day);
    chk("still 1 result after 다음 날 (no double play)", results() === 1 && S().W + S().L === 1, results() + " " + S().W + "-" + S().L);
    chk("EXPECT gate income for a directly played HOME game", S().fin.inc.gate > gate0, "gate " + gate0 + " -> " + S().fin.inc.gate + " ledger=" + S().fin.ledger.map(l => l.kind).join(",") + " att=" + S().fin.att);
    newErrs(e0, "nextday");
    // tie via the record API on day 1 (game 2, home)
    e0 = errMark(); const W0 = S().W, L0 = S().L; const rec = ClubUI.recordExternalGame({ us: 2, them: 2, sp: "-", ip: 1, er: 0, box: [] });
    chk("EXPECT a 2:2 tie is not counted as a loss", rec && S().L === L0 && S().W === W0, "rec=" + rec + " W-L " + W0 + "-" + L0 + " -> " + S().W + "-" + S().L + " log=" + (S().log[0] && S().log[0].t));
    PT.click("#nextDay"); await PT.wait(60);
    const gate1 = S().fin.inc.gate; const gt3 = ClubUI.gameToday(); ClubUI.simDay();
    chk("quick-sim home game adds gate income (contrast)", gt3 && gt3.home && S().fin.inc.gate > gate1, "home=" + (gt3 && gt3.home) + " gate " + gate1 + " -> " + S().fin.inc.gate);
    newErrs(e0, "tie");
    // simDay under lock (API)
    e0 = errMark(); await startGame(1, 1); const dayL = S().day; ClubUI.simDay(); chk("EXPECT simDay refused while locked (day stays " + dayL + ")", S().day === dayL, S().day);
    await finishGame(); chk("results == W+L after simDay-under-lock", results() === S().W + S().L, results() + " vs " + (S().W + S().L));
    newErrs(e0, "simlock"); APP.show("schedule");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · lock/record", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
