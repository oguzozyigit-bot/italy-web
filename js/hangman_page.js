// FILE: /js/hangman_page.js
import { mountShell } from "/js/ui_shell.js";

// ---------- helpers ----------
const $ = (id)=>document.getElementById(id);

function norm(s){
  return String(s||"")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?]/g, "");
}

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
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

// ---------- sound ----------
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

// ---------- rules ----------
function mistakeLimit(diff){
  if(diff===3) return 6; // kolay
  if(diff===4) return 4; // normal
  return 2;              // zor
}

// Best key per language+diff
function bestKey(lang, diff){
  return `italky_hangman_best_${String(lang)}_${String(diff)}`;
}

// ---------- state ----------
let LANGPOOL_BASE = "";
let pool = null;
let target = null;

let lang = "en";
let diff = 3;

let lives = 3;
const MAX_LIVES = 9;

let guessed = new Set();
let mistakes = 0;

const MAX_JOKERS = 2;
let jokerUsedCount = 0;     // ✅ kaç joker kullanıldı (0..2)
let flawless = true;
let lock = false;

// scoring
let bestGame = 0;      // en yüksek "toplam skor" (game over'a kadar biriken)
let roundScore = 100;  // bu kelimenin skoru
let runScore = 0;      // biriken toplam skor

function loadBest(){
  bestGame = parseInt(localStorage.getItem(bestKey(lang, diff)) || "0", 10) || 0;
}

function saveBest(){
  try{ localStorage.setItem(bestKey(lang, diff), String(bestGame)); }catch{}
}

function paintScores(){
  $("bestVal").textContent = String(bestGame);
  $("scoreVal").textContent = String(runScore + roundScore);
}

function startNewGame(){
  lives = 3;
  runScore = 0;
  roundScore = 100;
  mistakes = 0;
  guessed = new Set();
  jokerUsedCount = 0;
  flawless = true;
  lock = false;

  loadBest();
  renderHearts();
  updateMan();
  paintScores();
  setJokersUI();
}

function startNewRound(){
  lock = false;
  guessed = new Set();
  mistakes = 0;
  roundScore = 100;
  flawless = true;
  jokerUsedCount = 0;
  setJokersUI();

  // pick new word
  const usedSet = createUsedSet(`used_hangman_${lang}`);
  const items = Array.isArray(pool?.items) ? pool.items : [];
  if(!items.length){
    target = null;
    $("trText").textContent = "KELİME BULUNAMADI";
    $("matrix").innerHTML = "";
    $("kb").innerHTML = "";
    paintScores();
    return;
  }

  // yeterli aday yoksa used reset
  const candidates = items.filter(x => x?.w && !usedSet.used.has(norm(x.w)) && (String(x.w).trim().length >= 3));
  if(candidates.length < 1) usedSet.used.clear();

  const fresh = items.filter(x => x?.w && !usedSet.used.has(norm(x.w)) && (String(x.w).trim().length >= 3));
  const pickOne = shuffle(fresh).slice(0,1)[0];
  if(pickOne?.w){
    usedSet.used.add(norm(pickOne.w));
    usedSet.save();
  }
  target = pickOne || null;

  if(!target?.w){
    $("trText").textContent = "KELİME BULUNAMADI";
    $("matrix").innerHTML = "";
    $("kb").innerHTML = "";
    paintScores();
    return;
  }

  $("trText").textContent = (target.tr || "—").trim() || "—";

  renderWord();
  renderKeyboard();
  updateMan();
  paintScores();
}

// ---------- UI ----------
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
  const showCount = Math.min(mistakeLimit(diff), 6);
  seq.slice(0, Math.min(mistakes, showCount)).forEach(id => $(id).classList.add("on"));
}

function setJokersUI(){
  const j0 = $("j0"), j1 = $("j1");
  if(!j0 || !j1) return;
  j0.classList.toggle("spent", jokerUsedCount >= 1);
  j1.classList.toggle("spent", jokerUsedCount >= 2);
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

  $("kb").innerHTML = keys.map(k=>`<button class="key" data-k="${k}" type="button">${k}</button>`).join("");
  $("kb").querySelectorAll(".key").forEach(btn=>{
    btn.addEventListener("click", ()=> press(btn.dataset.k, btn));
  });
}

// ---------- gameplay ----------
function applyPenalty(n){
  roundScore = Math.max(0, roundScore - n);
  paintScores();
}

function endGameIfBest(){
  if(runScore > bestGame){
    bestGame = runScore;
    saveBest();
  }
}

function showModal(title, color, bonus){
  $("mTitle").textContent = title;
  $("mTitle").style.color = color;
  $("mWord").textContent = target.w.toUpperCase();
  $("mTr").textContent = `(${target.tr || "—"})`;
  $("mBonus").textContent = bonus || "";
  $("modal").classList.add("on");
}

function endRound(win){
  lock = true;
  speakWord(target.w, lang);

  if(win){
    runScore += roundScore;

    beep(880, 90, "sine", 0.05);
    beep(1320, 90, "sine", 0.04);

    let bonus = `+${roundScore} PUAN\nTOPLAM: ${runScore}`;

    // kusursuz bonus: hiç hata yok + joker yok => +1 can (max 9)
    if(flawless && jokerUsedCount === 0 && lives < MAX_LIVES){
      lives++;
      bonus += "\nKUSURSUZ: +1 CAN";
    }

    renderHearts();
    loadBest(); // lang/diff anahtarına göre
    if(runScore > bestGame){
      bestGame = runScore;
      saveBest();
    }
    paintScores();

    showModal("MİSYON BAŞARILI", "#00ff9d", bonus);
    return;
  }

  lives--;
  renderHearts();
  $("man").classList.add("swing");

  beep(180, 140, "square", 0.04);

  setTimeout(()=>{
    $("man").classList.remove("swing");

    if(lives <= 0){
      endGameIfBest();
      paintScores();
      showModal("GAME OVER", "#ff0033", `TOPLAM SKOR: ${runScore}\nREKOR: ${bestGame}`);
    }else{
      showModal("DEŞİFRE EDİLEMEDİ", "#ff0033", "-1 CAN");
    }
  }, 2500);
}

function press(letter, btn){
  if(lock) return;
  if(!letter) return;
  letter = String(letter).toUpperCase();
  if(guessed.has(letter)) return;

  const w = target.w.toUpperCase();
  if(w.includes(letter)){
    guessed.add(letter);
    btn?.classList.add("hit");
    beep(740, 70, "sine", 0.03);

    renderWord();
    if(w.split("").every(ch => guessed.has(ch))) endRound(true);
  }else{
    btn?.classList.add("miss");
    beep(220, 90, "square", 0.03);

    flawless = false;
    mistakes++;
    applyPenalty(10);
    updateMan();

    if(mistakes >= mistakeLimit(diff)) endRound(false);
  }
}

function jokerReveal(){
  if(lock) return;
  if(jokerUsedCount >= MAX_JOKERS) return;

  jokerUsedCount++;
  setJokersUI();

  flawless = false;        // joker kusursuzu bozar
  applyPenalty(10);
  beep(520, 90, "sine", 0.03);

  const w = target.w.toUpperCase();
  const remaining = w.split("").filter(ch => !guessed.has(ch));
  if(!remaining.length) return;

  // rastgele bir harf aç
  const pick = remaining[Math.floor(Math.random()*remaining.length)];
  const btn = $("kb").querySelector(`.key[data-k="${pick}"]`);
  if(btn){
    press(pick, btn);
  }else{
    guessed.add(pick);
    renderWord();
    if(w.split("").every(ch => guessed.has(ch))) endRound(true);
  }
}

// ---------- setup / shell ----------
function applyShellLift(){
  try{
    const footerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--footerH")) || 0;
    document.documentElement.style.setProperty("--shellLift", footerH ? `${footerH + 10}px` : "0px");
  }catch{}
}

function bindSetup(){
  // selection
  $("langGrid").addEventListener("click", (e)=>{
    const c = e.target.closest(".pickCard");
    if(!c || !c.dataset.lang) return;
    [...$("langGrid").querySelectorAll(".pickCard")].forEach(x=>x.classList.remove("active"));
    c.classList.add("active");
    lang = c.dataset.lang;
  });

  $("diffGrid").addEventListener("click", (e)=>{
    const c = e.target.closest(".pickCard.diff");
    if(!c) return;
    [...$("diffGrid").querySelectorAll(".pickCard.diff")].forEach(x=>x.classList.remove("active"));
    c.classList.add("active");
    diff = parseInt(c.dataset.diff,10);
  });

  $("mBtn").addEventListener("click", ()=>{
    $("modal").classList.remove("on");
    if(lives <= 0){
      // yeni oyun
      startNewGame();
      startNewRound();
      return;
    }
    // yeni kelime
    startNewRound();
  });

  // ✅ 2 joker: capture ile garanti
  const j0 = $("j0"), j1 = $("j1");
  const bindJ = (el)=>{
    if(!el) return;
    el.addEventListener("click", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      jokerReveal();
    }, { capture:true });
    el.addEventListener("touchend", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      jokerReveal();
    }, { passive:false, capture:true });
  };
  bindJ(j0); bindJ(j1);

  $("startBtn").addEventListener("click", async ()=>{
    $("setupMsg").textContent = "Yükleniyor…";

    // Langpool base
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

    // per-lang+diff best yükle
    loadBest();
    paintScores();

    $("setup").style.display = "none";
    $("setupMsg").textContent = "";

    startNewGame();
    startNewRound();
  });
}

async function boot(){
  // ✅ Sayfa daha açılır açılmaz shell gelsin (üst/alt bar görünür)
  mountShell({ scroll:"none" });
  applyShellLift();
  bindSetup();

  // ilk skor alanı
  loadBest();
  paintScores();
  renderHearts();
}

boot();
