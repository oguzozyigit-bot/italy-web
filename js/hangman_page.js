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

// ---- LangPool base from config.js ----
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

// ---- SCORE RULES ----
let LANGPOOL_BASE = "";
let pool = null;
let target = null;

let lang = "en";
let diff = 3;

let lives = 3;
const MAX_LIVES = 9;

let totalScore = 0;     // biriken
let roundScore = 100;   // kelime puanı
let guessed = new Set();
let mistakes = 0;

const MAX_JOKERS = 2;

let flawless = true;
let jokerUsed = false;
let lock = false;

/* =========================
   ✅ USER-BASED BEST SCORE (Supabase + local fallback)
   - key: `${lang}::${diff}`
   - storage: profiles.hangman_best (jsonb)
========================= */
let USER_ID = "anon";
let BEST_CACHE = null; // number|null

async function ensureUserId(){
  if(USER_ID && USER_ID !== "anon") return USER_ID;
  try{
    const { data:{ session } } = await supabase.auth.getSession();
    USER_ID = session?.user?.id || "anon";
  }catch{
    USER_ID = "anon";
  }
  return USER_ID;
}
function bestLocalKey(){
  return `italky_hangman_best::${lang}::${diff}::${USER_ID || "anon"}`;
}
function bestMapKey(){
  return `${lang}::${diff}`;
}

async function getBest(){
  if(BEST_CACHE != null) return BEST_CACHE;
  await ensureUserId();

  // 1) Supabase read best-effort
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
  }catch{
    // ignore
  }

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
  BEST_CACHE = nv;

  // local always
  try{ localStorage.setItem(bestLocalKey(), String(nv)); }catch{}

  // Supabase best-effort (kolon/policy yoksa sessizce local devam)
  try{
    const { data, error } = await supabase
      .from("profiles")
      .select("hangman_best")
      .eq("id", USER_ID)
      .maybeSingle();

    if(error){
      return;
    }

    const cur = (data?.hangman_best && typeof data.hangman_best === "object") ? { ...data.hangman_best } : {};
    const key = bestMapKey();
    const old = Number(cur[key] ?? 0);
    if(nv <= old) return;

    cur[key] = nv;

    await supabase
      .from("profiles")
      .update({ hangman_best: cur })
      .eq("id", USER_ID);
  }catch{
    // ignore
  }
}

/* ========================= */

async function paint(){
  const b = await getBest();
  $("bestVal").textContent = String(b);
  $("scoreVal").textContent = String(totalScore);
  $("roundVal").textContent = String(roundScore);
}

function getMistakeLimit(){
  // easy(3)=6, normal(4)=4, hard(5)=2
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

$("mBtn").onclick = () => {
  $("modal").classList.remove("on");

  if(lives <= 0){
    location.reload();
    return;
  }
  newRound();
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

    showModal("MİSYON BAŞARILI", "#00ff9d", bonus);
    return;
  }

  lives--;
  renderHearts();
  $("man").classList.add("swing");

  const swingMs = 2200;
  setTimeout(async ()=>{
    $("man").classList.remove("swing");
    if(lives <= 0){
      const b = await getBest();
      showModal("GAME OVER", "#ff0033", `TOPLAM SKOR: ${totalScore}\nEN YÜKSEK: ${b}`);
    }else{
      showModal("DEŞİFRE EDİLEMEDİ", "#ff0033", "-1 CAN");
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
    paint(); // async içerde best yok; hızlı güncelleme
    if(mistakes >= getMistakeLimit()) endRound(false);
  }
}

function useJ(i){
  if(lock) return;
  if(MAX_JOKERS <= 0) return;

  jokerUsed = true;

  const el = (i===0) ? $("j0") : $("j1");
  if(el.classList.contains("spent")) return;

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
  paint();
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

  // BEST cache reset when lang/diff changes
  BEST_CACHE = null;
  await ensureUserId();

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

// ---- Setup seçimleri ----
$("langGrid").addEventListener("click", (e)=>{
  const c=e.target.closest(".pickCard");
  if(!c || !c.dataset.lang) return;
  [...$("langGrid").querySelectorAll(".pickCard")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");
  lang = c.dataset.lang;

  // ✅ best cache reset for this scope
  BEST_CACHE = null;
  paint();
});

$("diffGrid").addEventListener("click", (e)=>{
  const c=e.target.closest(".pickCard.diff");
  if(!c) return;
  [...$("diffGrid").querySelectorAll(".pickCard.diff")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");
  diff = parseInt(c.dataset.diff,10);

  BEST_CACHE = null;
  paint();
});

// ---- Start ----
$("startBtn").addEventListener("click", async ()=>{
  $("setupMsg").textContent = "Yükleniyor…";

  try{
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

  lives = 3;
  totalScore = 0;
  renderHearts();

  $("setup").style.display = "none";
  $("setupMsg").textContent = "";

  await newRound();
});

// initial render
renderHearts();
paint();
