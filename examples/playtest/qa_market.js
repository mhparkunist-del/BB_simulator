/* generated QA scenario: market abuse */
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

    let e0; PT.say("market abuse"); await newSeason(1); // LG
    for (let i = 0; i < 2; i++) ClubUI.simDay(); APP.show("market");
    const M = ClubMarket, F = () => M.fin();
    // negotiation via UI
    e0 = errMark(); const fa0 = S().fa[0]; const n0 = await pagedClick("signing", "[data-nego='" + fa0.id + "']", "sign"); await PT.until(() => PT.visible("#negoModal"), 2000);
    chk("nego modal opens from the signing table", n0 && PT.visible("#negoModal"), PT.visible("#negoModal"));
    $("negoSalary").value = 0; $("negoOffer").click(); await PT.wait(30); chk("offer 0억: refused, patience -1, not signed", F().nego.patience === 2 && !P(fa0.id), F().nego.msg);
    $("negoSalary").value = -5; $("negoOffer").click(); await PT.wait(30); chk("offer -5억: refused, not signed, no error", !P(fa0.id) && PT.errs.length === e0, F().nego.msg + " patience=" + F().nego.patience);
    $("negoClose").click(); chk("nego close hides modal", $("negoModal").hidden, $("negoModal").hidden);
    // 999억 x 4년 via UI
    const fa1 = S().fa[1]; const b0 = S().budget; await pagedClick("signing", "[data-nego='" + fa1.id + "']", "sign"); await PT.until(() => PT.visible("#negoModal"), 2000);
    chk("salary input has no max attr", $("negoSalary").max === "", "max='" + $("negoSalary").max + "'"); $("negoSalary").value = 999; $("negoYears").value = "4"; $("negoOffer").click(); await PT.wait(50);
    const signed999 = !!P(fa1.id); chk("EXPECT 999억×4년 offer cannot be afforded (budget " + b0 + ")", !signed999 || S().budget >= 0, "signed=" + signed999 + " budget " + b0 + " -> " + S().budget + " msg=" + F().nego.msg);
    chk("EXPECT budget never negative", S().budget >= 0, "budget=" + S().budget + " strip=" + PT.text("#tBudget") + " top40=" + ClubInt.top40().toFixed(1));
    $("negoClose").click();
    // 99 years via API
    const fa2 = S().fa[2]; M.startNego(fa2.id); M.offer(F().nego.ask, 99); $("negoModal").hidden = true;
    chk("EXPECT contract years capped at 4 (API offer years=99)", !P(fa2.id) || P(fa2.id).contract.years <= 4, "signed=" + !!P(fa2.id) + " years=" + (P(fa2.id) && P(fa2.id).contract.years));
    M.offer(1, 1); M.startNego(123456); M.answerOffer(999999, true); chk("offer w/o nego, bogus startNego, bogus answerOffer: no error", PT.errs.length === e0, PT.errs.slice(e0).join("|"));
    // release blocked when broke?
    const res0 = S().players.find(p => !p.active && p.id !== fa1.id); const nBefore = S().players.length; APP.show("roster"); await pagedClick("rosterList", "[data-act='release'][data-pid='" + res0.id + "']", "roster"); await PT.wait(30);
    chk("release with negative/insufficient budget is refused", S().budget < 0 ? S().players.length === nBefore : true, "budget=" + S().budget + " players " + nBefore + " -> " + S().players.length + " log=" + S().log[0].t);
    newErrs(e0, "nego"); S().budget = 40; ClubUI.render(); PT.note("budget reset to 40 via API for the trade tests");
    // trades (API)
    e0 = errMark(); APP.show("market"); const opp = S().opps.find(o => o.code); const R = M.oppRoster(opp.code).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => a.v - b.v); const cheap = R[0].p;
    const mine = () => S().players.filter(p => p.active && !p.noTrade).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
    let r = M.proposeTrade(opp.code, [], [], 0); chk("empty trade refused", !r.ok && r.msg.includes("고르세요"), r.msg);
    r = M.proposeTrade("ZZ", [cheap.id], [], 0); chk("unknown club refused", !r.ok, r.msg);
    r = M.proposeTrade(opp.code, [cheap.id], [], S().budget + 1); chk("cash > budget refused", !r.ok && r.msg.includes("잔액"), r.msg);
    r = M.proposeTrade(opp.code, [cheap.id], [mine()[0].p.id], NaN); chk("EXPECT NaN cash handled (no 'NaN' in message)", !r.msg.includes("NaN"), r.msg);
    const m2 = mine(); r = M.proposeTrade(opp.code, [cheap.id, cheap.id], [m2[0].p.id, m2[1].p.id], 0);
    chk("EXPECT duplicate id in theirIds refused / no duplicate player in our club", !r.ok || S().players.filter(p => p.id === cheap.id).length === 1, r.msg + " copies=" + S().players.filter(p => p.id === cheap.id).length + " sameIdRosterRows=" + S().players.filter(p => p.id === cheap.id).map(p => p.name).join("/"));
    const m3 = mine(); r = M.proposeTrade(opp.code, [], [m3[0].p.id], 0); chk("EXPECT giving a player away for nothing needs a confirmation/refusal", !r.ok, r.msg);
    const m4 = mine(); const bB = S().budget; r = M.proposeTrade(opp.code, [], [m4[0].p.id], -30); PT.note("negative cash (sell for 30억): " + r.msg + " budget " + bB + " -> " + S().budget + " inc.parent=" + F().inc.parent);
    chk("negative cash trade: ledger entry consistent", !r.ok || (S().budget === bB + 30 && F().ledger[0].amt === 30), r.msg + " ledger0=" + JSON.stringify(F().ledger[0]));
    const m5 = mine(); const R5 = M.oppRoster(opp.code).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => a.v - b.v); r = M.proposeTrade(opp.code, [R5[0].p.id, R5[1].p.id, R5[2].p.id], [m5[0].p.id, m5[1].p.id, m5[2].p.id], 0);
    chk("EXPECT 3-for-3 refused (UI says max 2)", !r.ok && /2|최대/.test(r.msg), r.msg);
    if (signed999) { r = M.proposeTrade(opp.code, [], [fa1.id], 0); chk("FA-signed player is trade-locked", !r.ok && r.msg.includes("FA"), r.msg) }
    newErrs(e0, "trade-api");
    // trade UI
    e0 = errMark(); ClubUI.render(); const boxes = [...document.querySelectorAll("#tradeTheirs input")]; boxes.slice(0, 3).forEach(b => { b.click() }); await PT.wait(30);
    const checked = document.querySelectorAll("#tradeTheirs input:checked").length; chk("UI limits 받을 선수 to 2", checked === 2, checked);
    $("tradeCash").value = "abc"; $("tradeGo").click(); await PT.wait(30); chk("tradeGo with cash 'abc': message, no error", (PT.text("#tradeMsg") || "").length > 0 && PT.errs.length === e0, PT.text("#tradeMsg"));
    newErrs(e0, "trade-ui");
    // deadline
    e0 = errMark(); let g = 0; while (S().sched.filter(x => x.result).length < 20 && g++ < 30) ClubUI.simDay(); APP.show("market");
    chk("deadline: tradeGo disabled after 20 games", $("tradeGo").disabled, "games=" + S().sched.filter(x => x.result).length + " disabled=" + $("tradeGo").disabled);
    r = M.proposeTrade(opp.code, [R5[0].p.id], [], 0); chk("deadline: API refuses", !r.ok && r.msg.includes("마감"), r.msg);
    const want = mine()[0].p; const give = M.oppRoster(opp.code).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v)[0].p; F().offers.push({ id: 424242, code: opp.code, short: opp.short, want: want.id, give: [give.id], day: S().day }); ClubUI.render();
    chk("offer card rendered after deadline", !!document.querySelector("[data-off='424242']"), !!document.querySelector("[data-off='424242']"));
    const hadWant = !!P(want.id); M.answerOffer(424242, true); chk("EXPECT accepting an AI offer after the deadline is refused", hadWant && !!P(want.id) && !P(give.id), "gave " + want.name + " stillOurs=" + !!P(want.id) + " got " + give.name + "=" + !!P(give.id));
    newErrs(e0, "deadline"); APP.show("market");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · market abuse", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
