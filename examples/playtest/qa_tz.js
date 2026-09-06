/* generated QA scenario: timezone/dates */
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

    PT.note("timezoneOffset=" + new Date().getTimezoneOffset() + " (minutes; -540 = KST)");
    const mv = id => !$(id).hidden; PT.note("eventModal css position=" + getComputedStyle($("eventModal")).position + " PT.visible(eventModal when shown) would be " + PT.visible("#eventModal"));
    await newSeason(3); // KIA
    const s0 = S(); PT.note("KBO sched[0].date=" + s0.sched[0].date + " today()=" + ClubInt.today() + " header=" + PT.text("#tDate") + " date0=" + ClubInt.DATA.date0);
    const row1 = document.querySelector("#schedule table tr:nth-child(2)"); const rowTxt = row1 ? row1.textContent : ""; PT.note("schedule row 1: " + rowTxt);
    chk("EXPECT schedule row date == header date on day 0 (KBO club)", rowTxt.includes(PT.text("#tDate")), "row=" + rowTxt.slice(0, 30) + " header=" + PT.text("#tDate"));
    chk("KBO club: game today on day 0", !!ClubUI.gameToday(), JSON.stringify(ClubUI.gameToday()));
    // schedule skipped Mondays? list the displayed weekday letters of the first 8 rows
    const days = [...document.querySelectorAll("#schedule table tr")].slice(1).map(r => r.children[1].textContent); PT.note("displayed dates: " + days.join(" "));
    chk("EXPECT no game displayed on a Monday (KBO schedule skips Mondays)", !days.some(d => d.includes("(월)")), days.filter(d => d.includes("(월)")).join(","));
    // generic club after 새 시즌
    window.confirm = () => true; PT.click("#reset"); await PT.wait(100); const g = S(); PT.note("generic sched[0].date=" + g.sched[0].date + " today()=" + ClubInt.today() + " club=" + g.club.name);
    const found = []; for (let d = 0; d < 8; d++) { g.day = d; if (ClubUI.gameToday()) found.push(d) } g.day = 0; ClubUI.render();
    chk("EXPECT generic club (after 새 시즌) finds its games by date (days with a game in 0..7)", found.length >= 5, "days with game: " + found.join(",") + " (sched dates " + g.sched.slice(0, 3).map(x => x.date).join(",") + ")");
    let k = 0; while (S().day < ClubInt.DATA.days && k++ < 60) ClubUI.simDay();
    chk("EXPECT generic club plays its 30 games by the day limit", S().sched.filter(x => x.result).length === 30, "results=" + S().sched.filter(x => x.result).length + " W-L " + S().W + "-" + S().L + " day=" + S().day);
    APP.show("schedule");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · timezone/dates", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
