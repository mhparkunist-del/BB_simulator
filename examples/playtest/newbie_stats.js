/* newbie persona · standings/records screen on day 0 (nothing played yet) */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=stats]"); await PT.wait(300);
  const seen = { h2s: [...document.querySelectorAll("#tab-stats h2")].map(e => e.innerText.trim()), standings: txt("#standings"), teamStats: txt("#teamStats"), batStats: txt("#batStats"), pitStats: txt("#pitStats"), rank: txt("#tRank") };
  PT.note("순위표: " + (seen.standings || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "));
  PT.note("팀 기록: " + (seen.teamStats || "").replace(/\n/g, " ‖ ").replace(/\t/g, " "));
  PT.note("타자 기록 표: " + (seen.batStats || "(빈칸)") + " · 투수 기록 표: " + (seen.pitStats || "(빈칸)"));
  PT.note("초보 시선: 순위표에 우리 팀 이름이 '덕아웃 나이트'로 나오는데 나는 KIA를 골랐음(헤더 RANK도 '/ 6'인데 상대는 9구단). 타자 기록 열 G/PA/H/HR/RBI/BB/K/AVG, 투수 IP/ER/ERA/W/L/SV/K가 전부 영어 약자. 경기 전에는 빈 표라 이 화면이 왜 있는지 모름.");
  PT.say("순위·기록 화면 (개막 전)");
  await PT.done({ persona: "야구 초보", screen: "stats", seen });
})();
