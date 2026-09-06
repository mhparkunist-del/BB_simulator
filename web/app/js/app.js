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
  const SCREENS = ["schedule", "training", "roster", "stats", "game"];
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = A.base + src; s.onload = res; s.onerror = () => rej(new Error("script " + src)); document.head.appendChild(s) });
  }
  A.show = function (name) {
    if (!SCREENS.includes(name)) name = "schedule";
    document.querySelectorAll(".nav [data-screen]").forEach(b => b.classList.toggle("on", b.dataset.screen === name));
    $("screen-club").hidden = name === "game";
    $("screen-game").hidden = name !== "game";
    $("strip").hidden = name !== "game"; $("cstrip").hidden = name === "game";
    if (name !== "game" && window.ClubUI_tab) { window.ClubUI_tab(name); if (window.ClubUI && window.ClubUI.state && window.ClubUI.state()) window.ClubUI.render() }
    if (name === "game") {
      if (window.ClubUI && window.ClubUI.lineupForGame) A.clubLineup = window.ClubUI.lineupForGame();
      if (window.GameUI && !(window.GameUI.state && window.GameUI.state())) { window.GameUI.roster(); }
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}) } catch (e) {}
    } else { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock() } catch (e) {} }
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  };
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
    const smokeMode = window.SMOKE || q.get("smoke");
    if (smokeMode && !A.bundled && !q.get("nohold")) { const im = new Image(); im.src = A.base + "hold?ms=6000"; im.style.cssText = "position:fixed;width:1px;height:1px;opacity:0"; document.body.appendChild(im) }   // keeps the load event (and the screenshot) waiting
    try {
      status.textContent = "데이터 불러오는 중…";
      A.roster = await A.fetchJSON("data/roster.json");
      A.club = await A.fetchJSON("data/club.json");
      status.textContent = "렌더러 불러오는 중…";
      if (!A.bundled) for (const f of ["js/render/math.js", "js/render/park.js", "js/render/person.js", "js/render/pitcher.js", "js/render/figures.js", "js/render/play.js", "js/render/seam.js", "js/game/game.js", "js/club/club.js"]) await loadScript(f);
      else if (A.bundledInit) A.bundledInit();
      status.hidden = true;
      document.querySelectorAll(".nav [data-screen]").forEach(b => b.onclick = () => A.show(b.dataset.screen));
      document.querySelectorAll(".viewsel button").forEach(b => b.onclick = () => viewSel(b.dataset.view));
      window.addEventListener("resize", applyLayout);
      applyLayout(); wireGameExtras();
      A.show((location.hash || "#schedule").slice(1));
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
  async function smoke(mode) {                    // headless check: drive a flow, report at the top of the page
    const box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99;background:rgba(0,102,51,.9);color:#fff;padding:2px 6px;font:12px monospace;white-space:pre-wrap";
    document.body.appendChild(box);
    const errs = []; window.addEventListener("error", e => errs.push(e.message));
    try {
      if (mode === "club") {
        await new Promise(r => { const t = setInterval(() => { if (window.ClubUI && window.ClubUI.state()) { clearInterval(t); r() } }, 50) });
        window.ClubUI.fresh(); for (let i = 0; i < 9; i++) window.ClubUI.advanceDay();
        A.show("training");
        const S = window.ClubUI.state();
        const tb = $("training"); box.textContent = "SMOKE OK club: day=" + S.day + " record=" + S.W + "-" + S.L + " errs=" + errs.length + " | training box " + tb.clientHeight + "/" + tb.scrollHeight + " rows=" + tb.querySelectorAll("tr").length + " pager=" + !!tb.querySelector(".pager");
      } else {
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
  document.addEventListener("DOMContentLoaded", boot);
})();
