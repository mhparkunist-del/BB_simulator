/* casual persona · game day: 오늘 경기 시작 → setup → 플레이 볼 → pitches. Variants by name suffix:
   _setup: end on the setup screen · _intro: cutscene on, shot mid-intro, end at first pitch scene
   _pitch: 3× 한 구 at 1x with mid-flight shots, end on pitch scene · _views: 인체/궤적 views · _feed: 기록 overlay
   _pa: 타석 ×2 then 이닝 → inning-break screen · _break2: break page 2 · _fast: 결과 바로보기 → final screen
   _after: 정비로 돌아가기 → event · _sched: event 확인 → schedule with result */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));  // PT 상태줄을 오른쪽 아래로 (헤더 가림 방지)
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  if (!window.__rafPoly) { window.__rafPoly = true; window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id); PT.note("harness: native rAF does not fire in headless capture → setTimeout polyfill (60fps)"); }
  const v = PT.name.replace(/_pc$/, ""); const is = s => v.endsWith(s);
  const idle = () => PT.until(() => !document.getElementById("playPitch").disabled || (GameUI.state() && GameUI.state().over), 60000);
  const G = () => GameUI.state(); const sum = a => a.reduce((x, y) => x + y, 0); const score = () => sum(G().score.us) + ":" + sum(G().score.them);
  PT.say("경기 날");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.note("nextDay label '" + PT.text("#nextDay") + "'");
  PT.click("#nextDay"); await PT.until(() => PT.visible("#setup"), 3000);
  PT.note("setup: note '" + PT.text("#gameDayNote") + "' order '" + PT.text("#order") + "' start disabled " + document.getElementById("start").disabled + " innings " + document.getElementById("innings").value + " pitchers " + document.querySelectorAll("[data-p]").length + " batters " + document.querySelectorAll("[data-b]").length + " selected p " + document.querySelectorAll("[data-p].sel").length + " b " + document.querySelectorAll("[data-b].sel").length);
  PT.note("setup sizes: " + M("#start") + " | " + M("#autoOrder") + " | " + M("[data-b]") + " | " + M("#innings") + " h2 font " + getComputedStyle(document.querySelector("#setup h2")).fontSize + " card font " + getComputedStyle(document.querySelector("[data-b]")).fontSize);
  const bt = document.getElementById("batters"); PT.note("batters box " + bt.clientHeight + "/" + bt.scrollHeight + " overflow " + getComputedStyle(bt).overflowY);
  PT.note("h2 text: " + PT.text("#setup h2").replace(/\s+/g, " "));
  if (is("_setup")) { PT.say("경기 준비 화면"); await PT.done({ persona: "casual mobile", screen: v }); return; }
  document.getElementById("innings").value = 2;
  if (document.getElementById("start").disabled) { PT.click("#autoOrder"); if (GameUI.pick.pitcher === null) document.querySelector("[data-p]").click(); PT.note("had to press 자동 타순"); }
  if (is("_intro")) window.NOCUT = false;
  PT.say("플레이 볼");
  const t0 = performance.now(); const pStart = document.getElementById("start").onclick();
  if (is("_intro")) { await PT.wait(1500); await PT.shot("intro_1s", "#play"); await PT.wait(1500); await PT.shot("intro_3s", "#play"); PT.note("intro scene visible at 3s: " + PT.visible("#scenePlay")); }
  await pStart; PT.note("start → pitch scene after " + Math.round(performance.now() - t0) + "ms · locked " + APP.locked + " nav disabled " + [...document.querySelectorAll(".nav [data-screen]")].filter(b => b.disabled).length + " lockBadge '" + PT.text("#lockBadge") + "'");
  await PT.wait(300);
  PT.note("hud: inn '" + PT.text("#sInn") + "' batter '" + PT.text("#sBatter") + "' ondeck '" + PT.text("#onDeck") + "' feedLast '" + PT.text("#feedLast").replace(/\s+/g, " ") + "'");
  PT.note("hud sizes: " + M("#playPitch") + " | " + M("#playPA") + " | " + M("#playInning") + " | " + M("#playFast") + " | " + M("#stop") + " | " + M("#spd") + " | chips " + M(".call") + " | view " + M(".viewsel button") + " | kz " + M("#kz") + " | field " + M("#field") + " | strip b font " + getComputedStyle(document.querySelector(".bug b")).fontSize + " small " + getComputedStyle(document.querySelector(".bug small")).fontSize);
  PT.note("cam canvas " + M("#cam") + " feedLast font " + getComputedStyle(document.getElementById("feedLast")).fontSize);
  if (is("_intro")) { await PT.shot("first_scene"); await PT.done({ persona: "casual mobile", screen: v }); return; }
  if (is("_pitch")) {
    for (let k = 1; k <= 3; k++) {
      const a = performance.now(); PT.say("한 구 " + k); PT.click("#playPitch");
      await PT.wait(2100); await PT.shot("pitch" + k + "_flight"); await PT.wait(600); await PT.shot("pitch" + k + "_late", "canvas#play:not([hidden]), #vw-cam canvas");
      await idle(); PT.note("pitch " + k + " took " + Math.round(performance.now() - a) + "ms · mph '" + PT.text("#speed") + "' count B" + document.querySelectorAll("#lBalls .on").length + " S" + document.querySelectorAll("#lStrikes .on").length + " O" + document.querySelectorAll("#lOuts .on").length + " · feedLast: " + PT.text("#feedLast").replace(/\s+/g, " "));
    }
    await PT.shot("after3");
    PT.say("한 구 3번 눌러봄");
    await PT.done({ persona: "casual mobile", screen: v, pitches: 3 }); return;
  }
  if (is("_views")) {
    PT.click(".viewsel [data-view=body]"); await PT.wait(300); await PT.shot("view_body", "#body"); PT.note("body view: " + M("#body") + " note '" + PT.text("#bodyNote") + "'");
    PT.click(".viewsel [data-view=seam]"); await PT.wait(300); await PT.shot("view_seam", "#seam"); PT.note("seam view: " + M("#seam"));
    document.getElementById("spd").value = 4; PT.click("#playPitch"); await idle(); await PT.shot("seam_after_pitch", "#seam");
    PT.say("궤적 뷰에서 한 구");
    await PT.done({ persona: "casual mobile", screen: v }); return;
  }
  if (is("_feed")) {
    document.getElementById("spd").value = 4; PT.click("#playPA"); await idle();
    PT.click("#feedBtn"); await PT.wait(300); PT.note("feed overlay visible " + PT.visible("#feed") + " lines " + document.querySelectorAll("#feed .l").length + " font " + getComputedStyle(document.getElementById("feed")).fontSize + " first: " + (document.querySelector("#feed .l") || {}).textContent);
    PT.say("기록 버튼 → 피드 열림");
    await PT.done({ persona: "casual mobile", screen: v }); return;
  }
  document.getElementById("spd").value = 6;
  if (is("_pa") || is("_break2")) {
    const a = performance.now(); PT.say("타석"); PT.click("#playPA"); await idle(); PT.note("타석 took " + Math.round(performance.now() - a) + "ms at 6x · " + PT.text("#feedLast").replace(/\s+/g, " "));
    PT.click("#playPA"); await idle(); PT.note("타석2 · outs " + G().outs + " score " + score());
    PT.say("이닝"); const b = performance.now(); PT.click("#playInning"); await PT.until(() => PT.visible("#sceneBreak"), 90000); await idle();
    PT.note("이닝 took " + Math.round(performance.now() - b) + "ms · break visible " + PT.visible("#sceneBreak") + " title '" + PT.text("#breakTitle") + "' nextUp '" + PT.text("#nextUp").replace(/\s+/g, " ") + "' page '" + PT.text("#breakPageNo") + "' resume '" + PT.text("#resume") + "' " + M("#resume") + " | " + M("#breakNext") + " table font " + getComputedStyle(document.querySelector("#breakScore td") || document.body).fontSize);
    if (is("_break2")) { PT.click("#breakNext"); await PT.wait(200); PT.note("page2 '" + PT.text("#breakPageNo") + "' rows " + document.querySelectorAll("#breakUs tr").length); PT.say("이닝 교체 화면 2쪽"); }
    else PT.say("이닝 끝 → 교체 화면");
    await PT.done({ persona: "casual mobile", screen: v }); return;
  }
  // _fast, _after, _sched
  PT.click("#playPA"); await idle();
  PT.say("결과 바로보기"); const f0 = performance.now(); PT.click("#playFast"); await PT.wait(100); PT.note("fast label while running: '" + PT.text("#playFast") + "'");
  await PT.until(() => G() && G().over, 90000); await idle(); await PT.wait(300);
  PT.note("fast took " + Math.round(performance.now() - f0) + "ms · over " + G().over + " score " + score() + " break visible " + PT.visible("#sceneBreak") + " title '" + PT.text("#breakTitle") + "' resume '" + PT.text("#resume") + "' pitches " + JSON.stringify(G().pitches));
  PT.note("final table: " + PT.text("#breakScore").replace(/\s+/g, " "));
  if (is("_fast")) { await PT.done({ persona: "casual mobile", screen: v }); return; }
  PT.click("#resume"); const ev = await PT.until(() => PT.visible("#eventModal"), 4000);
  PT.note("event after resume " + ev + ": '" + PT.text("#eventTitle") + "' " + PT.text("#eventBody").replace(/\s+/g, " ") + " · locked " + APP.locked);
  if (is("_after")) { PT.say("정비로 돌아가기 → 결과 이벤트"); await PT.done({ persona: "casual mobile", screen: v }); return; }
  PT.click("#eventOk"); await PT.wait(400);
  const S = ClubUI.state();
  PT.note("back: schedule visible " + PT.visible("#tab-schedule") + " day " + S.day + " rec " + PT.text("#tRec") + " nextDay '" + PT.text("#nextDay") + "' sched1 " + JSON.stringify(S.sched[0].result) + " log0 " + (S.log[0] || {}).t);
  PT.say("경기 끝, 일정으로 복귀");
  await PT.done({ persona: "casual mobile", screen: v, result: S.sched[0].result });
})();
