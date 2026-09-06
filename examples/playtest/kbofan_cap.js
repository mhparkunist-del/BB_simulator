/* KBO fan playtest: KT (highest payroll) — sign every FA at asking price to push the top-40 payroll over the 137.4억 cap and the 1군 over 26, then finish the season and read the cap penalty / roster warnings; also probe the 1-year no-trade flag and foreign-player counting */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("KT 샐러리캡 초과 실험");
  ClubUI.fresh(APP.teamList().find(t => t.code === "KT")); const M = ClubMarket; let S = ClubUI.state();
  note("start top40 " + ClubInt.top40().toFixed(1) + " budget " + S.budget + " 1군 " + S.players.filter(p => p.active).length + " · FA pool " + S.fa.map(f => f.name + "(" + (f.pos || f.role) + " " + f.asking + "억)").join(","));
  const foreign = n => /[가-힣]/.test(n) && !/^[가-힣]{2,4}$/.test(n) ? "?" : (/^(디아즈|페덱|사토시|후라도|오스틴|카라스코|케네디|톨허스트|타카다|카스트로|아빌라|비슬리|페라자|짐머맨|화이트|왕옌청|라일리|블레인|알칸타라|히우라|데이비슨|쿠에바스|로하스|헤이수스|위즈덤|네일|올러|에레디아|레이예스|감보아|케이브|푸이그|카디네스)$/.test(n) ? "F" : "K");
  note("KT 1군 외국인(이름 기준 추정): " + S.players.filter(p => p.active && foreign(p.name) === "F").map(p => p.name).join(",") + " · 전체 외국인 " + S.players.filter(p => foreign(p.name) === "F").map(p => p.name + (p.active ? "" : "[2군]")).join(","));
  const signed = [];
  for (const f of S.fa.slice()) {
    M.startNego(f.id); await PT.wait(50);
    const r = M.offer(f.asking, 3);
    const p = ClubUI.state().players.find(x => x.name === f.name);
    signed.push(f.name + ":" + (p ? "signed " + p.contract.salary + "억 active=" + p.active + " noTrade=" + p.noTrade : "no (" + (r && r.msg ? r.msg : JSON.stringify(r)) + ")"));
    PT.click("#negoClose"); await PT.wait(50);
    if (ClubUI.state().budget < 3) break;
  }
  S = ClubUI.state();
  note("SIGNED: " + signed.join(" | "));
  note("after signing: top40 " + ClubInt.top40().toFixed(1) + " (캡 137.4) budget " + S.budget + " 1군 " + S.players.filter(p => p.active).length + " · nego modal msg: " + (document.getElementById("negoMsg") ? PT.text("#negoMsg") : "-"));
  APP.show("roster"); await PT.wait(300);
  note("roster head: " + (document.querySelector("#rosterList th") || {}).textContent + " · warn: " + [...document.querySelectorAll(".warn")].map(e => e.textContent.trim()).join(" / ").slice(0, 300));
  note("strip: " + ["tDate", "tRec", "tRank", "tBudget", "tPay"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  // try to trade away a just-signed FA (should be blocked for 1 year)
  const fa1 = S.players.find(p => p.noTrade); const opp = S.opps[0]; const theirs = M.oppRoster(opp.code);
  if (fa1 && theirs.length) { const r = M.proposeTrade(opp.code, [theirs[theirs.length - 1].id], [fa1.id], 0); note("trade noTrade player " + fa1.name + " → " + JSON.stringify(r).slice(0, 200)) }
  // cash clamp probe
  { const r = M.proposeTrade(opp.code, [theirs[0].id], [], 9999); note("cash 9999 probe → " + JSON.stringify(r).slice(0, 200) + " budget " + ClubUI.state().budget) }
  // sim to season end and read the settlement
  let n = 0; while (ClubUI.state().sched.some(g => !g.result) && n < 45) { ClubUI.simDay(); n++ }
  S = ClubUI.state(); const f = M.fin();
  note("season end: " + S.W + "-" + S.L + "-" + (S.D || 0) + " budget " + S.budget + " top40 " + ClubInt.top40().toFixed(1) + " exp " + JSON.stringify(f.exp) + " inc " + JSON.stringify(f.inc));
  note("ledger 제재/정산 lines: " + f.ledger.filter(l => /제재|기금|캡|정산/.test(l.text + l.kind)).map(l => l.d + " " + l.kind + " " + l.amt + " " + l.text).join(" || "));
  note("log head: " + S.log.slice(0, 4).map(l => l.d + " " + l.t).join(" || "));
  note("draws recorded? S.D=" + S.D + " · results with us==them: " + S.sched.filter(g => g.result && g.result.us === g.result.them).length + " · sched result sample: " + JSON.stringify(S.sched[0].result));
  APP.show("market"); await PT.wait(300);
  await PT.done({ persona: "KBO 골수팬 · 캡", notes: L });
})();
