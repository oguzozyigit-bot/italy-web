// FILE: /js/teacher_course.page.js
import { STORAGE_KEY } from "/js/config.js";

const API_BASE = "https://italky-api.onrender.com";
const $ = (id)=>document.getElementById(id);
const safeJson=(s,fb={})=>{ try{return JSON.parse(s||"");}catch{return fb;} };

function getUserCache(){
  return safeJson(localStorage.getItem(STORAGE_KEY), {});
}
function firstNameNoSurname(full){
  const s = String(full||"").trim().replace(/\s+/g," ");
  if(!s) return "Öğrenci";
  const parts = s.split(" ").filter(Boolean);
  if(parts.length === 1) return parts[0];
  // 2+ isimde son kelime soyad kabul
  return parts.slice(0, -1).join(" ");
}

// ---- Teacher map (6 dil)
const TEACHERS = {
  dora:   { id:"dora",   name:"Dora",   lang:"en", stt:"en-US" },
  ayda:   { id:"ayda",   name:"Ayda",   lang:"de", stt:"de-DE" },
  jale:   { id:"jale",   name:"Jale",   lang:"fr", stt:"fr-FR" },
  sencer: { id:"sencer", name:"Sencer", lang:"it", stt:"it-IT" },
  ozan:   { id:"ozan",   name:"Ozan",   lang:"es", stt:"es-ES" },
  sungur: { id:"sungur", name:"Sungur", lang:"ru", stt:"ru-RU" },
};
function getTeacher(){
  const id = String(localStorage.getItem("italky_teacher_pref")||"dora").trim();
  return TEACHERS[id] || TEACHERS.dora;
}
function getPlanMins(){
  const m = Number(localStorage.getItem("italky_lesson_mins")||"15");
  return [10,15,20,30].includes(m) ? m : 15;
}

// ---- UI
const chatEl = $("chat");
function scrollBottom(){ try{ chatEl.scrollTop = chatEl.scrollHeight; }catch{} }

function addBubble(cls, text, speakable=false){
  const d=document.createElement("div");
  d.className = `bubble ${cls}`;
  const txt = document.createElement("div");
  txt.className="txt";
  txt.textContent = String(text||"");
  d.appendChild(txt);

  if(speakable){
    const b=document.createElement("button");
    b.type="button";
    b.className="spkBtn";
    b.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>`;
    b.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      speakTTS(String(text||""), teacher.lang);
    });
    d.appendChild(b);
  }

  chatEl.appendChild(d);
  scrollBottom();
  return d;
}

function setStatus(s){
  const el=$("statusText");
  if(el) el.textContent = s;
}

function setBadges(){
  $("pillScore").textContent = "95%";
  $("pillTry").textContent = "●".repeat(Math.max(0, triesLeft)) + "○".repeat(Math.max(0, 3-triesLeft));
}

// ---- Translate (UI only)
async function translateTR(text, sourceLang){
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
        style: "fast",
        provider: "auto",
        strict: true,
        no_extra: true
      })
    });
    if(!r.ok) return "";
    const j = await r.json().catch(()=>null);
    return String(j?.translated || "").trim();
  }catch{ return ""; }
}

// ---- Audio: /api/tts (google -> openai fallback backend)
let audioObj=null;
function stopAudio(){ try{ if(audioObj){ audioObj.pause(); audioObj.currentTime=0; } }catch{} audioObj=null; }

async function speakTTS(text, lang){
  const t = String(text||"").trim();
  if(!t) return;

  stopAudio();
  setStatus("SPEAKING");

  try{
    const r = await fetch(`${API_BASE}/api/tts`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ text: t, lang })
    });
    if(!r.ok){
      setStatus("TTS_FAIL");
      return;
    }
    const j = await r.json().catch(()=>null);
    if(!j?.ok || !j?.audio_base64){
      setStatus("TTS_UNAVAILABLE");
      return;
    }
    const src = "data:audio/mpeg;base64," + j.audio_base64;
    audioObj = new Audio(src);
    audioObj.onended = ()=>{ audioObj=null; setStatus("RUNNING"); };
    await audioObj.play();
  }catch{
    setStatus("TTS_ERR");
  }
}

// ---- Bell
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
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+1.2);
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.start(); o2.start();
    o1.stop(ctx.currentTime+1.25); o2.stop(ctx.currentTime+1.25);
    setTimeout(()=>{ try{ctx.close();}catch{} }, 1400);
  }catch{}
}

// ---- Similarity (token + bag)
const TARGET_SIM = 0.95;
function normText(s){
  return String(s||"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu," ")
    .replace(/\s+/g," ")
    .trim();
}
function tokenSimilarity(a,b){
  const A = normText(a).split(" ").filter(Boolean);
  const B = normText(b).split(" ").filter(Boolean);
  if(!A.length && !B.length) return 1;
  if(!A.length || !B.length) return 0;

  const len = Math.max(A.length, B.length);
  let posHit=0;
  for(let i=0;i<Math.min(A.length,B.length);i++){ if(A[i]===B[i]) posHit++; }

  const setB=new Set(B);
  let bagHit=0;
  for(const w of A){ if(setB.has(w)) bagHit++; }

  return Math.max(posHit/len, bagHit/len);
}

// ---- SpeechRecognition
let recognition=null;
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
function stopSTT(){ try{ recognition?.stop?.(); }catch{} recognition=null; }

// ---- Lesson content generator (OpenAI chat backend)
async function teacherTurn(userText){
  const sys =
`You are a real ${teacher.lang.toUpperCase()} teacher.
Rules:
- Speak ONLY in ${teacher.lang.toUpperCase()} (never Turkish).
- Output MUST be exactly:
TEACH: (1-3 short lines)
REPEAT: (ONE single sentence student must say)
- Level is ${level}. Keep it appropriate.
- Be sweet but disciplined.`;

  const payload = {
    // senin backend chat_openai router’ında beklediğin alanlara göre:
    text: userText,
    system: sys,
    max_tokens: 220
  };

  const r = await fetch(`${API_BASE}/api/chat_openai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(t || `HTTP ${r.status}`);
  }
  const j = await r.json().catch(()=>null);
  return String(j?.text || j?.reply || "").trim();
}

function parseTeachRepeat(raw){
  const s=String(raw||"").trim();
  let teach=s, repeat="";
  const mR = s.match(/REPEAT:\s*([^\n\r]+)/i);
  if(mR) repeat = String(mR[1]||"").trim();
  const mT = s.match(/TEACH:\s*([\s\S]*?)\s*REPEAT:/i);
  if(mT) teach = String(mT[1]||"").trim();
  if(!repeat){
    const lines=s.split(/[\n\r]+/).map(x=>x.trim()).filter(Boolean);
    repeat = lines.at(-1) || "";
  }
  return { teach, repeat };
}

// ---- State
let teacher=null;
let mins=15;
let level="A1";
let running=false;
let paused=false;
let endAt=0;

let pendingRepeat="";
let triesLeft=3;

function formatLeft(){
  const ms = Math.max(0, endAt - Date.now());
  const s = Math.floor(ms/1000);
  const mm = Math.floor(s/60);
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}
function tick(){
  if(!running || paused) return;
  $("lessonInfo").textContent = `Ders: ${level} • Kalan: ${formatLeft()}`;
  if(Date.now() >= endAt){
    endLesson();
    return;
  }
  requestAnimationFrame(tick);
}

async function startLesson(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert("Bu cihazda SpeechRecognition yok. Chrome/Android WebView sınırlaması olabilir.");
    return;
  }
  running=true;
  paused=false;
  endAt = Date.now() + mins*60*1000;
  triesLeft=3;
  setBadges();

  $("btnLesson").textContent = "Mola Ver";
  setStatus("RUNNING");

  const u = getUserCache();
  const studentName = firstNameNoSurname(u?.full_name || u?.display_name || u?.name || "Öğrenci");

  // Açılış
  const hi = `Hello ${studentName}.`;
  addBubble("teacher", hi, true);
  const tr = await translateTR(hi, teacher.lang);
  if(tr) addBubble("tr", `(${tr})`, false);
  await speakTTS(hi, teacher.lang);

  await nextTeacher("Start the lesson with a quick warm-up. Then give a short pronunciation focus.");
  tick();
}

function pauseLesson(){
  paused=true;
  stopAudio(); stopSTT();
  setStatus("PAUSED");
  $("btnLesson").textContent = "Devam Et";
}
function resumeLesson(){
  paused=false;
  setStatus("RUNNING");
  $("btnLesson").textContent = "Mola Ver";
  if(pendingRepeat) listenStudent();
  else nextTeacher("Continue.");
  tick();
}

async function nextTeacher(userText){
  if(!running || paused) return;

  setStatus("THINKING");
  let reply="";
  try{
    reply = await teacherTurn(userText);
  }catch(e){
    addBubble("teacher", "Sorry. Connection issue. Let's try again.", true);
    setStatus("ERR");
    return;
  }

  const { teach, repeat } = parseTeachRepeat(reply);

  if(teach){
    addBubble("teacher", teach, true);
    const tr = await translateTR(teach, teacher.lang);
    if(tr) addBubble("tr", `(${tr})`, false);
    await speakTTS(teach, teacher.lang);
  }

  if(repeat){
    pendingRepeat = repeat;
    triesLeft = 3;
    setBadges();

    const repLine = `Repeat: ${repeat}`;
    addBubble("teacher", repLine, true);
    const tr = await translateTR(repLine, teacher.lang);
    if(tr) addBubble("tr", `(${tr})`, false);

    await speakTTS(repLine, teacher.lang);
    listenStudent();
    return;
  }

  listenStudent();
}

function listenStudent(){
  if(!running || paused) return;
  setStatus("LISTENING");

  stopSTT();
  const rec = buildRecognizer(teacher.stt);
  if(!rec){
    alert("SpeechRecognition yok.");
    running=false;
    return;
  }
  recognition=rec;

  rec.onresult = async (e)=>{
    const said = String(e.results?.[0]?.[0]?.transcript || "").trim();
    if(!said) return;

    addBubble("student", said, false);

    if(!pendingRepeat){
      await nextTeacher(said);
      return;
    }

    const sim = tokenSimilarity(said, pendingRepeat);
    const pct = Math.round(sim*100);

    if(sim >= TARGET_SIM){
      const okLine = `Good. (${pct}%)`;
      addBubble("teacher", okLine, true);
      const tr = await translateTR("Good.", teacher.lang);
      if(tr) addBubble("tr", `(${tr})`, false);

      await speakTTS("Good.", teacher.lang);
      pendingRepeat="";
      triesLeft=3;
      setBadges();
      await nextTeacher("Continue.");
      return;
    }

    triesLeft -= 1;
    setBadges();

    const noLine = `Not yet. (${pct}%) Try again.`;
    addBubble("teacher", noLine, true);
    const tr = await translateTR("Not yet. Try again.", teacher.lang);
    if(tr) addBubble("tr", `(${tr})`, false);

    await speakTTS("Not yet. Try again.", teacher.lang);

    if(triesLeft <= 0){
      addBubble("teacher", "Okay. We move on.", true);
      const trm = await translateTR("Okay. We move on.", teacher.lang);
      if(trm) addBubble("tr", `(${trm})`, false);

      await speakTTS("Okay. We move on.", teacher.lang);
      pendingRepeat="";
      triesLeft=3;
      setBadges();
      await nextTeacher("Continue.");
      return;
    }

    // tekrar aynı cümle
    const repLine = `Repeat: ${pendingRepeat}`;
    addBubble("teacher", repLine, true);
    const tr2 = await translateTR(repLine, teacher.lang);
    if(tr2) addBubble("tr", `(${tr2})`, false);
    await speakTTS(repLine, teacher.lang);

    listenStudent();
  };

  rec.onerror = ()=>{};
  try{ rec.start(); }catch{}
}

async function endLesson(){
  if(!running) return;
  running=false;
  paused=false;
  stopAudio(); stopSTT();
  setStatus("DONE");
  $("btnLesson").textContent = "Dersi Başlat";

  const u = getUserCache();
  const studentName = firstNameNoSurname(u?.full_name || u?.display_name || u?.name || "Öğrenci");

  const bye = `Good job today, ${studentName}. See you next time.`;
  addBubble("teacher", bye, true);
  const tr = await translateTR(bye, teacher.lang);
  if(tr) addBubble("tr", `(${tr})`, false);
  await speakTTS(bye, teacher.lang);
  playBell();
}

// ---- Boot
document.addEventListener("DOMContentLoaded", ()=>{
  teacher = getTeacher();
  mins = getPlanMins();

  // level’ı profiles.levels’dan daha sonra okuyup set edeceğiz; şimdilik local
  // (istersen buraya supabase read ekleriz)
  level = String(localStorage.getItem("italky_course_level") || "A1").toUpperCase();
  if(!["A1","A2","B1","B2","C1"].includes(level)) level="A1";

  $("teacherName").textContent = `${teacher.name} • ${teacher.lang.toUpperCase()}`;
  $("lessonInfo").textContent = `Ders: ${level} • Süre: ${mins} dk`;
  setBadges();
  setStatus("READY");

  $("backBtn")?.addEventListener("click", ()=>location.href="/pages/plan_select.html");
  $("logoHome")?.addEventListener("click", ()=>location.href="/pages/home.html");

  $("btnBell")?.addEventListener("click", playBell);

  $("btnLesson")?.addEventListener("click", async ()=>{
    if(!running){
      await startLesson();
      return;
    }
    if(paused) resumeLesson();
    else pauseLesson();
  });

  addBubble("teacher", `Lesson ready. Press “Dersi Başlat”.`, true);
});
