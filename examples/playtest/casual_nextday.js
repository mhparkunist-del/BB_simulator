/* casual persona · after the first game: 결과 바로보기 → 정비로 돌아가기 → 확인 → 다음 날. What does the next day show (events, training feedback, next game)? name *_train ends on the training screen */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); }
  const v = PT.name; const G = () => GameUI.state();
  PT.say("첫 경기 뒤 다음 날");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=training]"); await PT.wait(100); PT.click(".pol[data-pol=balanced]"); await PT.wait(100);
  PT.click(".nav [data-screen=schedule]"); await PT.wait(100); PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
  document.getElementById("innings").value = 2; await document.getElementById("start").onclick(); await PT.wait(200);
  PT.click("#playFast"); await PT.until(() => G() && G().over, 60000); await PT.wait(300);
  PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 4000); PT.note("game-over event: " + PT.text("#eventTitle") + " · " + PT.text("#eventBody").replace(/\s+/g, " "));
  PT.click("#eventOk"); await PT.wait(300);
  const S0 = ClubUI.state(); PT.note("after game: day " + S0.day + " " + PT.text("#tDate") + " rec " + S0.W + "-" + S0.L + " budget " + S0.budget + " nextDay '" + PT.text("#nextDay") + "' morale " + PT.text("#tMorale") + " · next game: " + PT.text("#nextGame").replace(/\s+/g, " "));
  PT.click("#nextDay"); await PT.wait(400);
  const ev = PT.visible("#eventModal"); PT.note("다음 날 → event? " + ev + (ev ? " '" + PT.text("#eventTitle") + " · " + PT.text("#eventBody").replace(/\s+/g, " ").slice(0, 200) + "'" : ""));
  if (ev) { PT.click("#eventOk"); await PT.wait(200); }
  const S1 = ClubUI.state(); PT.note("day " + S1.day + " " + PT.text("#tDate") + " nextDay '" + PT.text("#nextDay") + "' · log0 '" + (S1.log[0] || {}).t + "' log1 '" + (S1.log[1] || {}).t + "' · next game: " + PT.text("#nextGame").replace(/\s+/g, " ") + " · budget " + S1.budget);
  const sp = S1.players.filter(p => p.type === "P" && S1.rotation.includes(p.id)).map(p => p.name + " " + Math.round(p.fatigue * 100) + "%").join(", "); PT.note("rotation fatigue: " + sp);
  if (v.endsWith("_train")) { PT.click(".nav [data-screen=training]"); await PT.wait(300); PT.note("training: policy on '" + (document.querySelector(".pol.on") || {}).textContent + "' trainLog: " + PT.text("#trainLog").replace(/\s+/g, " ").slice(0, 300)); PT.say("다음 날 · 훈련 화면"); }
  else PT.say("다음 날 → " + PT.text("#tDate"));
  await PT.done({ persona: "casual mobile", screen: v, day: S1.day });
})();
