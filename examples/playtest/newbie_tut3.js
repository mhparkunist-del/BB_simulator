/* newbie persona · tutorial step 3 (schedule screen behind it) — does the button match what the text says? */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutNext"); await PT.wait(100); PT.click("#tutNext"); await PT.wait(300);
  const seen = { text: txt("#tutText"), step: txt("#tutStep"), nextLabel: txt("#tutNext"), screenBehind: txt(".nav .on"), nextDayLabel: txt("#nextDay"), nextDayHint: txt("#tab-schedule .ctl .hint"), hintVisible: PT.visible("#tab-schedule .ctl .hint"), nextGame: txt("#nextGame"), log: txt("#log"), date: txt("#tDate") };
  PT.note("튜토리얼 3: " + seen.text + " (" + seen.step + ") · 마지막 버튼 라벨 '" + seen.nextLabel + "'");
  PT.note("일정 화면 버튼: '" + seen.nextDayLabel + "' · 힌트 보임=" + seen.hintVisible + " · 오늘 " + seen.date);
  PT.note("다음 경기 박스: " + (seen.nextGame || "").replace(/\n/g, " "));
  PT.note("초보 시선: 튜토리얼은 '다음 날을 진행하세요'인데 버튼은 '" + seen.nextDayLabel + "'. '결과 바로보기'가 어디 있는지 모름(경기 화면 안). '정비 화면'이 뭔지 정의 없음. '타선 0.57 · 수비 0.60 · 상대 타격 0.55'는 숫자 뜻 모름.");
  PT.say("튜토리얼 3/3");
  await PT.done({ persona: "야구 초보", screen: "tutorial-3", seen });
})();
