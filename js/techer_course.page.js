// FILE: /js/teacher_course.page.js
// italkyAI Teacher Course — Speech-only, Sweet but Disciplined
// - Teacher speaks target language only
// - UI shows Turkish translation in parentheses
// - 95% similarity, 3 tries
// - No typing, no mic button
// - Start/Pause button controls the lesson
// - Classic bell (WebAudio)

// deps
import { STORAGE_KEY, BASE_DOMAIN } from "/js/config.js";
import { apiPOST } from "/js/api.js";

const $ = (id)=>document.getElementById(id);
function safeJson(s, fb={}){ try{return JSON.parse(s||"");}catch{return fb;} }
function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }

// auth
function termsKey(email=""){ return `italky_terms_accepted_at::${String(email||"").toLowerCase().trim()}`; }
function getUser(){ return safeJson(localStorage.getItem(STORAGE_KEY), {}); }
function ensureLogged(){
  const u=getUser();
  if(!u?.email){ location.replace("/index.html"); return null; }
  if(!localStorage.getItem(termsKey(u.email))){ location.replace("/index.html"); return null; }
  return u;
}

// teacher prefs
const KEY_TEACHER = "italky_teacher_pref";
const KEY_MINS = "italky_lesson_mins";
const KEY_LEVEL = "italky_lesson_level";

const TEACHERS = {
  dora:   { id:"dora",   nameTR:"Dora",   lang:"en", stt:"en-US", voice:"nova" },
  ayda:   { id:"ayda",   nameTR:"Ayda",   lang:"de", stt:"de-DE", voice:"shimmer" },
  jale:   { id:"jale",   nameTR:"Jale",   lang:"fr", stt:"fr-FR", voice:"alloy" },
  sencer: { id:"sencer", nameTR:"Sencer", lang:"it", stt:"it-IT", voice:"echo" },
  ozan:   { id:"ozan",   nameTR:"Ozan",   lang:"es", stt:"es-ES", voice:"fable" },
  sungur: { id:"sungur", nameTR:"Sungur", lang:"ru", stt:"ru-RU", voice:"onyx" },
  huma:   { id:"huma",   nameTR:"Hüma",   lang:"ja", stt:"ja-JP", voice:"nova" }
};

function getTeacher(){
  const id = (localStorage.getItem(KEY_TEACHER)||"dora").trim();
  return TEACHERS[id] || TEACHERS.dora;
}
function getMins(){
  const m = (localStorage.getItem(KEY_MINS)||"10").trim();
  return (m==="20"||m==="30") ? Number(m) : 10;
}
function getLevel(){
  const l = (localStorage.getItem(KEY_LEVEL)||"A0").trim().toUpperCase();
  return ["A0","A1","A2","B1"].includes(l) ? l : "A0";
}

// UI helpers
const chatEl = $("chat");
function scrollBottom(){
  try{ chatEl.scrollTop = chatEl.scrollHeight; }catch{}
}
function addBubble(cls, text){
  const d=document.createElement("div");
  d.className = `bubble ${cls}`;
  d.textContent = String(text||"");
  chatEl.appendChild(d);
  scrollBottom();
  return d;
}

// Turkish translation (UI only)
async function translateToTR(text, sourceLang){
  const t = String(text||"").trim();
  if(!t) return "";
  try{
    const b = base();
    if(!b) return "";
    const r = await fetch(`${b}/api/translate`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ text:t, source: sourceLang, target:"tr", from_lang: sourceLang, to_lang:"tr" })
    });
    if(!r.ok) return "";
    const data = await r.json().catch(()=> ({}));
    const out = String(data?.translated || data?.translation || data?.text || "").trim();
    return out || "";
  }catch{ return ""; }
}

// similarity
const TARGET_SIM = 0.95;
const MAX_TRIES = 3;
function normText(s){
  return String(s||"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu," ")
    .replace(/\s+/g," ")
    .trim();
}
function tokenSimilarity(a,b){
  const A = normText(a).split(" ").filter(Boolean);
  const B = normText(b).split(" ").filter(Boolean);
  if(!A.length && !B.length) return 1;
  if(!A.length || !B.length) return 0;
  const len = Math.max(A.length, B.length);
  let hit=0;
  for(let i=0;i<Math.min(A.length,B.length);i++){ if(A[i]===B[i]) hit++; }
  const setB=new Set(B); let bagHit=0;
  for(const w of A){ if(setB.has(w)) bagHit++; }
  return Math.max(hit/len, bagHit/len);
}

// bell (classic-ish)
function playBell(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g  = ctx.createGain();
    o1.type="sine"; o2.type="sine";
    o1.frequency.value = 880;  // A5
    o2.frequency.value = 1320; // E6
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+1.4);
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.start(); o2.start();
    o1.stop(ctx.currentTime+1.45); o2.stop(ctx.currentTime+1.45);
    setTimeout(()=>{ try{ctx.close();}catch{} }, 1600);
  }catch{}
}

// TTS via backend
let currentAudio=null;
function stopAudio(){ if(currentAudio){ try{currentAudio.pause();}catch{} currentAudio=null; } }
async function speakTTS(text, voice, onEnd){
  stopAudio();
  const t=String(text||"").trim(); if(!t){ onEnd?.(); return; }
  $("statusText").textContent = "SPEAKING";
  try{
    const data = await apiPOST("/api/tts_openai", { text:t, voice, speed:1.05 }, { timeoutMs:45000 });
    const b64 = data?.audio_base64;
    if(!b64){ onEnd?.(); return; }
    const audio = new Audio("data:audio/mp3;base64,"+b64);
    currentAudio=audio;
    audio.onended=()=>{ currentAudio=null; onEnd?.(); };
    await audio.play();
  }catch{
    onEnd?.();
  }
}

// STT
let recognition=null;
function stopSTT(){ try{recognition?.stop?.();}catch{} recognition=null; }
function buildRecognizer(lang){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = lang;
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

// Teacher engine (OpenAI text)
function teacherSystemPrompt({teacherName, lang, level, studentName}){
  return `
You are ${teacherName}, a sweet but disciplined ${lang.toUpperCase()} language teacher in italkyAI.
Rules:
- You NEVER speak Turkish. Never translate to Turkish. Never mention OpenAI/GPT/AI/Gemini.
- Use the student's name ONLY at the start, once during a strict reminder, and at the end (not every sentence).
- Teach like a real class: pronunciation + letters/sounds + examples.
- Output MUST be exactly:
TEACH: (1-3 short lines)
REPEAT: (ONE single sentence the student must say)
- Level: ${level}. Keep it appropriate.
- Today’s focus can include sounds/letters (e.g., vowel pronunciation).
Student name: ${studentName}.
`.trim();
}

async function apiTeacherText(userText, teacher, level, studentName, history){
  const sys = teacherSystemPrompt({ teacherName: teacher.nameTR, lang: teacher.lang, level, studentName });
  const h = [
    { role:"assistant", content: sys },
    ...(history||[]).slice(-6)
  ];
  const data = await apiPOST("/api/chat_openai", {
    text: userText,
    persona_name: teacher.nameTR,
    history: h,
    max_tokens: 220
  }, { timeoutMs: 25000 });
  return String(data?.text || "").trim();
}

function parseTeachRepeat(reply){
  const raw=String(reply||"").trim();
  let teach=raw, repeat="";
  const mR = raw.match(/REPEAT:\s*([^\n\r]+)/i);
  if(mR) repeat=String(mR[1]||"").trim();
  const mT = raw.match(/TEACH:\s*([\s\S]*?)(?:\n|\r|$)REPEAT:/i);
  if(mT) teach=String(mT[1]||"").trim();
  if(!repeat){
    const lines = raw.split(/[\n\r]+/).map(x=>x.trim()).filter(Boolean);
    repeat = lines[lines.length-1] || "";
  }
  if(!teach) teach = raw;
  return { teach, repeat };
}

// Course state
let u=null;
let teacher=null;
let level="A0";
let mins=10;
let running=false;
let paused=false;
let endAt=0;

let pendingRepeat="";
let triesLeft=MAX_TRIES;
let history=[];

function setBadges(){
  $("pillTry").textContent = "●".repeat(Math.max(0, triesLeft)) + "○".repeat(Math.max(0, MAX_TRIES-triesLeft));
  $("pillScore").textContent = "95%";
}

function setHeader(){
  const title = `${teacher.nameTR} • ${teacher.lang.toUpperCase()} • ${level}`;
  $("teacherName").textContent = title;
  $("lessonInfo").textContent = `${mins} dk`;
}

function setStatus(s){ $("statusText").textContent = s; }

function resetRepeat(){
  pendingRepeat="";
  triesLeft=MAX_TRIES;
  setBadges();
}

function pauseLesson(){
  paused=true;
  stopAudio();
  stopSTT();
  setStatus("PAUSED");
  $("btnLesson").textContent = "Devam Et";
}
function resumeLesson(){
  paused=false;
  setStatus("RUNNING");
  $("btnLesson").textContent = "Mola Ver";
  // Continue flow: if waiting repeat, listen; else teacher continues
  if(pendingRepeat) listenStudent();
  else teacherNext("Continue.");
}

function stopLesson(){
  running=false;
  paused=false;
  stopAudio(); stopSTT();
  setStatus("READY");
  $("btnLesson").textContent = "Dersi Başlat";
}

function formatTimeLeft(){
  const ms = Math.max(0, endAt - Date.now());
  const s = Math.floor(ms/1000);
  const mm = Math.floor(s/60);
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

function tickTime(){
  if(!running || paused) return;
  if(Date.now() >= endAt){
    // time ended: finish current turn only, do not start new topics
    // We will let the current repeat/turn finish, then close.
    // Mark endAt=now to prevent new topics.
    endAt = Date.now();
  }
  $("lessonInfo").textContent = `${mins} dk • ${formatTimeLeft()}`;
  requestAnimationFrame(tickTime);
}

async function startLesson(){
  if(running) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert("Bu cihaz konuşmayı yazıya çevirmiyor (SpeechRecognition yok).");
    return;
  }
  running=true;
  paused=false;
  endAt = Date.now() + mins*60*1000;
  setStatus("RUNNING");
  $("btnLesson").textContent = "Mola Ver";
  $("lessonInfo").textContent = `${mins} dk • ${formatTimeLeft()}`;
  resetRepeat();

  // Teacher auto starts (with student name)
  const studentName = (u?.name || u?.fullname || "Student").split(" ")[0].trim() || "Student";
  addBubble("teacher", `Hello ${studentName}.`);
  const tr1 = await translateToTR(`Hello ${studentName}.`, teacher.lang);
  if(tr1) addBubble("tr", `(${tr1})`);

  await speakTTS(`Hello ${studentName}.`, teacher.voice, async ()=>{
    await teacherNext("Start the lesson. Begin with a short warm-up and then a sound/letter topic.");
    tickTime();
  });
}

async function teacherNext(userText){
  if(!running || paused) return;

  // If time ended, do not start new blocks; only close when current cycle ends
  const timeEnded = Date.now() >= endAt;

  setStatus("THINKING");

  history.push({ role:"user", content: userText });
  if(history.length>12) history = history.slice(-12);

  let reply="";
  try{
    reply = await apiTeacherText(userText, teacher, level, (u?.name||"Student").split(" ")[0], history);
  }catch{}

  const { teach, repeat } = parseTeachRepeat(reply);
  const teachText = (teach||"").trim();
  const repeatText = (repeat||"").trim();

  history.push({ role:"assistant", content: reply||"" });
  if(history.length>12) history = history.slice(-12);

  if(teachText){
    addBubble("teacher", teachText);
    const tr = await translateToTR(teachText, teacher.lang);
    if(tr) addBubble("tr", `(${tr})`);
    await speakTTS(teachText, teacher.voice, ()=>{});
  }

  if(repeatText){
    // If time ended and we are about to start a fresh repeat cycle, allow ONE final cycle then finish.
    pendingRepeat = repeatText;
    triesLeft = MAX_TRIES;
    setBadges();

    addBubble("teacher", `Repeat: ${repeatText}`);
    const tr = await translateToTR(`Repeat: ${repeatText}`, teacher.lang);
    if(tr) addBubble("tr", `(${tr})`);

    await speakTTS(`Repeat: ${repeatText}`, teacher.voice, ()=>{
      listenStudent();
    });
    return;
  }

  // If no repeat line, just continue listening
  if(timeEnded){
    await endLessonProperly();
  }else{
    listenStudent();
  }
}

function listenStudent(){
  if(!running || paused) return;

  setStatus("LISTENING");

  stopSTT();
  const rec = buildRecognizer(teacher.stt);
  if(!rec){
    alert("SpeechRecognition yok.");
    stopLesson();
    return;
  }
  recognition = rec;

  rec.onresult = async (e)=>{
    const said = String(e.results?.[0]?.[0]?.transcript || "").trim();
    if(!said) return;

    addBubble("student", said);

    // Repeat check
    if(pendingRepeat){
      const score = tokenSimilarity(said, pendingRepeat);
      if(score >= TARGET_SIM){
        addBubble("teacher", `Good. (${Math.round(score*100)}%)`);
        const tr = await translateToTR(`Good.`, teacher.lang);
        if(tr) addBubble("tr", `(${tr})`);

        await speakTTS("Good.", teacher.voice, async ()=>{
          resetRepeat();

          // If time ended, finish now with bell + goodbye
          if(Date.now() >= endAt){
            await endLessonProperly();
          }else{
            await teacherNext("Continue.");
          }
        });

      } else {
        triesLeft -= 1;
        setBadges();

        // syllable / sound breakdown (heceleme)
        const breakdown = buildSyllableHint(pendingRepeat, teacher.lang);

        addBubble("teacher", `Not yet. Listen: ${breakdown} (tries left: ${triesLeft})`);
        const tr = await translateToTR(`Not yet. Listen carefully.`, teacher.lang);
        if(tr) addBubble("tr", `(${tr})`);

        await speakTTS(`Not yet. Listen carefully.`, teacher.voice, async ()=>{
          // replay repeat
          if(triesLeft <= 0){
            addBubble("teacher", `Okay. We move on.`);
            const trm = await translateToTR(`Okay. We move on.`, teacher.lang);
            if(trm) addBubble("tr", `(${trm})`);

            await speakTTS(`Okay. We move on.`, teacher.voice, async ()=>{
              resetRepeat();
              if(Date.now() >= endAt) await endLessonProperly();
              else await teacherNext("Continue.");
            });
          } else {
            addBubble("teacher", `Repeat: ${pendingRepeat}`);
            const tr2 = await translateToTR(`Repeat: ${pendingRepeat}`, teacher.lang);
            if(tr2) addBubble("tr", `(${tr2})`);

            await speakTTS(`Repeat: ${pendingRepeat}`, teacher.voice, ()=>{
              listenStudent();
            });
          }
        });
      }
      return;
    }

    // If no pending repeat, continue lesson
    await teacherNext(said);
  };

  rec.onerror = ()=>{ /* keep silent */ };
  rec.onend = ()=>{ /* we control flow */ };

  try{ rec.start(); }catch{}
}

function buildSyllableHint(sentence, lang){
  // Basic syllable-ish hint: split words, then hyphenate long words
  const s = normText(sentence);
  const words = s.split(" ").filter(Boolean);
  const parts = words.map(w=>{
    if(w.length<=4) return w;
    // naive split: 2+2+...
    const seg=[];
    for(let i=0;i<w.length;i+=2) seg.push(w.slice(i,i+2));
    return seg.join("-");
  });
  return parts.join(" | ");
}

async function endLessonProperly(){
  if(!running) return;
  setStatus("ENDING");

  // sweet but disciplined goodbye with name (only at end)
  const studentName = (u?.name || u?.fullname || "Student").split(" ")[0].trim() || "Student";
  const bye = `Good job today, ${studentName}. See you tomorrow.`;
  addBubble("teacher", bye);
  const tr = await translateToTR(bye, teacher.lang);
  if(tr) addBubble("tr", `(${tr})`);

  await speakTTS(bye, teacher.voice, ()=>{
    playBell(); // classic bell
    stopLesson();
    setStatus("DONE");
  });
}

// boot
document.addEventListener("DOMContentLoaded", ()=>{
  u = ensureLogged();
  if(!u) return;

  teacher = getTeacher();
  mins = getMins();
  level = getLevel();

  setHeader();
  setBadges();
  setStatus("READY");

  $("backBtn")?.addEventListener("click", ()=>location.href="/pages/home.html");
  $("logoHome")?.addEventListener("click", ()=>location.href="/pages/home.html");

  const btn = $("btnLesson");
  btn.addEventListener("click", async ()=>{
    if(!running){
      await startLesson();
      return;
    }
    // running: toggle pause/resume
    if(paused) resumeLesson();
    else pauseLesson();
  });

  // initial info
  addBubble("teacher", `Lesson ready. Press “Dersi Başlat”.`);
});
