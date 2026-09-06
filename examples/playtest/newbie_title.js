/* newbie persona · title screen: what does a first-time player read before pressing anything? */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const vis = s => [...document.querySelectorAll(s)].filter(e => !e.hidden).map(e => e.innerText.trim());
  await PT.wait(600);
  const seen = { logo: txt(".logo"), tag: txt(".tag"), buttons: vis("#screen-title button"), note: txt("#titleNote"), version: txt(".apphead .v") };
  PT.note("타이틀 로고: " + seen.logo + " / 설명: " + seen.tag);
  PT.note("버튼: " + seen.buttons.join(" | ") + " / 안내: " + seen.note);
  PT.note("초보 시선: '투수·타자·포수·야수가 각자 판단하는 야구'는 무슨 게임인지(감독? 선수?) 바로 안 와닿음. '구단을 맡아 시즌을 치릅니다'가 실제 안내. '가로 화면 전용'은 PC에서는 의미 불명.");
  PT.say("타이틀 화면");
  await PT.done({ persona: "야구 초보", screen: "title", seen });
})();
