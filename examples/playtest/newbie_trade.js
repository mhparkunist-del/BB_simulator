/* newbie persona · trade: tick the top player on each side and press 제안, follow the counter once */
(async () => {
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=market]"); await PT.wait(300);
  const steps = [];
  steps.push({ step: "초기", club: $("tradeClub") && $("tradeClub").selectedOptions[0].text, theirsHead: txt("#tradeTheirs tr"), theirsRow1: txt("#tradeTheirs tr:nth-child(2)"), oursRow1: txt("#tradeOurs tr:nth-child(2)"), cashLabel: txt("#trade .ctl:last-child .hint"), goDisabled: $("tradeGo").disabled, msg: txt("#tradeMsg") });
  // newbie: "I want their best guy, I'll give my worst listed guy"
  const theirs = document.querySelector("#tradeTheirs input"); theirs.click(); await PT.wait(150);
  const oursRows = [...document.querySelectorAll("#tradeOurs input")]; oursRows[oursRows.length - 1].click(); await PT.wait(150);
  PT.click("#tradeGo"); await PT.wait(250);
  steps.push({ step: "1차 제안", msg: txt("#tradeMsg"), cash: $("tradeCash").value, theirsChecked: [...document.querySelectorAll("#tradeTheirs input:checked")].length, oursChecked: [...document.querySelectorAll("#tradeOurs input:checked")].length });
  PT.click("#tradeGo"); await PT.wait(250);
  steps.push({ step: "2차 제안(역제안 그대로)", msg: txt("#tradeMsg"), cash: $("tradeCash").value, oursChecked: [...document.querySelectorAll("#tradeOurs input:checked")].length, budget: ClubUI.state().budget });
  // now the "give my best guy for their best guy" case
  document.querySelectorAll("#tradeOurs input:checked").forEach(c => c.click()); await PT.wait(150);
  const t2 = document.querySelector("#tradeTheirs input"); if (!t2.checked) { t2.click(); await PT.wait(150) }
  document.querySelector("#tradeOurs input").click(); await PT.wait(150); $("tradeCash").value = 0;
  PT.click("#tradeGo"); await PT.wait(250);
  steps.push({ step: "3차 제안(우리 최고 ⇄ 상대 최고)", msg: txt("#tradeMsg"), log: (txt("#log") || "").split("\n")[0], budget: ClubUI.state().budget });
  steps.forEach(s => PT.note(s.step + ": " + JSON.stringify(s)));
  PT.note("초보 시선: 체크박스 표 두 개와 '가치' 숫자만 있고 '가치 44.1'이 뭘 기준으로 한 값인지 모름. '역제안 · 현금 N억을 더하면 받겠습니다'는 이해됨. 그러나 역제안이 입력칸에 자동으로 들어갔다는 표시가 없어서 두 번째 '제안'을 누르면 갑자기 성사돼 돈이 빠짐. '현금(억, 음수는 받음)'은 무슨 말인지 한참 봐야 함.");
  PT.say("트레이드 제안 3회 후");
  await PT.done({ persona: "야구 초보", screen: "trade", steps });
})();
