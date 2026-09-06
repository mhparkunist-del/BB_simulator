/* KBO fan playtest: realism sweep over all 10 clubs — well-known players' status (1군/2군, pos, hand, age, salary), KBO-registered players the game benches to 2군, est-star ages, and the opponent 9 the engine would field (position counts) */
(async () => {
  const L = []; const note = t => { PT.note(t); L.push(t) };
  PT.say("10구단 사실성 점검");
  const STARS = { SS: ["구자욱", "강민호", "최형우", "김영웅", "이재현", "원태인", "최원태", "디아즈", "김지찬", "후라도", "오승환", "이성규", "김헌곤"], LG: ["홍창기", "오지환", "문보경", "박해민", "박동원", "임찬규", "손주영", "고우석", "오스틴", "신민재", "김윤식", "송승기", "치리노스", "톨허스트"], OB: ["양의지", "곽빈", "정수빈", "손아섭", "김재환", "강승호", "박준순", "최승용", "이영하", "홍건희", "김택연", "조수행", "케이브"], HT: ["김도영", "양현종", "나성범", "김선빈", "박찬호", "최지민", "하주석", "이의리", "정해영", "김태군", "최형우", "위즈덤", "네일", "올러"], SK: ["최정", "김광현", "박성한", "한유섬", "에레디아", "김재환", "이지영", "노경은", "조병현", "문승원", "고명준", "정준재", "김광현"], LT: ["전준우", "윤동희", "나승엽", "박세웅", "김원중", "황성빈", "고승민", "손호영", "한동희", "노진혁", "정철원", "유강남", "레이예스", "감보아"], HH: ["류현진", "문동주", "노시환", "채은성", "강백호", "심우준", "김서현", "최재훈", "정우주", "엄상백", "황영묵", "이진영", "장민재", "폰세", "와이스", "페라자"], NC: ["김주원", "박건우", "손아섭", "권희동", "김형준", "구창모", "류진욱", "김휘집", "이용찬", "박민우", "서호철", "최정원", "데이비슨", "라일리"], KT: ["고영표", "소형준", "박영현", "김현수", "허경민", "강백호", "장성우", "황재균", "김민혁", "오원석", "배정대", "문상철", "안현민", "쿠에바스", "로하스"], WO: ["안우진", "송성문", "김혜성", "이주형", "김재현", "하영민", "김윤하", "주승우", "김동헌", "이정후", "데이비슨", "알칸타라", "푸이그", "카디네스"] };
  const T = APP.teamList(); const summary = [];
  for (const t of T) {
    ClubUI.fresh(t); const S = ClubUI.state(); const K = APP.kbo.clubs.find(c => c.code === t.code);
    const reg = K.players.filter(p => p.active).map(p => p.name); const g2 = new Set(S.players.filter(p => !p.active).map(p => p.name)); const benched = reg.filter(n => g2.has(n));
    const est = S.players.filter(p => !p.real);
    note(t.code + " " + t.name + " · KBO등록 1군 " + reg.length + " → 게임 1군 24 · 등록1군인데 게임2군 " + benched.length + "명: " + benched.join(",") + " · est " + est.length + "명 (2군 " + S.players.filter(p => !p.active).length + "명 중)");
    note(t.code + " STARS: " + STARS[t.code].map(n => { const ps = S.players.filter(x => x.name === n); if (!ps.length) return n + "=없음"; return ps.map(p => n + "=" + (p.active ? "1군" : "2군") + " " + (p.pos || p.role) + " " + p.age + "세 " + (p.bats || "") + "/" + (p.throws || "") + " #" + p.num + " " + p.contract.salary + "억 ovr" + ClubInt.ovr(p).toFixed(2) + (p.real ? "" : " est")).join(" & ") }).join(" | "));
    // opponent 9 the engine would field (same rule as lineupForGame): first unused registered batter with matching L/R hand in kbo.json order
    const R = APP.roster; const ob = K.players.filter(p => p.group !== "P" && p.active); const used = new Set(); const nine = [];
    R.opp.batters.forEach(ab => { let c = ob.find(p => !used.has(p.name) && (p.bats === "L") === (ab.hand === "L")) || ob.find(p => !used.has(p.name)); if (c) { used.add(c.name); nine.push(c) } });
    const pc = {}; nine.forEach(p => pc[p.pos] = (pc[p.pos] || 0) + 1);
    const op = K.players.filter(p => p.group === "P" && p.active); const five = R.opp.pitchers.map((ap, i) => { const c = op.filter(p => (p.throws === "L") === (ap.hand === "L"))[i % Math.max(1, op.length)] || op[i % Math.max(1, op.length)]; return c ? c.name : "-" });
    note(t.code + " OPP9(상대로 만날 때): " + nine.map(p => p.name + "/" + p.pos + "/" + p.bats).join(",") + " · pos " + JSON.stringify(pc) + " · 상대 선발진 " + five.join(","));
    const lineupNames = S.lineup.map(id => S.players.find(p => p.id === id).name); const overlap = nine.filter(p => lineupNames.includes(p.name)).length;
    note(t.code + " 자기구단 타순 vs 상대판 9명 겹침 " + overlap + "/9 · 자기구단 타순: " + lineupNames.join(","));
    const oldest = S.players.slice().sort((a, b) => b.age - a.age).slice(0, 3).map(p => p.name + p.age + (p.real ? "" : "e")); const young = S.players.slice().sort((a, b) => a.age - b.age).slice(0, 3).map(p => p.name + p.age + (p.real ? "" : "e"));
    const nums = {}; S.players.forEach(p => { if (p.active) nums[p.num] = (nums[p.num] || 0) + 1 }); const dupNum = Object.entries(nums).filter(([n, c]) => c > 1).map(([n, c]) => "#" + n + "x" + c);
    summary.push(t.code + " benched" + benched.length + " est" + est.length + " oldest " + oldest.join("/") + " youngest " + young.join("/") + " 1군 등번호 중복 " + (dupNum.join(",") || "없음") + " top40 " + ClubInt.top40().toFixed(1));
  }
  note("SUMMARY: " + summary.join(" || "));
  // salary sanity: top-5 salaries league-wide vs known real contracts
  const all = []; for (const t of T) { ClubUI.fresh(t); ClubUI.state().players.forEach(p => all.push({ c: t.code, n: p.name, s: p.contract.salary, a: p.age, pos: p.pos || p.role, act: p.active })) }
  note("LEAGUE TOP SALARY 15: " + all.sort((a, b) => b.s - a.s).slice(0, 15).map(p => p.c + " " + p.n + " " + p.s + "억(" + p.a + "세 " + p.pos + ")").join(", "));
  note("1군 min salary " + Math.min(...all.filter(p => p.act).map(p => p.s)) + " · 2군 max " + Math.max(...all.filter(p => !p.act).map(p => p.s)) + " · 2군 salary 0.3 count " + all.filter(p => !p.act && p.s === 0.3).length + "/" + all.filter(p => !p.act).length);
  ClubUI.fresh(T.find(t => t.code === "HH")); APP.show("roster"); await PT.wait(400);
  await PT.done({ persona: "KBO 골수팬 · 사실성", notes: L });
})();
