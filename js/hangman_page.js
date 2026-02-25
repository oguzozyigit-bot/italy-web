// FILE: /js/hangman_page.js
import { mountShell } from "/js/ui_shell.js";
import { supabase } from "/js/supabase_client.js";

const $ = (id) => document.getElementById(id);

// ---- UI SHELL ----
mountShell({ scroll:"none" });

// footer lift (dock alt bara girmesin)
try{
  const root = getComputedStyle(document.documentElement);
  const footerH = parseFloat(root.getPropertyValue("--footerH")) || 0;
  document.documentElement.style.setProperty("--shellLift", footerH ? `${footerH + 10}px` : "0px");
}catch{}

/* ===============================
   SETTINGS (persist)
================================ */
const LS_LANG = "italky_hangman_lang";
const LS_DIFF = "italky_hangman_diff";

/* ===============================
   Langpool base
================================ */
async function readLangpoolBase(){
  if(window.LANGPOOL_BASE) return String(window.LANGPOOL_BASE);
  const r = await fetch("/js/config.js", { cache:"no-store" });
  const t = await r.text();
  const m = t.match(/LANGPOOL_BASE\s*=\s*["']([^"']+)["']/);
  return (m && m[1]) ? m[1] : "";
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, "");

function sanitize(data){
  const items = Array.isArray(data?.items) ? data.items : [];
  const seen = new Set();
  const out = [];
  for(const it of items){
    const w = String(it?.w || "").trim();
    const tr = String(it?.tr || "").trim();
    if(!w || !tr) continue;
    const k = norm(w);
    if(seen.has(k)) continue;
    seen.add(k);
    out.push({ w, tr });
  }
  return { lang: String(data?.lang||""), version: data?.version||1, items: out };
}

async function loadLangPoolDirect(lang, base){
  const L = String(lang||"").trim().toLowerCase();
  const url = `${base}/${encodeURIComponent(L)}.json`;
  const r = await fetch(url, { cache:"no-store" });
  if(!r.ok) return { lang:L, version:1, items:[] };
  return sanitize(await r.json());
}

function createUsedSet(storageKey){
  let used = new Set();
  try{
    const raw = localStorage.getItem(storageKey);
    const arr = JSON.parse(raw || "[]");
    if(Array.isArray(arr)) used = new Set(arr);
  }catch{}
  const save = () => { try{ localStorage.setItem(storageKey, JSON.stringify([...used])); }catch{} };
  return { used, save };
}

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function pick(pool, count, usedSet, saveUsed, filterFn){
  const items = Array.isArray(pool?.items)? pool.items : [];
  if(!items.length) return [];
  const candidates = items.filter(x => x?.w && !usedSet.has(norm(x.w)) && (!filterFn || filterFn(x)));
  if(candidates.length < count) usedSet.clear();
  const fresh = items.filter(x => x?.w && !usedSet.has(norm(x.w)) && (!filterFn || filterFn(x)));
  const chosen = shuffle(fresh).slice(0,count);
  chosen.forEach(x=>usedSet.add(norm(x.w)));
  if(saveUsed) saveUsed();
  return chosen;
}

/* ===============================
   GAME STATE
================================ */
let LANGPOOL_BASE = "";
let pool = null;
let target = null;

let lang = "en";
let diff = 3;

let lives = 3;
const MAX_LIVES = 9;

let totalScore = 0;
let roundScore = 100;
let guessed = new Set();
let mistakes = 0;

const MAX_JOKERS = 2;

let flawless = true;
let jokerUsed = false;
let lock = false;

/* ===============================
   ✅ USER-BASED BEST SCORE
   - Supabase: profiles.hangman_best jsonb
   - key: `${lang}::${diff}`
   - local fallback always
================================ */
let USER_ID = "anon";
let BEST_CACHE = null;

async function ensureUserId(){
  // ✅ en başta kilitle (anon->user geçişi rekoru “sıfırlar” hissini bitirir)
  if(USER_ID && USER_ID !== "anon") return USER_ID;
  try{
    const { data:{ session } } = await supabase.auth.getSession();
    USER_ID = session?.user?.id || "anon";
  }catch{
    USER_ID = "anon";
  }
  return USER_ID;
}

function bestMapKey(){ return `${lang}::${diff}`; }
function bestLocalKey(){ return `italky_hangman_best::${bestMapKey()}::${USER_ID}`; }

async function getBest(){
  if(BEST_CACHE != null) return BEST_CACHE;
  await ensureUserId();

  // 1) Supabase
  try{
    const { data, error } = await supabase
      .from("profiles")
      .select("hangman_best")
      .eq("id", USER_ID)
      .maybeSingle();

    if(!error && data?.hangman_best && typeof data.hangman_best === "object"){
      const v = Number(data.hangman_best[bestMapKey()] ?? 0);
      BEST_CACHE = Number.isFinite(v) ? v : 0;
      try{ localStorage.setItem(bestLocalKey(), String(BEST_CACHE)); }catch{}
      return BEST_CACHE;
    }
  }catch{}

  // 2) local fallback
  try{
    const v = parseInt(localStorage.getItem(bestLocalKey()) || "0", 10);
    BEST_CACHE = Number.isFinite(v) ? v : 0;
  }catch{
    BEST_CACHE = 0;
  }
  return BEST_CACHE;
}

async function setBest(newVal){
  await ensureUserId();
  const nv = Math.max(0, Number(newVal)||0);

  // local always
  BEST_CACHE = nv;
  try{ localStorage.setItem(bestLocalKey(), String(nv)); }catch{}

  // supabase best-effort
  try{
    const { data, error } = await supabase
      .from("profiles")
      .select("hangman_best")
      .eq("id", USER_ID)
      .maybeSingle();

    if(error) return;

    const cur = (data?.hangman_best && typeof data.hangman_best === "object") ? { ...data.hangman_best } : {};
    const key = bestMapKey();
    const old = Number(cur[key] ?? 0);
    if(nv <= old) return;

    cur[key] = nv;

    await supabase
      .from("profiles")
      .update({ hangman_best: cur })
      .eq("id", USER_ID);
  }catch{}
}

/* ===============================
   UI
================================ */
async function paint(){
  const b = await getBest();
  $("bestVal").textContent = String(b);
  $("scoreVal").textContent = String(totalScore);
  $("roundVal").textContent = String(roundScore);
}

function getMistakeLimit(){
  if(diff===3) return 6;
  if(diff===4) return 4;
  return 2;
}

function renderHearts(){
  const capped = Math.max(0, Math.min(lives, MAX_LIVES));
  let html = "";
  for(let i=0;i<capped;i++) html += `<span class="heart">❤️</span>`;
  $("hearts").innerHTML = html;
}

function resetMan(){
  ["p_head","p_body","p_larm","p_rarm","p_lleg","p_rleg"].forEach(id => $(id).classList.remove("on"));
  $("man").classList.remove("swing");
}

function updateMan(){
  resetMan();
  const seq = ["p_head","p_body","p_larm","p_rarm","p_lleg","p_rleg"];
  const limit = getMistakeLimit();
  const showCount = Math.min(limit, 6);
  seq.slice(0, Math.min(mistakes, showCount)).forEach(id => $(id).classList.add("on"));
}

function renderWord(){
  const w = target.w.toUpperCase();
  $("matrix").innerHTML = w.split("").map(ch=>{
    const found = guessed.has(ch);
    return `<div class="slot ${found ? "found":""}">${found ? ch : ""}</div>`;
  }).join("");
}

function renderKeyboard(){
  const w = target.w.toUpperCase();
  const uniq = [...new Set(w.split(""))];
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const fillers = abc.filter(l => !uniq.includes(l)).sort(()=>0.5-Math.random()).slice(0,10);
  const keys = [...uniq, ...fillers].sort(()=>0.5-Math.random());

  $("kb").innerHTML = keys.map(k=>`<button class="key" data-k="${k}">${k}</button>`).join("");
  $("kb").querySelectorAll(".key").forEach(btn=>{
    btn.onclick = () => press(btn.dataset.k, btn);
  });
}

function speakWord(text){
  try{
    const t = String(text||"").trim();
    if(!t) return;

    if(window.NativeTTS && typeof window.NativeTTS.speak === "function"){
      try{ window.NativeTTS.stop?.(); }catch{}
      setTimeout(()=>{ try{ window.NativeTTS.speak(t, lang); }catch{} }, 180);
      return;
    }

    if(!("speechSynthesis" in window)) return;
    const map = {en:"en-US",de:"de-DE",fr:"fr-FR",it:"it-IT",es:"es-ES"};
    const u = new SpeechSynthesisUtterance(t);
    u.lang = map[lang] || "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch{}
}

function showModal(title, color, bonus){
  $("mTitle").textContent = title;
  $("mTitle").style.color = color;
  $("mWord").textContent = target.w.toUpperCase();
  $("mTr").textContent = `(${target.tr || "—"})`;
  $("mBonus").textContent = bonus || "";
  $("modal").classList.add("on");
}

/* ===============================
   ✅ NEW: “DEVAM” = reset + yeni oyun
   - Skor 0
   - Can 3
   - Setup’a dönmez, sayfa yenilenmez
================================ */
async function resetAndStartNewGame(){
  lock = false;
  totalScore = 0;
  lives = 3;
  renderHearts();
  await paint();
  await newRound();
}

$("mBtn").onclick = async () => {
  $("modal").classList.remove("on");
  await resetAndStartNewGame();
};

function applyPenalty(){
  roundScore = Math.max(0, roundScore - 10);
}

async function endRound(win){
  lock = true;
  speakWord(target.w);

  if(win){
    totalScore += roundScore;

    let bonus = `+${roundScore} PUAN\nTOPLAM SKOR: ${totalScore}`;
    if(flawless && !jokerUsed && lives < MAX_LIVES){
      lives++;
      bonus += `\nKUSURSUZ: +1 CAN`;
    }

    const b = await getBest();
    if(totalScore > b) await setBest(totalScore);

    renderHearts();
    await paint();

    // modal göster (DEVAM = reset+new game)
    showModal("MİSYON BAŞARILI", "#00ff9d", bonus);
    return;
  }

  lives--;
  renderHearts();
  $("man").classList.add("swing");

  const swingMs = 2200;
  setTimeout(async ()=>{
    $("man").classList.remove("swing");
    const b = await getBest();
    if(lives <= 0){
      showModal("GAME OVER", "#ff0033", `TOPLAM SKOR: ${totalScore}\nEN YÜKSEK: ${b}`);
    }else{
      showModal("DEŞİFRE EDİLEMEDİ", "#ff0033", `-1 CAN\nEN YÜKSEK: ${b}`);
    }
  }, swingMs);
}

function press(letter, btn){
  if(lock) return;
  if(guessed.has(letter)) return;

  const w = target.w.toUpperCase();
  if(w.includes(letter)){
    guessed.add(letter);
    btn.classList.add("hit");
    renderWord();
    if(w.split("").every(ch => guessed.has(ch))) endRound(true);
  }else{
    btn.classList.add("miss");
    flawless = false;
    mistakes++;
    applyPenalty();
    updateMan();
    // hızlı paint (best okumadan)
    $("roundVal").textContent = String(roundScore);
    if(mistakes >= getMistakeLimit()) endRound(false);
  }
}

function useJ(i){
  if(lock) return;

  const el = (i===0) ? $("j0") : $("j1");
  if(el.classList.contains("spent")) return;

  jokerUsed = true;
  el.classList.add("spent");
  applyPenalty();

  const w = target.w.toUpperCase();
  const rem = w.split("").filter(ch => !guessed.has(ch));
  if(rem.length){
    const l = rem[0];
    const btn = $("kb").querySelector(`.key[data-k="${l}"]`);
    if(btn) press(l, btn);
    else { guessed.add(l); renderWord(); }
  }
  $("roundVal").textContent = String(roundScore);
}

$("j0").onclick = ()=>useJ(0);
$("j1").onclick = ()=>useJ(1);

async function newRound(){
  lock = false;
  guessed = new Set();
  mistakes = 0;

  $("j0").classList.remove("spent");
  $("j1").classList.remove("spent");

  flawless = true;
  jokerUsed = false;

  roundScore = 100;
  resetMan();

  // ✅ Best cache reset ONLY for current lang/diff (but best itself not deleted)
  BEST_CACHE = null;

  const usedSet = createUsedSet(`used_hangman_${lang}`);
  const pickedW = pick(pool, 1, usedSet.used, usedSet.save, (x)=> (x?.w||"").length >= 3);
  target = pickedW?.[0];

  if(!target?.w){
    $("trText").textContent = "KELİME BULUNAMADI";
    $("matrix").innerHTML = "";
    $("kb").innerHTML = "";
    await paint();
    return;
  }

  $("trText").textContent = (target.tr || "—").trim() || "—";

  renderHearts();
  renderWord();
  renderKeyboard();
  updateMan();
  await paint();
}

/* ===============================
   Setup + Auto-start
================================ */
function savePrefs(){
  try{ localStorage.setItem(LS_LANG, lang); }catch{}
  try{ localStorage.setItem(LS_DIFF, String(diff)); }catch{}
}
function loadPrefs(){
  try{
    const l = String(localStorage.getItem(LS_LANG)||"").trim().toLowerCase();
    if(l) lang = l;
  }catch{}
  try{
    const d = parseInt(localStorage.getItem(LS_DIFF)||"", 10);
    if(d===3 || d===4 || d===5) diff = d;
  }catch{}
}

function markSetupUI(){
  // lang
  [...$("langGrid").querySelectorAll(".pickCard")].forEach(x=>x.classList.remove("active"));
  const lc = $("langGrid").querySelector(`.pickCard[data-lang="${lang}"]`);
  lc?.classList.add("active");

  // diff
  [...$("diffGrid").querySelectorAll(".pickCard.diff")].forEach(x=>x.classList.remove("active"));
  const dc = $("diffGrid").querySelector(`.pickCard.diff[data-diff="${diff}"]`);
  dc?.classList.add("active");
}

// setup seçimleri
$("langGrid").addEventListener("click", (e)=>{
  const c=e.target.closest(".pickCard");
  if(!c || !c.dataset.lang) return;
  [...$("langGrid").querySelectorAll(".pickCard")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");
  lang = c.dataset.lang;
  savePrefs();
  BEST_CACHE = null;
  paint();
});

$("diffGrid").addEventListener("click", (e)=>{
  const c=e.target.closest(".pickCard.diff");
  if(!c) return;
  [...$("diffGrid").querySelectorAll(".pickCard.diff")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");
  diff = parseInt(c.dataset.diff,10);
  savePrefs();
  BEST_CACHE = null;
  paint();
});

// Start
$("startBtn").addEventListener("click", async ()=>{
  $("setupMsg").textContent = "Yükleniyor…";

  try{
    await ensureUserId(); // ✅ USER_ID kilit
    LANGPOOL_BASE = await readLangpoolBase();
    if(!LANGPOOL_BASE){
      $("setupMsg").textContent = "LANGPOOL_BASE bulunamadı (/js/config.js).";
      return;
    }

    pool = await loadLangPoolDirect(lang, LANGPOOL_BASE);
    if(!pool?.items?.length){
      $("setupMsg").textContent = `Havuz boş: ${LANGPOOL_BASE}/${lang}.json`;
      return;
    }
  }catch(err){
    $("setupMsg").textContent = "Havuz yükleme hatası:\n" + String(err);
    return;
  }

  $("setup").style.display = "none";
  $("setupMsg").textContent = "";

  await resetAndStartNewGame();
});

// ✅ Setup’a geri dönmek için: HANGMAN yazısına çift tık
let lastTap = 0;
document.querySelector(".title")?.addEventListener("click", ()=>{
  const now = Date.now();
  if(now - lastTap < 400){
    $("setup").style.display = "flex";
    $("setupMsg").textContent = "";
    markSetupUI();
  }
  lastTap = now;
});

/* ===============================
   BOOT
================================ */
(async function boot(){
  await ensureUserId();

  loadPrefs();
  markSetupUI();

  // Auto-start: dil/diff daha önce seçildiyse setup göstermeden başlat
  // (pool yüklemesi hızlı değilse setup üzerinde “yükleniyor” göstereceğiz)
  const hasPref = !!localStorage.getItem(LS_LANG) && !!localStorage.getItem(LS_DIFF);
  if(hasPref){
    $("setupMsg").textContent = "Yükleniyor…";
    try{
      LANGPOOL_BASE = await readLangpoolBase();
      pool = await loadLangPoolDirect(lang, LANGPOOL_BASE);
      if(pool?.items?.length){
        $("setup").style.display = "none";
        await resetAndStartNewGame();
        return;
      }
    }catch{}
    // fallback: setup açık kalsın
    $("setupMsg").textContent = "Dil/Zorluk seçip başlat.";
  }else{
    $("setupMsg").textContent = "Dil ve zorluk seçip başlat.";
  }

  renderHearts();
  await paint();
})();
