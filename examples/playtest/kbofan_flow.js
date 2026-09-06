/* KBO fan playtest: new-game UI flow after the patch — 타이틀 → 새로 시작 → 한화 card → 부임하기; dump which screen/modal is up at each step (diagnoses the roster_hh hang) */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  const vis = () => [...document.querySelectorAll("[id^=screen-]")].filter(e => !e.hidden && getComputedStyle(e).display !== "none").map(e => e.id).join(",") + " modals:" + ["eventModal", "cardModal", "negoModal", "saveModal", "tutorial"].filter(id => { const e = document.getElementById(id); return e && !e.hidden && getComputedStyle(e).display !== "none" }).join(",");
  PT.say("새로 시작 흐름");
  note("t0 " + vis());
  PT.click("#btnNew"); await PT.wait(300); note("after btnNew " + vis());
  const idx = APP.teamList().findIndex(t => t.code === "HH"); const cards = document.querySelectorAll("#teamCards .tc"); cards[idx].click(); await PT.wait(100);
  note("after card " + vis() + " teamPick=" + PT.text("#teamPick") + " startDisabled=" + document.getElementById("teamStart").disabled);
  const t1 = performance.now(); const pr = document.getElementById("teamStart").onclick(); let settled = false; pr.then(() => settled = true).catch(e => note("teamStart error " + e));
  for (let i = 0; i < 12; i++) { await PT.wait(500); if (settled) break }
  note("teamStart settled=" + settled + " after " + Math.round(performance.now() - t1) + "ms · " + vis() + " · state? " + (ClubUI.state() ? ClubUI.state().club.name + " day " + ClubUI.state().day : "null"));
  note("event: " + PT.text("#eventTitle") + " / " + PT.text("#eventBody"));
  if (PT.visible("#eventModal")) { PT.click("#eventOk"); await PT.wait(300); note("after eventOk " + vis() + " tut: " + PT.text("#tutText")) }
  if (PT.visible("#tutorial")) { PT.click("#tutSkip"); await PT.wait(300); note("after tutSkip " + vis()) }
  note("strip: " + ["tDate", "tRec", "tRank", "tBudget", "tPay", "tMorale"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  // 새 시즌 keeps the club: finish the season and check the "new season" path
  let n = 0; while (ClubUI.state().sched.some(g => !g.result) && n < 45) { ClubUI.simDay(); n++ }
  const S = ClubUI.state(); note("season over: " + S.W + "-" + S.L + (S.D ? "-" + S.D : "") + " day " + S.day + " · log head: " + S.log.slice(0, 3).map(l => l.d + " " + l.t).join(" || "));
  APP.show("schedule"); await PT.wait(300);
  note("nextDay label at season end: " + PT.text("#nextDay") + " · nextGame: " + (document.getElementById("nextGame").innerText || "").replace(/\s+/g, " ").slice(0, 200));
  const btns = [...document.querySelectorAll("button")].filter(b => /새 시즌|다음 시즌|시즌 시작/.test(b.textContent)).map(b => b.id + ":" + b.textContent.trim());
  note("season-end buttons: " + btns.join(" | "));
  const b = [...document.querySelectorAll("button")].find(b => /새 시즌|다음 시즌/.test(b.textContent) && !b.hidden && !b.disabled);
  if (b) { b.click(); await PT.wait(800); const S2 = ClubUI.state(); note("after 새 시즌: club " + S2.club.name + " rec " + S2.W + "-" + S2.L + " day " + S2.day + " budget " + S2.budget + " players " + S2.players.length + " sched0 " + (S2.sched[0] && S2.sched[0].date) + " " + vis() + " · event " + PT.text("#eventTitle") + " / " + PT.text("#eventBody").slice(0, 160)); if (PT.visible("#eventModal")) PT.click("#eventOk") }
  await PT.done({ persona: "KBO 골수팬 · 흐름", notes: L });
})();
