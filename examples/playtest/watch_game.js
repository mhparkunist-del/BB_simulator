/* watch_game: 2이닝을 '한 구' 버튼으로 끝까지. 1배속 4구·2배속 4구·이후 6배속. 구당 소요시간, 자막(#feed) 전문, 사인 배지, 구수 표기 검증.
   초에는 공격 사인(타석마다 번트/강공/기다려/자유 순환), 말에는 수비 사인(몸쪽/바깥/내야 전진/외야 후퇴 순환). 마지막 화면은 경기 종료 화면. */
(async () => { try {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);   // 헤드리스 Firefox는 load 전 rAF가 오지 않아(0 fps) 애니메이션이 멈춘다 → 대체
  window.NOCUT = true;
  PT.say("새로 시작");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  APP.show("game"); PT.click("#autoOrder"); document.querySelector("[data-p]").click(); document.getElementById("innings").value = 2; document.getElementById("seed").value = 7; await document.getElementById("start").onclick();
  await PT.until(() => !document.getElementById("game").hidden, 3000);
  const GU = GameUI, G = GU.state();
  const $ = id => document.getElementById(id);
  const feedTop = () => { const l = $("feed").children[0]; return l ? l.textContent.trim() : "" };
  const nFeed = () => $("feed").children.length;
  const OFF = ["bunt", "power", "take", "none"], DEF = ["inside", "outside", "infield_in", "outfield_deep", "none"];
  const rows = []; let n = 0, paNo = 0, lastPA = null, playScenes = 0, mismatch = [];
  const spdFor = i => i < 3 ? 1 : (i < 6 ? 2 : 10);
  while (!G.over && n < 130) {
    if (PT.visible("#sceneBreak")) { PT.note("break screen → 다음 이닝 진행"); PT.click("#resume"); await PT.until(() => !PT.visible("#sceneBreak"), 4000) }
    const key = G.inning + G.half + G.idx.us + "-" + G.idx.them;
    if (key !== lastPA) { lastPA = key; paNo++; if (G.half === "top") { const c = OFF[paNo % OFF.length]; document.querySelector(".call[data-call=" + c + "]").click() } else { const c = DEF[paNo % DEF.length]; document.querySelector(".dcall[data-dcall=" + c + "]").click() } }
    const sign = G.half === "top" ? document.querySelector(".call.on").dataset.call : document.querySelector(".dcall.on").dataset.dcall;
    const spd = spdFor(n); $("spd").value = spd;
    const before = { inn: G.inning, half: G.half, b: G.balls, s: G.strikes, o: G.outs, pa: G.paPitches, f: nFeed() };
    const t0 = performance.now(); let sawPlay = false;
    PT.click("#playPitch");
    await PT.until(() => $("playPitch").disabled || G.over, 1000);
    const iv = setInterval(() => { if (!$("scenePlay").hidden) sawPlay = true }, 30);
    await PT.until(() => !$("playPitch").disabled || G.over, 40000);
    clearInterval(iv);
    const ms = Math.round(performance.now() - t0);
    if (sawPlay) playScenes++;
    const lines = [...$("feed").children].slice(0, nFeed() - before.f).map(l => l.textContent.trim()).reverse();
    const pitchLine = lines.find(l => /구째/.test(l)) || "";
    const m = pitchLine.match(/(\d+)구째/); const said = m ? +m[1] : null; const actual = before.pa + 1;
    if (said !== null && said !== actual) mismatch.push({ n, said, actual, count: before.b + "-" + before.s, line: pitchLine.slice(0, 60) });
    const badge = $("signBadge").classList.contains("on");
    rows.push({ n, inn: before.inn + before.half[0], count: before.b + "-" + before.s, outs: before.o, spd, ms, sign, badge, play: sawPlay, mph: $("speed").textContent, lines });
    PT.note("#" + n + " " + before.inn + before.half + " " + before.b + "-" + before.s + " o" + before.o + " spd" + spd + " " + ms + "ms sign=" + sign + " badge=" + badge + (sawPlay ? " PLAY" : "") + " | " + lines.join(" || "));
    n++;
  }
  const byspd = {}; rows.forEach(r => { const k = r.spd + (r.play ? "x_play" : "x"); (byspd[k] = byspd[k] || []).push(r.ms) });
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const summary = Object.fromEntries(Object.entries(byspd).map(([k, v]) => [k, { n: v.length, avg: avg(v), min: Math.min(...v), max: Math.max(...v) }]));
  PT.note("SUMMARY pitches=" + n + " over=" + G.over + " score " + G.score.us.join("+") + " : " + G.score.them.join("+") + " playScenes=" + playScenes + " timing=" + JSON.stringify(summary) + " mismatches=" + mismatch.length);
  PT.note("MISMATCH " + JSON.stringify(mismatch.slice(0, 8)));
  const feedLines = [...document.querySelectorAll("#feed .l")].map(l => l.textContent.trim()).reverse();
  PT.note("FEED total lines " + feedLines.length);
  await PT.until(() => PT.visible("#sceneBreak"), 5000);
  PT.note("break: " + PT.text("#breakTitle") + " | " + PT.text("#breakScore").replace(/\s+/g, " "));
  document.getElementById("breakNext").click(); document.getElementById("breakNext").click(); document.getElementById("breakNext").click();
  PT.note("pitchers page: " + PT.text("#breakPitchers").replace(/\s+/g, " "));
  document.getElementById("breakPrev").click(); document.getElementById("breakPrev").click(); document.getElementById("breakPrev").click();
  await PT.done({ persona: "관전자", pitches: n, over: G.over, score: G.score, hits: G.hits, timing: summary, mismatch, playScenes, rows, feed: feedLines });
  } catch (e) { PT.note("FATAL " + e.message + " " + (e.stack || "").slice(0, 400)); await PT.done({ fatal: e.message }) }
})();
