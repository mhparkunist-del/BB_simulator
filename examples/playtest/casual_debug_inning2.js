/* harness probe v2: press 이닝 at 6x, heartbeat every 1 s (no dedupe) so a main-thread hang shows as an abrupt end; errors are noted */
(async () => {
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); }
  window.addEventListener("error", e => PT.note("window.error " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
  window.addEventListener("unhandledrejection", e => PT.note("unhandledrejection " + (e.reason && e.reason.message || e.reason)));
  const G = () => GameUI.state();
  try {
    PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
    let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
    document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
    PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
    await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
    PT.click(".nav [data-screen=schedule]"); await PT.wait(100); PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
    document.getElementById("innings").value = 2; await document.getElementById("start").onclick(); await PT.wait(200);
    document.getElementById("spd").value = PT.name.endsWith("_1x") ? 1 : 6;
    const t0 = performance.now(); PT.click("#playInning");
    for (let k = 0; k < 50; k++) {
      await PT.wait(1000);
      const g = G(); const st = g ? (g.inning + g.half + " outs " + g.outs + " B" + g.balls + "S" + g.strikes + " paPitches " + g.paPitches + " pitches " + JSON.stringify(g.pitches) + " over " + g.over) : "no G";
      PT.note(Math.round((performance.now() - t0) / 1000) + "s " + st + " · btnDisabled " + document.getElementById("playPitch").disabled + " · scene " + (PT.visible("#scenePitch") ? "pitch" : PT.visible("#scenePlay") ? "play" : PT.visible("#sceneBreak") ? "break" : "?") + " · feed: " + PT.text("#feedLast").replace(/\s+/g, " ").slice(0, 90));
      if (PT.visible("#sceneBreak") || (g && g.over)) break;
    }
    PT.note("loop end · break visible " + PT.visible("#sceneBreak") + " title '" + PT.text("#breakTitle") + "'");
    await PT.shot("end");
  } catch (e) { PT.note("scenario error: " + e.message + "\n" + (e.stack || "").slice(0, 300)); }
  await PT.done({ probe: "inning2" });
})();
