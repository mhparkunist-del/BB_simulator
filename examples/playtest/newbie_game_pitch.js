/* newbie persona · in-game pitch screen: play a few pitches and one plate appearance by buttons, read the feed and the HUD */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note('rAF polyfilled (headless)');
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const feedLines = () => [...document.querySelectorAll("#feed .l")].map(e => e.innerText.replace(/\n/g, " ").trim());
  const idle = () => !$("playPitch").disabled;
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(200);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  $("spd").value = 4;
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(300);
  const seen = {};
  seen.start = { inn: txt("#sInn"), runs: txt("#sRuns"), batter: txt("#sBatter"), onDeck: txt("#onDeck"), mph: txt("#speed"), signBadge: txt("#signBadge"), signVisible: getComputedStyle($("signBadge")).opacity, views: [...document.querySelectorAll(".viewsel button")].map(e => e.innerText.trim()), offCalls: [...document.querySelectorAll("#offCalls .call")].map(e => e.innerText.trim() + (e.classList.contains("on") ? "(on)" : "")), defCallsShown: PT.visible("#defCalls"), bigButtons: [...document.querySelectorAll(".actions .big button, .actions .big label")].map(e => e.innerText.trim()), lockBadge: txt("#lockBadge"), navDisabled: [...document.querySelectorAll(".nav [data-screen]")].filter(b => b.disabled).length, feed: feedLines(), feedLast: txt("#feedLast"), bodyNote: txt("#bodyNote") };
  PT.note("시작 HUD: " + JSON.stringify(seen.start));
  for (let k = 0; k < 3; k++) { PT.click("#playPitch"); await PT.wait(150); await PT.until(idle, 25000); }
  seen.after3 = { feed: feedLines().slice(0, 8), inn: txt("#sInn"), batter: txt("#sBatter"), mph: txt("#speed"), balls: [...$("lBalls").children].filter(e => e.classList.contains("on")).length, strikes: [...$("lStrikes").children].filter(e => e.classList.contains("on")).length, outs: [...$("lOuts").children].filter(e => e.classList.contains("on")).length, feedLast: txt("#feedLast") };
  PT.note("한 구 ×3 뒤 피드: " + seen.after3.feed.join(" ‖ "));
  PT.note("B/S/O 램프 " + seen.after3.balls + "/" + seen.after3.strikes + "/" + seen.after3.outs + " · MPH " + seen.after3.mph + " · 타자칸 " + seen.after3.batter);
  PT.click("#offCalls [data-call=bunt]"); await PT.wait(100);
  PT.click("#playPA"); await PT.wait(150); await PT.until(idle, 60000);
  seen.afterPA = { feed: feedLines().slice(0, 8), signBadgeOn: $("signBadge").classList.contains("on"), inn: txt("#sInn"), runs: txt("#sRuns"), batter: txt("#sBatter"), scene: $("sceneBreak").hidden ? ($("scenePlay").hidden ? "pitch" : "play") : "break" };
  PT.note("번트 사인 후 타석 진행 피드: " + seen.afterPA.feed.join(" ‖ "));
  await PT.shot("cam");
  PT.click("#feedBtn"); await PT.wait(200); seen.feedPanelOpen = PT.visible("#feed"); seen.feedAll = feedLines();
  PT.note("초보 시선: 피드 문장 '타석 시작 · 김도영 (R) · 컨택 B 파워 A…' 뒤에 투구 문장이 붙는데 어느 쪽이 우리 팀인지, 지금 우리가 공격인지 수비인지 화면에 크게 안 나옴(1회초=우리 공격이라는 규칙을 모름). MPH가 시속 마일이라 감이 없음(km/h 아님). '자유/번트/기다려/강공' 사인이 뭘 하는지 설명 없음. '한 구/타석/이닝' 버튼 3개+결과 바로보기+배속+정지가 한 줄이라 어떤 걸 눌러야 할지 모름. benchsign! 뱃지는 영어.");
  PT.say("경기 화면 · 기록 패널 열림");
  await PT.done({ persona: "야구 초보", screen: "game-pitch", seen });
})();
