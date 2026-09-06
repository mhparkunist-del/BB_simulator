/* harness probe: press 이닝 at 6x and log the game state every 2 s to see where an inning stalls */
(async () => {
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); }
  const G = () => GameUI.state();
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=schedule]"); await PT.wait(100); PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
  document.getElementById("innings").value = 2; await document.getElementById("start").onclick(); await PT.wait(200);
  document.getElementById("spd").value = 6;
  const t0 = performance.now(); PT.click("#playInning");
  let last = "";
  for (let k = 0; k < 40; k++) {
    await PT.wait(2000);
    const g = G(); const st = g ? (g.inning + g.half + " outs " + g.outs + " B" + g.balls + "S" + g.strikes + " paPitches " + g.paPitches + " pitches " + JSON.stringify(g.pitches) + " over " + g.over) : "no G";
    const line = Math.round((performance.now() - t0) / 1000) + "s " + st + " · pitchBtnDisabled " + document.getElementById("playPitch").disabled + " · scene " + (PT.visible("#scenePitch") ? "pitch" : PT.visible("#scenePlay") ? "play" : PT.visible("#sceneBreak") ? "break" : "?") + " · feed: " + PT.text("#feedLast").replace(/\s+/g, " ").slice(0, 100);
    if (line.slice(3) !== last.slice(3)) PT.note(line); last = line;
    if (PT.visible("#sceneBreak") || (g && g.over)) break;
  }
  await PT.shot("stall");
  await PT.done({ probe: "inning" });
})();
