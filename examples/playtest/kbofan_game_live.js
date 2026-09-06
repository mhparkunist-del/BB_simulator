/* KBO fan playtest: 삼성 game — play one inning live at 10x, capture the pitch HUD mid-game (final capture = live game screen), then inning-break page with next three batters */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("삼성 경기 라이브");
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);   // headless capture holds the load event and rAF never ticks, so an animated pitch would hang forever
  ClubUI.fresh(APP.teamList().find(t => t.code === "SS")); const S = ClubUI.state(); ClubUI.render();
  APP.show("game"); await PT.wait(400);
  note("gameDayNote: " + PT.text("#gameDayNote") + " oppClub " + JSON.stringify(APP.clubLineup && APP.clubLineup.oppClub));
  if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click();
  if (GameUI.pick.order.length < 9) PT.click("#autoOrder");
  document.getElementById("innings").value = 2; document.getElementById("spd").value = 10;
  await document.getElementById("start").onclick(); await PT.until(() => !document.getElementById("game").hidden, 3000);
  note("first feed: " + (document.querySelector("#feed .l") || {}).textContent);
  await document.getElementById("playInning").onclick();
  note("after top 1: scene break visible " + PT.visible("#sceneBreak") + " · breakTitle " + PT.text("#breakTitle") + " · nextUp: " + PT.text("#nextUp"));
  note("break page label: " + PT.text("#breakPageNo"));
  PT.click("#breakNext"); await PT.wait(100); note("page2: " + PT.text("#breakPageNo") + " " + (document.getElementById("breakUs").innerText || "").replace(/\s+/g, " ").slice(0, 300));
  PT.click("#resume"); await PT.wait(200);
  await document.getElementById("playPA").onclick();
  note("bottom 1 after 1 PA: " + PT.text("#sInn") + " AT BAT " + PT.text("#sBatter") + " · " + PT.text("#onDeck") + " · def calls visible " + (document.getElementById("defCalls").style.display !== "none") + " · feedLast " + (document.getElementById("feedLast").innerText || "").replace(/\s+/g, " ").slice(0, 200));
  await PT.shot("cam_bottom1", "#cam");
  note("nav locked " + APP.locked + " lockBadge " + PT.text("#lockBadge"));
  await PT.done({ persona: "KBO 골수팬 · 라이브", notes: L });
})();
