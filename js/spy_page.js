// FILE: /js/spy_page.js
import { loadLangPool, createUsedSet, pick } from "/js/langpool.js";
import { supabase } from "/js/supabase_client.js"; // login check için
import { setHeaderTokens } from "/js/ui_shell.js";

const $ = (id) => document.getElementById(id);

let lang = "en";
let muted = false;
let totalScore = 0;
let setScore = 0;
let momentum = 1.0;
let lives = 3;
let combo = 0;

let currentItem = null;
let cooldown = false;
let setCounter = 0;
let runActive = false;
let poolItems = [];
let speaking = false;
let lastUtter = null;

const LANGMAP = { en:"en-US", de:"de-DE", fr:"fr-FR", es:"es-ES", it:"it-IT" };

// ---------- 24h PASS (game.html mantığıyla uyumlu) ----------
const PASS_HOURS = 24;
const PASS_MS = PASS_HOURS * 60 * 60 * 1000;

function getSessionUser(){
  // Supabase session varsa id al, yoksa local user
  // (Menüde zaten session kontrol ediyorsun ama burada güvenlik)
  try{
    const u = JSON.parse(localStorage.getItem("italky_user_v1") || "{}");
    return u;
  }catch{
    return {};
  }
}

function uid(u){
  return String(u?.id || u?.user_id || u?.email || "guest").toLowerCase().trim();
}

function passKey(gameId, userId){
  return `italky_24h_${gameId}_${userId}`;
}

async function ensureLoggedIn(){
  try{
    const { data:{ session } } = await supabase.auth.getSession();
    if(!session?.user){
      location.href = "/pages/login.html";
      return null;
    }
    return session.user;
  }catch{
    location.href = "/pages/login.html";
    return null;
  }
}

async function ensure24hPassOrSpend1Token(gameId){
  // Eğer menü zaten jeton düşürdüyse, burada sadece PASS kontrol etmek yeter.
  // Ama “direct link” ile girilirse de burada güvenceye alıyoruz.
  const sessionUser = await ensureLoggedIn();
  if(!sessionUser) return false;

  const userId = sessionUser.id;
  const key = passKey(gameId, userId);

  const last = Number(localStorage.getItem(key) || "0");
  if(last && (Date.now() - last) < PASS_MS){
    return true;
  }

  // jeton düş
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("tokens")
    .eq("id", userId)
    .single();

  if(error){
    alert("Jeton kontrol edilemedi.");
    return false;
  }

  const tokens = Number(prof?.tokens ?? 0);
  if(tokens <= 0){
    alert("Devam etmek için jeton gerekli!");
    location.href = "/pages/profile.html";
    return false;
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ tokens: tokens - 1 })
    .eq("id", userId);

  if(upErr){
    alert("Jeton düşülemedi.");
    return false;
  }

  localStorage.setItem(key, String(Date.now()));
  setHeaderTokens(tokens - 1);
  return true;
}

// ---------- UI ----------
function toast(msg, color="var(--radar)"){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.style.borderColor = color;
  t.style.color = color;
  t.classList.add("show");
  clearTimeout(window.__spy_to);
  window.__spy_to = setTimeout(()=>t.classList.remove("show"), 1600);
}

function updatePB(){
  const pb = parseInt(localStorage.getItem(`audio_spy_pb_${lang}`) || "0", 10);
  $("pbDisp").textContent = `PB: ${pb}`;
}

function setListenLabel(state){
  const btn = $("listenBtn");
  if(!btn) return;
  if(state === "playing"){
    btn.textContent = "⏳ SİNYAL ÇALIYOR";
    btn.disabled = true;
  }else if(state === "wait"){
    btn.textContent = "… BEKLE";
    btn.disabled = true;
  }else{
    btn.textContent = "▶ SİNYALİ DİNLE";
    btn.disabled = false;
  }
}

function updateUI(){
  $("scoreDisp").textContent = String(totalScore);
  $("momDisp").textContent = `x${momentum.toFixed(2)} MOMENTUM`;
  $("livesDisp").textContent = "❤️".repeat(Math.max(0,lives)) + "💀".repeat(3 - Math.max(0,lives));
}

function lockOptions(lock=true){
  document.querySelectorAll(".opt").forEach(x => x.style.pointerEvents = lock ? "none" : "auto");
}

// ---------- Speech ----------
function stopSpeak(){
  speaking = false;
  try { speechSynthesis.cancel(); } catch {}
  lastUtter = null;
}

function speak(txt, onDone){
  if(muted || !txt){
    onDone && onDone();
    return;
  }
  stopSpeak();

  const u = new SpeechSynthesisUtterance(txt);
  lastUtter = u;
  u.lang = LANGMAP[lang] || "en-US";
  u.rate = 0.85;
  speaking = true;

  const finish = () => {
    if(lastUtter !== u) return;
    speaking = false;
    onDone && onDone();
  };

  u.onend = finish;
  u.onerror = finish;

  try { speechSynthesis.speak(u); }
  catch { finish(); }
}

// ---------- Normalize compare ----------
const norm = (s)=>
  String(s||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ");

// ---------- Game ----------
async function initSet(isBank=false){
  if(isBank){ lives = 3; momentum = 1.0; combo = 0; }
  setCounter = 0; setScore = 0;
  cooldown = false;
  stopSpeak();
  setListenLabel("idle");

  const data = await loadLangPool(lang);
  const USED_KEY = `used_audio_spy_v2_${lang}`;
  const { used, save } = createUsedSet(USED_KEY);

  let picked = pick(data, 12, used, save);
  if(!picked || picked.length < 8){
    localStorage.removeItem(USED_KEY);
    const cleanUsed = new Set();
    picked = pick(data, 12, cleanUsed, save);
  }

  poolItems = picked || [];
  updateUI();
  nextSignal();
}

function nextSignal(){
  if(setCounter >= 8 || lives <= 0){
    finishSet(lives <= 0);
    return;
  }

  const w = poolItems[setCounter];
  currentItem = {
    say: (w?.sentence || `Listen: ${w?.w || "signal"}.`),
    ans: w?.tr || "",
    w: w?.w || ""
  };

  buildOptions(currentItem.ans);
  setTimeout(()=>playSignal(), 450);
}

function buildOptions(correct){
  const opts = [correct];
  while(opts.length < 4){
    const r = poolItems[Math.floor(Math.random()*poolItems.length)]?.tr;
    if(r && !opts.some(x=>norm(x)===norm(r))) opts.push(r);
  }
  opts.sort(()=>Math.random()-0.5);

  const area = $("optionsArea");
  area.innerHTML = "";
  opts.forEach(v=>{
    const d = document.createElement("div");
    d.className = "opt";
    d.textContent = v;
    d.addEventListener("click", ()=>handleChoice(d, v));
    area.appendChild(d);
  });
}

function playSignal(){
  if(speaking || cooldown || !currentItem) return;
  setListenLabel("playing");
  $("wave").classList.add("playing");
  speak(currentItem.say, ()=>{
    $("wave").classList.remove("playing");
    setListenLabel("idle");
  });
}

function resetSignal(){
  cooldown = false;
  setCounter++;
  lockOptions(false);
  setListenLabel("idle");
}

function handleChoice(el, val){
  if(cooldown || !currentItem) return;
  cooldown = true;
  lockOptions(true);
  setListenLabel("wait");

  const isCorrect = norm(val) === norm(currentItem.ans);

  if(isCorrect){
    el.classList.add("correct");
    const gain = Math.round(100 * momentum);
    totalScore += gain; setScore += gain;
    momentum = Math.min(1.6, momentum + 0.05);
    combo++;

    if(combo > 0 && combo % 2 === 0){
      if(lives < 3){ lives++; toast("TAMİR EDİLDİ ❤️+1", "var(--ok)"); }
      else { toast("FLOW STABİL ⚡", "var(--radar)"); }
    }

    $("wave").classList.add("playing");
    speak(currentItem.say, ()=>{
      $("wave").classList.remove("playing");
      resetSignal();
      updateUI();
      nextSignal();
    });
  }else{
    el.classList.add("wrong");
    lives--;
    combo = 0;
    momentum = Math.max(1.0, momentum - 0.2);

    document.querySelectorAll(".opt").forEach(x=>{
      if(norm(x.textContent) === norm(currentItem.ans)) x.classList.add("correct");
    });

    $("wave").classList.add("playing");
    speak(currentItem.say, ()=>{
      $("wave").classList.remove("playing");
      resetSignal();
      updateUI();
      (lives > 0) ? nextSignal() : finishSet(true);
    });
  }

  updateUI();
}

function finishSet(died){
  stopSpeak();
  setListenLabel("idle");

  const pb = parseInt(localStorage.getItem(`audio_spy_pb_${lang}`) || "0", 10);
  if(totalScore > pb) localStorage.setItem(`audio_spy_pb_${lang}`, String(totalScore));

  $("endModal").classList.remove("hidden");
  $("endTitle").textContent = died ? "SIGNAL LOST" : "SECTOR DECODED";
  $("endTitle").style.color = died ? "var(--alert)" : "var(--radar)";
  $("endStats").innerHTML = `TOPLAM SKOR: <b>${totalScore}</b><br>MOMENTUM: <b>x${momentum.toFixed(2)}</b>`;

  if(died){
    $("continueBtn").classList.add("hidden");
    runActive = false;
  }else{
    $("continueBtn").classList.remove("hidden");
  }

  updatePB();
}

// ---------- Events ----------
document.querySelectorAll(".lang-btn").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".lang-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    lang = b.dataset.lang || "en";
    updatePB();
  });
});

$("soundBtn").addEventListener("click", ()=>{
  muted = !muted;
  $("soundBtn").textContent = muted ? "🔇" : "🔊";
  if(muted) stopSpeak();
});

$("listenBtn").addEventListener("click", playSignal);

$("startBtn").addEventListener("click", async ()=>{
  // ✅ 24h pass / 1 jeton (direct link güvenliği)
  const ok = await ensure24hPassOrSpend1Token("spy");
  if(!ok) return;

  $("startModal").classList.add("hidden");
  $("gameArea").style.display = "flex";

  if(!runActive){
    totalScore = 0; lives = 3; momentum = 1.0; combo = 0; runActive = true;
  }

  await initSet(true);
  updateUI();
});

$("continueBtn").addEventListener("click", async ()=>{
  // ✅ her yeni set için yine PASS geçerli; PASS yoksa 1 jeton düşer
  const ok = await ensure24hPassOrSpend1Token("spy");
  if(!ok) return;

  $("endModal").classList.add("hidden");
  await initSet(false);
});

$("exitBtn").addEventListener("click", ()=>{
  if(confirm("Operasyonu durdurup üsse dönmek istiyor musunuz?")){
    location.href = "/pages/game.html";
  }
});

window.addEventListener("load", ()=>{
  updatePB();
  setListenLabel("idle");
  updateUI();
});
