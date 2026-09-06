/* newbie persona · schedule screen right after the tutorial: header strip, next game, log, buttons */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); for (let k = 0; k < 3; k++) { PT.click("#tutNext"); await PT.wait(80) }
  await PT.wait(300);
  const strip = [...document.querySelectorAll("#cstrip .s")].map(e => e.innerText.replace(/\n/g, "=")).join(" · ");
  const seen = { nav: [...document.querySelectorAll(".nav button")].map(e => e.innerText.trim()), strip, headerButtons: [txt("#saveBtn"), txt("#titleBtn")], h2s: [...document.querySelectorAll("#tab-schedule h2")].map(e => e.innerText.trim()), schedHead: txt("#schedule tr"), schedRows: [...document.querySelectorAll("#schedule tr")].slice(1, 4).map(e => e.innerText.replace(/\t/g, " | ")), pager: txt("#schedule .pager"), nextGame: txt("#nextGame"), log: txt("#log"), nextDay: txt("#nextDay"), hint: txt("#tab-schedule .ctl .hint"), reset: txt("#reset"), tutorialGone: !PT.visible("#tutorial") };
  PT.note("상단 스트립: " + strip);
  PT.note("네비: " + seen.nav.join(" / ") + " · 헤더 버튼: " + seen.headerButtons.join(" / "));
  PT.note("일정 표 머리: " + seen.schedHead + " · 1행: " + seen.schedRows[0]);
  PT.note("구단 일지: " + (seen.log || "").replace(/\n/g, " ‖ "));
  PT.note("초보 시선: 스트립이 영어 약자(DATE/REC/RANK/BUDGET/PAYROLL/MORALE)라 REC=전적, PAYROLL 105.3/137.4 뜻을 모름. '상위 40인 보수', '샐러리캡 137.4억'은 이벤트/튜토리얼 어디에도 설명 없음. '새 시즌' 버튼이 '다음 날' 옆에 있어 잘못 누를까 불안(확인창은 있음).");
  PT.say("일정 화면 (튜토리얼 후)");
  await PT.done({ persona: "야구 초보", screen: "schedule", seen });
})();
