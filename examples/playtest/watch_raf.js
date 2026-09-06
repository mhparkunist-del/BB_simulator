/* watch_raf: 헤드리스 환경의 requestAnimationFrame 주기와 한 구 애니메이션 실제 소요시간 점검 */
(async () => {
  const raf = await new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n) }; requestAnimationFrame(f); setTimeout(() => r(n), 1500) });
  PT.note("rAF frames in 1s: " + raf + " visibility=" + document.visibilityState + " hidden=" + document.hidden);
  if (raf < 30) { window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); PT.note("rAF polyfilled with setTimeout(16)") }
  window.NOCUT = true;
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 1; await document.getElementById("start").onclick();
  const G = GameUI.state(); const $ = id => document.getElementById(id);
  for (const spd of [1, 10]) {
    $("spd").value = spd; const t0 = performance.now(); let frames = 0; const f = () => { frames++; if ($("playPitch").disabled) requestAnimationFrame(f) };
    PT.click("#playPitch"); requestAnimationFrame(f);
    await PT.until(() => $("playPitch").disabled, 1000); const t1 = performance.now();
    const ok = await PT.until(() => !$("playPitch").disabled, 25000);
    PT.note("spd " + spd + ": disabled after " + Math.round(t1 - t0) + " ms, done=" + ok + " in " + Math.round(performance.now() - t0) + " ms, frames=" + frames + " feed=" + ($("feed").children[0] || {}).textContent);
  }
  await PT.done({ raf });
})();
