/* newbie persona · "just play": follow only what the UI says. pick a club → play the first game → sign a player → advance a week → check standing and money.
   Every moment where the tester had to guess is logged with PT.note("GUESS: ..."). */
(async () => {
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note('rAF polyfilled (headless)');
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const strip = () => [...document.querySelectorAll("#cstrip .s")].map(e => e.innerText.replace(/\n/g, "=")).join(" · ");
  const diary = [];
  const say = t => { diary.push(t); PT.note(t) };
  async function playTodayFast() {
    PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(150);
    const pre = { order: txt("#order"), startDisabled: $("start").disabled, note: txt("#gameDayNote") };
    if ($("start").disabled) { say("GUESS: 플레이 볼이 꺼져 있어 '자동 타순'을 눌러봄"); PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click() }
    PT.click("#start"); await PT.until(() => !$("game").hidden, 4000); await PT.wait(150);
    PT.click("#playFast"); await PT.until(() => { const G = GameUI.state(); return G && G.over && PT.visible("#sceneBreak") }, 120000); await PT.wait(120);
    const G = GameUI.state(); const sc = G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0);
    PT.click("#resume"); await PT.until(() => PT.visible("#eventModal"), 4000); const ev = txt("#eventBody"); PT.click("#eventOk"); await PT.wait(200);
    return { pre, sc, ev: (ev || "").replace(/\n/g, " ") };
  }
  // 1) title → club
  say("타이틀: 버튼 '" + [...document.querySelectorAll("#screen-title button")].filter(b => !b.hidden).map(b => b.innerText).join("/") + "' → '새로 시작'이 강조돼 있어 누름");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  say("구단 선택: 카드 10장. GUESS: 어느 팀이 초보에게 좋은지 힌트가 없어 첫 카드(" + txt("#teamCards .tc b") + ")를 고름");
  document.querySelectorAll("#teamCards .tc")[0].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000);
  say("이벤트: " + (txt("#eventBody") || "").replace(/\n/g, " ")); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000);
  for (let k = 0; k < 3; k++) { say("튜토리얼 " + txt("#tutStep") + " (뒤 화면 " + txt(".nav .on") + "): " + txt("#tutText")); PT.click("#tutNext"); await PT.wait(80) }
  await PT.wait(200);
  say("튜토리얼 끝. 지금 화면 '" + txt(".nav .on") + "', 버튼 '" + txt("#nextDay") + "'. 스트립: " + strip());
  say("GUESS: 튜토리얼은 '다음 날을 진행하세요'라고 했는데 버튼이 '오늘 경기 시작'이라 경기를 꼭 해야 하는 줄 알고 누름");
  // 2) first game
  const g1 = await playTodayFast();
  say("경기 준비: " + g1.pre.note + " · " + g1.pre.order + " · 플레이 볼 disabled=" + g1.pre.startDisabled + " → GUESS: 이닝/시드/사인 뜻 몰라 그대로 '플레이 볼' 누름, 이어서 '한 구/타석/이닝' 중 뭘 누를지 몰라 '결과 바로보기' 누름");
  say("첫 경기 결과 " + g1.sc + " · 이벤트: " + g1.ev + " · 스트립: " + strip());
  // 3) sign a player: where? the tutorial never said. try nav '예산·이적'
  say("GUESS: 선수 영입은 튜토리얼에 없음. 네비 '예산·이적'을 눌러봄");
  PT.click(".nav [data-screen=market]"); await PT.wait(250);
  const faRow = txt("#signing tr:nth-child(2)"); say("영입 협상 표 1행: " + (faRow || "").replace(/\t/g, " | ") + " → '협상' 버튼 누름");
  const cash0 = ClubUI.state().budget; document.querySelector("#signing [data-nego]").click(); await PT.until(() => PT.visible("#negoModal"), 3000); await PT.wait(150);
  say("협상 모달: " + (txt("#negoBody") || "").replace(/\n/g, " ‖ ") + " · 버튼 " + [txt("#negoOffer"), txt("#negoMeet"), txt("#negoClose")].join("/"));
  say("GUESS: '제안'과 '요구 수용' 차이를 몰라 안전해 보이는 '요구 수용'을 누름");
  PT.click("#negoMeet"); await PT.wait(200);
  const negoMsg = txt("#negoBody .nmsg"); const signed = ClubUI.state().players.some(p => p.id === ClubMarket.fin().nego.id);
  say("결과 메시지: " + negoMsg + " · 계약=" + signed + " · 잔액 " + cash0 + " → " + ClubUI.state().budget + " · 모달 열림=" + PT.visible("#negoModal") + " → GUESS: 성사됐는데 모달이 안 닫혀 '닫기'를 눌러야 하는지 헤맴");
  PT.click("#negoClose"); await PT.wait(150);
  say("예산 패널: " + (txt("#budget") || "").split("\n").slice(0, 6).join(" ‖ "));
  // 4) advance a week following the button label
  say("GUESS: '일주일 진행' 같은 건 없음. 일정 화면의 버튼을 7번 누르기로 함(경기 날은 강제 경기)");
  PT.click(".nav [data-screen=schedule]"); await PT.wait(150);
  const days = [];
  for (let d = 0; d < 7; d++) {
    const label = txt("#nextDay"); const date = txt("#tDate");
    if (label === "오늘 경기 시작") { const g = await playTodayFast(); days.push(date + " 경기 " + g.sc); }
    else { PT.click("#nextDay"); await PT.wait(120); days.push(date + " " + label); }
    if (!PT.visible("#screen-club")) { PT.click(".nav [data-screen=schedule]"); await PT.wait(100) }
  }
  say("7일 진행: " + days.join(" → "));
  say("한 주 뒤 스트립: " + strip() + " · 일지 상위: " + (txt("#log") || "").split("\n").slice(0, 5).join(" ‖ "));
  // 5) standing and money
  PT.click(".nav [data-screen=stats]"); await PT.wait(200);
  say("순위표: " + (txt("#standings") || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "));
  PT.click(".nav [data-screen=market]"); await PT.wait(200);
  const bud = (txt("#budget") || "").split("\n");
  say("예산: " + bud.slice(0, 8).join(" ‖ "));
  say("GUESS: 순위표의 우리 팀 이름이 '덕아웃 나이트'로 나와 내 팀(" + ClubUI.state().club.name + ")이 맞는지 한참 봄. 돈은 '잔액'과 '시즌 수입/지출'과 '상위 40인 보수'가 따로 있어 내가 부자인지 가난한지 결론을 못 내림");
  const S = ClubUI.state();
  PT.say("just play · 1주 진행 후 예산 화면");
  await PT.done({ persona: "야구 초보", screen: "justplay", diary, stats: { club: S.club.name, day: S.day, W: S.W, L: S.L, budget: S.budget, signed, players: S.players.length, guesses: diary.filter(t => t.includes("GUESS")).length, errs: PT.errs.length } });
})();
