// FILE: italky-web/js/voice_ai_page.js
import { BASE_DOMAIN, STORAGE_KEY } from "/js/config.js";

const $ = (id) => document.getElementById(id);

function safeJson(s, fb = {}) { try { return JSON.parse(s || ""); } catch { return fb; } }
function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1600);
}

function getUser(){
  return safeJson(localStorage.getItem(STORAGE_KEY), {});
}
function ensureLogged(){
  const u = getUser();
  if(!u || !u.email || !u.isSessionActive){
    location.replace("/index.html");
    return null;
  }
  return u;
}

/* ---------- Voice preferences (OpenAI voices) ---------- */
const VOICES = [
  { id:"alloy",   name:"Alloy",   hint:"Dengeli, net" },
  { id:"nova",    name:"Nova",    hint:"Daha parlak" },
  { id:"shimmer", name:"Shimmer", hint:"Yumuşak" },
  { id:"echo",    name:"Echo",    hint:"Tok" },
  { id:"fable",   name:"Fable",   hint:"Hikâye tonu" },
  { id:"onyx",    name:"Onyx",    hint:"Daha derin" },
];

function getSavedVoice(u){
  return String(u.voice_pref || "").trim() || "alloy";
}
function saveVoiceToProfile(u, voiceId){
  u.voice_pref = voiceId;
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); }catch{}
}

let selectedVoice = "alloy";

/* ---------- UI states ---------- */
function setWave(mode, statusText){
  const w = $("wave");
  w.classList.remove("listening","thinking","speaking");
  if(mode) w.classList.add(mode);
  $("status").textContent = statusText || "Hazır";
}

/* ---------- Bubbles ---------- */
function addLine(kind, text){
  const box = $("bubbles");
  const d = document.createElement("div");
  d.className = `line ${kind}`;
  d.textContent = String(text||"");
  box.appendChild(d);
  // keep last 6 lines
  while(box.children.length > 6) box.removeChild(box.firstElementChild);
}

/* ---------- STT (SpeechRecognition) ---------- */
function makeRecognizer(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = "tr-TR";           // kullanıcı Türkçe konuşuyor varsayımı (istersen sonra ayarlarız)
  r.interimResults = false;
  r.continuous = false;
  return r;
}

/* ---------- Audio play (base64 mp3) ---------- */
function playBase64Mp3(b64){
  return new Promise((resolve)=>{
    if(!b64){ resolve(false); return; }
    try{
      const a = new Audio("data:audio/mpeg;base64," + b64);
      a.onended = ()=> resolve(true);
      a.onerror = ()=> resolve(false);
      a.play().catch(()=> resolve(false));
    }catch{
      resolve(false);
    }
  });
}

/* ---------- API: voice chat ---------- */
async function apiVoiceChat(u, text){
  const base = String(BASE_DOMAIN||"").replace(/\/+$/,"");
  const url = `${base}/api/voice/chat`;
  const body = {
    user_id: (u.user_id || u.id || u.email),
    text,
    voice: selectedVoice,
  };

  const r = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });

  const raw = await r.text().catch(()=> "");
  if(!r.ok) throw new Error(raw || `HTTP ${r.status}`);
  let data = {};
  try{ data = JSON.parse(raw||"{}"); }catch{}
  return {
    text: String(data.text || "").trim(),
    audio_base64: String(data.audio_base64 || data.audio || "").trim()
  };
}

/* ---------- Voice modal ---------- */
function openVoiceModal(){
  $("voiceModal").classList.add("show");
}
function closeVoiceModal(){
  $("voiceModal").classList.remove("show");
}

function renderVoiceList(){
  const list = $("voiceList");
  list.innerHTML = "";
  VOICES.forEach(v=>{
    const row = document.createElement("div");
    row.className = "voiceRow" + (v.id===selectedVoice ? " selected" : "");
    row.dataset.voice = v.id;
    row.innerHTML = `<div>
      <div class="vName">${v.name}</div>
      <div class="vHint">${v.hint}</div>
    </div>
    <div class="vHint">${v.id}</div>`;
    row.addEventListener("click", ()=>{
      selectedVoice = v.id;
      renderVoiceList();
    });
    list.appendChild(row);
  });
}

/* ---------- main flow ---------- */
let busy = false;

async function startVoiceTurn(u){
  if(busy) return;
  const rec = makeRecognizer();
  if(!rec){ toast("Bu cihaz konuşmayı yazıya çevirmiyor."); return; }

  busy = true;
  setWave("listening","Dinliyorum…");

  let said = "";

  rec.onresult = (e)=>{
    said = (e.results?.[0]?.[0]?.transcript || "").trim();
  };

  rec.onerror = ()=>{
    busy = false;
    setWave(null,"Hazır");
    toast("Mikrofon izni / HTTPS sorunu olabilir.");
  };

  rec.onend = async ()=>{
    if(!said){
      busy = false;
      setWave(null,"Hazır");
      toast("Duyamadım. Bir daha dene.");
      return;
    }

    addLine("me", said);

    try{
      setWave("thinking","Düşünüyorum…");
      const out = await apiVoiceChat(u, said);
      const reply = out.text || "…";
      addLine("ai", reply);

      setWave("speaking","Konuşuyorum…");
      await playBase64Mp3(out.audio_base64);
    }catch(e){
      addLine("ai","Şu an cevap veremedim. Bir daha dener misin?");
      toast("API hata verdi.");
    }

    busy = false;
    setWave(null,"Hazır");
  };

  try{ rec.start(); }
  catch{
    busy = false;
    setWave(null,"Hazır");
    toast("Mikrofon açılamadı.");
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  const u = ensureLogged();
  if(!u) return;

  // nav
  $("backBtn").addEventListener("click", ()=> location.href="/pages/home.html");

  // voice load
  selectedVoice = getSavedVoice(u);
  renderVoiceList();

  // open modal on brand click
  $("brandBtn").addEventListener("click", openVoiceModal);

  $("closeVoice").addEventListener("click", closeVoiceModal);
  $("voiceModal").addEventListener("click", (e)=>{ if(e.target === $("voiceModal")) closeVoiceModal(); });

  $("saveVoice").addEventListener("click", ()=>{
    saveVoiceToProfile(u, selectedVoice);
    closeVoiceModal();
    toast(`Ses kaydedildi: ${selectedVoice}`);
  });

  // first time: ask voice
  if(!String(u.voice_pref||"").trim()){
    openVoiceModal();
  }

  // talk
  $("talkBtn").addEventListener("click", ()=> startVoiceTurn(u));
});
