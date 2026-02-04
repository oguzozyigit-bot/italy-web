// /js/langpool.js
const CACHE_KEY = (l) => `italky_lang_${l}_v1`;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, "");

export async function loadLangPool(lang) {
  // localStorage cache
  try {
    const raw = localStorage.getItem(CACHE_KEY(lang));
    if (raw) return sanitize(JSON.parse(raw));
  } catch {}

  // file fetch (offline cache varsa çalışır)
  const r = await fetch(`/assets/lang/${lang}.json`, { cache: "force-cache" });
  const data = await r.json();

  try {
    localStorage.setItem(CACHE_KEY(lang), JSON.stringify(data));
  } catch {}

  return sanitize(data);
}

function sanitize(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const w = String(it?.w || "").trim();
    const tr = String(it?.tr || "").trim();
    if (!w || !tr) continue;
    const k = norm(w);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      w,
      tr,
      pos: String(it?.pos || "").trim(),
      lvl: String(it?.lvl || "").trim()
    });
  }
  return { lang: data?.lang || "", version: data?.version || 1, items: out };
}

export function createUsedSet(storageKey) {
  // oyun başına ayrı used anahtarı: örn "used_duobattle_en"
  let used = new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) used = new Set(JSON.parse(raw));
  } catch {}
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify([...used])); } catch {}
  };
  return { used, save, norm };
}

export function pick(pool, count, usedSet, saveUsed, filterFn) {
  const candidates = pool.items.filter(
    (x) => !usedSet.has(norm(x.w)) && (!filterFn || filterFn(x))
  );

  if (candidates.length < count) usedSet.clear();

  const fresh = pool.items.filter(
    (x) => !usedSet.has(norm(x.w)) && (!filterFn || filterFn(x))
  );

  const chosen = shuffle(fresh).slice(0, count);
  chosen.forEach((x) => usedSet.add(norm(x.w)));
  if (saveUsed) saveUsed();
  return chosen;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
