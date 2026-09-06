/* newbie persona · player card modal (first row of the 1군 list) */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=roster]"); await PT.wait(300);
  const row = document.querySelector("#rosterList tr.pr"); row.querySelector("td").click();
  const ok = await PT.until(() => PT.visible("#cardModal"), 3000); await PT.wait(200);
  const seen = { opened: ok, card: txt("#playerCard"), closeBtn: txt("#cardClose") };
  PT.note("선수 카드: " + (seen.card || "").replace(/\n/g, " ‖ "));
  PT.note("초보 시선: 카드에 '만족도 60% · 출전 60 · 성적 60 · 연봉 60 · 동료 60 · 역할 60', '성격 · 야망 0.53 충성 0.41 프로의식 0.7', '계약 · 3.1억 × 2년 (연봉조정)' 같은 숫자가 한꺼번에 나오는데 어느 것이 내가 바꿀 수 있는 값인지 모름. 잠재 등급이 무엇인지, 개별 훈련을 여기서 고르면 훈련 화면과 어떤 관계인지 모름.");
  PT.say("선수 카드 모달");
  await PT.done({ persona: "야구 초보", screen: "card", seen });
})();
