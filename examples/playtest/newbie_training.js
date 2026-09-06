/* newbie persona · training screen without the tutorial box */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=training]"); await PT.wait(300);
  const sel = document.querySelector("#training select.prog");
  const seen = { h2: txt("#tab-training h2"), policies: [...document.querySelectorAll("#policy .pol")].map(e => e.innerText.trim() + (e.classList.contains("on") ? "(on)" : "")), head: txt("#training tr"), rows: [...document.querySelectorAll("#training tr")].slice(1, 4).map(e => e.innerText.replace(/\t/g, " | ")), pager: txt("#training .pager"), programsB: sel ? [...sel.options].map(o => o.text) : [], staff: txt("#staff"), trainLog: txt("#trainLog") };
  // press a policy button as a newbie would ("균형" sounds safe) and see what changes
  PT.click("#policy [data-pol=balanced]"); await PT.wait(200);
  seen.afterBalanced = { policyOn: txt("#policy .pol.on"), rows: [...document.querySelectorAll("#training tr")].slice(1, 3).map(e => e.innerText.replace(/\t/g, " | ")), trainLog: txt("#trainLog"), log: txt("#log") };
  PT.note("훈련 표 머리: " + seen.head + " · 1행: " + seen.rows[0]);
  PT.note("프로그램(타자): " + seen.programsB.join(" / "));
  PT.note("코칭 스태프: " + (seen.staff || "").replace(/\n/g, " ‖ ") + " · 성과: " + seen.trainLog);
  PT.note("'균형' 누른 뒤: 방침=" + seen.afterBalanced.policyOn + " · 1행=" + seen.afterBalanced.rows[0] + " · 피드백 로그 없음(일지에도 안 남음)");
  PT.note("초보 시선: 방침을 눌러도 '적용됐다'는 말이 없음. 표의 '종합·잠재 B A'가 등급이란 걸 모름(S~D 범례 없음). 코치 숫자 60/55/50이 좋은 건지 모름. 선수 84명 표를 7명씩 12쪽 넘겨야 함(정보 과다·페이지 과다).");
  PT.say("훈련 화면 · 균형 방침 누른 뒤");
  await PT.done({ persona: "야구 초보", screen: "training", seen });
})();
