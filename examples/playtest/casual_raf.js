/* harness probe: does requestAnimationFrame advance in the headless capture? counts frames for 1 s, then again with a setTimeout polyfill */
(async () => {
  let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  await PT.wait(1200); PT.note("native rAF frames in 1s: " + n);
  const nativeRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
  let m = 0; const t1 = performance.now(); const tick2 = () => { m++; if (performance.now() - t1 < 1000) requestAnimationFrame(tick2); }; requestAnimationFrame(tick2);
  await PT.wait(1200); PT.note("polyfilled rAF frames in 1s: " + m);
  window.requestAnimationFrame = nativeRAF;
  await PT.done({ probe: "raf", native: n, polyfill: m });
})();
