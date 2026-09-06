/* casual persona · first launch: title screen as-is, and (name *_load) after pressing 불러오기 on a fresh install */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));  // PT 상태줄을 오른쪽 아래로 (헤더 가림 방지)
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize + (el.hidden ? " hidden" : ""); };
  const v = PT.name.replace(/_pc$/, "");
  PT.say("첫 실행 · 타이틀 화면 " + innerWidth + "x" + innerHeight);
  await PT.wait(500);
  PT.note("viewport " + innerWidth + "x" + innerHeight + " dpr " + devicePixelRatio);
  PT.note("buttons: " + ["#btnContinue", "#btnNew", "#btnLoad"].map(M).join(" | "));
  PT.note("tag: " + PT.text(".tag") + " || note: " + PT.text("#titleNote") + " || logo: " + M(".logo"));
  PT.note("fonts loaded: " + (document.fonts ? document.fonts.status + " " + [...document.fonts].filter(f => f.status === "loaded").map(f => f.family).filter((x, i, a) => a.indexOf(x) === i).join(",") : "-"));
  if (v.endsWith("_load")) {
    PT.say("불러오기 눌러봄 (저장 없음)");
    PT.click("#btnLoad"); await PT.until(() => PT.visible("#loadSlots"), 3000);
    PT.note("load slots visible " + PT.visible("#loadSlots") + " text: " + PT.text("#loadSlots"));
    const b = document.querySelector("#loadSlots [data-slot]"); if (b) { b.click(); await PT.wait(400); PT.note("빈 슬롯 불러오기 클릭 후 screen title visible " + PT.visible("#screen-title") + " event " + PT.visible("#eventModal")); }
  }
  await PT.done({ persona: "casual mobile", screen: v });
})();
