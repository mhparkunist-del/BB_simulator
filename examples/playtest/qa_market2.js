/* generated QA scenario: market UI/cap */
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

    let e0; await newSeason(1); for (let i = 0; i < 2; i++) ClubUI.simDay(); APP.show("market"); const M = ClubMarket;
    // UI: pick 3 받을 선수 (re-query after each render)
    e0 = errMark(); for (let i = 0; i < 3; i++) { const cb = [...document.querySelectorAll("#tradeTheirs input")].filter(c => !c.checked)[0]; if (cb) { cb.click(); await PT.wait(20) } }
    const checked = document.querySelectorAll("#tradeTheirs input:checked").length; chk("UI limits 받을 선수 to 2", checked === 2, checked);
    // UI give-away: uncheck theirs, check one of ours, 제안 with cash 0
    [...document.querySelectorAll("#tradeTheirs input:checked")].forEach(() => { const c = document.querySelector("#tradeTheirs input:checked"); if (c) c.click() }); await PT.wait(20);
    const ourCb = document.querySelector("#tradeOurs input:not([disabled])"); const ourId = +ourCb.dataset.id; const ourName = P(ourId).name; ourCb.click(); await PT.wait(20); $("tradeCash").value = 0; $("tradeGo").click(); await PT.wait(40);
    chk("EXPECT UI 제안 with only 보낼 선수 (gift) is refused or confirmed", !!P(ourId), ourName + " still ours=" + !!P(ourId) + " msg=" + PT.text("#tradeMsg"));
    newErrs(e0, "ui-trade");
    // 26-man cap: fill 1군 to 26 via API then check the UI
    e0 = errMark(); const s = S(); s.players.filter(p => !p.active).slice(0, 26 - s.players.filter(p => p.active).length).forEach(p => p.active = true); ClubUI.render(); APP.show("roster");
    const act = s.players.filter(p => p.active).length; const upEnabled = [...document.querySelectorAll("#rosterList [data-act='up']")].filter(b => !b.disabled).length; const upAll = document.querySelectorAll("#rosterList [data-act='up']").length;
    chk("at 26 active every visible 1군 button is disabled", act === 26 && upEnabled === 0, "active=" + act + " enabledUp=" + upEnabled + "/" + upAll + " header=" + (PT.text("#rosterList") || "").slice(0, 12));
    const fa = s.fa[0]; M.startNego(fa.id); M.offer(M.fin().nego.ask, M.fin().nego.years); $("negoModal").hidden = true; chk("FA signed at 26 lands in 2군", P(fa.id) && P(fa.id).active === false && s.players.filter(p => p.active).length === 26, "active=" + s.players.filter(p => p.active).length);
    const opp = s.opps.find(o => o.code); const R = M.oppRoster(opp.code).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => a.v - b.v); const mine = s.players.filter(p => p.active && !p.noTrade).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
    const r = M.proposeTrade(opp.code, [R[0].p.id, R[1].p.id], [mine[0].p.id], 0); chk("2-for-1 at 26 active keeps the cap", !r.ok || s.players.filter(p => p.active).length <= 26, r.msg + " active=" + s.players.filter(p => p.active).length);
    newErrs(e0, "cap"); APP.show("roster");

  } catch (e) { PT.note("SCENARIO EXCEPTION " + e.message + " " + (e.stack || "").slice(0, 300)); C.push({ name: "scenario exception", ok: false, got: e.message }) }
  await PT.done({ persona: "QA 파괴 테스터 · market UI/cap", checks: C, fails: C.filter(c => !c.ok).length, hangs: HANGS });
})();
