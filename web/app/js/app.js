/* bbsim app · shell: data loading, module loading in order, screens (hash router), orientation, service worker, smoke mode */
window.APP = window.APP || {};
(function () {
  const A = window.APP;
  A.base = A.base || (location.pathname.replace(/[^/]*$/, ""));
  A.fetchJSON = async function (path) {
    if (A.embedded && A.embedded[path]) return A.embedded[path];
    const r = await fetch(A.base + path, { cache: "default" });
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  };
  const $ = id => document.getElementById(id);
  const SCREENS = ["title", "team", "schedule", "training", "roster", "stats", "market", "game"];
  const TEAMS = [
    { name: "덕아웃 나이트", city: "야간 구장", color: "#f2b441", motto: "밤경기의 명가" },
    { name: "항구 갈매기", city: "항구", color: "#4fa3e0", motto: "바닷바람을 등지고" },
    { name: "고원 산양", city: "고원", color: "#8ad1a8", motto: "높은 곳에서 멀리" },
    { name: "강변 여우", city: "강변", color: "#e0524b", motto: "빠르고 영리하게" },
    { name: "도심 늑대", city: "도심", color: "#c9c2ae", motto: "떼로 사냥한다" },
    { name: "남부 사자", city: "남부", color: "#d98c3a", motto: "포효 한 번에 한 점" },
  ];
  const TUTORIAL = ["먼저 선수단을 둘러보세요. 이름을 누르면 카드가 열리고, 포지션 셀렉트로 수비 위치를 정합니다.", "훈련 화면에서 코치에게 방침을 맡기거나(균형·타격·투수·유망주·회복) 선수마다 직접 프로그램을 고릅니다.", "일정 화면의 큰 버튼이 안내합니다. 경기 날에는 \"오늘 경기 시작\"을 눌러 경기 화면으로 가고, 급하면 \"결과 바로보기\"로 남은 경기를 바로 끝냅니다. 경기가 없는 날은 \"다음 날\"입니다. 경기가 시작되면 끝날 때까지 정비 화면으로 나갈 수 없습니다."];
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = A.base + src; s.onload = res; s.onerror = () => rej(new Error("script " + src)); document.head.appendChild(s) });
  }
  A.show = function (name) {
    if (!SCREENS.includes(name)) name = "schedule";
    if (A.locked && name !== "game") name = "game";
    $("apphead").hidden = (name === "title" || name === "team");
    $("screen-title").hidden = name !== "title"; $("screen-team").hidden = name !== "team";
    if (name === "title") A.theme();
    if (name === "title" || name === "team") { $("screen-club").hidden = true; $("screen-game").hidden = true; if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name); return }
    document.querySelectorAll(".nav [data-screen]").forEach(b => b.classList.toggle("on", b.dataset.screen === name));
    $("screen-club").hidden = name === "game";
    $("screen-game").hidden = name !== "game";
    $("strip").hidden = name !== "game"; $("cstrip").hidden = name === "game";
    if (name !== "game" && window.ClubUI_tab) { window.ClubUI_tab(name); if (window.ClubUI && window.ClubUI.state && window.ClubUI.state()) window.ClubUI.render() }
    if (name === "game") {
      if (window.ClubUI && window.ClubUI.lineupForGame) A.clubLineup = window.ClubUI.lineupForGame();
      const gt = window.ClubUI && window.ClubUI.gameToday ? window.ClubUI.gameToday() : null;
      const note = $("gameDayNote"); if (note) note.textContent = gt ? (gt.g + "차전 · " + gt.opp + (gt.home ? " (홈)" : " (원정)") + " · 결과가 시즌에 기록됩니다") : "오늘은 경기가 없습니다 · 연습 경기(기록 없음)";
      if (window.GameUI && !(window.GameUI.state && window.GameUI.state())) { window.GameUI.roster(); }
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}) } catch (e) {}
    } else { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock() } catch (e) {} }
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  };
  A.onGameStart = function () { A.locked = true; $("lockBadge").hidden = false; document.querySelectorAll(".nav [data-screen]").forEach(b => { if (b.dataset.screen !== "game") b.disabled = true }); $("saveBtn").disabled = true; $("titleBtn").disabled = true };
  A.onGameOver = function (res) {
    A.locked = false; $("lockBadge").hidden = true; document.querySelectorAll(".nav [data-screen]").forEach(b => b.disabled = false); $("saveBtn").disabled = false; $("titleBtn").disabled = false;
    const rec = window.ClubUI && window.ClubUI.recordExternalGame ? window.ClubUI.recordExternalGame(res) : false;
    A.show("schedule");
    A.event("경기 종료", (res.us > res.them ? "이겼습니다. " : res.us < res.them ? "졌습니다. " : "비겼습니다. ") + res.us + " : " + res.them + (rec ? "<br>결과가 오늘 일정과 기록에 반영됐습니다. 정비 시간입니다. 일정 화면에서 다음 날로 넘어가세요." : "<br>연습 경기라 기록에는 남지 않습니다."), () => {});
    A.autosave();
  };
  /* theme: every accent on the page derives from the club's two colours (primary, accent); the title uses the KBO league navy/red */
  A.theme = function (color, color2) {
    const rgb = c => { c = String(c || "#0b2a5b").replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) || 0) };
    const hex = v => "#" + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
    const lum = v => (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255, mix = (v, t, f) => v.map((x, i) => x + (t[i] - x) * f), W = [255, 255, 255], K = [0, 0, 0];
    const team = rgb(color || "#0b2a5b"); let acc = rgb(color2 || (color ? hex(mix(team, W, 0.45)) : "#ff7a7a")); if (lum(acc) < 0.45) acc = mix(acc, W, 0.35);
    const go = lum(team) < 0.18 ? acc : team, st = document.documentElement.style, set = (k, v) => st.setProperty(k, v);
    set("--team", hex(team)); set("--team-rgb", team.map(Math.round).join(",")); set("--stripe", hex(lum(team) < 0.18 ? acc : mix(team, W, 0.15)));
    set("--bulb", hex(acc)); set("--bulb2", hex(mix(acc, W, 0.35))); set("--bulb-dark", hex(mix(acc, K, 0.35))); set("--bulb-rgb", acc.map(Math.round).join(",")); set("--bulb-ink", lum(acc) > 0.5 ? "#151008" : "#fff");
    set("--go", hex(go)); set("--go2", hex(mix(go, W, 0.22))); set("--go-ink", lum(go) > 0.6 ? "#151008" : "#fff"); set("--go-dark", hex(mix(go, K, 0.45)));
    const m = document.querySelector("meta[name=theme-color]"); if (m) m.content = hex(mix(team, K, 0.6)); A.themeNow = { color: hex(team), color2: hex(acc) };
  };
  A.event = function (title, body, cb) { $("eventTitle").textContent = title; $("eventBody").innerHTML = body; $("eventModal").hidden = false; $("eventOk").onclick = () => { $("eventModal").hidden = true; if (cb) cb() } };
  A.autosave = function () { if (window.ClubUI && window.ClubUI.state()) A.kv.set("autosave", { when: new Date().toISOString(), S: window.ClubUI.state() }) };
  function slotList(container, mode) {
    Promise.all([1, 2, 3].map(i => A.kv.get("save:" + i))).then(saves => {
      container.innerHTML = saves.map((sv, i) => "<div class='slot'><b>슬롯 " + (i + 1) + "</b><span>" + (sv ? (sv.S.club && sv.S.club.name ? sv.S.club.name + " · " : "") + "day " + sv.S.day + " · " + sv.S.W + "승 " + sv.S.L + "패 · " + new Date(sv.when).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).replace("T", " ") : "비어 있음") + "</span><button data-slot='" + (i + 1) + "'>" + (mode === "save" ? "여기 저장" : "불러오기") + "</button></div>").join("");
      container.querySelectorAll("[data-slot]").forEach(b => b.onclick = async () => {
        const i = +b.dataset.slot;
        if (mode === "save") { await A.kv.set("save:" + i, { when: new Date().toISOString(), S: window.ClubUI.state() }); slotList(container, mode); A.event("저장", "슬롯 " + i + "에 저장했습니다.") }
        else { const sv = await A.kv.get("save:" + i); if (!sv) return; await A.kv.set("club", sv.S); await A.kv.set("autosave", { S: sv.S, at: Date.now() }); window.ClubUI.setState(sv.S); $("loadSlots").hidden = true; A.show("schedule") }
      });
      container.hidden = false;
    });
  }
  function tutorial(step) {
    if (step >= TUTORIAL.length) { $("tutorial").hidden = true; A.kv.set("tutorial_done", true); return }
    $("tutorial").hidden = false; $("tutText").textContent = TUTORIAL[step]; $("tutStep").textContent = (step + 1) + "/" + TUTORIAL.length;
    A.show(["roster", "training", "schedule"][step]);
    $("tutNext").onclick = () => tutorial(step + 1); $("tutSkip").onclick = () => tutorial(TUTORIAL.length);
  }
  function wireFlow() {
    $("btnNew").onclick = () => { $("loadSlots").hidden = true; A.show("team"); renderTeams() };
    $("btnLoad").onclick = () => slotList($("loadSlots"), "load");
    $("btnContinue").onclick = () => A.show("schedule");
    if ($("teamBack")) $("teamBack").onclick = () => A.show("title");
    if ($("helpBtn")) { $("helpBtn").onclick = () => { $("helpModal").hidden = false }; $("helpClose").onclick = () => { $("helpModal").hidden = true } }
    $("saveBtn").onclick = () => { slotList($("saveSlots"), "save"); $("saveModal").hidden = false }; $("saveClose").onclick = () => { $("saveModal").hidden = true };
    $("titleBtn").onclick = () => { A.autosave(); A.show("title"); refreshContinue() };
    $("teamStart").onclick = async () => {
      const t = teamList()[A.teamPick]; window.ClubUI.fresh(t); await A.kv.set("tutorial_done", false);
      A.show("schedule");
      A.event("구단주 인사", "<b>" + t.name + "</b> 감독으로 부임하신 것을 환영합니다.<br>" + (t.code ? "실제 " + t.name + " 선수단(2026 등록명단 기준)으로 시즌을 치릅니다. 능력치는 이 게임의 추정값입니다." : t.motto) + "<br>올 시즌 30경기, 선수단과 훈련은 감독님께 맡깁니다. 먼저 선수들을 둘러보시죠.", () => tutorial(0));
      A.autosave();
    };
  }
  function teamList() {
    if (A.kbo && A.kbo.clubs) return A.kbo.clubs.map(c => ({ name: c.name, city: c.city, color: c.color, color2: c.color2, code: c.code, motto: "1군 " + c.n_active + "명 · 전체 " + c.players.length + "명 (KBO " + A.kbo.season + ")" }));
    return TEAMS;
  }
  function renderTeams() {
    A.teamPick = null; $("teamStart").disabled = true;
    const L = teamList();
    $("teamCards").innerHTML = L.map((t, i) => "<div class='tc' data-i='" + i + "' style='border-top:3px solid " + t.color + "'><b><span class='sw' style='background:" + t.color + "'></span>" + t.name + "</b><span class='hint'>" + t.city + " · " + t.motto + "</span></div>").join("");
    $("teamCards").querySelectorAll(".tc").forEach(c => c.onclick = () => { A.teamPick = +c.dataset.i; A.theme(L[A.teamPick].color, L[A.teamPick].color2); $("teamCards").querySelectorAll(".tc").forEach(x => x.classList.toggle("sel", x === c)); $("teamPick").textContent = L[A.teamPick].name + " 선택"; $("teamStart").disabled = false });
  }
  async function refreshContinue() { const sv = await A.kv.get("autosave"); const has = !!(sv && sv.S); $("btnContinue").hidden = !has; if (has && window.ClubUI && window.ClubUI.setState && !(window.ClubUI.state() && window.ClubUI.state().day === sv.S.day)) window.ClubUI.setState(sv.S) }
  function viewSel(v) {                           // small screens: one 3D view at a time
    A.viewSel = v; window.VIEW_HIDE = { cam: v !== "cam", body: v !== "body", seam: v !== "seam" };
    ["cam", "body", "seam"].forEach(k => { const p = $("vw-" + k); if (p) p.hidden = k !== v });
    document.querySelectorAll(".viewsel button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
    if (window.GameUI) window.GameUI.drawIdle();
  }
  function applyLayout() { viewSel(A.viewSel || "cam") }
  let bpage = 0;
  function showBreakPage(i) {
    const ids = ["breakScore", "breakUs", "breakThem", "breakPitchers"], names = ["점수", "우리 타자", "상대 타자", "투수"];
    bpage = (i + 4) % 4;
    ids.forEach((id, k) => { $(id).hidden = k !== bpage });
    $("breakPageNo").textContent = names[bpage] + " " + (bpage + 1) + "/4";
  }
  function wireGameExtras() {
    $("breakPrev").onclick = () => showBreakPage(bpage - 1); $("breakNext").onclick = () => showBreakPage(bpage + 1);
    if (window.GameUI && window.GameUI.setScene) { const orig = window.GameUI.setScene; }
    new MutationObserver(() => { if (!$("sceneBreak").hidden) showBreakPage(0) }).observe($("sceneBreak"), { attributes: true, attributeFilter: ["hidden"] });
    new MutationObserver(() => { const ls = [...$("feed").children].slice(0, 2); $("feedLast").innerHTML = ls.map(l => l.innerHTML).join("<br>") }).observe($("feed"), { childList: true });
    $("feedBtn").onclick = () => { $("feed").hidden = !$("feed").hidden };
    $("feed").onclick = () => { $("feed").hidden = true };
    let locked = false;
    document.addEventListener("pointerdown", () => {
      if (locked || window.innerWidth >= 1100 || $("screen-game").hidden) return;
      locked = true;
      try { const el = document.documentElement; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) req.call(el).catch(() => {}) } catch (e) {}
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}) } catch (e) {}
    }, { passive: true });
  }
  async function boot() {
    const status = $("boot");
    const q = new URLSearchParams(location.search);
    const smokeMode = window.SMOKE || q.get("smoke"), pt = q.get("pt");
    if ((smokeMode || pt) && !A.bundled && !q.get("nohold")) { const im = new Image(); im.src = A.base + (pt ? "hold?wait=1&t=" + Date.now() : "hold?ms=6000"); im.style.cssText = "position:fixed;width:1px;height:1px;opacity:0"; document.body.appendChild(im) }   // keeps the load event (and the screenshot) waiting
    try {
      status.textContent = "데이터 불러오는 중…";
      A.roster = await A.fetchJSON("data/roster.json");
      A.club = await A.fetchJSON("data/club.json");
      try { A.kbo = await A.fetchJSON("data/kbo.json") } catch (e) { A.kbo = null }
      status.textContent = "렌더러 불러오는 중…";
      if (!A.bundled) for (const f of ["js/render/math.js", "js/render/park.js", "js/render/person.js", "js/render/pitcher.js", "js/render/figures.js", "js/render/play.js", "js/render/seam.js", "js/render/cutscene.js", "js/game/game.js", "js/club/club.js", "js/club/market.js"]) await loadScript(f);
      else if (A.bundledInit) A.bundledInit();
      status.hidden = true;
      document.querySelectorAll(".nav [data-screen]").forEach(b => b.onclick = () => A.show(b.dataset.screen));
      document.querySelectorAll(".viewsel button").forEach(b => b.onclick = () => viewSel(b.dataset.view));
      window.addEventListener("resize", applyLayout);
      applyLayout(); wireGameExtras(); wireFlow();
      const sv = await A.kv.get("autosave");
      const hash = (location.hash || "").slice(1);
      if (sv && sv.S && hash && hash !== "title" && hash !== "team") { window.ClubUI && window.ClubUI.setState && window.ClubUI.setState(sv.S); A.show(hash) }
      else { A.show("title"); refreshContinue() }
      setInterval(() => { if (!A.locked) A.autosave() }, 60 * 1000);
      if (pt) startPlaytest(pt);
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        let hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !A.reloaded) { A.reloaded = true; location.reload() } hadController = true });
        navigator.serviceWorker.register(A.base + "sw.js").then(reg => { reg.update().catch(() => {}); setInterval(() => reg.update().catch(() => {}), 10 * 60 * 1000) }).catch(() => {});
      }
      if (smokeMode) smoke(smokeMode);
    } catch (e) {
      status.hidden = false; status.textContent = "불러오기 실패: " + e.message; status.className = "boot err";
      console.error(e);
    }
  }
  /* playtest hook (tools/playtest.py): ?pt=<name> loads pt/<name>.js with window.PT = { say, note, shot, done, wait, until, click } */
  A.teamList = () => teamList();
  function startPlaytest(name) {
    const box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99;background:rgba(40,40,120,.9);color:#fff;padding:2px 6px;font:12px monospace;white-space:pre-wrap";
    box.textContent = "PT " + name + " running…"; document.body.appendChild(box);
    const errs = []; window.addEventListener("error", e => errs.push(e.message + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno)); window.addEventListener("unhandledrejection", e => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
    const post = (path, obj) => fetch(A.base + path, { method: "POST", body: JSON.stringify(obj) }).catch(() => {});
    window.NOCUT = true;
    window.PT = {
      name, errs, log: [], t0: performance.now(),
      say(t) { box.textContent = "PT " + name + ": " + t },
      note(t) { this.log.push(t); post("log", { t }) },
      wait(ms) { return new Promise(r => setTimeout(r, ms)) },
      until(fn, ms) { const t0 = Date.now(); return new Promise(r => { const iv = setInterval(() => { let ok = false; try { ok = fn() } catch (e) {} if (ok || Date.now() - t0 > (ms || 8000)) { clearInterval(iv); r(ok) } }, 40) }) },
      click(sel) { const el = typeof sel === "string" ? document.querySelector(sel) : sel; if (!el) { this.note("click miss: " + sel); return false } el.click(); return true },
      visible(sel) { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return !el.hidden && r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" },
      text(sel) { const el = document.querySelector(sel); return el ? el.textContent.trim() : null },
      async shot(label, sel) { try { const c = document.querySelector(sel || "canvas#play:not([hidden]), .vw:not([hidden]) canvas, canvas"); if (!c) return; await post("shot", { label, png: c.toDataURL("image/png") }) } catch (e) { this.note("shot failed: " + e.message) } },
      async done(obj) { const rep = Object.assign({ name, ms: Math.round(performance.now() - this.t0), errs, log: this.log }, obj || {}); box.textContent = "PT " + name + " done · errs=" + errs.length; await post("report", rep) },
    };
    const sc = document.createElement("script"); sc.src = A.base + "pt/" + name + ".js?t=" + Date.now(); sc.onerror = () => { window.PT.note("scenario script failed to load"); window.PT.done({ fatal: "script load" }) }; document.body.appendChild(sc);
  }
  async function smoke(mode) {                    // headless check: drive a flow, report at the top of the page
    const box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99;background:rgba(0,102,51,.9);color:#fff;padding:2px 6px;font:12px monospace;white-space:pre-wrap";
    document.body.appendChild(box);
    const errs = []; window.addEventListener("error", e => errs.push(e.message));
    window.NOCUT = !mode.startsWith("cut");             // cutscenes only in the cut* capture modes
    try {
      if (mode === "flow") {
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        A.show("title"); $("btnNew").onclick(); $("teamCards").querySelectorAll(".tc")[3].onclick(); await $("teamStart").onclick();
        const S = window.ClubUI.state(); const eng = S.players.filter(p => p.engine_id !== undefined);
        box.textContent = "SMOKE OK flow: club=" + (S.club && S.club.name) + " players=" + S.players.length + " active=" + S.players.filter(p => p.active).length + " engine=" + eng.length + " lineup=" + S.lineup.map(id => (S.players.find(p => p.id === id) || {}).name).join("/") + " rot=" + S.rotation.length + " opps=" + S.opps.length + " event=" + !$("eventModal").hidden + " errs=" + errs.length;
      } else if (mode === "lock") {
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        A.show("game"); $("autoOrder").onclick(); if (window.GameUI.pick.pitcher === null) document.querySelector("[data-p]").onclick(); $("start").onclick();
        A.show("schedule");
        box.textContent = "SMOKE OK lock: locked=" + !!A.locked + " gameVisible=" + !$("screen-game").hidden + " clubHidden=" + $("screen-club").hidden + " navDisabled=" + [...document.querySelectorAll(".nav [data-screen]")].filter(b => b.disabled).length + " errs=" + errs.length;
      } else if (mode === "market") {                     // budget, a signing negotiation and a trade proposal on a KBO club
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state() && window.ClubMarket) { clearInterval(t); r() } }, 50) });
        const t40s = teamList().map(t => { window.ClubUI.fresh(t); return Math.round(window.ClubInt.top40()) });
        window.ClubUI.fresh(teamList()[4]); for (let i = 0; i < 8; i++) window.ClubUI.simDay();
        const M = window.ClubMarket, S = window.ClubUI.state(), fa = S.fa[0];
        M.startNego(fa.id); M.offer(Math.round(fa.asking * 0.5 * 10) / 10, 1); const low = M.fin().nego.msg; M.offer(M.fin().nego.ask, M.fin().nego.years); const signed = S.players.some(p => p.id === fa.id);
        $("negoModal").hidden = true;
        const opp = S.opps.find(o => o.code); const roster = M.oppRoster(opp.code).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => a.v - b.v);
        const target = roster[Math.floor(roster.length / 2)]; const mine = S.players.filter(p => p.active && !p.noTrade).map(p => ({ p, v: M.tradeValue(p) })).sort((a, b) => b.v - a.v);
        const r1 = M.proposeTrade(opp.code, [target.p.id], [mine[mine.length - 1].p.id], 0);
        const give = mine.filter(x => x.v >= target.v * 1.2).pop() || mine[0]; const r2 = M.proposeTrade(opp.code, [target.p.id], [give.p.id], 0);
        A.show("market");
        box.textContent = "SMOKE OK market: cash=" + S.budget + " top40=" + window.ClubInt.top40().toFixed(1) + " allClubs=" + t40s.join("/") + " ask=" + fa.asking + " ledger=" + M.fin().ledger.length + " att=" + M.fin().att + " | nego low='" + low.slice(0, 40) + "' signed=" + signed + " | trade1=" + r1.msg.slice(0, 44) + " | trade2=" + r2.msg.slice(0, 60) + " ok=" + r2.ok + " errs=" + errs.length;
      } else if (mode === "cut" || mode === "cutinn" || mode === "cutend") {   // one frame of a cutscene: intro (starter to the mound), half change, ending
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        if (A.kbo) window.ClubUI.fresh(teamList()[3]);
        window.NOCUT = true; A.show("game"); $("autoOrder").onclick(); if (window.GameUI.pick.pitcher === null) document.querySelector("[data-p]").onclick(); await $("start").onclick();
        window.GameUI.setScene("play");
        if (mode === "cut") window.CUT.draw("intro", 2.6, { pitcher: "양현종", club: "KIA 타이거즈", side: "us" });
        else if (mode === "cutinn") window.CUT.draw("inning", 1.5, { incoming: "us", inning: 3, half: "bottom" });
        else window.CUT.draw("ending", 3.1, { win: true, us: 5, them: 3, fielding: "us" });
        box.textContent = "SMOKE OK " + mode + ": drawn on #play " + $("play").width + "x" + $("play").height + " errs=" + errs.length;
      } else if (mode === "fast") {                       // 결과 바로보기: the rest of the game without animation, then the final screen
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        if (A.kbo) window.ClubUI.fresh(teamList()[2]);
        A.show("game"); $("autoOrder").onclick(); if (window.GameUI.pick.pitcher === null) document.querySelector("[data-p]").onclick(); $("start").onclick();
        const t0 = performance.now(); await window.GameUI.fast(); const G = window.GameUI.state();
        box.textContent = "SMOKE OK fast: over=" + G.over + " inning=" + G.inning + "/" + G.total + " score=" + G.score.us.reduce((a, b) => a + b, 0) + ":" + G.score.them.reduce((a, b) => a + b, 0) + " pitches=" + (G.pitches ? G.pitches.us + G.pitches.them : "-") + " ms=" + Math.round(performance.now() - t0) + " scene=" + !$("sceneBreak").hidden + " nextDayLabel=" + $("nextDay").textContent + " errs=" + errs.length;
      } else if (mode === "team") {                       // club select with a card chosen: the whole page previews that club's colours
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        A.show("title"); $("btnNew").onclick(); $("teamCards").querySelectorAll(".tc")[6].onclick();
        box.textContent = "SMOKE OK team: pick=" + A.teamPick + " theme=" + JSON.stringify(A.themeNow) + " bulb=" + getComputedStyle(document.documentElement).getPropertyValue("--bulb").trim() + " errs=" + errs.length;
      } else if (mode === "title") {
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        A.show("title"); box.textContent = "SMOKE OK title: fonts=" + (document.fonts ? document.fonts.size : "-") + " errs=" + errs.length;
      } else if (mode === "perf") {                       // frame cost: ms per drawAll in the pitch scene and the play scene
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        if (A.kbo) window.ClubUI.fresh(teamList()[0]);
        A.show("game"); $("autoOrder").onclick(); if (window.GameUI.pick.pitcher === null) document.querySelector("[data-p]").onclick(); $("start").onclick();
        const GU = window.GameUI; let p = null, tries = 0;
        while (tries++ < 12) { p = await GU.pickPitch(); if (p.batted && p.fielding) break }
        const T = p.flight.t[p.flight.t.length - 1];
        const time = (ts, scene) => { GU.setScene(scene); const a = performance.now(); ts.forEach(t => GU.drawAll(p, t)); return ((performance.now() - a) / ts.length).toFixed(1) };
        const pitchTs = Array.from({ length: 30 }, (_, i) => -1.5 + i * (T + 1.5) / 30);
        const tb = p.batted ? p.batted.flight.t[p.batted.flight.t.length - 1] : T + 2;
        const playTs = Array.from({ length: 30 }, (_, i) => T + 0.4 + i * (tb - T) / 30);
        const c1 = time(pitchTs, "pitch"), c2 = p.batted ? time(playTs, "play") : "-";
        GU.setScene("pitch"); GU.drawAll(p, 0.1);
        box.textContent = "SMOKE OK perf: pitch=" + c1 + "ms/frame play=" + c2 + "ms/frame batted=" + !!p.batted + " dpr=" + devicePixelRatio + " cam=" + $("cam").width + "x" + $("cam").height + " errs=" + errs.length;
      } else if (mode === "setup" || mode === "break") {   // setup: starter cards with stamina; break: inning-change screen with the next three batters
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        if (A.kbo) window.ClubUI.fresh(teamList()[1]);
        A.show("game"); $("autoOrder").onclick();
        if (mode === "setup") {
          const stam = [...document.querySelectorAll("[data-p] .stam")].map(e => e.textContent.trim());
          box.textContent = "SMOKE OK setup: pitchers=" + document.querySelectorAll("[data-p]").length + " stamina=" + stam.join("|") + " batters=" + document.querySelectorAll("[data-b]").length + " errs=" + errs.length;
        } else {
          if (window.GameUI.pick.pitcher === null) document.querySelector("[data-p]").onclick(); $("start").onclick();
          window.GameUI.setScene("break"); window.GameUI.renderBreak(false);
          box.textContent = "SMOKE OK break: nextUp=" + $("nextUp").textContent.trim() + " pages=" + document.querySelectorAll(".bpage").length + " errs=" + errs.length;
        }
      } else if (mode === "club") {
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        window.ClubUI.fresh(A.kbo ? teamList()[2] : undefined); for (let i = 0; i < 9; i++) window.ClubUI.simDay();
        A.show("roster");
        const S = window.ClubUI.state();
        const tb = $("training"); box.textContent = "SMOKE OK club: day=" + S.day + " record=" + S.W + "-" + S.L + " errs=" + errs.length + " | training box " + tb.clientHeight + "/" + tb.scrollHeight + " rows=" + tb.querySelectorAll("tr").length + " pager=" + !!tb.querySelector(".pager");
      } else {
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        if (A.kbo) window.ClubUI.fresh(teamList()[0]);
        A.show("game");
        $("autoOrder").onclick(); if (window.GameUI.pick.pitcher === null) document.querySelector("[data-p]").onclick(); $("start").onclick();
        const GU = window.GameUI, G = GU.state();
        const p = await GU.pickPitch(); const T = p.flight.t[p.flight.t.length - 1];
        [-1.2, 0.0, 0.40, T + 0.3].forEach(t => GU.drawAll(p, t));
        const h = id => { const e = $(id); if (!e) return "-"; if (e.hidden) return "H"; const r = e.getBoundingClientRect(); return Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "x" + Math.round(r.height) };
        box.textContent = "SMOKE OK game: half=" + G.half + " pitcher=" + G.pitcher + " pitch=" + p.result + " swing=" + p.swing + " view=" + (A.viewSel || "all") + " bundled=" + !!A.bundled + " errs=" + errs.length + " | main=" + document.querySelector("main").clientHeight + " screen=" + h("screen-game") + " setup=" + h("setup") + " game=" + h("game") + " pitch=" + h("scenePitch") + " cam=" + h("cam");
      }
    } catch (e) { box.style.background = "#900"; box.textContent = "SMOKE ERR: " + e.message + "\n" + (e.stack || "").slice(0, 400) }
    document.title = box.textContent.slice(0, 40);
  }
  /* button press feedback: ripple at the touch point, spring-back pop on release, a light haptic tap on touch devices */
  document.addEventListener("pointerdown", e => {
    const b = e.target.closest && e.target.closest("button"); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.1, sp = document.createElement("span"); sp.className = "ripple";
    sp.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px"; b.appendChild(sp); setTimeout(() => sp.remove(), 600);
    if (e.pointerType === "touch" && navigator.vibrate) { try { navigator.vibrate(6) } catch (_) {} }
  }, { passive: true });
  document.addEventListener("pointerup", e => { const b = e.target.closest && e.target.closest("button"); if (!b || b.disabled) return; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); b.addEventListener("animationend", () => b.classList.remove("pop"), { once: true }) }, { passive: true });
  document.addEventListener("DOMContentLoaded", boot);
})();
