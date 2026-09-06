/* generated QA scenario: 99 innings */
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

    await newSeason(5); for (let i = 0; i < 3; i++) ClubUI.simDay();
    APP.show("game"); await PT.wait(30); PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); $("innings").value = 99; $("seed").value = 1;
    chk("innings input max attr is 9 but 99 accepted", $("innings").max === "9" && $("innings").value === "99", $("innings").value);
    const e0 = errMark(); await $("start").onclick(); await PT.until(() => !$("game").hidden, 3000); chk("total = 99", GameUI.state().total === 99, GameUI.state().total);
    $("playInning").click(); const br = await PT.until(() => PT.visible("#sceneBreak"), 25000); if (!br) { $("stop").click(); await PT.wait(300) }
    chk("reached the inning break", br, "pitches=" + (GameUI.state().pitches.us + GameUI.state().pitches.them) + (br ? "" : " (hang?) " + ($("feed").textContent || "").slice(0, 60)));
    if (!br) { GameUI.renderBreak(false); GameUI.setScene("break") }
    const tbl = document.querySelector("#breakScore table"); const box = document.querySelector(".breakbox"); const tw = tbl ? tbl.getBoundingClientRect().width : 0, bw = box ? box.getBoundingClientRect().width : 0, bl = box ? box.getBoundingClientRect().left : 0;
    chk("EXPECT 99-column box score fits the panel (no horizontal overflow)", tw <= bw + 1 && bl >= 0 && bl + bw <= innerWidth + 1, "table " + Math.round(tw) + "px vs panel " + Math.round(bw) + "px at left " + Math.round(bl) + ", innerWidth " + innerWidth + ", doc scrollWidth " + document.documentElement.scrollWidth);
    chk("resume button visible on break screen", PT.visible("#resume"), "resume rect right=" + Math.round($("resume").getBoundingClientRect().right));
    chk("no JS errors", newErrs(e0, "99").length === 0, PT.errs.slice(e0).join("|"));

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · 99 innings", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
