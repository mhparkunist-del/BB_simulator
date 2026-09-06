/* newbie persona · signing negotiation: open the modal from the 협상 button, lowball once, then accept the ask */
(async () => {
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=market]"); await PT.wait(300);
  const cashBefore = ClubUI.state().budget;
  const btn = document.querySelector("#signing [data-nego]"); btn.click();
  const ok = await PT.until(() => PT.visible("#negoModal"), 3000); await PT.wait(200);
  const steps = [];
  steps.push({ step: "열림", body: txt("#negoBody"), salary: $("negoSalary").value, years: $("negoYears").value, buttons: [txt("#negoOffer"), txt("#negoMeet"), txt("#negoClose")] });
  const ask = ClubMarket.fin().nego.ask;
  $("negoSalary").value = Math.round(ask * 0.5 * 10) / 10; $("negoSalary").dispatchEvent(new Event("input")); await PT.wait(100);
  PT.click("#negoOffer"); await PT.wait(200);
  steps.push({ step: "반값 제안", offered: $("negoSalary").value, msg: txt("#negoBody .nmsg"), hint: txt("#negoBody .hint") });
  PT.click("#negoMeet"); await PT.wait(200);
  steps.push({ step: "요구 수용", msg: txt("#negoBody .nmsg"), hint: txt("#negoBody .hint"), offerDisabled: $("negoOffer").disabled });
  const S = ClubUI.state();
  const signed = S.players.some(p => p.id === ClubMarket.fin().nego.id);
  const result = { signed, cashBefore, cashAfter: S.budget, log: (txt("#log") || "").split("\n").slice(0, 2), modalStillOpen: PT.visible("#negoModal") };
  steps.forEach(s => PT.note(s.step + ": " + JSON.stringify(s)));
  PT.note("결과: 계약=" + signed + " · 잔액 " + cashBefore + " → " + S.budget + " · 일지 " + result.log.join(" ‖ "));
  PT.note("초보 시선: 에이전트 말은 자연스러워 이해됨. 그런데 계약 성사 뒤 모달이 그대로 열려 있고 '닫기'만 남아 다음에 뭘 할지 모름. 잔액이 왜 그만큼 줄었는지(계약금 30%)는 힌트 한 줄뿐. 인내 ●●○ 표시가 무엇인지 처음엔 모름. 반값 제안이 '어렵습니다'로 끝나 인내가 줄었다는 걸 눈치채기 어려움.");
  PT.say("영입 협상 · 계약 성사 후");
  await PT.done({ persona: "야구 초보", screen: "nego", opened: ok, steps, result });
})();
