/* generated QA scenario: animation/inputs */
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

    const hidden0 = document.hidden, vis = document.visibilityState; const t0 = performance.now(); const raf = await Promise.race([new Promise(r => requestAnimationFrame(() => r("raf " + Math.round(performance.now() - t0) + "ms"))), PT.wait(3000).then(() => "raf timeout 3s")]);
    PT.note("document.hidden=" + hidden0 + " visibilityState=" + vis + " " + raf); chk("requestAnimationFrame fires in this harness", !raf.includes("timeout"), raf);
    await newSeason(2); for (let i = 0; i < 3; i++) ClubUI.simDay(); let e0 = errMark();
    // 한 구 with animation at 10x
    await startGame(1, 1); $("spd").value = 10; $("playPitch").click(); const one = await PT.until(() => (GameUI.state().pitches.us + GameUI.state().pitches.them) === 1 && !$("playPitch").disabled, 15000);
    chk("한 구 (animated, 10x) completes within 15s", one, "pitches=" + (GameUI.state().pitches.us + GameUI.state().pitches.them) + " busy=" + $("playPitch").disabled);
    // rapid clicks
    const P0 = GameUI.state().pitches.us + GameUI.state().pitches.them; for (let i = 0; i < 12; i++) $("playPitch").click(); await PT.until(() => !$("playPitch").disabled, 15000); await PT.wait(300);
    const P1 = GameUI.state().pitches.us + GameUI.state().pitches.them; chk("12 rapid 한 구 clicks -> exactly 1 pitch (busy guard)", P1 - P0 === 1, (P1 - P0) + " pitches");
    // spd negative
    $("spd").value = -1; chk("spd input has min=0.25 but accepts -1", $("spd").value === "-1", $("spd").value); $("playPitch").click(); await PT.wait(3000);
    const frozen = $("playPitch").disabled; chk("EXPECT 배속 -1 does not freeze the game (buttons back within 3s)", !frozen, "playPitch.disabled=" + frozen);
    $("stop").click(); const resc = await PT.until(() => !$("playPitch").disabled, 5000); chk("정지 rescues the freeze", resc, "playPitch.disabled=" + $("playPitch").disabled);
    $("spd").value = 0; $("playPitch").click(); const z = await PT.until(() => !$("playPitch").disabled, 15000); chk("spd 0 -> falls back to 1x, pitch completes", z, $("playPitch").disabled); $("spd").value = 10;
    // fast then stop spam
    const pr = fastGuard(8000); await PT.wait(30); for (let i = 0; i < 20; i++) { $("stop").click(); await PT.wait(2) } await pr; const G = GameUI.state();
    chk("fast + stop spam: stopped cleanly, buttons enabled", G.over || !$("playPitch").disabled, "over=" + G.over + " inning=" + G.inning + G.half + " pitches=" + (G.pitches.us + G.pitches.them));
    chk("feed announces interruption", G.over || ($("feed").textContent || "").includes("중단"), ($("feed").textContent || "").slice(0, 80));
    // 타석 button then 이닝 button (animated) -> break screen
    $("playPA").click(); const pa = await PT.until(() => !$("playPA").disabled, 20000); chk("타석 completes", pa, "pitches=" + (GameUI.state().pitches.us + GameUI.state().pitches.them));
    if (!GameUI.state().over) { $("playInning").click(); const br = await PT.until(() => !$("sceneBreak").hidden, 40000); if (!br) { $("stop").click(); await PT.wait(300) } chk("이닝 reaches the break screen", br, "pitches=" + (GameUI.state().pitches.us + GameUI.state().pitches.them) + " over=" + GameUI.state().over);
      if (br) { $("breakPrev").click(); chk("break prev wraps to 4/4", (PT.text("#breakPageNo") || "").includes("4/4"), PT.text("#breakPageNo")); $("breakNext").click(); chk("break next wraps to 1/4", (PT.text("#breakPageNo") || "").includes("1/4"), PT.text("#breakPageNo")); if (!GameUI.state().over) { $("resume").click(); await PT.wait(50); chk("다음 이닝 진행 returns to the pitch scene", !$("scenePitch").hidden, $("scenePitch").hidden) } } }
    const r = await finishGame(); PT.note("finished hung=" + r.hung); chk("no JS errors in animation tests", newErrs(e0, "anim").length === 0, PT.errs.slice(e0).join("|"));
    // start twice (API) while running
    e0 = errMark(); await startGame(2, 1); const pr3 = fastGuard(8000); await PT.wait(5); const G_before = GameUI.state(); try { await $("start").onclick() } catch (e) { PT.note("second start threw " + e.message) } await pr3; await PT.wait(100);
    const twice = newErrs(e0, "start-twice"); chk("EXPECT second 플레이 볼 (API) while running is harmless", twice.length === 0, "errs=" + twice.join("|") + " newG=" + (GameUI.state() !== G_before) + " over=" + (GameUI.state() && GameUI.state().over));
    { const r2 = await finishGame(); PT.note("start-twice game finished hung=" + r2.hung) } chk("unlocked after start-twice sequence", !APP.locked, APP.locked);
    // seed -1 (last: may soft-lock)
    e0 = errMark(); APP.show("game"); await PT.wait(30); PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); $("innings").value = 1; $("seed").value = -1;
    chk("seed input allows -1 (no min attr)", $("seed").min === "" && $("seed").value === "-1", "min='" + $("seed").min + "' value=" + $("seed").value);
    try { await $("start").onclick() } catch (e) { PT.note("start threw " + e.message) } await PT.wait(300);
    const seedErrs = newErrs(e0, "seed-1"); chk("EXPECT seed -1 starts a valid game (no JS error)", seedErrs.length === 0, seedErrs.join(" | "));
    $("playPitch").click(); await PT.wait(1500); const feedTxt = ($("feed").textContent || "").slice(0, 120); PT.note("feed after 한 구 with seed -1: " + feedTxt);
    chk("EXPECT a pitch is playable with seed -1", !feedTxt.includes("투구 데이터가 없습니다"), feedTxt);
    APP.show("schedule"); chk("EXPECT can leave after seed -1 (soft-lock check)", !$("screen-club").hidden, "locked=" + APP.locked + " clubHidden=" + $("screen-club").hidden + " gameVisible=" + !$("game").hidden);
    $("playFast").click(); await PT.wait(500); chk("EXPECT 결과 바로보기 can finish the seed -1 game", GameUI.state() && GameUI.state().over, "over=" + (GameUI.state() && GameUI.state().over) + " feed=" + ($("feed").textContent || "").slice(0, 60));
    newErrs(e0, "seed-1b");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · animation/inputs", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
