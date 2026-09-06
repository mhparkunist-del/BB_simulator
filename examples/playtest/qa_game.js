/* generated QA scenario: game inputs */
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

    let e0; PT.say("game inputs"); await newSeason(2); for (let i = 0; i < 3; i++) ClubUI.simDay(); // day 3 = Monday, practice only
    chk("day 3 has no game (practice)", !ClubUI.gameToday(), JSON.stringify(ClubUI.gameToday()));
    e0 = errMark(); await startGame(0, 1); chk("innings 0 falls back to 3", GameUI.state().total === 3, GameUI.state().total); const t0 = performance.now(); const r0 = await finishGame(); PT.note("3-inning fast ms " + Math.round(performance.now() - t0) + " hung=" + r0.hung); newErrs(e0, "inn0");
    e0 = errMark(); await startGame(-1, 1); chk("innings -1 accepted (min=1 not enforced)", GameUI.state().total === -1, GameUI.state().total); chk("EXPECT sane inning label with innings=-1", !(PT.text("#sInn") || "").startsWith("-"), PT.text("#sInn"));
    const rm = await finishGame(); chk("innings -1 game ends after 1 inning", rm.ok, "hung=" + rm.hung + " " + rm.txt); newErrs(e0, "inn-1");
    e0 = errMark(); $("innings").value = "abc"; await startGame(undefined, 1); chk("innings 'abc' -> 3", GameUI.state().total === 3, GameUI.state().total); await finishGame(); newErrs(e0, "innabc");
    // speed -1
    e0 = errMark(); await startGame(1, 1); $("spd").value = -1; PT.click("#playPitch"); await PT.wait(2500);
    const hung = $("playPitch").disabled; chk("EXPECT 배속 -1 does not freeze the pitch (buttons back within 2.5s)", !hung, "playPitch.disabled=" + hung + " pitches=" + (GameUI.state().pitches.us + GameUI.state().pitches.them));
    PT.click("#stop"); await PT.wait(300); chk("정지 rescues the freeze", !$("playPitch").disabled, $("playPitch").disabled); $("spd").value = 10; newErrs(e0, "spd-1");
    // rapid clicks
    e0 = errMark(); const P0 = GameUI.state().pitches.us + GameUI.state().pitches.them; for (let i = 0; i < 12; i++) $("playPitch").click(); await PT.wait(2500);
    const P1 = GameUI.state().pitches.us + GameUI.state().pitches.them; chk("12 rapid 한 구 clicks -> exactly 1 pitch (busy guard)", P1 - P0 === 1, (P1 - P0) + " pitches");
    newErrs(e0, "rapid");
    // fast + stop spam
    e0 = errMark(); if (!GameUI.state().over) { const pr = fastGuard(8000); for (let i = 0; i < 20; i++) { $("stop").click(); await PT.wait(2) } await pr; const G = GameUI.state();
      chk("fast + stop spam: stopped cleanly, buttons enabled", !$("playPitch").disabled || G.over, "over=" + G.over + " inning=" + G.inning + G.half + " pitch scene=" + PT.visible("#scenePitch"));
      chk("feed announces interruption", G.over || ($("feed").textContent || "").includes("중단"), ($("feed").textContent || "").slice(0, 80)) }
    for (const v of ["body", "seam", "cam"]) { document.querySelector(".viewsel [data-view='" + v + "']").click(); window.dispatchEvent(new Event("resize")); await PT.wait(30) }
    const pr2 = fastGuard(8000); for (let i = 0; i < 5; i++) { window.dispatchEvent(new Event("resize")); await PT.wait(20) } await pr2;
    chk("resize/view switch during fast run: no errors", newErrs(e0, "resize").length === 0, PT.errs.slice(e0).join("|"));
    { const r = await finishGame(); PT.note("spd/rapid game finished hung=" + r.hung) }
    // break pages wrap
    e0 = errMark(); await startGame(2, 1); $("playInning").click(); const br = await PT.until(() => PT.visible("#sceneBreak"), 20000);
    if (!br) { $("stop").click(); await PT.wait(300); PT.note("이닝 did not reach the break within 20s (hang?) pitches=" + (GameUI.state().pitches.us + GameUI.state().pitches.them)) }
    chk("break screen after 이닝", br, PT.text("#breakPageNo")); if (br) { $("breakPrev").click(); chk("break prev wraps to 4/4", (PT.text("#breakPageNo") || "").includes("4/4"), PT.text("#breakPageNo")); $("breakNext").click(); chk("break next wraps to 1/4", (PT.text("#breakPageNo") || "").includes("1/4"), PT.text("#breakPageNo")) }
    // start twice (API) while running
    const pr3 = fastGuard(8000); await PT.wait(5); const G_before = GameUI.state(); try { await $("start").onclick() } catch (e) { PT.note("second start threw " + e.message) } await pr3; await PT.wait(100);
    const twice = newErrs(e0, "start-twice"); chk("EXPECT second 플레이 볼 (API) while running is harmless", twice.length === 0, "errs=" + twice.join("|") + " newG=" + (GameUI.state() !== G_before) + " over=" + (GameUI.state() && GameUI.state().over));
    { const r = await finishGame(); PT.note("start-twice game finished hung=" + r.hung) } chk("unlocked after start-twice sequence", !APP.locked, APP.locked);
    // hang census: 6 practice games with seeds 1..6 (guard 10 s each)
    let hangN = 0, played = 0; for (let sd = 1; sd <= 6; sd++) { await startGame(3, sd); const r = await finishGame(10000); played++; if (r.hung) hangN++ }
    chk("EXPECT 0 of " + played + " fast 3-inning games hang in an endless foul loop", hangN === 0, hangN + " hung: " + HANGS.join(" ;; "));
    // seed -1 (last: may soft-lock)
    e0 = errMark(); APP.show("game"); await PT.wait(30); PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); $("innings").value = 1; $("seed").value = -1;
    chk("seed input allows -1 (no min attr)", $("seed").min === "" && $("seed").value === "-1", "min='" + $("seed").min + "' value=" + $("seed").value);
    try { await $("start").onclick() } catch (e) { PT.note("start threw " + e.message) } await PT.wait(300);
    const seedErrs = newErrs(e0, "seed-1"); chk("EXPECT seed -1 starts a valid game (no JS error)", seedErrs.length === 0, seedErrs.join(" | "));
    PT.click("#playPitch"); await PT.wait(800); const feedTxt = ($("feed").textContent || "").slice(0, 120); PT.note("feed after 한 구 with seed -1: " + feedTxt);
    chk("EXPECT a pitch is playable with seed -1", !feedTxt.includes("투구 데이터가 없습니다"), feedTxt);
    APP.show("schedule"); chk("EXPECT can leave after seed -1 (soft-lock check)", PT.visible("#screen-club"), "locked=" + APP.locked + " clubVisible=" + PT.visible("#screen-club") + " gameVisible=" + !$("game").hidden);
    newErrs(e0, "seed-1b");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · game inputs", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
