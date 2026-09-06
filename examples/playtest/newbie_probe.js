/* layout probes for the newbie report: tutorial box vs 오늘 경기 시작 button, '선택 중' button clipping, trade table clipping, header nav clipping */
(async () => {
  const $ = id => document.getElementById(id);
  const txt = s => { const e = document.querySelector(s); return e ? e.innerText.trim() : null };
  const R = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
  const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const seen = { size: [window.innerWidth, window.innerHeight] };
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[3].click(); PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutNext"); await PT.wait(80); PT.click("#tutNext"); await PT.wait(150);
  const box = R(document.querySelector("#tutorial .modalbox") || document.querySelector("#tutorial > div") || $("tutorial")); const nd = R($("nextDay"));
  const c = nd ? document.elementFromPoint(nd.x + nd.w / 2, nd.y + nd.h / 2) : null;
  seen.tut3 = { step: txt("#tutStep"), box, nextDay: nd, overlap: overlap(box, nd), topAtNextDayCenter: c ? (c.id || c.className || c.tagName) : null };
  PT.note("튜토리얼 3/3 상자 " + JSON.stringify(box) + " vs 오늘 경기 시작 버튼 " + JSON.stringify(nd) + " → 겹침=" + seen.tut3.overlap + " · 버튼 중앙 최상위 요소=" + seen.tut3.topAtNextDayCenter);
  PT.click("#tutNext"); await PT.wait(150);
  // header
  const navs = [...document.querySelectorAll(".nav [data-screen]")].map(b => ({ label: b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), clipped: b.scrollWidth > b.clientWidth + 1 }));
  const stripR = R($("cstrip")); const hdr = R(document.querySelector("header") || document.querySelector(".top"));
  seen.header = { navs, strip: stripR, header: hdr, stripLines: stripR ? Math.round(stripR.h / 14) : null };
  PT.note("헤더: nav " + JSON.stringify(navs) + " · 스트립 " + JSON.stringify(stripR) + " · 헤더 " + JSON.stringify(hdr));
  // roster: 선택 중 clipping
  PT.click(".nav [data-screen=roster]"); await PT.wait(150);
  const sw = document.querySelector("#lineup .swap"); if (sw) { sw.click(); await PT.wait(100) }
  const sw2 = document.querySelector("#lineup .swap.sel") || document.querySelector("#lineup .swap");
  const lineupBox = document.querySelector("#lineup"); const lb = R(lineupBox); const sb = R(sw2);
  seen.swap = { label: sw2 ? sw2.textContent.trim() : null, btn: sb, panel: lb, spillsRight: sb && lb ? sb.x + sb.w > lb.x + lb.w + 1 : null, textClipped: sw2 ? sw2.scrollWidth > sw2.clientWidth + 1 : null, panelScrollW: lineupBox ? lineupBox.scrollWidth : null, panelClientW: lineupBox ? lineupBox.clientWidth : null };
  PT.note("타순 '" + seen.swap.label + "' 버튼 " + JSON.stringify(sb) + " · 패널 " + JSON.stringify(lb) + " · 오른쪽 넘침=" + seen.swap.spillsRight + " · 패널 scroll/client " + seen.swap.panelScrollW + "/" + seen.swap.panelClientW);
  // market: trade table clipping
  PT.click(".nav [data-screen=market]"); await PT.wait(200);
  const ours = $("tradeOurs"); const oursTbl = ours ? ours.querySelector("table") : null; const wrap = ours ? ours.closest(".box, .panel, section") : null;
  seen.trade = { oursScrollW: oursTbl ? oursTbl.scrollWidth : null, oursClientW: ours ? ours.clientWidth : null, tblRect: R(oursTbl), wrapRect: R(wrap), lastCellVisible: (() => { const td = oursTbl ? oursTbl.querySelector("tbody tr td:last-child") : null; if (!td) return null; const r = td.getBoundingClientRect(); const w = wrap ? wrap.getBoundingClientRect() : { right: window.innerWidth }; return { text: td.textContent.trim(), right: Math.round(r.right), wrapRight: Math.round(w.right), cut: r.right > w.right + 1 } })() };
  PT.note("트레이드 보낼 선수 표: " + JSON.stringify(seen.trade));
  PT.say("레이아웃 프로브 " + seen.size.join("x"));
  await PT.done({ persona: "야구 초보", screen: "probe", seen });
})();
