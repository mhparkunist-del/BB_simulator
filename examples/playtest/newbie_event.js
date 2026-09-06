/* newbie persona · owner greeting event modal right after 부임하기 */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  const ok = await PT.until(() => PT.visible("#eventModal"), 5000);
  const seen = { modalShown: ok, title: txt("#eventTitle"), body: txt("#eventBody"), button: txt("#eventOk"), behind: txt(".nav .on"), strip: txt("#cstrip") };
  PT.note("이벤트 제목: " + seen.title);
  PT.note("이벤트 본문: " + seen.body);
  PT.note("뒤 화면 상단 스트립: " + (seen.strip || "").replace(/\n/g, " "));
  PT.note("초보 시선: '2026 등록명단', '능력치는 이 게임의 추정값'은 이해됨. '선수단과 훈련은 감독님께 맡깁니다'가 곧 내가 뭘 해야 하는지 말해주진 않음. 확인 뒤 뭐가 나올지 예고 없음.");
  PT.say("부임 이벤트 모달");
  await PT.done({ persona: "야구 초보", screen: "event", seen });
})();
