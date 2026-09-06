/* newbie persona · inning-change screen after pressing 이닝: title, next batters, the four pages */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note('rAF polyfilled (headless)');
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(200);
  if ($("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
  $("spd").value = 10;
  PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(200);
  PT.click("#playInning"); await PT.wait(200);
  const ok = await PT.until(() => PT.visible("#sceneBreak"), 120000); await PT.wait(300);
  const pages = [];
  for (let k = 0; k < 4; k++) { pages.push({ no: txt("#breakPageNo"), body: (txt(".bpage:not([hidden])") || "").replace(/\n/g, " ‖ ").replace(/\t/g, " ") }); PT.click("#breakNext"); await PT.wait(120) }
  const seen = { reached: ok, title: txt("#breakTitle"), nextUp: txt("#nextUp"), pages, buttons: [txt("#breakPrev"), txt("#breakNext"), txt("#resume")], feedLast: [...document.querySelectorAll("#feed .l")].slice(0, 3).map(e => e.innerText.replace(/\n/g, " ")), G: (() => { const G = GameUI.state(); return G ? { inning: G.inning, half: G.half, us: G.score.us, them: G.score.them } : null })() };
  PT.note("이닝 교체 제목: " + seen.title + " · 다음 타순: " + (seen.nextUp || "").replace(/\n/g, " "));
  pages.forEach(p => PT.note("페이지 " + p.no + ": " + p.body));
  PT.note("버튼: " + seen.buttons.join(" / "));
  PT.note("초보 시선: 표의 R/H/E 가 득점/안타/실책이라는 설명 없음. '1회말 시작 전'에서 이제 우리가 수비라는 안내가 없음(다음 타순에 '상대 공격'이라고만). 페이지 이름 '점수/우리 타자/상대 타자/투수'는 이해됨. '다음 이닝 진행'이 실제로는 '다음 하프이닝'이라 1회초→1회말인데 이닝이 바뀐다는 말과 어긋남.");
  PT.say("이닝 교체 화면");
  await PT.done({ persona: "야구 초보", screen: "break", seen });
})();
