/* newbie persona · mid-game inning-change screen (1회초 → 1회말) reached with the 이닝 button; fast rAF polyfill (0 ms) */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0); window.cancelAnimationFrame = id => clearTimeout(id); PT.note("rAF polyfilled 0ms");
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(200);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  $("spd").value = $("spd").max || 10;
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(200);
  const t0 = performance.now(); PT.click("#playInning"); await PT.wait(200);
  const ok = await PT.until(() => PT.visible("#sceneBreak"), 270000); const ms = Math.round(performance.now() - t0); await PT.wait(300);
  const G0 = GameUI.state();
  PT.note("이닝 버튼 → 교체 화면 도달=" + ok + " · " + ms + "ms · 투구 " + (G0.pitches.us + G0.pitches.them) + " · 라벨(진행 중) " + txt("#playInning"));
  const pages = [];
  for (let k = 0; k < 4; k++) { pages.push({ no: txt("#breakPageNo"), body: (txt(".bpage:not([hidden])") || "").replace(/\n/g, " ‖ ").replace(/\t/g, " ") }); PT.click("#breakNext"); await PT.wait(120) }
  const seen = { reached: ok, ms, title: txt("#breakTitle"), nextUp: txt("#nextUp"), pages, buttons: [txt("#breakPrev"), txt("#breakNext"), txt("#resume")], feedTop: [...document.querySelectorAll("#feed .l")].slice(0, 4).map(e => e.innerText.replace(/\n/g, " ")), G: { inning: G0.inning, half: G0.half, us: G0.score.us, them: G0.score.them } };
  PT.note("이닝 교체 제목: " + seen.title + " · 다음 타순: " + (seen.nextUp || "").replace(/\n/g, " "));
  pages.forEach(p => PT.note("페이지 " + p.no + ": " + p.body.slice(0, 400)));
  PT.note("버튼: " + seen.buttons.join(" / ") + " · 피드: " + seen.feedTop.join(" ‖ "));
  await PT.shot("break"); PT.say("이닝 교체 화면 (1회초 뒤) · 페이지 1/4"); PT.click("#breakPrev"); await PT.wait(100); await PT.done({ persona: "야구 초보", screen: "break-overlay", seen }); return;
  PT.click("#resume"); await PT.wait(300);
  seen.afterResume = { scene: $("sceneBreak").hidden ? "pitch" : "break", inn: txt("#sInn"), batter: txt("#sBatter"), defCallsShown: PT.visible("#defCalls"), offCallsShown: PT.visible("#offCalls"), dcalls: [...document.querySelectorAll("#defCalls .dcall")].map(e => e.innerText.trim()), feedTop: [...document.querySelectorAll("#feed .l")].slice(0, 2).map(e => e.innerText.replace(/\n/g, " ")) };
  PT.note("다음 이닝 진행 뒤: " + JSON.stringify(seen.afterResume));
  PT.note("초보 시선: 표의 R/H/E 가 득점/안타/실책이라는 설명 없음. '1회말 시작 전'에서 이제 우리가 수비라는 안내가 있는지 확인. 페이지 이름은 이해되는지. '다음 이닝 진행'이 실제로는 하프이닝(1회초→1회말) 전환.");
  PT.say("이닝 교체 화면 (1회초 뒤)");
  await PT.done({ persona: "야구 초보", screen: "break", seen });
})();
