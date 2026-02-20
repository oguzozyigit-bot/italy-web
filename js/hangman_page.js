// FILE: /js/hangman_page.js
import { mountShell } from "/js/ui_shell.js";

const $ = (id) => document.getElementById(id);

/* =========================
   CONFIG
========================= */
const MAX_LIVES = 9;
const START_LIVES = 3;
const WORD_START_SCORE = 100;
const PENALTY = 10;
const MAX_JOKERS = 2;

// Rekor: cihazda kalıcı (dil+zorluk bazlı ayrı)
const BEST_PREFIX = "italky_hangman_best_v2"; // best_{lang}_{diff}

// Kelime havuzu: LANGPOOL_BASE + /{lang}.json (senin mevcut sistemin)
let LANGPOOL_BASE = "";

/* =========================
   HELPERS
========================= */
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, "");

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

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

async function readLangpoolBase(){
  if(window.LANGPOOL_BASE) return String(window.LANGPOOL_BASE);
  const r = await fetch("/js/config.js", { cache:"no-store" });
  const t = await r.text();
  const m = t.match(/LANGPOOL_BASE\s*=\s*["']([^"']+)["']/);
  return (m && m[1]) ? m[1] : "";
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

/* =========================
   SOUND (mini sfx + word speak)
========================= */
const AC = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

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

function speakWord(text, langCode){
  try{
    const t = String(text||"").trim();
    if(!t) return;

    // APK NativeTTS varsa onu kullan
    if(window.NativeTTS && typeof window.NativeTTS.speak === "function"){
      try{ window.NativeTTS.stop?.(); }catch{}
      setTimeout(()=>{ try{ window.NativeTTS.speak(t, langCode); }catch{} }, 180);
      return;
    }

    if(!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(t);
    const map = {en:"en-US",de:"de-DE",fr:"fr-FR",it:"it-IT",es:"es-ES"};
    u.lang = map[langCode] || "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch{}
}

/* =========================
   GAME STATE
========================= */
let pool = null;
let target = null;

let lang = "en";
let diff = 3; // 3 easy, 4 normal, 5 hard (UI böyle)

let lives = START_LIVES;
let guessed = new Set();
let mistakes = 0;

let jokersLeft = MAX_JOKERS;

let flawless = true;
let jokerUsed = false;
let lock = false;

// skorlar
let wordScore = WORD_START_SCORE; // kelime puanı (100 -> düşer)
let totalScore = 0;              // toplam skor (bilinen kelimelerle artar)
let bestScore = 0;               // rekor (kalıcı)

/* =========================
   RULES
========================= */
function getMistakeLimit(){
  // Kolay: 6, Normal: 4, Zor: 2
  if(diff===3) return 6;
  if(diff===4) return 4;
  return 2;
}

function bestKey(){
  return `${BEST_PREFIX}_${lang}_${diff}`;
}

function loadBest(){
  try{
    bestScore = parseInt(localStorage.getItem(bestKey()) || "0", 10);
    if(Number.isNaN(bestScore)) bestScore = 0;
  }catch{
    bestScore = 0;
  }
}

function saveBest(){
  try{ localStorage.setItem(bestKey(), String(bestScore)); }catch{}
}

/* =========================
   UI PAINT
========================= */
function renderHearts(){
  const capped = Math.max(0, Math.min(lives, MAX_LIVES));
  let html = "";
  for(let i=0;i<capped;i++) html += `<span class="heart">❤️</span>`;
  $("hearts").innerHTML = html;
}

function paintScores(){
  // Üstte REKOR, altta TOPLAM SKOR zaten var: bestVal + scoreVal
  $("bestVal").textContent = String(bestScore);
  $("scoreVal").textContent = String(totalScore);

  // Kelime puanı ekranda ayrıca görünsün (trBox altında göstermek istemedin; HUD içinde gösterelim)
  // scoreVal zaten büyük; wordScore’ı bonus metninde + modal içinde gösteriyoruz.
  // İstersen küçük bir yere koymak için:
  // (UI bozmamak için dokunmuyoruz.)
}

function resetMan(){
  ["p_head","p_body","p_larm","p_rarm","p_lleg","p_rleg"].forEach(id => $(id).classList.remove("on"));
  $("man").classList.remove("swing");
}

function updateMan(){
  resetMan();
  const m = mistakes;

  const seq = ["p_head","p_body","p_larm","p_rarm","p_lleg","p_rleg"];
  const showCount = Math.min(getMistakeLimit(), 6);
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
    btn.onclick = () => press(btn.dataset.k, btn);
  });
}

function showModal(title, color, bonus){
  $("mTitle").textContent = title;
  $("mTitle").style.color = color;
  $("mWord").textContent = target.w.toUpperCase();
  $("mTr").textContent = `(${target.tr || "—"})`;
  $("mBonus").textContent = bonus || "";
  $("modal").classList.add("on");
}

/* =========================
   SCORE MECHANICS
========================= */
function resetForNewWord(){
  wordScore = WORD_START_SCORE;
  mistakes = 0;
  guessed = new Set();
  jokersLeft = MAX_JOKERS;
  flawless = true;
  jokerUsed = false;

  $("j0").classList.remove("spent");
  $("j1").classList.remove("spent");

  resetMan();
  updateMan();
}

function applyPenalty(){
  wordScore = Math.max(0, wordScore - PENALTY);
}

function addTotalScore(){
  totalScore += wordScore;
  if(totalScore > bestScore){
    bestScore = totalScore;
    saveBest();
  }
}

/* =========================
   GAME FLOW
========================= */
function endRound(win){
  lock = true;

  // kelimeyi her bitişte seslendir
  speakWord(target.w, lang);

  if(win){
    // doğru: puanı ekle
    addTotalScore();

    // sfx
    beep(880, 90, "sine", 0.05);
    beep(1320, 90, "sine", 0.04);

    // bonus can
    let bonus = `KELİME PUANI: +${wordScore}\nTOPLAM SKOR: ${totalScore}`;
    if(flawless && !jokerUsed && lives < MAX_LIVES){
      lives++;
      bonus += `\nKUSURSUZ: +1 CAN`;
    }

    paintScores();
    renderHearts();
    showModal("MİSYON BAŞARILI", "#00ff9d", bonus);
    return;
  }

  // kayıp: 1 can gider, puan eklenmez
  lives--;
  renderHearts();

  // sfx
  beep(180, 140, "square", 0.04);

  $("man").classList.add("swing");
  setTimeout(()=>{
    $("man").classList.remove("swing");
    if(lives <= 0){
      // oyun bitti: rekor zaten totalScore ile güncellenmiş olabilir; yine de yaz
      if(totalScore > bestScore){
        bestScore = totalScore;
        saveBest();
      }
      paintScores();
      showModal("GAME OVER", "#ff0033", `TOPLAM SKOR: ${totalScore}\nREKOR: ${bestScore}`);
    }else{
      showModal("DEŞİFRE EDİLEMEDİ", "#ff0033", "-1 CAN");
    }
  }, 2200);
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
    const done = w.split("").every(ch => guessed.has(ch));
    if(done) endRound(true);
  }else{
    btn.classList.add("miss");
    beep(220, 90, "square", 0.03);

    flawless = false;
    mistakes++;

    applyPenalty();
    updateMan();

    if(mistakes >= getMistakeLimit()){
      endRound(false);
    }
  }
}

function useJ(which){
  if(lock) return;
  if(jokersLeft <= 0) return;

  jokerUsed = true;
  jokersLeft--;
  (which===0 ? $("j0") : $("j1")).classList.add("spent");

  // joker cezası
  applyPenalty();

  const w = target.w.toUpperCase();
  const rem = w.split("").filter(ch => !guessed.has(ch));
  if(rem.length){
    const l = rem[0];
    const btn = $("kb").querySelector(`.key[data-k="${l}"]`);
    if(btn) press(l, btn);
    else{
      guessed.add(l);
      renderWord();
    }
  }
}

$("j0").addEventListener("click", ()=>useJ(0));
$("j1").addEventListener("click", ()=>useJ(1));

$("mBtn").addEventListener("click", ()=>{
  $("modal").classList.remove("on");

  // game over -> reset oyun (aynı sayfa reload)
  if(lives <= 0){
    location.reload();
    return;
  }

  // yeni kelime
  newRound();
});

function newRound(){
  lock = false;

  const usedSet = createUsedSet(`used_hangman_${lang}`);
  const pickedW = pick(pool, 1, usedSet.used, usedSet.save, (x)=> (x?.w||"").length >= 3);
  target = pickedW?.[0];

  if(!target?.w){
    $("trText").textContent = "KELİME BULUNAMADI";
    $("matrix").innerHTML = "";
    $("kb").innerHTML = "";
    return;
  }

  resetForNewWord();
  $("trText").textContent = (target.tr || "—").trim() || "—";
  renderHearts();
  renderWord();
  renderKeyboard();
  paintScores();
}

async function bootShellAndLift(){
  // ui shell
  mountShell({ scroll:"none" });

  // footer lift (dock shell footer üstüne girmez)
  try{
    const root = getComputedStyle(document.documentElement);
    const footerH = parseFloat(root.getPropertyValue("--footerH")) || 0;
    document.documentElement.style.setProperty("--shellLift", footerH ? `${footerH + 10}px` : "0px");
  }catch{}
}

/* =========================
   SETUP UI
========================= */
$("langGrid").addEventListener("click", (e)=>{
  const c = e.target.closest(".pickCard");
  if(!c || !c.dataset.lang) return;
  [...$("langGrid").querySelectorAll(".pickCard")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");
  lang = c.dataset.lang;

  // dil değişince rekor farklı (dil+zorluk)
  loadBest();
  paintScores();
});

$("diffGrid").addEventListener("click", (e)=>{
  const c = e.target.closest(".pickCard.diff");
  if(!c) return;
  [...$("diffGrid").querySelectorAll(".pickCard.diff")].forEach(x=>x.classList.remove("active"));
  c.classList.add("active");
  diff = parseInt(c.dataset.diff,10);

  // zorluk değişince rekor farklı (dil+zorluk)
  loadBest();
  paintScores();
});

$("startBtn").addEventListener("click", async ()=>{
  $("setupMsg").textContent = "Yükleniyor…";

  // Shell
  await bootShellAndLift();

  // Langpool base
  try{
    LANGPOOL_BASE = await readLangpoolBase();
    if(!LANGPOOL_BASE){
      $("setupMsg").textContent = "LANGPOOL_BASE bulunamadı (/js/config.js).";
      return;
    }
  }catch(e){
    $("setupMsg").textContent = "config.js okunamadı.";
    return;
  }

  // Pool
  try{
    pool = await loadLangPoolDirect(lang, LANGPOOL_BASE);
    if(!pool?.items?.length){
      $("setupMsg").textContent = `Havuz boş: ${LANGPOOL_BASE}/${lang}.json`;
      return;
    }
  }catch(err){
    $("setupMsg").textContent = "Havuz yükleme hatası:\n" + String(err);
    return;
  }

  // oyun başlangıcı
  lives = START_LIVES;
  totalScore = 0;

  loadBest();
  renderHearts();
  paintScores();

  $("setup").style.display = "none";
  $("setupMsg").textContent = "";

  newRound();
});

/* =========================
   FIRST PAINT
========================= */
(function init(){
  // başlangıçta dil+zorluk rekorunu göster
  loadBest();
  renderHearts();
  paintScores();
})();
```0
