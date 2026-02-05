// FILE: italky-web/js/langpool.js
import { LANGPOOL_BASE } from "/js/config.js";

// Pool cache key (opsiyonel) – CDN zaten hızlı ama yine de dursun
const CACHE_KEY = (l) => `italky_lang_${l}_v1`;

// normalize: "used" anahtarı için
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, "");

// JSON parse güvenliği
function safeJsonParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function emptyPool(lang) {
  return { lang: String(lang || ""), version: 1, items: [] };
}

export async function loadLangPool(lang) {
  const L = String(lang || "").trim().toLowerCase();
  if (!L) return emptyPool("");

  // 1) localStorage cache (isteğe bağlı hızlandırma)
  // Not: Supabase dosyaları zamanla büyüyor; bu yüzden cache’i "kırılabilir" tutuyoruz.
  // Eğer her zaman en güncel istersen bu bloğu tamamen kaldırabilirsin.
  try {
    const raw = localStorage.getItem(CACHE_KEY(L));
    if (raw) {
      const parsed = safeJsonParse(raw, null);
      if (parsed) return sanitize(parsed);
    }
  } catch {}

  // 2) Supabase public URL
  const url = `${LANGPOOL_BASE}/${encodeURIComponent(L)}.json`;

  let data = null;
  try {
    // ✅ no-store: güncellemeler hemen gelsin
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return emptyPool(L);
    data = await r.json();
  } catch {
    return emptyPool(L);
  }

  // 3) cache yaz (opsiyonel)
  try {
    localStorage.setItem(CACHE_KEY(L), JSON.stringify(data));
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

    // opsiyonel: örnek cümle alanı
    const sentence = String(it?.sentence || it?.ex || "").trim();

    out.push({
      w,
      tr,
      pos: String(it?.pos || "").trim(),  // noun/verb/adj/adv
      lvl: String(it?.lvl || "").trim(),  // A1/A2/B1/B2/C1
      sentence
    });
  }

  return { lang: String(data?.lang || ""), version: data?.version || 1, items: out };
}

export function createUsedSet(storageKey) {
  let used = new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    const arr = safeJsonParse(raw, []);
    if (Array.isArray(arr)) used = new Set(arr);
  } catch {}

  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify([...used])); } catch {}
  };

  return { used, save, norm };
}

/**
 * pick:
 * - pool.items içinden count kadar seçer
 * - usedSet ile tekrarları engeller
 * - aday azsa usedSet clear (yeni tur)
 */
export function pick(pool, count, usedSet, saveUsed, filterFn) {
  const items = Array.isArray(pool?.items) ? pool.items : [];
  if (!items.length) return [];

  const candidates = items.filter(
    (x) => x?.w && !usedSet.has(norm(x.w)) && (!filterFn || filterFn(x))
  );

  if (candidates.length < count) usedSet.clear();

  const fresh = items.filter(
    (x) => x?.w && !usedSet.has(norm(x.w)) && (!filterFn || filterFn(x))
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
