/* KBO fan playtest: 삼성 라이온즈 squad plausibility, and open a star's player card (강민호) so the card modal is in the final capture */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  const CODE = "SS";
  PT.say(CODE + " 선수단 점검");
  ClubUI.fresh(APP.teamList().find(t => t.code === CODE));
  const S = ClubUI.state(); const P = id => S.players.find(p => p.id === id);
  ClubUI.render();
  const cs = getComputedStyle(document.documentElement);
  note("club " + S.club.name + " color " + S.club.color + "/" + S.club.color2 + " css --team " + cs.getPropertyValue("--team").trim() + " --bulb " + cs.getPropertyValue("--bulb").trim());
  const fmtP = p => p.name + "#" + p.num + " " + (p.pos || p.role) + " " + (p.bats || "") + "/" + (p.throws || "") + " " + p.age + "세 " + p.contract.salary + "억 ovr" + ClubInt.ovr(p).toFixed(2) + (p.real ? "" : "(est)");
  note("LINEUP: " + S.lineup.map((id, i) => (i + 1) + "." + fmtP(P(id))).join(" | "));
  note("ROTATION: " + S.rotation.map((id, i) => (i + 1) + "." + fmtP(P(id))).join(" | "));
  const act = S.players.filter(p => p.active);
  note("1군 " + act.length + " 2군 " + S.players.filter(p => !p.active).length);
  note("BULLPEN: " + act.filter(p => p.type == "P" && !S.rotation.includes(p.id)).map(fmtP).join(" | "));
  note("BENCH: " + act.filter(p => p.type == "B" && !S.lineup.includes(p.id)).map(fmtP).join(" | "));
  note("TOP SALARY: " + S.players.slice().sort((a, b) => b.contract.salary - a.contract.salary).slice(0, 12).map(p => p.name + " " + p.contract.salary + "억(" + p.age + "세 " + (p.pos || p.role) + ")" + (p.active ? "" : "[2군]")).join(", "));
  note("top40 " + ClubInt.top40().toFixed(1));
  const known = ["구자욱", "강민호", "최형우", "김영웅", "이재현", "김지찬", "디아즈", "원태인", "후라도", "가라비토", "페덱", "사토시", "백정현", "이승현", "김재윤", "최지광", "박진만", "김헌곤", "류지혁", "박세혁", "이성규", "김성윤", "배찬승", "최원태", "오승환"];
  note("KNOWN: " + known.map(n => { const ps = S.players.filter(x => x.name === n); return n + "=" + (ps.length ? ps.map(p => (p.active ? "1군" : "2군") + " " + (p.pos || p.role) + " " + p.age + "세 " + p.hand + " " + p.contract.salary + "억" + (p.real ? "" : " est")).join(" & ") : "없음") }).join(" | "));
  const cnt = {}; S.players.forEach(p => cnt[p.name] = (cnt[p.name] || 0) + 1);
  note("DUP NAMES: " + Object.entries(cnt).filter(([n, c]) => c > 1).map(([n, c]) => n + "x" + c + " " + S.players.filter(p => p.name === n).map(p => "#" + p.num + " " + (p.pos || p.role) + " " + p.age + "세" + p.hand + (p.active ? "1군" : "2군")).join("/")).join(", "));
  const kboAct = APP.kbo.clubs.find(c => c.code === CODE).players.filter(p => p.active).map(p => p.name);
  note("KBO 등록 1군인데 게임 2군: " + kboAct.filter(n => { const p = S.players.find(x => x.name === n); return p && !p.active }).join(", "));
  note("catchers: " + S.players.filter(p => p.pos === "C").map(p => p.name + " " + p.age + "세 " + p.bats + "/" + p.throws + " speed" + p.attrs.speed.toFixed(2) + (p.active ? " 1군" : " 2군")).join(" | "));
  APP.show("roster"); await PT.wait(400);
  // open 강민호 card through the roster list (page through until the row is visible)
  let row = null; for (let k = 0; k < 12 && !row; k++) { row = [...document.querySelectorAll("#rosterList tr.pr")].find(r => r.textContent.startsWith("강민호")); if (!row) { const nx = document.querySelector("#rosterList [data-pg][data-d='1']"); if (!nx) break; nx.click(); await PT.wait(60) } }
  if (row) { row.click(); await PT.until(() => PT.visible("#cardModal"), 2000); note("CARD 강민호: " + (document.getElementById("playerCard").innerText || "").replace(/\s+/g, " ").slice(0, 500)) } else note("강민호 row not found in roster list");
  note("strip: " + ["tDate", "tRec", "tRank", "tBudget", "tPay", "tMorale"].map(id => id + "=" + PT.text("#" + id)).join(" "));
  await PT.done({ persona: "KBO 골수팬 · 삼성", notes: L });
})();
