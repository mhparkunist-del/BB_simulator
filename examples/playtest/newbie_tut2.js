/* newbie persona · tutorial step 2 (training screen behind it) */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutNext"); await PT.wait(300);
  const seen = { text: txt("#tutText"), step: txt("#tutStep"), screenBehind: txt(".nav .on"), h2: txt("#tab-training h2"), policies: [...document.querySelectorAll("#policy .pol")].map(e => e.innerText.trim()), policyOn: txt("#policy .pol.on"), tableHead: txt("#training tr"), row1: txt("#training tr:nth-child(2)"), programs: [...document.querySelectorAll("#training select.prog")].slice(0, 1).map(s => [...s.options].map(o => o.text)).flat(), staff: txt("#staff"), trainLog: txt("#trainLog") };
  PT.note("튜토리얼 2: " + seen.text + " (" + seen.step + ")");
  PT.note("훈련 방침 버튼: " + seen.policies.join(" / ") + " · 현재 " + seen.policyOn);
  PT.note("프로그램 목록(타자): " + seen.programs.join(" / "));
  PT.note("훈련 제목 힌트: " + seen.h2);
  PT.note("초보 시선: 기본이 '직접'이라 아무것도 안 하면 훈련이 어떻게 되는지 모름. '잠재력에 가까울수록…느려집니다'는 무엇이 느려지는지 주어가 없음. '배럴·타이밍', '펑고·루트 드릴', '딜리버리 반복'은 야구 용어라 모름. 컨디션 vs 피로 차이 모름.");
  PT.say("튜토리얼 2/3");
  await PT.done({ persona: "야구 초보", screen: "tutorial-2", seen });
})();
