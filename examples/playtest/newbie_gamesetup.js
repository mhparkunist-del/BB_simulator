/* newbie persona · game setup screen on the opening game day, entered from the schedule button */
(async () => {
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  const label = txt("#nextDay"); PT.click("#nextDay"); await PT.until(() => PT.visible("#screen-game"), 3000); await PT.wait(300);
  const seen = { fromButton: label, h2: txt("#setup h2"), dayNote: txt("#gameDayNote"), innings: $("innings").value, seed: $("seed").value, pitcherCards: [...document.querySelectorAll("#pitchers .pc")].map(e => e.innerText.replace(/\n/g, " · ")), pitcherSelected: txt("#pitchers .pc.sel"), batterCards: [...document.querySelectorAll("#batters .pc")].slice(0, 4).map(e => e.innerText.replace(/\n/g, " · ")), batterCount: document.querySelectorAll("#batters .pc").length, order: txt("#order"), buttons: [txt("#clearOrder"), txt("#autoOrder"), txt("#start")], startDisabled: $("start").disabled, lockBadge: PT.visible("#lockBadge") };
  PT.note("'" + label + "' 눌러 도착 · 제목: " + seen.h2);
  PT.note("경기 안내: " + seen.dayNote + " · 이닝 기본 " + seen.innings + " · 시드 " + seen.seed);
  PT.note("투수 카드 " + seen.pitcherCards.length + "장: " + seen.pitcherCards.slice(0, 2).join(" || ") + " · 선택된 투수: " + seen.pitcherSelected);
  PT.note("타자 카드 " + seen.batterCount + "장: " + seen.batterCards.slice(0, 2).join(" || ") + " · " + seen.order + " · 플레이 볼 disabled=" + seen.startDisabled);
  PT.note("초보 시선: '이닝 3'이 기본인데 야구는 9이닝 아닌가? 왜 3인지 설명 없음. '시드 1'은 게임 용어라 완전히 모름(개발자 옵션처럼 보임). '초에는 우리 타선(공격 사인), 말에는 우리 선발(수비 사인)'에서 초/말 뜻 모름. '오버핸드 파워' 같은 투수 폼 표기, 컨택/파워/선구/주력 등급 반복. 타순 9명이 이미 채워져 있으면 그냥 플레이 볼만 누르면 되는지 모름.");
  PT.say("경기 준비 화면");
  await PT.done({ persona: "야구 초보", screen: "gamesetup", seen });
})();
