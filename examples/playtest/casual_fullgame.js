/* casual persona · one whole 2-inning game on game day using 타석 at 10x, a 결과 바로보기 + 정지 test in the 2nd inning, then 이닝 to the end.
   name default: end on the final break screen · *_stats: return to club, 확인, open 기록 screen · *_sched: back on schedule */
(async () => {
  window.addEventListener("error", e => PT.note("window.error " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno)); window.addEventListener("unhandledrejection", e => PT.note("unhandledrejection " + (e.reason && e.reason.message || e.reason)));
  try {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note("harness: native rAF does not fire in headless capture → setTimeout polyfill (60fps)"); }
  const v = PT.name.replace(/_pc$/, ""); const is = s => v.endsWith(s);
  const G = () => GameUI.state(); const sum = a => a.reduce((x, y) => x + y, 0); const score = () => sum(G().score.us) + ":" + sum(G().score.them);
  const idle = () => PT.until(() => !document.getElementById("playPitch").disabled || (G() && G().over), 60000);
  PT.say("풀 게임 2이닝");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=schedule]"); await PT.wait(200);
  PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
  document.getElementById("innings").value = 2;
  if (document.getElementById("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); }
  const t0 = performance.now(); await document.getElementById("start").onclick(); await PT.wait(200);
  document.getElementById("spd").value = 10;
  PT.note("save/title disabled during game: " + document.getElementById("saveBtn").disabled + "/" + document.getElementById("titleBtn").disabled + " · nav 일정 click → club visible? " + (PT.click(".nav [data-screen=schedule]"), !document.getElementById("screen-club").hidden));
  let pa = 0, breaks = 0, stopTested = false; const paTimes = [];
  while (G() && !G().over && pa < 60) {
    if (PT.visible("#sceneBreak")) { breaks++; PT.note("break #" + breaks + ": '" + PT.text("#breakTitle") + "' nextUp: " + PT.text("#nextUp").replace(/\s+/g, " ")); PT.click("#resume"); await PT.wait(150); continue; }
    if (!stopTested && G().inning === 2 && G().half === "top") {
      stopTested = true; PT.say("결과 바로보기 → 곧바로 정지"); PT.click("#playFast"); await PT.wait(120); PT.click("#stop"); await idle(); await PT.wait(200);
      PT.note("stop test: over " + G().over + " inning " + G().inning + G().half + " outs " + G().outs + " score " + score() + " feedLast: " + PT.text("#feedLast").replace(/\s+/g, " ") + " scene pitch " + PT.visible("#scenePitch"));
      if (G().over) break; continue;
    }
    const a = performance.now(); PT.click("#playPA"); await idle(); pa++; paTimes.push(Math.round(performance.now() - a));
    if (pa <= 4 || pa % 5 === 0) PT.note("PA " + pa + " " + paTimes[paTimes.length - 1] + "ms · " + PT.text("#sInn") + " O" + G().outs + " " + score() + " · " + PT.text("#feedLast").replace(/\s+/g, " ").slice(0, 120));
    if (pa === 2) await PT.shot("pa2_scene");
  }
  if (G() && !G().over) { PT.say("이닝 버튼으로 마무리"); PT.click("#playInning"); await PT.until(() => G().over || PT.visible("#sceneBreak"), 90000); await idle(); if (!G().over && PT.visible("#sceneBreak")) { PT.click("#resume"); await PT.wait(150); PT.click("#playInning"); await PT.until(() => G().over, 90000); await idle(); } }
  const took = Math.round(performance.now() - t0);
  PT.note("game over " + G().over + " score " + score() + " PAs " + pa + " breaks " + breaks + " total " + took + "ms · pa ms avg " + Math.round(paTimes.reduce((x, y) => x + y, 0) / Math.max(1, paTimes.length)) + " max " + Math.max(...paTimes) + " · hits " + JSON.stringify(G().hits) + " pitches " + JSON.stringify(G().pitches));
  PT.note("final break: '" + PT.text("#breakTitle") + "' resume '" + PT.text("#resume") + "' table: " + PT.text("#breakScore").replace(/\s+/g, " "));
  PT.click("#breakNext"); await PT.wait(150); PT.note("우리 타자 page: " + PT.text("#breakUs").replace(/\s+/g, " ").slice(0, 200)); PT.click("#breakNext"); PT.click("#breakNext"); await PT.wait(150); PT.note("투수 page: " + PT.text("#breakPitchers").replace(/\s+/g, " "));
  PT.click("#breakPrev"); PT.click("#breakPrev"); PT.click("#breakPrev"); await PT.wait(100);
  PT.say("경기 종료 " + score());
  if (!is("_stats") && !is("_sched")) { await PT.done({ persona: "casual mobile", screen: v, pa, took, score: score() }); return; }
  const finalScore = score();
  PT.click("#resume"); PT.note("resume clicked · setup visible " + PT.visible("#setup") + " modal hidden attr " + document.getElementById("eventModal").hidden); await PT.until(() => PT.visible("#eventModal"), 4000); PT.note("event: " + PT.text("#eventTitle") + " · " + PT.text("#eventBody").replace(/\s+/g, " ")); PT.click("#eventOk"); await PT.wait(300);
  const S = ClubUI.state(); PT.note("after game: day " + S.day + " rec " + S.W + "-" + S.L + " nextDay '" + PT.text("#nextDay") + "' rank " + PT.text("#tRank") + " log0 " + (S.log[0] || {}).t);
  if (is("_stats")) { PT.click(".nav [data-screen=stats]"); await PT.wait(300); PT.note("stats: standings " + PT.text("#standings").replace(/\s+/g, " ").slice(0, 160) + " | bat rows " + document.querySelectorAll("#batStats tr").length + " pit rows " + document.querySelectorAll("#pitStats tr").length + " | team: " + PT.text("#teamStats").replace(/\s+/g, " ")); PT.say("경기 뒤 기록 화면"); }
  else { PT.say("경기 뒤 일정"); PT.note("sched row1: " + document.querySelector("#schedule tr:nth-child(2)").textContent.replace(/\s+/g, " ")); }
  await PT.done({ persona: "casual mobile", screen: v, pa, took, score: finalScore });
  } catch (e) { PT.note("scenario error: " + e.message + " " + (e.stack || "").split("\n").slice(0, 3).join(" | ")); await PT.done({ persona: "casual mobile", screen: v, error: e.message }); }
})();
