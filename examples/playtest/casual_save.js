/* casual persona · save and load through the UI. name *_modal: 저장 modal open · *_saved: after 여기 저장 (event) · *_title: 타이틀 button → title with 계속하기
   *_load: 불러오기 slots on the title · *_loaded: slot 1 loaded → schedule · *_continue: 계속하기 pressed */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, ""); const is = s => v.endsWith(s);
  PT.say("저장 · 불러오기");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=schedule]"); await PT.wait(200);
  // make the state distinguishable: change training policy to 균형
  PT.click(".nav [data-screen=training]"); await PT.wait(100); PT.click(".pol[data-pol=balanced]"); await PT.wait(100); PT.click(".nav [data-screen=schedule]"); await PT.wait(100);
  PT.note("policy now " + ClubUI.state().policy + " · " + M("#saveBtn") + " · " + M("#titleBtn"));
  PT.click("#saveBtn"); await PT.until(() => PT.visible("#saveModal"), 3000); await PT.wait(300);
  PT.note("save modal visible " + PT.visible("#saveModal") + " slots: " + PT.text("#saveSlots").replace(/\s+/g, " ") + " · " + M("#saveSlots [data-slot]"));
  if (is("_modal")) { await PT.done({ persona: "casual mobile", screen: v }); return; }
  PT.click("#saveSlots [data-slot='1']"); const ev = await PT.until(() => PT.visible("#eventModal"), 3000); await PT.wait(300);
  PT.note("after 여기 저장: event " + ev + " '" + PT.text("#eventTitle") + " · " + PT.text("#eventBody") + "' save modal still visible " + PT.visible("#saveModal") + " slots now: " + PT.text("#saveSlots").replace(/\s+/g, " "));
  if (is("_saved")) { await PT.done({ persona: "casual mobile", screen: v }); return; }
  PT.click("#eventOk"); await PT.wait(100); PT.click("#saveClose"); await PT.wait(100);
  PT.note("modal closed " + !PT.visible("#saveModal"));
  PT.click("#titleBtn"); await PT.until(() => PT.visible("#screen-title"), 3000); await PT.wait(400);
  PT.note("title: continue visible " + PT.visible("#btnContinue") + " " + M("#btnContinue"));
  if (is("_title")) { PT.say("타이틀로 나옴"); await PT.done({ persona: "casual mobile", screen: v }); return; }
  if (is("_continue")) { PT.click("#btnContinue"); await PT.wait(400); PT.note("continue → schedule visible " + PT.visible("#tab-schedule") + " policy " + ClubUI.state().policy + " day " + ClubUI.state().day); PT.say("계속하기"); await PT.done({ persona: "casual mobile", screen: v }); return; }
  PT.click("#btnLoad"); await PT.until(() => PT.visible("#loadSlots"), 3000); await PT.wait(300);
  PT.note("load slots: " + PT.text("#loadSlots").replace(/\s+/g, " "));
  if (is("_load")) { await PT.done({ persona: "casual mobile", screen: v }); return; }
  // pretend the state changed: start a new season with another club, then load slot 1 from the title
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team")); document.querySelectorAll("#teamCards .tc")[0].click(); await PT.wait(100); PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk"); await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(100);
  PT.note("other club now: " + ClubUI.state().club.name + " policy " + ClubUI.state().policy);
  PT.click("#titleBtn"); await PT.until(() => PT.visible("#screen-title"), 3000); PT.click("#btnLoad"); await PT.until(() => PT.visible("#loadSlots"), 3000); await PT.wait(200);
  PT.click("#loadSlots [data-slot='1']"); await PT.until(() => PT.visible("#tab-schedule"), 4000); await PT.wait(400);
  const S = ClubUI.state(); PT.note("loaded: club " + S.club.name + " policy " + S.policy + " day " + S.day + " header " + PT.text("#cstrip").replace(/\s+/g, " ") + " event shown " + PT.visible("#eventModal"));
  PT.say("슬롯 1 불러옴 → " + S.club.name);
  await PT.done({ persona: "casual mobile", screen: v, loadedClub: S.club.name, loadedPolicy: S.policy });
})();
