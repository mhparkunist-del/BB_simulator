/* KBO fan playtest: 한화 opening game — setup cards (names/numbers/hands), starters, on-deck, one PA live, then fast to the end and read the box score (final capture = break screen) */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("한화 개막전");
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);   // headless capture holds the load event and rAF never ticks, so an animated pitch would hang forever
  ClubUI.fresh(APP.teamList().find(t => t.code === "HH")); const S = ClubUI.state(); ClubUI.render();
  APP.show("game"); await PT.wait(400);
  note("gameDayNote: " + PT.text("#gameDayNote") + " · clubLineup oppClub " + JSON.stringify(APP.clubLineup && APP.clubLineup.oppClub) + " order prefilled " + PT.text("#order"));
  note("PITCHER CARDS: " + [...document.querySelectorAll("#pitchers .pc")].map(e => e.textContent.replace(/\s+/g, " ").trim()).join(" || "));
  note("BATTER CARDS: " + [...document.querySelectorAll("#batters .pc")].map(e => e.textContent.replace(/\s+/g, " ").trim()).join(" || "));
  const R = APP.roster; note("OPP names: batters " + R.opp.batters.map(b => (b.num !== undefined ? b.num + " " : "") + b.name + "/" + (b.pos || "") + "/" + b.hand).join(", ") + " · pitchers " + R.opp.pitchers.map(p => p.name + "/" + p.hand).join(", "));
  note("club lineup for game: " + S.lineup.map(id => { const p = S.players.find(x => x.id === id); return p.name + "/" + p.pos + "/" + p.hand }).join(", ") + " · starter today " + (() => { const sp = S.rotation.map(id => S.players.find(x => x.id === id))[S.rotIdx]; return sp ? sp.name + " " + sp.hand : "-" })());
  if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click();
  if (GameUI.pick.order.length < 9) PT.click("#autoOrder");
  note("innings default " + document.getElementById("innings").value + " max " + document.getElementById("innings").max);
  document.getElementById("innings").value = 3; document.getElementById("spd").value = 10;
  await document.getElementById("start").onclick(); await PT.until(() => !document.getElementById("game").hidden, 3000);
  note("locked " + APP.locked + " · first feed: " + (document.querySelector("#feed .l") || {}).textContent);
  note("HUD: " + PT.text("#sInn") + " " + PT.text("#sRuns") + " AT BAT " + PT.text("#sBatter") + " · " + PT.text("#onDeck"));
  await PT.shot("cam_start", "#cam");
  await document.getElementById("playPA").onclick();
  note("after 1 PA: " + PT.text("#sInn") + " outs " + [...document.querySelectorAll("#lOuts span")].filter(s => s.classList.contains("on")).length + " AT BAT " + PT.text("#sBatter") + " · " + PT.text("#onDeck") + " · feedLast: " + (document.getElementById("feedLast").innerText || "").replace(/\s+/g, " ").slice(0, 300));
  await PT.shot("cam_pa", "#cam");
  await GameUI.fast(); const G = GameUI.state();
  note("over " + G.over + " score us " + G.score.us.join(",") + " them " + G.score.them.join(",") + " hits " + JSON.stringify(G.hits) + " errors " + JSON.stringify(G.errors) + " pitches " + JSON.stringify(G.pitches));
  await PT.until(() => PT.visible("#sceneBreak"), 3000);
  note("BREAK title: " + PT.text("#breakTitle") + " · nextUp: " + PT.text("#nextUp"));
  note("SCORE TABLE: " + (document.getElementById("breakScore").innerText || "").replace(/\s+/g, " "));
  note("BOX US: " + (document.getElementById("breakUs").innerText || "").replace(/\s+/g, " ").slice(0, 400));
  note("BOX THEM: " + (document.getElementById("breakThem").innerText || "").replace(/\s+/g, " ").slice(0, 400));
  note("PITCHERS: " + (document.getElementById("breakPitchers").innerText || "").replace(/\s+/g, " "));
  note("box names in our roster? " + Object.keys(G.box.us).map(n => n + ":" + !!S.players.find(p => p.name === n)).join(", "));
  await PT.done({ persona: "KBO 골수팬 · 경기", notes: L });
})();
