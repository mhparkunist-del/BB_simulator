/* KBO fan playtest: sweep all 10 clubs (payroll, stars, rotation, lineup positions, colours, dup names), end on the club-select screen with 한화 chosen */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  const T = APP.teamList();
  note("teamList: " + T.map(t => t.code + " " + t.name + " " + t.city + " " + t.color + "/" + t.color2 + " (" + t.motto + ")").join(" | "));
  const sum = {};
  for (const t of T) {
    ClubUI.fresh(t); const S = ClubUI.state(); const P = id => S.players.find(p => p.id === id);
    const act = S.players.filter(p => p.active);
    const top = S.players.slice().sort((a, b) => b.contract.salary - a.contract.salary).slice(0, 5).map(p => p.name + " " + p.contract.salary);
    const cnt = {}; S.players.forEach(p => cnt[p.name] = (cnt[p.name] || 0) + 1); const dups = Object.entries(cnt).filter(([n, c]) => c > 1).map(([n, c]) => n + "x" + c);
    const sameBirth = []; const kc = APP.kbo.clubs.find(c => c.code === t.code); const byName = {}; kc.players.forEach(p => { (byName[p.name] = byName[p.name] || []).push(p) }); Object.entries(byName).forEach(([n, ps]) => { if (ps.length > 1 && ps.every(p => p.birth && p.birth === ps[0].birth)) sameBirth.push(n + "(" + ps.map(p => "#" + p.num).join("/") + " " + ps[0].birth + ")") });
    const est1 = act.filter(p => !p.real).length;
    note(t.code + " " + t.name + ": 1군 " + act.length + "(B" + act.filter(p => p.type == "B").length + "/P" + act.filter(p => p.type == "P").length + ") 전체 " + S.players.length + " top40 " + ClubInt.top40().toFixed(1) + " | 최고연봉 " + top.join(", ") + " | 로테 " + S.rotation.map(id => P(id).name + "(" + P(id).hand + ")").join(",") + " | 타순 " + S.lineup.map(id => P(id).name + "/" + P(id).pos).join(",") + " | 상대 " + S.opps.length + " | FA " + S.fa.length + " | 동명이인 " + dups.join(",") + " | 동명·동일생일 " + sameBirth.join(",") + " | est1군 " + est1);
    sum[t.code] = ClubInt.top40();
  }
  note("PAYROLL top40 by club: " + Object.entries(sum).map(([c, v]) => c + " " + v.toFixed(1)).join(", "));
  // FA pool: who are these people?
  ClubUI.fresh(T.find(t => t.code === "HH")); const S = ClubUI.state();
  note("FA POOL (한화 시점): " + S.fa.map(p => p.name + " " + p.from + " " + (p.pos || p.role) + " " + p.age + "세 요구 " + p.asking + "억 ovr" + ClubInt.ovr(p).toFixed(2) + " " + (p.real ? "실명1군정보" : "est")).join(" | "));
  // finish on the team-select screen with 한화 previewed (colour theme check)
  APP.show("title"); PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  const idx = T.findIndex(t => t.code === "HH"); document.querySelectorAll("#teamCards .tc")[idx].click(); await PT.wait(300);
  const cs = getComputedStyle(document.documentElement);
  note("theme after picking 한화: --team " + cs.getPropertyValue("--team").trim() + " --bulb " + cs.getPropertyValue("--bulb").trim() + " --go " + cs.getPropertyValue("--go").trim() + " themeNow " + JSON.stringify(APP.themeNow));
  await PT.done({ persona: "KBO 골수팬 · 10구단 일람", notes: L });
})();
