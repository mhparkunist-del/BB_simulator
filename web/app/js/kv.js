/* bbsim app · tiny key-value store: IndexedDB with a localStorage fallback */
window.APP = window.APP || {};
window.APP.kv = (function () {
  const DB = "bbsim", STORE = "kv";
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function get(k) {
    try {
      const db = await open();
      return await new Promise((res, rej) => { const t = db.transaction(STORE, "readonly").objectStore(STORE).get(k); t.onsuccess = () => res(t.result === undefined ? null : t.result); t.onerror = () => rej(t.error) });
    } catch (e) { try { const s = localStorage.getItem("bbsim:" + k); return s ? JSON.parse(s) : null } catch (e2) { return null } }
  }
  async function set(k, v) {
    const plain = JSON.parse(JSON.stringify(v));
    try {
      const db = await open();
      return await new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite").objectStore(STORE).put(plain, k); t.onsuccess = () => res(true); t.onerror = () => rej(t.error) });
    } catch (e) { try { localStorage.setItem("bbsim:" + k, JSON.stringify(plain)); return true } catch (e2) { return false } }
  }
  async function del(k) {
    try { const db = await open(); return await new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite").objectStore(STORE).delete(k); t.onsuccess = () => res(true); t.onerror = () => rej(t.error) }) }
    catch (e) { try { localStorage.removeItem("bbsim:" + k) } catch (e2) {} return true }
  }
  return { get, set, del };
})();
