// FILE: /js/hangman_page.js
import { mountShell, hydrateFromCache } from "/js/ui_shell.js";

const $ = (id) => document.getElementById(id);

/* ---------------------------
   CONFIG
--------------------------- */
const MAX_LIVES = 9;
const MAX_JOKERS = 2;

const DIFF_TO_MISTAKE_LIMIT = {
  3: 6, // EASY
  4: 4, // NORMAL
  5: 2, // HARD
};

const TTS_LANG_MAP = { en:"en-US", de:"de-DE", fr:"fr-FR", it:"it-IT", es:"es-ES" };

/* ---------------------------
   LangPool fetch
   config.js içinden LANGPOOL_BASE okunur
--------------------------- */
async function readLangpoolBase(){
  if (globalThis.LANGPOOL_BASE) return String(globalThis.LANGPOOL_BASE);
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

/* ---------------------------
   Sound (mini beep)
--------------------------- */
const AC = (globalThis.AudioContext || globalThis.webkitAudioContext)
  ? new (globalThis.AudioContext || globalThis.webkitAudioContext)()
  : null;

function beep(freq=880, ms=110, type="sine", vol=0.04){
  try{
    if(!AC) return;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(AC.destination);
    o.start();
    setTimeout(()=>{ try{o.stop()}catch{} }, ms);
  }catch{}
}

/* ---------------------------
   TTS
--------------------------- */
function speakText(text, langCode){
  const t = String(text||"").trim();
  if(!t) return;

  // APK
  if (globalThis.NativeTTS && typeof globalThis.NativeTTS.speak === "function") {
    try{ globalThis.NativeTTS.stop?.(); }catch{}
    setTimeout(()=>{ try{ globalThis.NativeTTS.speak(t, String(langCode||"en")); }catch{} }, 180);
    return;
  }

  // Web
  if(!("speechSynthesis" in globalThis)) return;
  try{
    const u = new SpeechSynthesisUtterance(t);
    u.lang = TTS_LANG_MAP[langCode] || "en-US";
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(u);
  }catch{}
}

/* ---------------------------
   Game State
--------------------------- */
let LANGPOOL_BASE = "";
let pool = null;
let target = null;

let lang = "en";
let diff = 3;

let lives = 3;
let guessed = new Set();
let mistakes = 0;

let jokersLeft = MAX_JOKERS;
let flawless = true;
let jokerUsed = false;
let lock = false;

// Scoring
let roundScore = 100; // internal only
let runScore = 0;     // ✅ ekranda görünen tek skor

// Best per (lang+diff)
function bestKey(lang, diff){ return `italky_hangman_best_${lang}_${diff}`; }
function usedKey(lang){ return `used_hangman_${lang}`; }

let bestGame = 0;

function getMistakeLimit(){
  return DIFF_TO_MISTAKE_LIMIT[diff] ?? 6;
}

function paintScores(){
  $("scoreVal").textContent = String(runScore);
  $("bestVal").textContent = String(bestGame);
}

/* ---------------------------
   UI
--------------------------- */
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
  const m = mistakes;

  const seq = ["p_head","p_body","p_larm","p_rarm","p_lleg","p_rleg"];
  const limit = getMistakeLimit();
  const showCount = Math.min(limit, 6);

  seq.slice(0, Math.min(m, showCount)).forEach(id => $(id).classList.add("on"));
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
    btn.addEventListener("click", ()=> press(btn.dataset.k, btn));
  });
}

function showModal(title, color, bonusText){
  $("mTitle").textContent = title;
  $("mTitle").style.color = color;
  $("mWord").textContent = target.w.toUpperCase();
  $("mTr").textContent = `(${target.tr || "—"})`;
  $("mBonus").textContent = bonusText || "";
  $("modal").classList.add("on");
}

function startNewGameScores(){
  runScore = 0;
  roundScore = 100;
  paintScores();
}

function startNewRoundScores(){
  roundScore = 100;
}

function applyPenalty(n){
  roundScore = Math.max(0, roundScore - n);
}

/* ---------------------------
   Core
--------------------------- */
function endGame(){
  // ✅ rekor: bu (lang+diff) için en yüksek runScore
  if(runScore > bestGame){
    bestGame = runScore;
    try{ localStorage.setItem(bestKey(lang, diff), String(bestGame)); }catch{}
  }
  paintScores();
}

function endRound(win){
  lock = true;

  // kelimeyi her zaman seslendir
  speakText(target.w, lang);

  if(win){
    // ✅ doğru: roundScore toplam skora eklenir
    runScore += roundScore;

    // sfx
    beep(880, 90, "sine", 0.05);
    beep(1320, 90, "sine", 0.04);

    // bonus can (kural aynı)
    let bonus = `TOPLAM SKOR: ${runScore}`;
    if(flawless && !jokerUsed && lives < MAX_LIVES){
      lives++;
      bonus += `\nKUSURSUZ: +1 CAN`;
    }

    renderHearts();
    // yeni round için roundScore tazelenir (ama ekranda görünmüyor)
    startNewRoundScores();

    showModal("MİSYON BAŞARILI", "#00ff9d", bonus);
    return;
  }

  // yanlış kelime -> 1 can gider
  lives--;
  renderHearts();

  $("man").classList.add("swing");
  beep(180, 140, "square", 0.04);

  setTimeout(()=>{
    $("man").classList.remove("swing");

    if(lives <= 0){
      endGame();
      showModal("GAME OVER", "#ff0033", `TOPLAM SKOR: ${runScore}\nREKOR: ${bestGame}`);
    }else{
      showModal("DEŞİFRE EDİLEMEDİ", "#ff0033", "-1 CAN");
    }
  }, 2400);
}

function press(letter, btn){
  if(lock) return;
  if(guessed.has(letter)) return;

  const w = target.w.toUpperCase();

  if(w.includes(letter)){
    guessed.add(letter);
    btn.classList.add("hit");
    beep(740, 70, "sine", 0.03);

    renderWord();

    if(w.split("").every(ch => guessed.has(ch))){
      endRound(true);
    }
  }else{
    btn.classList.add("miss");
    beep(220, 90, "square", 0.03);

    flawless = false;
    mistakes++;
    applyPenalty(10);
    updateMan();

    if(mistakes >= getMistakeLimit()){
      endRound(false);
    }
  }
}

function useJ(idx){
  if(lock) return;
  if(jokersLeft <= 0) return;

  jokerUsed = true;
  jokersLeft--;
  (idx===0 ? $("j0") : $("j1")).classList.add("spent");

  applyPenalty(10);

  const w = target.w.toUpperCase();
  const rem = w.split("").filter(ch => !guessed.has(ch));
  if(rem.length){
    const l = rem[0];
    const btn = $("kb").querySelector(`.key[data-k="${l}"]`);
    if(btn) press(l, btn);
    else { guessed.add(l); renderWord(); }
  }
}

async function newRound(){
  lock = false;

  guessed = new Set();
  mistakes = 0;
  jokersLeft = MAX_JOKERS;
  flawless = true;
  jokerUsed = false;

  $("j0").classList.remove("spent");
  $("j1").classList.remove("spent");

  resetMan();

  const usedSet = createUsedSet(usedKey(lang));
  const picked = pick(pool, 1, usedSet.used, usedSet.save, (x)=> (x?.w||"").length >= 3);
  target = picked?.[0] || null;

  if(!target?.w){
    $("trText").textContent = "KELİME BULUNAMADI";
    $("matrix").innerHTML = "";
    $("kb").innerHTML = "";
    return;
  }

  $("trText").textContent = (target.tr || "—").trim() || "—";

  startNewRoundScores();
  renderHearts();
  renderWord();
  renderKeyboard();
  updateMan();
}

/* ---------------------------
   Setup interactions
--------------------------- */
$("langGrid")?.addEventListener("click", (e)=>{
  const c = e.target.closest(".pickCard");
  if(!c || !c.dataset.lang) return;

  [...$("langGrid").querySelectorAll(".pickCard")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");

  lang = c.dataset.lang;
});

$("diffGrid")?.addEventListener("click", (e)=>{
  const c = e.target.closest(".pickCard.diff");
  if(!c) return;

  [...$("diffGrid").querySelectorAll(".pickCard.diff")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");

  diff = parseInt(c.dataset.diff, 10);
});

$("j0")?.addEventListener("click", ()=>useJ(0));
$("j1")?.addEventListener("click", ()=>useJ(1));

$("mBtn")?.addEventListener("click", async ()=>{
  $("modal").classList.remove("on");

  if(lives <= 0){
    // yeni oyun
    $("setup").style.display = "flex";
    $("setupMsg").textContent = "";
    return;
  }

  await newRound();
});

/* ---------------------------
   Start button
--------------------------- */
$("startBtn")?.addEventListener("click", async ()=>{
  $("setupMsg").textContent = "Yükleniyor…";

  // ✅ Shell
  try{
    mountShell({ scroll:"none" });
    hydrateFromCache?.();
  }catch{}

  // ✅ Footer lift => dock shell altına girmesin
  try{
    const root = getComputedStyle(document.documentElement);
    const footerH = parseFloat(root.getPropertyValue("--footerH")) || 0;
    document.documentElement.style.setProperty("--shellLift", footerH ? `${footerH + 10}px` : "0px");
  }catch{}

  // ✅ Pool
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

  // ✅ Rekor: lang+diff bazlı
  bestGame = parseInt(localStorage.getItem(bestKey(lang, diff)) || "0", 10);

  // ✅ Yeni oyun
  lives = 3;
  renderHearts();
  startNewGameScores();
  paintScores();

  $("setup").style.display = "none";
  $("setupMsg").textContent = "";

  await newRound();
});

/* initial */
(() => {
  // UI default
  lives = 3;
  renderHearts();
  bestGame = parseInt(localStorage.getItem(bestKey(lang, diff)) || "0", 10);
  paintScores();
})();
