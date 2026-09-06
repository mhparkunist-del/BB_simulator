/* casual persona · training screen. name default: as opened · *_pol: tap 균형 · *_page: press the table's 다음 pager · *_sel: change one player's program via the select */
(async () => {
  (b=>{if(b)b.style.cssText+=";top:auto;bottom:0;left:auto;right:0;max-width:45%;font:9px monospace;padding:1px 4px;opacity:.85"})([...document.body.children].find(d=>d.tagName==="DIV"&&/^PT /.test(d.textContent||"")));
  const M = sel => { const el = document.querySelector(sel); if (!el) return sel + ":없음"; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return sel + " " + Math.round(r.width) + "x" + Math.round(r.height) + "px/" + cs.fontSize; };
  const v = PT.name.replace(/_pc$/, ""); const is = s => v.endsWith(s);
  PT.say("훈련 화면");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  let i = APP.teamList().findIndex(t => /LG/.test(t.name)); if (i < 0) i = 0;
  document.querySelectorAll("#teamCards .tc")[i].click(); await PT.wait(200);
  PT.click("#teamStart"); await PT.until(() => PT.visible("#eventModal"), 6000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip"); await PT.wait(200);
  PT.click(".nav [data-screen=training]"); await PT.wait(300);
  const tb = document.getElementById("training");
  PT.note("training rows " + tb.querySelectorAll("tr").length + " box " + tb.clientHeight + "/" + tb.scrollHeight + " pager '" + (PT.text("#training .pager") || "-") + "' | " + M(".pol") + " | " + M("#training select") + " | td font " + getComputedStyle(tb.querySelector("td")).fontSize + " | h2: " + PT.text("#tab-training h2").replace(/\s+/g, " "));
  PT.note("policy on: " + (document.querySelector(".pol.on") || {}).textContent + " · staff: " + PT.text("#staff").replace(/\s+/g, " ") + " · trainLog: " + PT.text("#trainLog"));
  PT.note("first row: " + tb.querySelector("tr:nth-child(2)").textContent.replace(/\s+/g, " ") + " · programs: " + [...tb.querySelector("select").options].map(o => o.textContent).join("/"));
  if (is("_pol")) {
    PT.click(".pol[data-pol=balanced]"); await PT.wait(300);
    PT.note("after 균형: policy " + ClubUI.state().policy + " on '" + (document.querySelector(".pol.on") || {}).textContent + "' first row: " + document.querySelector("#training tr:nth-child(2)").textContent.replace(/\s+/g, " ") + " · log0 " + (ClubUI.state().log[0] || {}).t + " · trainLog: " + PT.text("#trainLog"));
    const progs = [...document.querySelectorAll("#training select")].map(s => s.value); PT.note("programs page1: " + progs.join(","));
    PT.say("방침 균형 눌러봄");
  }
  if (is("_page")) { const b = [...document.querySelectorAll("#training .pager button")].find(x => x.textContent.includes("다음")); PT.note("pager button " + (b ? Math.round(b.getBoundingClientRect().width) + "x" + Math.round(b.getBoundingClientRect().height) : "없음")); if (b) b.click(); await PT.wait(200); PT.note("page now '" + PT.text("#training .pager") + "' first row: " + document.querySelector("#training tr:nth-child(2)").textContent.replace(/\s+/g, " ")); PT.say("훈련 표 2쪽"); }
  if (is("_sel")) { const s = document.querySelector("#training select"); s.value = s.options[s.options.length - 1].value; s.dispatchEvent(new Event("change")); await PT.wait(200); PT.note("changed first player's program to " + s.value + " → state " + ClubUI.state().program[+s.dataset.pid] + " · any feedback text? trainLog: " + PT.text("#trainLog")); PT.say("선수 1명 프로그램 변경"); }
  await PT.done({ persona: "casual mobile", screen: v });
})();
