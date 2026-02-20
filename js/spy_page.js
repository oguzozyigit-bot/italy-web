// FILE: /js/spy_page.js
import { mountShell } from "/js/ui_shell.js";
import { loadLangPool, createUsedSet, pick } from "/js/langpool.js";

mountShell({ scroll: "none" });

const $ = (id)=>document.getElementById(id);

const LANGMAP = { en:"en-US", de:"de-DE", fr:"fr-FR", es:"es-ES", it:"it-IT" };

let lang = "en";
let muted = false;

let totalScore = 0;
let setScore = 0;
let momentum = 1.0;
let lives = 3;
let combo = 0;

let poolItems = [];
let currentItem = null;
let cooldown = false;
let setCounter = 0;

let speaking = false;
let lastUtter = null;

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = String(msg||"");
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1600);
}

function norm(s){
  return String(s||"")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ");
}

function setLangLabel(){
  const map = { en:"EN", de:"DE", fr:"FR", es:"ES", it:"IT" };
  $("langDisp").textContent = `${map[lang] || "EN"} • TR`;
}

/* =========================
   ✅ TTS (APK NativeTTS + Web fallback)
========================= */
function nativeSpeakAvailable(){
  return !!(window.NativeTTS && typeof window.NativeTTS.speak === "function");
}

function stopSpeak(){
  speaking = false;
  try { window.NativeTTS?.stop?.(); } catch {}
  try { window.speechSynthesis?.cancel?.(); } catch {}
  lastUtter = null;
}

function speak(txt, onDone){
  const t = String(txt||"").trim();
  if(muted || !t){
    onDone && onDone();
    return;
  }

  stopSpeak();
  speaking = true;

  if(nativeSpeakAvailable()){
    try { window.NativeTTS.stop?.(); } catch {}
    setTimeout(()=>{
      try{
        window.NativeTTS.speak(t, lang);
      }catch(e){
        console.warn("NativeTTS speak error:", e);
      }finally{
        setTimeout(()=>{
          speaking = false;
          onDone && onDone();
        }, Math.min(4200, 900 + t.length * 35));
      }
    }, 160);
    return;
  }

  if(!window.speechSynthesis){
    speaking = false;
    onDone && onDone();
    return;
  }

  const u = new SpeechSynthesisUtterance(t);
  lastUtter = u;
  u.lang = LANGMAP[lang] || "en-US";
  u.rate = 0.88;

  const finish = ()=>{
    if(lastUtter !== u) return;
    speaking = false;
    onDone && onDone();
  };
  u.onend = finish;
  u.onerror = finish;

  try{
    window.speechSynthesis.speak(u);
  }catch{
    finish();
  }
}

/* =========================
   UI
========================= */
function updatePB(){
  const pb = parseInt(localStorage.getItem(`audio_spy_pb_${lang}`) || "0", 10);
  $("pbDisp").innerHTML = `PB: <b>${pb}</b>`;
}

function updateUI(){
  $("scoreDisp").textContent = String(totalScore);
  $("momDisp").textContent = `x${momentum.toFixed(2)} MOMENTUM`;
  const l = Math.max(0, lives);
  $("livesDisp").textContent = "❤️".repeat(l) + "💀".repeat(Math.max(0, 3-l));
}

function lockOptions(lock=true){
  document.querySelectorAll(".opt").forEach(x => x.style.pointerEvents = lock ? "none" : "auto");
}

function setListenLabel(state){
  const btn = $("listenBtn");
  const radar = $("radar");
  if(!btn) return;

  if(state === "playing"){
    btn.textContent = "⏳ SİNYAL ÇALIYOR";
    btn.disabled = true;
    radar?.classList.add("playing");
  }else if(state === "wait"){
    btn.textContent = "… BEKLE";
    btn.disabled = true;
    radar?.classList.remove("playing");
  }else{
    btn.textContent = "▶ SİNYALİ DİNLE";
    btn.disabled = false;
    radar?.classList.remove("playing");
  }
}

/* =========================
   GAME
========================= */
async function initSet(isBank=false){
  if(isBank){
    lives = 3;
    momentum = 1.0;
    combo = 0;
  }

  setCounter = 0;
  setScore = 0;
  cooldown = false;
  stopSpeak();
  setListenLabel("idle");

  const data = await loadLangPool(lang);

  const USED_KEY = `used_audio_spy_v3_${lang}`;
  const { used, save } = createUsedSet(USED_KEY);

  let picked = pick(data, 12, used, save);
  if(!picked || picked.length < 8){
    localStorage.removeItem(USED_KEY);
    const cleanUsed = new Set();
    picked = pick(data, 12, cleanUsed, save);
  }

  poolItems = picked || [];
  updateUI();
  updatePB();
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
    ans: (w?.tr || ""),
    w: (w?.w || "")
  };

  buildOptions(currentItem.ans);
  setListenLabel("idle");
}

function buildOptions(correct){
  const opts = [correct].filter(Boolean);
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
    d.onclick = ()=> handleChoice(d, v);
    area.appendChild(d);
  });
}

function playSignal(){
  if(speaking || cooldown || !currentItem) return;
  setListenLabel("playing");
  speak(currentItem.say, ()=>{
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
    totalScore += gain;
    setScore += gain;
    momentum = Math.min(1.6, momentum + 0.05);
    combo++;

    if(combo > 0 && combo % 2 === 0){
      if(lives < 3){
        lives++;
        toast("TAMİR +1 ❤️");
      }else{
        toast("FLOW ⚡");
      }
    }

    updateUI();

    speak(currentItem.say, ()=>{
      resetSignal();
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

    updateUI();

    speak(currentItem.say, ()=>{
      resetSignal();
      (lives > 0) ? nextSignal() : finishSet(true);
    });
  }
}

function finishSet(died){
  stopSpeak();
  setListenLabel("idle");

  const pb = parseInt(localStorage.getItem(`audio_spy_pb_${lang}`) || "0", 10);
  if(totalScore > pb) localStorage.setItem(`audio_spy_pb_${lang}`, String(totalScore));

  $("endTitle").textContent = died ? "SIGNAL LOST" : "SECTOR DECODED";
  $("endTitle").style.color = died ? "var(--danger)" : "var(--radar)";
  $("endStats").innerHTML =
    `TOPLAM SKOR: <b>${totalScore}</b><br>` +
    `SET SKOR: <b>${setScore}</b><br>` +
    `MOMENTUM: <b>x${momentum.toFixed(2)}</b>`;

  $("continueBtn").style.display = died ? "none" : "inline-flex";
  $("endModal").classList.add("show");
  updatePB();
}

/* =========================
   EVENTS
========================= */
document.querySelectorAll("#langRow .langBtn").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll("#langRow .langBtn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    lang = b.dataset.lang || "en";
    setLangLabel();
    updatePB();
  });
});

$("soundBtn").addEventListener("click", ()=>{
  muted = !muted;
  $("soundIco").textContent = muted ? "🔇" : "🔊";
  if(muted) stopSpeak();
});

$("helpBtn").addEventListener("click", ()=>{
  $("startModal").classList.add("show");
});

$("listenBtn").addEventListener("click", playSignal);

$("startBtn").addEventListener("click", async ()=>{
  $("startModal").classList.remove("show");
  $("endModal").classList.remove("show");

  totalScore = 0;
  lives = 3;
  momentum = 1.0;
  combo = 0;

  updateUI();
  setLangLabel();
  updatePB();

  await initSet(true);
});

$("exitBtn").addEventListener("click", ()=>{
  location.href = "/pages/game.html";
});

$("continueBtn").addEventListener("click", async ()=>{
  $("endModal").classList.remove("show");
  await initSet(false);
});

$("backBtn").addEventListener("click", ()=>{
  location.href = "/pages/game.html";
});

/* =========================
   BOOT CHECK (kritik)
========================= */
window.addEventListener("load", ()=>{
  // 1) ui shell var mı
  if(typeof mountShell !== "function"){
    toast("ui_shell yüklenemedi");
  }

  // 2) langpool var mı
  if(typeof loadLangPool !== "function"){
    toast("langpool.js bulunamadı");
  }

  // 3) TTS durumu
  if(nativeSpeakAvailable()){
    // OK
  }else if(!window.speechSynthesis){
    toast("Bu cihazda TTS yok");
  }

  setLangLabel();
  updatePB();
  updateUI();
  setListenLabel("idle");
});
