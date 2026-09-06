/* harness probe: replicate the full-game flow (타석 at 10x) and heartbeat for 3 s after every 이닝 교체 화면 → 다음 이닝 진행 click, to see whether the page stalls right after resume */
(async () => {
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); }
  window.addEventListener("error", e => PT.note("window.error " + e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno));
  const G = () => GameUI.state(); const sum = a => a.reduce((x, y) => x + y, 0);
  const idle = () => PT.until(() => !document.getElementById("playPitch").disabled || (G() && G().over), 60000);
  try {
    PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
    let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
    document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
    PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
    await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
    PT.click(".nav [data-screen=schedule]"); await PT.wait(100); PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
    document.getElementById("innings").value = 2; await document.getElementById("start").onclick(); await PT.wait(200);
    document.getElementById("spd").value = 10;
    let pa = 0, breaks = 0; const t0 = performance.now();
    while (G() && !G().over && pa < 60) {
      if (PT.visible("#sceneBreak")) {
        breaks++; PT.note("break #" + breaks + " '" + PT.text("#breakTitle") + "' → resume"); const r0 = performance.now(); PT.click("#resume");
        for (let k = 0; k < 8; k++) { await PT.wait(200); PT.note("  +" + Math.round(performance.now() - r0) + "ms after resume · scene " + (PT.visible("#scenePitch") ? "pitch" : PT.visible("#scenePlay") ? "play" : PT.visible("#sceneBreak") ? "break" : "?") + " · pitchBtn " + (document.getElementById("playPitch").disabled ? "off" : "on")); }
        continue;
      }
      PT.click("#playPA"); await idle(); pa++;
      if (pa % 4 === 0) PT.note("PA " + pa + " · " + PT.text("#sInn") + " O" + G().outs + " " + sum(G().score.us) + ":" + sum(G().score.them) + " · " + Math.round(performance.now() - t0) + "ms");
    }
    PT.note("game over " + (G() && G().over) + " PAs " + pa + " breaks " + breaks + " · final '" + PT.text("#breakTitle") + "'");
    const r0 = performance.now(); PT.click("#resume");
    for (let k = 0; k < 10; k++) { await PT.wait(200); PT.note("  +" + Math.round(performance.now() - r0) + "ms after final resume · event " + PT.visible("#eventModal") + " '" + PT.text("#eventTitle") + "' setup " + PT.visible("#setup")); if (PT.visible("#eventModal")) break; }
    PT.click("#eventOk"); await PT.wait(300); PT.note("after OK: screen " + (document.querySelector(".nav [data-screen].on") || {}).textContent + " rec " + ClubUI.state().W + "-" + ClubUI.state().L);
  } catch (e) { PT.note("scenario error: " + e.message); }
  await PT.done({ probe: "resume" });
})();
