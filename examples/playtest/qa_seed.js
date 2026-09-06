/* generated QA scenario: seed input */
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

    await newSeason(2); for (let i = 0; i < 3; i++) ClubUI.simDay(); let e0 = errMark();
    APP.show("game"); await PT.wait(30); PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); $("innings").value = 1; $("seed").value = -1;
    chk("seed input allows -1 (no min attr)", $("seed").min === "" && $("seed").value === "-1", "min='" + $("seed").min + "' value=" + $("seed").value);
    try { await $("start").onclick() } catch (e) { PT.note("start threw " + e.message) } await PT.wait(300);
    const seedErrs = newErrs(e0, "seed-1"); chk("EXPECT seed -1 starts a valid game (no JS error)", seedErrs.length === 0, seedErrs.join(" | "));
    chk("state after seed -1: locked / game shown / oppPitcher", false || (GameUI.state() && GameUI.state().oppPitcher >= 0), "locked=" + APP.locked + " gameVisible=" + !$("game").hidden + " oppPitcher=" + (GameUI.state() && GameUI.state().oppPitcher) + " pitcher=" + (GameUI.state() && GameUI.state().pitcher));
    $("playPitch").click(); await PT.wait(1500); const feedTxt = ($("feed").textContent || "").slice(0, 160); PT.note("feed after 한 구 with seed -1: " + feedTxt);
    chk("EXPECT a pitch is playable with seed -1", !feedTxt.includes("투구 데이터가 없습니다"), feedTxt);
    $("playFast").click(); await PT.wait(1000); chk("EXPECT 결과 바로보기 can finish the seed -1 game", GameUI.state() && GameUI.state().over, "over=" + (GameUI.state() && GameUI.state().over) + " busy=" + $("playPitch").disabled);
    APP.show("schedule"); chk("EXPECT can leave after seed -1 (soft-lock check)", !$("screen-club").hidden, "locked=" + APP.locked + " clubHidden=" + $("screen-club").hidden + " nav disabled=" + [...document.querySelectorAll(".nav [data-screen]")].filter(b => b.disabled).length);
    newErrs(e0, "seed-1b");
    // seed 1.5 and seed 0
    e0 = errMark(); GameUI.renderBreak; PT.note("resume label=" + PT.text("#resume"));

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · seed input", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
