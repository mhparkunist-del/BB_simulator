/* newbie persona · roster screen: lineup, rotation, FA market, 1군/2군 list; try the swap flow as the hint describes */
(async () => {
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  PT.click(".nav [data-screen=roster]"); await PT.wait(300);
  const seen = { h2s: [...document.querySelectorAll("#tab-roster h2")].map(e => e.innerText.trim()), lineupHead: txt("#lineup tr"), lineupRow1: txt("#lineup tr:nth-child(2)"), lineupNote: txt("#lineup .warn") || txt("#lineup .hint"), lineupHints: [...document.querySelectorAll("#lineup .hint, #lineup .warn")].map(e => e.innerText.trim()), rotationHead: txt("#rotation tr"), rotationRow1: txt("#rotation tr:nth-child(2)"), bullpen: txt("#rotation .hint"), faHead: txt("#market tr"), faRow1: txt("#market tr:nth-child(2)"), rosterHead: txt("#rosterList tr"), rosterRow1: txt("#rosterList tr:nth-child(2)"), rosterPager: txt("#rosterList .pager"), posOptions: [...(document.querySelector("#rosterList .posSel") || { options: [] }).options].map(o => o.text) };
  // try the swap flow exactly as the hint says: press 교체 on slot 1, then click a batter on the right
  PT.click("#lineup .swap"); await PT.wait(150);
  seen.afterSwapPress = { slotBtn: txt("#lineup .swap"), rowClass: (document.querySelector("#lineup tr.sel") || {}).className || "(no highlight)" };
  const rightRows = [...document.querySelectorAll("#rosterList tr.pr")];
  const cand = rightRows.find(r => !r.innerText.includes("SP") && !r.innerText.includes("RP"));
  if (cand) { cand.querySelector("td").click(); await PT.wait(200) }
  seen.afterSwap = { lineupRow1: txt("#lineup tr:nth-child(2)"), cardOpened: PT.visible("#cardModal"), log: (txt("#log") || "").split("\n")[0] };
  if (PT.visible("#cardModal")) PT.click("#cardClose");
  PT.note("타순 표 머리: " + seen.lineupHead + " · 1행: " + seen.lineupRow1);
  PT.note("타순 안내: " + seen.lineupHints.join(" ‖ "));
  PT.note("로테이션 머리: " + seen.rotationHead + " · 불펜: " + seen.bullpen);
  PT.note("포지션 선택지: " + seen.posOptions.join(","));
  PT.note("교체 누름 → 버튼 '" + seen.afterSwapPress.slotBtn + "' · 오른쪽 타자 클릭 후 1행: " + seen.afterSwap.lineupRow1 + " · 카드 열림=" + seen.afterSwap.cardOpened);
  PT.note("초보 시선: 한 화면에 표 4개(타순·로테이션·FA·1군/2군)와 등급 글자 수십 개. '컨택·파워·선구·주력·판단·수비·송구'와 '구위·제구·체력·무브먼트'가 어떤 능력인지 범례 없음. 오른쪽 타자를 눌렀는데 교체가 아니라 카드가 열릴 수도 있어(이미 타순에 있는 선수) 규칙을 모르면 실패함. 1군/2군, FA, SP/RP/CL 약자 설명 없음.");
  PT.say("선수단 화면 · 교체 시도 후");
  await PT.done({ persona: "야구 초보", screen: "roster", seen });
})();
