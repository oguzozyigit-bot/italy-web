// FILE: /js/teacher_course.page.js
// italkyAI Teacher Course — REAL LESSON (Voice + Repeat)
// ✅ Supabase session gate (no localStorage email/terms)
// ✅ No teacher names/personas (teacher selection removed)
// ✅ Language + level from localStorage, fallback from profiles.levels[lang]
// ✅ TTS: /api/tts (Google -> OpenAI fallback backend)
// ✅ STT: WebSpeechRecognition (browser) -> similarity
// ✅ 95% similarity, 3 tries
// ✅ Lesson flow: TEACH (teacher speaks) -> REPEAT (student repeats) -> evaluate -> next
// ✅ UI shows TR translation in parentheses (translate_ai), teacher target-language only

import { supabase } from "/js/supabase_client.js";

const API_BASE = "https://italky-api.onrender.com";

const $ = (id) => document.getElementById(id);

// ---------- helpers ----------
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function safeSet(id, text){
  const el = $(id);
  if(el) el.textContent = String(text ?? "");
}

function fmtTimeLeft(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60);
  const ss = String(s%60).padStart(2,"0");
  return `${m}:${ss}`;
}

function firstNameOnly(full){
  const s = String(full || "").trim().replace(/\s+/g," ");
  if(!s) return "Kullanıcı";
  const parts = s.split(" ").filter(Boolean);
  if(parts.length === 1) return parts[0];
  // son kelime soyad varsayımı -> çıkar
  return parts.slice(0, -1).join(" ");
}

function normText(s){
  return String(s||"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu," ")
    .replace(/\s+/g," ")
    .trim();
}

// token/bag similarity (cheap)
function tokenSimilarity(a,b){
  const A = normText(a).split(" ").filter(Boolean);
  const B = normText(b).split(" ").filter(Boolean);
  if(!A.length && !B.length) return 1;
  if(!A.length || !B.length) return 0;

  const setB = new Set(B);
  let bagHit = 0;
  for(const w of A) if(setB.has(w)) bagHit++;

  // order hit
  let orderHit = 0;
  for(let i=0;i<Math.min(A.length,B.length);i++){
    if(A[i] === B[i]) orderHit++;
  }
  const denom = Math.max(A.length, B.length) || 1;
  return Math.max(bagHit/denom, orderHit/denom);
}

// ---------- UI bubbles ----------
const chatEl = $("chat");
function scrollBottom(){ try{ chatEl.scrollTop = chatEl.scrollHeight; }catch{} }

function addBubble(kind, text, { speakable=false, onSpeak=null } = {}){
  const b = document.createElement("div");
  b.className = `bubble ${kind}`;
  const txt = document.createElement("div");
  txt.className = "txt";
  txt.textContent = String(text||"");
  b.appendChild(txt);

  if(speakable){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spkBtn";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>`;
    btn.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      onSpeak?.(txt.textContent);
    });
    b.appendChild(btn);
  }

  chatEl.appendChild(b);
  scrollBottom();
  return b;
}

// ---------- bell ----------
function playBell(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g  = ctx.createGain();
    o1.type="sine"; o2.type="sine";
    o1.frequency.value = 880;
    o2.frequency.value = 1320;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+1.1);
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.start(); o2.start();
    o1.stop(ctx.currentTime+1.15); o2.stop(ctx.currentTime+1.15);
    setTimeout(()=>{ try{ctx.close();}catch{} }, 1300);
  }catch{}
}

// ---------- TTS (/api/tts) ----------
let currentAudio = null;
function stopAudio(){
  try{
    if(currentAudio){
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
  }catch{}
  currentAudio = null;
}

async function speakTTS(text, lang){
  stopAudio();
  const t = String(text||"").trim();
  if(!t) return;

  // backend: {ok, audio_base64} (google/openai)
  const r = await fetch(`${API_BASE}/api/tts`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, lang })
  });
  const j = await r.json().catch(()=>null);
  if(!j?.ok || !j.audio_base64) throw new Error(j?.error || "TTS_UNAVAILABLE");

  const audio = new Audio("data:audio/mpeg;base64," + j.audio_base64);
  currentAudio = audio;
  await audio.play();
}

// ---------- Translate to TR (display only) ----------
async function translateToTR(text, sourceLang){
  const t = String(text||"").trim();
  if(!t) return "";
  try{
    const r = await fetch(`${API_BASE}/api/translate_ai`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        text: t,
        from_lang: sourceLang,
        to_lang: "tr",
        strict: true,
        no_extra: true,
        style: "fast",
        provider: "auto"
      })
    });
    if(!r.ok) return "";
    const j = await r.json().catch(()=>null);
    return String(j?.translated || "").trim();
  }catch{
    return "";
  }
}

// ---------- STT (WebSpeechRecognition) ----------
let recognition = null;
function stopSTT(){ try{ recognition?.stop?.(); }catch{} recognition=null; }

function buildRecognizer(bcp47){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = bcp47;
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

// ---------- Lesson brain (OpenAI text via your existing /api/chat_openai) ----------
function systemPrompt(lang, level, studentName){
  return `
You are a real ${lang.toUpperCase()} teacher.
Rules:
- Speak ONLY in ${lang.toUpperCase()} (never Turkish).
- Output MUST be exactly two lines:
TEACH: <1-3 short lines, clear, natural>
REPEAT: <one single sentence student must repeat>
- Level: ${level} (CEFR). Keep it appropriate.
- Be warm but disciplined.
Student: ${studentName}.
`.trim();
}

// Calls backend: /api/chat_openai (your API already has this router)
async function teacherGenerate(userText, lang, level, studentName, history){
  const payload = {
    text: userText,
    persona_name: "italky-teacher",
    history: [
      { role:"system", content: systemPrompt(lang, level, studentName) },
      ...(history||[]).slice(-8)
    ],
    max_tokens: 260
  };

  const r = await fetch(`${API_BASE}/api/chat_openai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(`chat_openai HTTP ${r.status} ${t}`);
  }
  const j = await r.json().catch(()=>null);
  return String(j?.text || j?.message || "").trim();
}

function parseTeachRepeat(reply){
  const raw = String(reply||"").trim();
  let teach = "";
  let repeat = "";

  const mTeach = raw.match(/TEACH:\s*([\s\S]*?)\nREPEAT:/i);
  if(mTeach) teach = String(mTeach[1]||"").trim();

  const mRep = raw.match(/REPEAT:\s*([^\n\r]+)/i);
  if(mRep) repeat = String(mRep[1]||"").trim();

  if(!teach) teach = raw.split(/\n+/)[0]?.replace(/^TEACH:\s*/i,"").trim() || raw;
  if(!repeat){
    const lines = raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    repeat = (lines[lines.length-1] || "").replace(/^REPEAT:\s*/i,"").trim();
  }
  return { teach, repeat };
}

// ---------- Course state ----------
const TARGET_SIM = 0.95;
const MAX_TRIES = 3;

let running=false;
let paused=false;

let lang="en";
let sttLang="en-US";
let level="A1";
let mins=15;

let studentName="Kullanıcı";
let timeEnd = 0;

let pendingRepeat = "";
let triesLeft = MAX_TRIES;
let history = [];

function setStatus(s){ safeSet("statusText", s); }

function setBadges(){
  safeSet("pillTry", "●".repeat(Math.max(0, triesLeft)) + "○".repeat(Math.max(0, MAX_TRIES-triesLeft)));
  safeSet("pillScore", "95%");
}

function setHeaderUI(){
  safeSet("teacherName", `Ders • ${lang.toUpperCase()}`);
  safeSet("lessonInfo", `Seviye: ${level} • Süre: ${mins} dk`);
}

function updateTime(){
  if(!running || paused) return;
  const left = Math.max(0, timeEnd - Date.now());
  safeSet("lessonInfo", `Seviye: ${level} • Kalan: ${fmtTimeLeft(left)}`);
  if(left <= 0){
    endLesson();
    return;
  }
  requestAnimationFrame(updateTime);
}

function resetRepeat(){
  pendingRepeat = "";
  triesLeft = MAX_TRIES;
  setBadges();
}

async function sayTeacher(text){
  addBubble("teacher", text, {
    speakable:true,
    onSpeak: async (t)=>{ try{ await speakTTS(t, sttLang); }catch{} }
  });
  const tr = await translateToTR(text, lang);
  if(tr) addBubble("tr", `(${tr})`);
  try{ await speakTTS(text, sttLang); }catch{}
}

async function nextTurn(userText){
  if(!running || paused) return;

  setStatus("THINKING");
  history.push({ role:"user", content: userText });
  if(history.length > 18) history = history.slice(-18);

  let reply = "";
  try{
    reply = await teacherGenerate(userText, lang, level, studentName, history);
  }catch(e){
    setStatus("ERROR");
    addBubble("tr", `(Öğretmen yanıt veremedi: ${e?.message || e})`);
    return;
  }

  history.push({ role:"assistant", content: reply });
  if(history.length > 18) history = history.slice(-18);

  const { teach, repeat } = parseTeachRepeat(reply);

  if(teach){
    setStatus("SPEAKING");
    await sayTeacher(teach);
  }

  if(repeat){
    pendingRepeat = repeat;
    triesLeft = MAX_TRIES;
    setBadges();

    setStatus("REPEAT");
    await sayTeacher(`Repeat: ${repeat}`);
    listenStudent();
    return;
  }

  listenStudent();
}

function listenStudent(){
  if(!running || paused) return;

  const rec = buildRecognizer(sttLang);
  if(!rec){
    addBubble("tr","(Bu cihazda SpeechRecognition yok. Chrome/Android WebView destekli olmalı.)");
    setStatus("NO_STT");
    return;
  }

  setStatus("LISTENING");
  stopSTT();
  recognition = rec;

  rec.onresult = async (e)=>{
    const said = String(e.results?.[0]?.[0]?.transcript || "").trim();
    if(!said) return;

    addBubble("student", said);

    if(pendingRepeat){
      const score = tokenSimilarity(said, pendingRepeat);
      const pct = Math.round(score*100);

      if(score >= TARGET_SIM){
        setStatus("GOOD");
        await sayTeacher(`Good. (${pct}%)`);
        resetRepeat();
        await nextTurn("Continue.");
        return;
      }

      triesLeft -= 1;
      setBadges();

      if(triesLeft <= 0){
        setStatus("MOVE_ON");
        await sayTeacher("Okay. We move on.");
        resetRepeat();
        await nextTurn("Continue.");
        return;
      }

      setStatus("TRY_AGAIN");
      await sayTeacher(`Not yet. Try again. (${pct}%)`);
      // tekrar dinlet + dinle
      await sayTeacher(`Repeat: ${pendingRepeat}`);
      listenStudent();
      return;
    }

    await nextTurn(said);
  };

  rec.onerror = ()=>{};
  rec.onend = ()=>{};
  try{ rec.start(); }catch{}
}

async function startLesson(){
  if(running) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    addBubble("tr","(Bu cihazda SpeechRecognition yok. Ders için gerekli.)");
    return;
  }

  running = true;
  paused = false;
  timeEnd = Date.now() + mins*60*1000;

  resetRepeat();
  setHeaderUI();
  setStatus("START");

  // greeting
  await sayTeacher(`Hello ${studentName}.`);
  await nextTurn("Start the lesson. Begin with a short warm-up and a pronunciation focus.");
  updateTime();
}

function pauseLesson(){
  if(!running) return;
  paused = true;
  stopAudio();
  stopSTT();
  setStatus("PAUSED");
  const b = $("btnLesson");
  if(b) b.textContent = "Devam Et";
}

function resumeLesson(){
  if(!running) return;
  paused = false;
  setStatus("RUNNING");
  const b = $("btnLesson");
  if(b) b.textContent = "Mola Ver";
  if(pendingRepeat) listenStudent();
  else nextTurn("Continue.");
  updateTime();
}

function endLesson(){
  if(!running) return;
  running = false;
  paused = false;
  stopAudio();
  stopSTT();
  setStatus("DONE");
  playBell();
  // geri dön
  setTimeout(()=>location.href="/pages/plan_select.html", 650);
}

// ---------- BOOT ----------
document.addEventListener("DOMContentLoaded", async ()=>{
  try{
    // buttons
    $("backBtn")?.addEventListener("click", ()=>location.href="/pages/home.html");
    $("logoHome")?.addEventListener("click", ()=>location.href="/pages/home.html");
    $("btnBell")?.addEventListener("click", ()=>playBell());

    const btn = $("btnLesson");
    if(btn){
      btn.addEventListener("click", async ()=>{
        if(!running){
          btn.textContent = "Mola Ver";
          await startLesson();
          return;
        }
        if(paused) resumeLesson();
        else pauseLesson();
      });
    }

    // session
    const { data:{ session } } = await supabase.auth.getSession();
    if(!session?.user){
      location.replace("/pages/login.html");
      return;
    }

    // localStorage config (plan_select sets these)
    lang = String(localStorage.getItem("italky_course_lang") || "en").trim().toLowerCase();
    mins = Number(localStorage.getItem("italky_lesson_mins") || "15") || 15;
    mins = clamp(mins, 5, 60);

    // stt lang map
    const STT_MAP = { en:"en-US", de:"de-DE", fr:"fr-FR", it:"it-IT", es:"es-ES", ru:"ru-RU" };
    sttLang = STT_MAP[lang] || "en-US";

    // profile (name + levels)
    const userId = session.user.id;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, levels")
      .eq("id", userId)
      .maybeSingle();

    studentName = firstNameOnly(prof?.full_name || "") || "Kullanıcı";

    const lvlLS = String(localStorage.getItem("italky_course_level") || "").trim().toUpperCase();
    const lvlDB = String((prof?.levels && prof.levels[lang]) ? prof.levels[lang] : "").trim().toUpperCase();
    level = (["A1","A2","B1","B2","C1"].includes(lvlLS) ? lvlLS :
            (["A1","A2","B1","B2","C1"].includes(lvlDB) ? lvlDB : "A1"));

    setHeaderUI();
    setBadges();
    setStatus("READY");

    addBubble("teacher", `Lesson ready. Press “Dersi Başlat”.`, {
      speakable:true,
      onSpeak: async (t)=>{ try{ await speakTTS(t, sttLang); }catch{} }
    });

  }catch(e){
    console.error("teacher_course.page.js boot error:", e);
    try{ addBubble("tr", `(Boot hata: ${e?.message || e})`); }catch{}
  }
});
