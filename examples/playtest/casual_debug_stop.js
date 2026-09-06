/* harness probe: press 결과 바로보기 then 정지 shortly after (delay from name suffix _d<ms>, default 60), heartbeat every 500 ms → a hang shows as an abrupt end */
(async () => {
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); }
  window.addEventListener("error", e => PT.note("window.error " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
  const m = /_d(\d+)/.exec(PT.name); const delay = m ? +m[1] : 60;
  const G = () => GameUI.state(); const sum = a => a.reduce((x, y) => x + y, 0);
  try {
    PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
    let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
    document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
    PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
    await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
    PT.click(".nav [data-screen=schedule]"); await PT.wait(100); PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
    document.getElementById("innings").value = 2; await document.getElementById("start").onclick(); await PT.wait(200);
    document.getElementById("spd").value = 6;
    PT.click("#playPA"); await PT.until(() => !document.getElementById("playPitch").disabled, 30000);
    PT.note("PA1 done · " + PT.text("#sInn") + " · fast label '" + PT.text("#playFast") + "'");
    const t0 = performance.now(); PT.click("#playFast"); await PT.wait(delay); PT.click("#stop");
    PT.note("fast pressed, stop pressed after " + Math.round(performance.now() - t0) + "ms · fast label now '" + PT.text("#playFast") + "'");
    for (let k = 0; k < 20; k++) {
      await PT.wait(500); const g = G();
      PT.note(Math.round((performance.now() - t0)) + "ms · " + (g ? g.inning + g.half + " outs " + g.outs + " score " + sum(g.score.us) + ":" + sum(g.score.them) + " over " + g.over : "no G") + " · pitchBtn " + (document.getElementById("playPitch").disabled ? "off" : "on") + " · fast '" + PT.text("#playFast") + "' · scene " + (PT.visible("#scenePitch") ? "pitch" : PT.visible("#scenePlay") ? "play" : PT.visible("#sceneBreak") ? "break" : "?"));
      if (!document.getElementById("playPitch").disabled || (g && g.over)) break;
    }
    PT.note("end · feedLast: " + PT.text("#feedLast").replace(/\s+/g, " ").slice(0, 120));
  } catch (e) { PT.note("scenario error: " + e.message); }
  await PT.done({ probe: "stop", delay });
})();
