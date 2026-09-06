/* newbie persona · budget / trade / signing screen on day 0 */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=market]"); await PT.wait(300);
  const seen = { h2s: [...document.querySelectorAll("#tab-market h2")].map(e => e.innerText.trim()), budget: txt("#budget"), tradeTop: (txt("#trade") || "").slice(0, 700), tradeMsg: txt("#tradeMsg"), signing: txt("#signing"), signingHint: txt("#tab-market .panel:nth-child(3) > .hint"), strip: txt("#tBudget") + " / " + txt("#tPay") };
  PT.note("예산 패널: " + (seen.budget || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "));
  PT.note("트레이드 패널(앞부분): " + seen.tradeTop.replace(/\n/g, " ‖ ").replace(/\t/g, " "));
  PT.note("영입 협상 표: " + (seen.signing || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "));
  PT.note("영입 힌트: " + seen.signingHint);
  PT.note("초보 시선: '잔액(이적 자금) 40.0억'과 '상위 40인 보수 105.3억 / 캡 137.4억'이 다른 돈인지 같은 돈인지 모름. '가치 = 능력·나이·계약 (ZenGM식)'의 ZenGM은 처음 듣는 말. '요구액과 인내', '계약금(연봉×연수×30 %)', '주간 결산'은 설명이 짧아서 돈이 언제 빠지는지 감이 안 옴. 한 화면에 표 5개.");
  PT.say("예산·이적 화면");
  await PT.done({ persona: "야구 초보", screen: "market", seen });
})();
