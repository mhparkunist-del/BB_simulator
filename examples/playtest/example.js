/* example scenario: new season with the 4th club, skip the tutorial, play one inning fast, sign a free agent, report */
(async () => {
  PT.say("타이틀 → 새로 시작");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  const S = ClubUI.state(); PT.note("club " + S.club.name + " players " + S.players.length + " cash " + S.budget);
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 1; await document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("game").hidden, 3000);
  await GameUI.fast(); const G = GameUI.state(); PT.note("game over " + G.over + " score " + G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0));
  await PT.shot("final");
  PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 3000); PT.click("#eventOk");
  APP.show("market"); const fa = ClubUI.state().fa[0]; ClubMarket.startNego(fa.id); ClubMarket.offer(ClubMarket.fin().nego.ask, ClubMarket.fin().nego.years);
  const signed = ClubUI.state().players.some(p => p.id === fa.id); PT.note("signed " + fa.name + " " + signed);
  await PT.done({ persona: "example", fun: 7, funWhy: "빠른 결과 보기와 협상이 이어져 리듬이 좋다", bugs: [], stats: { signed, locked: APP.locked } });
})();
