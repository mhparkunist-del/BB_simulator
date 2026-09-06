/* newbie persona · tutorial step 1 (roster screen behind it) */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  const ok = await PT.until(() => PT.visible("#tutorial"), 3000); await PT.wait(300);
  const seen = { shown: ok, text: txt("#tutText"), step: txt("#tutStep"), buttons: [txt("#tutSkip"), txt("#tutNext")], screenBehind: txt(".nav .on"), h2s: [...document.querySelectorAll("#tab-roster h2")].map(e => e.innerText.trim()), lineupHead: txt("#lineup tr"), warn: txt("#lineup .warn") || txt("#lineup .hint"), rosterHint: txt("#rosterList th") };
  PT.note("튜토리얼 1: " + seen.text + " (" + seen.step + ")");
  PT.note("뒤 화면: " + seen.screenBehind + " · 제목들: " + seen.h2s.join(" | "));
  PT.note("초보 시선: '포지션 셀렉트로 수비 위치를 정합니다' → 포지션 C/1B/SS/DH 약자 뜻 모름. 타순 표의 '컨택 B 파워 A 선구 C 주력 D'가 뭔지 설명 없음. 뭘 바꿔야 좋은지 기준 없음. 튜토리얼이 화면을 가리키지 않음(화살표/하이라이트 없음).");
  PT.say("튜토리얼 1/3");
  await PT.done({ persona: "야구 초보", screen: "tutorial-1", seen });
})();
