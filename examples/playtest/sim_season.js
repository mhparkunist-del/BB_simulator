/* sim_season: full 30-game season on manual (default) training, dump numbers before/after
   standings, ledger, weekly settlement, cap tax/floor, morale drift, injuries, fatigue, training gains, rotation health */
(async () => {
  const snap = () => JSON.parse(JSON.stringify(ClubUI.state()));
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const r2 = v => Math.round(v * 100) / 100;
  PT.say("새 시즌 시작 (버튼 경로)");
  PT.click("#btnNew"); await PT.until(() => PT.visible("#screen-team"));
  document.querySelectorAll("#teamCards .tc")[4].click(); await PT.click("#teamStart");
  await PT.until(() => PT.visible("#eventModal"), 5000); PT.click("#eventOk");
  await PT.until(() => PT.visible("#tutorial"), 3000); PT.click("#tutSkip");
  const S = ClubUI.state();
  const S0 = snap();
  const I = ClubInt;
  const ovr = p => I.ovr(p);
  PT.note("club " + S.club.name + " players " + S.players.length + " active " + S.players.filter(p => p.active).length + " budget " + S.budget + " top40 " + I.top40().toFixed(1) + " policy " + S.policy + " days " + I.DATA.days);
  PT.note("programs default: " + JSON.stringify(Object.values(S.program).reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {})));
  const lineupOvr = S.lineup.map(I.P).map(p => p ? r2(ovr(p)) : null);
  PT.note("lineup ovr " + JSON.stringify(lineupOvr) + " rotation " + S.rotation.map(id => I.P(id).name + ":" + r2(ovr(I.P(id)))).join(","));
  const perDay = [];
  const starts = {};
  let fallbackStarts = 0;
  let day = 0;
  // sim until 30 games done, recording daily
  while (S.sched.filter(g => g.result).length < 30 && day < 60) {
    const rot = S.rotation.map(I.P).filter(p => p && p.active);
    const planned = rot[S.rotIdx % Math.max(1, rot.length)];
    const fatSnap = {}; S.players.filter(p => p.type == "P").forEach(p => fatSnap[p.name] = p.fatigue);
    const gToday = S.sched.find(g => g.date === I.today() && !g.result);
    const b0 = S.budget;
    ClubUI.simDay();
    if (gToday && gToday.result) {
      const sp = S.players.find(p => p.name === gToday.result.sp);
      const f0 = fatSnap[gToday.result.sp];
      starts[gToday.result.sp] = (starts[gToday.result.sp] || 0) + 1;
      if (f0 >= 0.75) fallbackStarts++;
      perDay.push({ day, date: gToday.date, g: gToday.g, us: gToday.result.us, them: gToday.result.them, home: gToday.home, sp: gToday.result.sp, spFat0: r2(f0), ip: gToday.result.ip, W: S.W, L: S.L, budget: S.budget, dBudget: r2(S.budget - b0) });
    } else perDay.push({ day, date: I.today(), rest: true, budget: S.budget, dBudget: r2(S.budget - b0) });
    day++;
  }
  const S1 = snap();
  PT.note("season done at day " + S.day + " W-L " + S.W + "-" + S.L + " runs " + S.runs + "/" + S.ra + " budget " + S.budget + " top40 " + I.top40().toFixed(1) + " done=" + S.done);
  // standings
  const rows = I.rankNow();
  PT.note("standings: " + rows.map((r, i) => (i + 1) + "." + r.name + " " + r.W + "-" + r.L).join(" | "));
  PT.note("header rank text: " + PT.text("#tRank") + " · opp games played: " + S.opps.map(o => o.short + " " + (o.W + o.L)).join(","));
  // finance
  const f = S.fin;
  PT.note("fin inc " + JSON.stringify(f.inc) + " exp " + JSON.stringify(f.exp) + " att " + f.att + " ledger " + f.ledger.length);
  PT.note("ledger kinds: " + JSON.stringify(f.ledger.reduce((a, l) => (a[l.kind] = (a[l.kind] || 0) + 1, a), {})));
  PT.note("ledger last 12: " + f.ledger.slice(0, 12).map(l => l.d + " " + l.kind + " " + l.amt + " " + l.text).join(" || "));
  const weekly = f.ledger.filter(l => l.kind === "주간 결산").map(l => l.amt);
  const gates = f.ledger.filter(l => l.kind === "입장 수입").map(l => l.amt);
  PT.note("weekly settlements " + JSON.stringify(weekly) + " gate per home game avg " + r2(avg(gates)) + " n=" + gates.length);
  // morale drift
  const axes = ["playing_time", "team_success", "salary_fairness", "relationships", "role_fit"];
  const mor = (SS, act) => Object.fromEntries(axes.map(k => [k, r2(avg(SS.players.filter(p => act === undefined || p.active === act).map(p => p.morale[k])))]));
  PT.note("morale 1군 before " + JSON.stringify(mor(S0, true)) + " after " + JSON.stringify(mor(S1, true)));
  PT.note("morale 2군 before " + JSON.stringify(mor(S0, false)) + " after " + JSON.stringify(mor(S1, false)));
  PT.note("morale overall avg before " + r2(avg(S0.players.map(I.moraleOverall))) + " after " + r2(avg(S1.players.map(I.moraleOverall))) + " transfer requests in log: " + S.log.filter(l => l.t.includes("이적 요청")).length + " (log cap 200)");
  // fatigue / condition
  const grp = (SS, fn) => ({ B: r2(avg(SS.players.filter(p => p.type == "B" && p.active).map(fn))), SP: r2(avg(SS.players.filter(p => p.role == "SP" && p.active).map(fn))), RP: r2(avg(SS.players.filter(p => p.role == "RP" && p.active).map(fn))), farm: r2(avg(SS.players.filter(p => !p.active).map(fn))) });
  PT.note("fatigue before " + JSON.stringify(grp(S0, p => p.fatigue)) + " after " + JSON.stringify(grp(S1, p => p.fatigue)));
  PT.note("condition before " + JSON.stringify(grp(S0, p => p.condition)) + " after " + JSON.stringify(grp(S1, p => p.condition)));
  PT.note("lineup fatigue after: " + S.lineup.map(I.P).map(p => p ? p.name + " " + r2(p.fatigue) : "-").join(", "));
  PT.note("rotation fatigue after: " + S.rotation.map(I.P).map(p => p ? p.name + " " + r2(p.fatigue) : "-").join(", "));
  // starts
  PT.note("starts by pitcher " + JSON.stringify(starts) + " starts with fatigue>=0.75 at start: " + fallbackStarts + "/30");
  PT.note("starter fatigue at each start: " + perDay.filter(d => d.sp).map(d => d.g + ":" + d.sp.slice(0, 3) + "@" + d.spFat0 + "/" + d.ip + "ip").join(" "));
  // injuries
  const injLog = S.log.filter(l => l.t.includes("부상 ·") || l.t.includes("훈련 중 부상"));
  const injDays = injLog.map(l => +(l.t.match(/(\d+)일/) || [0, 0])[1]);
  PT.note("injuries logged " + injLog.length + " days " + JSON.stringify(injDays) + " currently injured " + S.players.filter(p => p.injury > 0).length + " active injured " + S.players.filter(p => p.injury > 0 && p.active).map(p => p.name + "(" + p.injury + ")").join(","));
  // training gains
  const keys = p => p.type == "B" ? I.DATA.bat_keys : I.DATA.pit_keys;
  const gains = S1.players.map(p => { const q = S0.players.find(x => x.id === p.id); if (!q) return null; const d = {}; let s = 0; keys(p).forEach(k => { d[k] = r2((p.attrs[k] - q.attrs[k]) * 100); s += p.attrs[k] - q.attrs[k] }); return { name: p.name, age: p.age, type: p.type, active: p.active, dOvr: r2((ovr(p) - ovr(q)) * 100), sum: r2(s * 100), d } }).filter(Boolean).sort((a, b) => b.sum - a.sum);
  PT.note("training gains (x100 attr pts) top5: " + gains.slice(0, 5).map(g => g.name + "(" + g.age + "," + (g.active ? "1군" : "2군") + ") sum " + g.sum + " ovr " + g.dOvr + " " + JSON.stringify(g.d)).join(" | "));
  PT.note("training gains bottom5: " + gains.slice(-5).map(g => g.name + "(" + g.age + ") sum " + g.sum + " ovr " + g.dOvr).join(" | "));
  PT.note("avg dOvr x100 by age: " + JSON.stringify([[0, 24], [25, 27], [28, 31], [32, 50]].map(([a, b]) => [a + "-" + b, r2(avg(gains.filter(g => g.age >= a && g.age <= b).map(g => g.dOvr)))])));
  PT.note("avg dOvr x100 active vs farm: " + r2(avg(gains.filter(g => g.active).map(g => g.dOvr))) + " / " + r2(avg(gains.filter(g => !g.active).map(g => g.dOvr))));
  // run distribution
  const us = perDay.filter(d => d.sp).map(d => d.us), them = perDay.filter(d => d.sp).map(d => d.them);
  const hist = a => a.reduce((h, v) => (h[v] = (h[v] || 0) + 1, h), {});
  PT.note("runs us " + JSON.stringify(hist(us)) + " avg " + r2(avg(us)) + " | them " + JSON.stringify(hist(them)) + " avg " + r2(avg(them)) + " | home W-L " + perDay.filter(d => d.sp && d.home && d.us > d.them).length + "-" + perDay.filter(d => d.sp && d.home && d.us <= d.them).length + " away " + perDay.filter(d => d.sp && !d.home && d.us > d.them).length + "-" + perDay.filter(d => d.sp && !d.home && d.us <= d.them).length);
  PT.note("AI trade offers logged: " + S.log.filter(l => l.t.includes("트레이드 제안")).length + " offers pending " + f.offers.length);
  PT.note("season end log: " + S.log.filter(l => l.t.includes("결산") || l.t.includes("제재금") || l.t.includes("기금") || l.t.includes("시즌 종료") || l.t.includes("30경기")).map(l => l.t).join(" || "));
  // keep advancing past the season
  const dayEnd = S.day, budgetEnd = S.budget;
  for (let i = 0; i < 12; i++) ClubUI.simDay();
  PT.note("after extra 12 simDay: day " + S.day + " (days cap " + I.DATA.days + ") budget " + S.budget + " (was " + budgetEnd + ") ledger newest " + f.ledger[0].kind + " " + f.ledger[0].amt + " nextDay disabled=" + document.getElementById("nextDay").disabled + " last log: " + S.log[0].t);
  APP.show("stats");
  await PT.wait(300);
  await PT.done({ persona: "manager-sim veteran", scenario: "season", record: S.W + "-" + S.L, runs: [S.runs, S.ra], budgetStart: 40, budgetEnd, top40: I.top40(), fin: f.inc, exp: f.exp, standings: rows, perDay, starts, fallbackStarts, injuries: injLog.map(l => l.t), gainsTop: gains.slice(0, 8), moraleBefore: mor(S0, true), moraleAfter: mor(S1, true), fatigueAfter: grp(S1, p => p.fatigue) });
})();
