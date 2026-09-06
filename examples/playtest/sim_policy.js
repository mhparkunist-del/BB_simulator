/* sim_policy: (1) baseline difficulty: every KBO club on default manual training, 30 games
   (2) training policy vs manual variants, same club, 3 seeds each: W-L, injuries, fatigue, attribute gains */
(async () => {
  const I = ClubInt, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, r2 = v => Math.round(v * 100) / 100;
  const keys = p => p.type == "B" ? I.DATA.bat_keys : I.DATA.pit_keys;
  const strengths = () => { const t = PT.text("#nextGame") || ""; const m = t.match(/타선 ([\d.]+) · 수비 ([\d.]+)/); return m ? [+m[1], +m[2]] : [null, null] };
  function runSeason(teamIdx, seed, setup) {
    ClubUI.fresh(APP.teamList()[teamIdx]); const S = ClubUI.state(); S.seed = seed;
    if (setup) setup(S);
    const S0 = JSON.parse(JSON.stringify(S));
    const [B0, D0] = strengths();
    let spFat = [], progMid = null, days = 0;
    while (S.sched.filter(g => g.result).length < 30 && days < 60) {
      const rot = S.rotation.map(I.P).filter(p => p && p.active); const planned = rot[S.rotIdx % Math.max(1, rot.length)];
      const g = S.sched.find(x => x.date === I.today() && !x.result);
      if (g && planned) { const nm = planned.name; const sp = S.players.filter(p => p.type == "P" && p.active && !p.injury && p.fatigue < 0.75 && S.rotation.includes(p.id)); }
      const fatMap = {}; S.players.forEach(p => fatMap[p.name] = p.fatigue);
      ClubUI.simDay();
      if (g && g.result) spFat.push(fatMap[g.result.sp]);
      if (days === 14) progMid = Object.values(S.program).reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {});
      days++;
    }
    const inj = S.log.filter(l => l.t.includes("훈련 중 부상")); const injDays = inj.map(l => +(l.t.match(/(\d+)일/) || [0, 0])[1]);
    const dOvr = S.players.map(p => { const q = S0.players.find(x => x.id === p.id); return q ? { age: p.age, active: p.active, type: p.type, d: (I.ovr(p) - I.ovr(q)) * 100, sum: keys(p).reduce((s, k) => s + Math.abs(p.attrs[k] - q.attrs[k]), 0) * 100 } : null }).filter(Boolean);
    const lineupIds = S0.lineup;
    return { W: S.W, L: S.L, runs: S.runs, ra: S.ra, B0, D0, lineupOvr: r2(avg(lineupIds.map(id => S0.players.find(p => p.id === id)).filter(Boolean).map(I.ovr))), rotOvr: r2(avg(S0.rotation.map(id => S0.players.find(p => p.id === id)).filter(Boolean).map(I.ovr))), oppPitch: r2(avg(S.opps.map(o => o.pitch))), oppBat: r2(avg(S.opps.map(o => o.bat))),
      injuries: inj.length, injDays: injDays.reduce((a, b) => a + b, 0), injActive: inj.filter(l => S.players.some(p => p.active && l.t.startsWith(p.name))).length,
      spFatAtStart: r2(avg(spFat)), spFatAtStartLate: r2(avg(spFat.slice(10))), fatB: r2(avg(S.players.filter(p => p.type == "B" && S.lineup.includes(p.id)).map(p => p.fatigue))), fatSP: r2(avg(S.players.filter(p => S.rotation.includes(p.id)).map(p => p.fatigue))),
      dOvrActive: r2(avg(dOvr.filter(x => x.active).map(x => x.d))), dOvrYoung: r2(avg(dOvr.filter(x => x.age <= 24).map(x => x.d))), dOvrLineup: r2(avg(dOvr.filter((x, i) => lineupIds.includes(S.players[i] && S.players[i].id)).map(x => x.d))), sumAbsActive: r2(avg(dOvr.filter(x => x.active).map(x => x.sum))), progMid, budget: S.budget, top40: r2(I.top40()) };
  }
  PT.say("baseline: 10 clubs, manual default");
  const base = [];
  for (let i = 0; i < 10; i++) { const t = APP.teamList()[i]; const r = runSeason(i, 20260403); base.push({ club: t.name, ...r }); PT.note("baseline " + t.name + " " + r.W + "-" + r.L + " R " + r.runs + "/" + r.ra + " B " + r.B0 + " D " + r.D0 + " lineupOvr " + r.lineupOvr + " rotOvr " + r.rotOvr + " oppPitch " + r.oppPitch + " oppBat " + r.oppBat + " inj " + r.injuries + " spFatLate " + r.spFatAtStartLate + " budget " + r.budget + " top40 " + r.top40) }
  PT.note("baseline avg W " + r2(avg(base.map(b => b.W))) + " runs/g " + r2(avg(base.map(b => b.runs)) / 30) + " ra/g " + r2(avg(base.map(b => b.ra)) / 30));
  PT.say("policies × seeds");
  const club = 4; const seeds = [11, 22, 33];
  const variants = {
    "manual-default": null,
    "balanced": S => { S.policy = "balanced" },
    "hitting": S => { S.policy = "hitting" },
    "pitching": S => { S.policy = "pitching" },
    "youth": S => { S.policy = "youth" },
    "rest": S => { S.policy = "rest" },
    "manual-SPrest": S => { S.rotation.forEach(id => S.program[id] = "rest") },
    "manual-allrest": S => { S.players.forEach(p => S.program[p.id] = "rest") },
    "manual-power+stuff": S => { S.players.forEach(p => S.program[p.id] = p.type == "B" ? "power" : "stuff") },
  };
  const out = {};
  for (const [name, setup] of Object.entries(variants)) {
    const rs = seeds.map(sd => runSeason(club, sd, setup));
    out[name] = rs;
    PT.note("variant " + name + ": W " + rs.map(r => r.W + "-" + r.L).join("/") + " avgW " + r2(avg(rs.map(r => r.W))) + " runs/g " + r2(avg(rs.map(r => r.runs)) / 30) + " ra/g " + r2(avg(rs.map(r => r.ra)) / 30) + " inj " + rs.map(r => r.injuries + "(" + r.injDays + "d)").join("/") + " spFatAtStart " + r2(avg(rs.map(r => r.spFatAtStart))) + " late " + r2(avg(rs.map(r => r.spFatAtStartLate))) + " fatSPend " + r2(avg(rs.map(r => r.fatSP))) + " fatBend " + r2(avg(rs.map(r => r.fatB))) + " dOvrActive " + r2(avg(rs.map(r => r.dOvrActive))) + " dOvrYoung " + r2(avg(rs.map(r => r.dOvrYoung))) + " sumAbsActive " + r2(avg(rs.map(r => r.sumAbsActive))) + " progMid " + JSON.stringify(rs[0].progMid));
  }
  APP.show("training");
  await PT.wait(200);
  await PT.done({ scenario: "policy", baseline: base, variants: out });
})();
