/* watch_feed: 관전자 — 몇 구 진행한 뒤 '기록' 탭(자막 전문)·K-zone·미니맵 상태를 캡처한다. 마지막 화면은 기록 탭. */
(async () => { try {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);   // 헤드리스 rAF 0 fps 대체
  window.NOCUT = true;
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 2; document.getElementById("seed").value = 11; await document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("game").hidden, 3000);
  const G = GameUI.state(); const $ = id => document.getElementById(id);
  $("spd").value = 10;
  let n = 0, inPlay = 0;
  while (n < 14 && !G.over) {
    PT.click("#playPitch"); await PT.until(() => $("playPitch").disabled, 1000);
    await PT.until(() => !$("playPitch").disabled || G.over, 30000);
    const top = $("feed").children[0]; const t = top ? top.textContent : "";
    if (/쳤습니다/.test(t)) inPlay++;
    n++;
  }
  PT.note("pitches " + n + " inPlay " + inPlay + " state " + G.inning + G.half + " o" + G.outs + " " + G.balls + "-" + G.strikes + " runners " + G.runners.join(","));
  await PT.shot("kz_after", "#kz"); await PT.shot("field_after", "#field");
  const kzr = $("kz").getBoundingClientRect(), fr = $("field").getBoundingClientRect(), bug = document.querySelector(".bug") && document.querySelector(".bug").getBoundingClientRect();
  PT.note("kz " + Math.round(kzr.width) + "x" + Math.round(kzr.height) + " field " + Math.round(fr.width) + "x" + Math.round(fr.height) + " bug " + (bug ? Math.round(bug.width) + "x" + Math.round(bug.height) : "-") + " win " + innerWidth + "x" + innerHeight);
  const lines = [...$("feed").children].map(l => l.textContent.trim()).reverse();
  PT.note("feed lines " + lines.length + "\n" + lines.join("\n"));
  // 배속 입력 클램프 확인
  $("spd").value = 50; $("spd").dispatchEvent(new Event("change")); PT.note("spd after 50 → " + $("spd").value + " min=" + $("spd").min + " max=" + $("spd").max + " step=" + $("spd").step);
  $("spd").value = 0; $("spd").dispatchEvent(new Event("change")); PT.note("spd after 0 → " + $("spd").value);
  $("spd").value = 10;
  PT.click("#feedBtn"); await PT.wait(300);
  PT.note("feed view visible=" + PT.visible("#feed") + " feedBtn on=" + $("feedBtn").classList.contains("on"));
  await PT.done({ persona: "관전자", pitches: n, inPlay, feed: lines });
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 400)); await PT.done({ fatal: e.message }) }
})();
