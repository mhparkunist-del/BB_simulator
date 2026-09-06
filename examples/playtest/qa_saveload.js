/* QA: save slot / load / autosave / continue / reset integrity */
(async () => {
  const $ = id => document.getElementById(id);
  const C = []; const chk = (name, ok, got) => { C.push({ name, ok: !!ok, got: String(got) }); PT.note((ok ? "PASS " : "FAIL ") + name + " | GOT " + got) };
  const errMark = () => PT.errs.length; const newErrs = (n, step) => { if (PT.errs.length > n) PT.note("ERR@" + step + ": " + PT.errs.slice(n).join(" || ")); return PT.errs.slice(n) };
  async function newSeason(i) { APP.show("title"); PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team")); document.querySelectorAll("#teamCards .tc")[i].click(); PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk"); await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(80) }
  function snap() { const S = ClubUI.state(); return JSON.stringify({ day: S.day, budget: S.budget, W: S.W, L: S.L, runs: S.runs, ra: S.ra, seed: S.seed, rotIdx: S.rotIdx, policy: S.policy, lineup: S.lineup, rotation: S.rotation, program: S.program, players: S.players.map(p => [p.id, p.name, p.active, p.injury, p.fatigue, p.condition, p.contract, p.stats, p.attrs, p.morale, p.pos, p.role]), fa: S.fa.map(p => p.id), ledger: S.fin.ledger, inc: S.fin.inc, exp: S.fin.exp, offers: S.fin.offers, sched: S.sched.map(g => g.result), log: S.log.length, opps: S.opps.map(o => [o.W, o.L, o.bat, o.pitch]), club: S.club, kbo: S.kbo, played: S.played }) }
  let e0;
  try {
    PT.say("save/load");
    await newSeason(3); // KIA
    for (let i = 0; i < 3; i++) ClubUI.simDay();
    // sign an FA to put entries in the ledger
    const fa = ClubUI.state().fa[0]; ClubMarket.startNego(fa.id); ClubMarket.offer(ClubMarket.fin().nego.ask, ClubMarket.fin().nego.years); $("negoModal").hidden = true;
    chk("FA signed before save", ClubUI.state().players.some(p => p.id === fa.id), ClubUI.state().players.some(p => p.id === fa.id));
    const A = snap(); const dayA = ClubUI.state().day, budgetA = ClubUI.state().budget, ledgerA = ClubUI.state().fin.ledger.length;
    // save to slot 1 via UI
    e0 = errMark(); APP.show("schedule"); PT.click("#saveBtn"); const gotSlots = await PT.until(() => document.querySelector("#saveSlots [data-slot='1']"), 4000);
    chk("save modal lists slots", gotSlots, gotSlots);
    document.querySelector("#saveSlots [data-slot='1']").click(); await PT.until(() => PT.visible("#eventModal"), 4000); const saveMsg = PT.text("#eventBody"); PT.click("#eventOk"); PT.click("#saveClose");
    await PT.wait(150); const slotTxt = PT.text("#saveSlots");
    chk("slot 1 label shows day", (slotTxt || "").includes("day " + dayA), slotTxt);
    const sv1 = await APP.kv.get("save:1"); chk("kv save:1 exists with same day", sv1 && sv1.S && sv1.S.day === dayA, sv1 && sv1.S && sv1.S.day);
    newErrs(e0, "save");
    // mutate state: days, lineup swap, policy, release, trade
    for (let i = 0; i < 4; i++) ClubUI.simDay();
    APP.show("roster"); document.querySelector(".swap[data-slot='0']").click(); document.querySelector(".swap[data-slot='1']").click();
    APP.show("training"); document.querySelector(".pol[data-pol='hitting']").click();
    const S1 = ClubUI.state(); const res = S1.players.find(p => !p.active); if (res) { APP.show("roster"); const b = document.querySelector("[data-act='release'][data-pid='" + res.id + "']"); if (b) b.click(); else { PT.note("release button not on first page; skipping UI release") } }
    const B = snap(); chk("state changed after mutations", A !== B, "dayB=" + ClubUI.state().day + " policy=" + ClubUI.state().policy);
    // go title, load slot 1
    e0 = errMark(); PT.click("#titleBtn"); await PT.until(() => PT.visible("#screen-title"), 3000);
    const auto1 = await APP.kv.get("autosave"); chk("titleBtn autosaves current (day B)", auto1 && auto1.S.day === ClubUI.state().day, auto1 && auto1.S.day);
    PT.click("#btnLoad"); const gotLoad = await PT.until(() => document.querySelector("#loadSlots [data-slot='1']"), 4000); chk("load list rendered", gotLoad, gotLoad);
    document.querySelector("#loadSlots [data-slot='1']").click(); await PT.until(() => PT.visible("#screen-club"), 4000); await PT.wait(100);
    const L = snap(); chk("EXPECT loaded state == saved snapshot", L === A, L === A ? "identical" : "DIFF len " + L.length + " vs " + A.length);
    if (L !== A) { const a = JSON.parse(A), l = JSON.parse(L); for (const k in a) if (JSON.stringify(a[k]) !== JSON.stringify(l[k])) PT.note("diff key " + k + ": " + JSON.stringify(a[k]).slice(0, 120) + " -> " + JSON.stringify(l[k]).slice(0, 120)) }
    chk("loaded day/budget/ledger", ClubUI.state().day === dayA && ClubUI.state().budget === budgetA && ClubUI.state().fin.ledger.length === ledgerA, ClubUI.state().day + "/" + ClubUI.state().budget + "/" + ClubUI.state().fin.ledger.length);
    chk("header strip shows loaded date/budget", PT.text("#tBudget") === budgetA.toFixed(1), PT.text("#tDate") + " " + PT.text("#tBudget"));
    const club = await APP.kv.get("club"); chk("kv club == loaded", club && club.day === dayA, club && club.day);
    const auto2 = await APP.kv.get("autosave"); chk("EXPECT autosave follows load (day " + dayA + ")", auto2 && auto2.S.day === dayA, "autosave day " + (auto2 && auto2.S.day) + " (boot with hash restores autosave, not the loaded slot)");
    newErrs(e0, "load");
    // title -> continue keeps loaded state
    e0 = errMark(); PT.click("#titleBtn"); await PT.until(() => PT.visible("#screen-title"), 3000); await PT.wait(200);
    chk("continue button visible", PT.visible("#btnContinue"), PT.visible("#btnContinue"));
    PT.click("#btnContinue"); await PT.until(() => PT.visible("#screen-club"), 3000);
    chk("continue -> state intact (day " + dayA + ")", ClubUI.state().day === dayA && snap() === A, ClubUI.state().day);
    newErrs(e0, "continue");
    // load an empty slot: nothing happens, no error
    e0 = errMark(); PT.click("#titleBtn"); await PT.until(() => PT.visible("#screen-title"), 3000); PT.click("#btnLoad"); await PT.until(() => document.querySelector("#loadSlots [data-slot='3']"), 4000);
    const s3 = await APP.kv.get("save:3"); document.querySelector("#loadSlots [data-slot='3']").click(); await PT.wait(300);
    chk("empty slot 3 load is a no-op", !s3 && PT.visible("#screen-title") && ClubUI.state().day === dayA, "slot3=" + !!s3 + " title=" + PT.visible("#screen-title"));
    PT.click("#btnContinue"); await PT.until(() => PT.visible("#screen-club"), 3000);
    newErrs(e0, "emptyslot");
    // save while locked: button disabled
    e0 = errMark(); APP.show("game"); PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); $("innings").value = 1; await $("start").onclick(); await PT.until(() => !$("game").hidden, 3000);
    chk("saveBtn disabled while locked", $("saveBtn").disabled && APP.locked, $("saveBtn").disabled);
    PT.click("#saveBtn"); await PT.wait(100); chk("save modal stays hidden while locked", $("saveModal").hidden, $("saveModal").hidden);
    const autoBefore = await APP.kv.get("autosave");
    await GameUI.fast(); PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 3000); PT.click("#eventOk"); await PT.wait(150);
    const autoAfter = await APP.kv.get("autosave"); chk("autosave written right after game over", autoAfter && autoAfter.when !== autoBefore.when, (autoBefore && autoBefore.when) + " -> " + (autoAfter && autoAfter.when));
    newErrs(e0, "locksave");
    // pager state survives reset: sim far, then 새 시즌
    e0 = errMark(); for (let i = 0; i < 18; i++) ClubUI.simDay(); APP.show("schedule"); const pgBefore = PT.text("#schedule .pager span");
    const clubBefore = ClubUI.state().club.name, kboBefore = ClubUI.state().kbo; window.confirm = () => true; PT.click("#reset"); await PT.wait(200);
    const pgAfter = PT.text("#schedule .pager span");
    chk("EXPECT schedule pager on page 1 after 새 시즌", (pgAfter || "").startsWith("1/"), "before=" + pgBefore + " after=" + pgAfter);
    chk("EXPECT 새 시즌 keeps club identity (" + clubBefore + ")", ClubUI.state().club.name === clubBefore && ClubUI.state().kbo === kboBefore, "club=" + ClubUI.state().club.name + " kbo=" + ClubUI.state().kbo + " opps=" + ClubUI.state().opps.map(o => o.name).join("/"));
    chk("reset -> day 0 record 0-0", ClubUI.state().day === 0 && ClubUI.state().W === 0, ClubUI.state().day + " " + ClubUI.state().W + "-" + ClubUI.state().L);
    APP.show("market"); chk("EXPECT trade panel still usable after 새 시즌", !(PT.text("#trade") || "").includes("KBO 구단으로 시작한"), (PT.text("#trade") || "").slice(0, 60));
    APP.show("game"); const cardNames = [...document.querySelectorAll("[data-b] b")].map(e => e.textContent.replace(/^\d+ /, "").split(" · ")[0]); const clubNames = new Set(ClubUI.state().players.map(p => p.name));
    const stale = cardNames.filter(n => !clubNames.has(n));
    chk("EXPECT game setup cards match club roster after 새 시즌", stale.length === 0, "stale names: " + stale.join(",") + " | club=" + ClubUI.state().club.name);
    newErrs(e0, "reset");
    APP.show("schedule");
  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 200)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · save/load", checks: C, fails: C.filter(c => !c.ok).length });
})();
