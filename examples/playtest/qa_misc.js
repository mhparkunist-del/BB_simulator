/* generated QA scenario: misc edge cases */
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

    let e0 = errMark(); await newSeason(7); // NC
    APP.show("bogus"); chk("APP.show('bogus') -> schedule", !$("tab-schedule").hidden && location.hash === "#schedule", location.hash);
    APP.show(); chk("APP.show() -> schedule", location.hash === "#schedule", location.hash);
    // team screen: is there a way back?
    APP.show("title"); PT.click("#btnNew"); await PT.until(() => !$("screen-team").hidden); const backBtns = [...document.querySelectorAll("#screen-team button")].map(b => b.textContent.trim());
    chk("EXPECT a cancel/back control on the club-select screen", backBtns.some(t => /취소|뒤로|타이틀|돌아/.test(t)), "buttons: " + backBtns.join(","));
    PT.click("#btnContinue"); PT.click("#btnLoad"); APP.show("schedule"); chk("state intact after visiting team screen without picking", S().club.name === "NC 다이노스" && S().day === 0, S().club.name);
    // 27 active via API
    const s = S(); s.players.filter(p => !p.active).slice(0, 27 - s.players.filter(p => p.active).length).forEach(p => p.active = true); ClubUI.render(); APP.show("roster");
    chk("27 active (API): header shows over-cap", (PT.text("#rosterList") || "").includes("27/26"), (PT.text("#rosterList") || "").slice(0, 12));
    ClubUI.simDay(); chk("EXPECT quick-sim with 27 active is refused or penalised", false || S().log.some(l => /초과|27/.test(l.t)), "log0=" + S().log[0].t + " active=" + S().players.filter(p => p.active).length);
    // lineup swap UI cannot create duplicates
    APP.show("roster"); document.querySelector(".swap[data-slot='0']").click(); const rowOfSlot1 = document.querySelector(".pr[data-pid='" + S().lineup[1] + "']"); if (rowOfSlot1) rowOfSlot1.querySelector("td").click(); await PT.wait(30);
    chk("swap then clicking a batter already in the lineup does not duplicate", new Set(S().lineup).size === 9, JSON.stringify(S().lineup));
    // negotiation: 4 years UI max, then modal closes with Escape? (no handler) — check Close only
    APP.show("market"); const fa = S().fa[0]; ClubMarket.startNego(fa.id); chk("nego years select max is 4", [...$("negoYears").options].map(o => o.value).join(",") === "1,2,3,4", [...$("negoYears").options].map(o => o.value).join(","));
    $("negoSalary").value = "1e3"; $("negoOffer").click(); await PT.wait(30); chk("EXPECT salary '1e3' (=1000억) is rejected as unaffordable", !P(fa.id) || S().budget >= 0, "signed=" + !!P(fa.id) + " budget=" + S().budget); $("negoClose").click();
    // pageTable pager clamps
    APP.show("schedule"); const nx = document.querySelector("#schedule [data-pg='sched'][data-d='1']"); for (let i = 0; i < 8; i++) { const b = document.querySelector("#schedule [data-pg='sched'][data-d='1']"); if (b) b.click() } chk("schedule pager clamps at last page", (PT.text("#schedule .pager span") || "").split("/")[0] === (PT.text("#schedule .pager span") || "").split("/")[1], PT.text("#schedule .pager span"));
    // save modal: save to slot, then overwrite, then event text
    PT.click("#saveBtn"); await PT.until(() => document.querySelector("#saveSlots [data-slot='2']"), 3000); document.querySelector("#saveSlots [data-slot='2']").click(); await PT.wait(300); const t1 = (await APP.kv.get("save:2")).when; document.querySelector("#saveSlots [data-slot='2']").click(); await PT.wait(300); const t2 = (await APP.kv.get("save:2")).when;
    chk("overwriting a slot updates its timestamp", t2 >= t1, t1 + " -> " + t2); PT.click("#eventOk"); PT.click("#saveClose");
    chk("no JS errors in misc", newErrs(e0, "misc").length === 0, PT.errs.slice(e0).join("|")); APP.show("roster");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · misc edge cases", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
