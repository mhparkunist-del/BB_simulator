/* newbie persona · club select: cards, hint text, what happens after picking one */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  const before = { h2: txt("#screen-team h2"), pick: txt("#teamPick"), startDisabled: document.getElementById("teamStart").disabled, cards: [...document.querySelectorAll("#teamCards .tc")].map(e => e.innerText.replace(/\n/g, " · ")) };
  PT.note("구단 선택 제목: " + before.h2);
  PT.note("카드 수 " + before.cards.length + " · 예: " + before.cards.slice(0, 3).join(" || "));
  PT.note("초보 시선: '선수단은 시즌 시작 시점의 같은 구단이고, 상대 5구단과 30경기' → 10장 카드인데 '상대 5구단'? 헷갈림. '1군 27명 · 전체 92명 (KBO 2026)'의 1군 뜻 모름. 어느 팀이 강한지 힌트 없음.");
  document.querySelectorAll("#teamCards .tc")[3].click(); await PT.wait(300);
  const after = { pick: txt("#teamPick"), startDisabled: document.getElementById("teamStart").disabled, startLabel: txt("#teamStart") };
  PT.note("카드 누른 뒤: " + after.pick + " / 버튼 '" + after.startLabel + "' disabled=" + after.startDisabled);
  PT.say("구단 선택 · KIA 카드 선택 후");
  await PT.done({ persona: "야구 초보", screen: "team", before, after });
})();
