// FILE: /js/f2f_call.js
import { LANG_POOL } from "/js/lang_pool_full.js";
import { STORAGE_KEY } from "/js/config.js";
import { shortDisplayName } from "/js/ui_shell.js";

const API_BASE = "https://italky-api.onrender.com";
const $ = (id)=>document.getElementById(id);

const params = new URLSearchParams(location.search);
const room = (params.get("room")||"").trim().toUpperCase();
const role = (params.get("role")||"").trim().toLowerCase();
let myLang = (params.get("me_lang")||localStorage.getItem("f2f_my_lang")||"tr").trim().toLowerCase();
localStorage.setItem("f2f_my_lang", myLang);

const LANGS = Array.isArray(LANG_POOL) ? LANG_POOL : [
  { code:"tr", flag:"🇹🇷", name:"Türkçe" },
  { code:"en", flag:"🇬🇧", name:"English" },
];

function norm(code){ return String(code||"").toLowerCase().trim(); }
function langLabel(code){
  const c = norm(code);
  const item = LANGS.find(x=>norm(x.code)===c);
  const flag = item?.flag || "🌐";
  const name = item?.name || c.toUpperCase();
  return `${flag} ${name}`;
}

function getProfileFromCache(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { name:"Kullanıcı", picture:"" };
    const u = JSON.parse(raw);
    const full = u.display_name || u.full_name || u.name || "";
    const name = shortDisplayName(full || "Kullanıcı");
    const picture = u.picture || u.avatar || u.avatar_url || "";
    return { name, picture };
  }catch{
    return { name:"Kullanıcı", picture:"" };
  }
}
const MY_PROFILE = getProfileFromCache();

const chat = $("chat");
const msgInput = $("msgInput");
const micBtn = $("micBtn");
const sendBtn = $("sendBtn");
const langSelect = $("langSelect");

/* Topbar setup */
$("roomInfo").textContent = "ROOM: " + (room || "—");
$("userName").textContent = MY_PROFILE.name || "Kullanıcı";

if(MY_PROFILE.picture){
  $("avatarImg").src = MY_PROFILE.picture;
  $("avatarImg").style.display = "block";
  $("avatarFallback").style.display = "none";
}else{
  $("avatarFallback").textContent = (MY_PROFILE.name||"K")[0]?.toUpperCase() || "•";
}
$("avatarBtn").onclick = ()=> location.href="/pages/profile.html";
$("logoHome").onclick = ()=> location.href="/pages/home.html";
$("backBtn").onclick = ()=> location.href="/pages/f2f_connect.html";

/* Populate lang select (always clickable) */
(function initLangSelect(){
  langSelect.innerHTML = LANGS.map(l=>{
    const c = norm(l.code);
    const label = `${l.flag||"🌐"} ${l.name||c.toUpperCase()}`;
    return `<option value="${c}">${label}</option>`;
  }).join("");
  langSelect.value = myLang;
  langSelect.addEventListener("change", ()=>{
    myLang = norm(langSelect.value);
    localStorage.setItem("f2f_my_lang", myLang);
  });
})();

/* Auto-grow textarea + send on Enter */
function growTA(){
  msgInput.style.height = "0px";
  const h = Math.min(120, msgInput.scrollHeight);
  msgInput.style.height = h + "px";
}
msgInput.addEventListener("input", growTA);
setTimeout(growTA, 0);

msgInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    sendTyped();
  }
});

$("clearChat").onclick = ()=>{
  chat.innerHTML = "";
};

/* ===== WS ===== */
let ws = null;
const clientId = (crypto?.randomUUID?.() || ("c_" + Math.random().toString(16).slice(2))).slice(0,18);

function wsUrl(){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function connect(){
  if(!room) return addMeta("Room eksik");
  ws = new WebSocket(wsUrl());

  ws.onopen = ()=>{
    ws.send(JSON.stringify({
      type:"hello", room, role,
      from: clientId,
      from_name: MY_PROFILE.name,
      me_lang: myLang
    }));
    addMeta("Bağlandı ✅");
  };

  ws.onmessage = async (ev)=>{
    let msg=null;
    try{ msg = JSON.parse(ev.data); }catch{ return; }

    if(msg.type === "info"){
      addMeta(String(msg.message||"info"));
      return;
    }

    if(msg.type === "translated"){
      const from = String(msg.from||"");
      if(from && from === clientId) return;

      const srcLang = norm(msg.lang || "en");
      const raw = String(msg.text || "").trim();
      const name = String(msg.from_name || "Katılımcı").trim();
      if(!raw) return;

      addMessage("left", name, raw, false, null);

      let out = raw;
      if(srcLang && myLang && srcLang !== myLang){
        const tr = await translateAI(raw, srcLang, myLang);
        if(tr) out = tr;
      }

      addMessage("right", MY_PROFILE.name, out, true, myLang);
      await speakViaTTS(out, myLang);
    }
  };
}
connect();

/* ===== UI helpers ===== */
function avatarNode(src, name){
  const a = document.createElement("div");
  a.className = "msgAvatar";
  if(src){
    const img = document.createElement("img");
    img.src = src;
    img.referrerPolicy = "no-referrer";
    a.appendChild(img);
  }else{
    a.textContent = (String(name||"•")[0]||"•").toUpperCase();
  }
  return a;
}

function addMeta(text){
  const b = document.createElement("div");
  b.className = "bubble meta";
  b.textContent = text;
  chat.appendChild(b);
  chat.scrollTop = chat.scrollHeight;
}

function addMessage(side, name, text, speakable=false, lang=null){
  const row = document.createElement("div");
  row.className = "msgRow " + (side === "right" ? "right" : "left");

  const av = avatarNode(side==="right" ? MY_PROFILE.picture : "", name);

  const wrap = document.createElement("div");
  wrap.className = "bubbleWrap";

  const nm = document.createElement("div");
  nm.className = "nameLine";
  nm.textContent = name || "";
  wrap.appendChild(nm);

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (side === "right" ? "user" : "bot");
  bubble.textContent = text;

  if(speakable){
    const sp = document.createElement("div");
    sp.className = "spkBtn";
    sp.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M3 10v4h4l5 4V6L7 10H3z"></path>
        <path d="M16 8c1.5 1 1.5 7 0 8"></path>
        <path d="M19 6c3 2 3 10 0 12"></path>
      </svg>`;
    sp.onclick = ()=> speakViaTTS(text, lang || myLang || "en");
    bubble.appendChild(sp);
  }

  wrap.appendChild(bubble);

  row.appendChild(av);
  row.appendChild(wrap);

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

/* ===== API calls ===== */
async function translateAI(text, from, to){
  const res = await fetch(`${API_BASE}/api/translate_ai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text, from_lang: from, to_lang: to, style:"chat", provider:"auto" })
  });
  if(!res.ok) return null;
  const data = await res.json().catch(()=>null);
  return data?.translated ? String(data.translated) : null;
}

let audioObj=null, lastAudioAt=0;
function stopAudio(){
  try{ if(audioObj){ audioObj.pause(); audioObj.currentTime=0; } }catch{}
  audioObj=null;
}
async function speakViaTTS(text, lang){
  const now = Date.now();
  if(now - lastAudioAt < 250) stopAudio();
  lastAudioAt = now;

  const res = await fetch(`${API_BASE}/api/tts`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text, lang, speaking_rate: 1, pitch: 0 })
  });
  if(!res.ok) return;

  const data = await res.json().catch(()=>null);
  if(!data?.ok || !data.audio_base64) return;

  const binary = atob(data.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const blob = new Blob([bytes], {type:"audio/mpeg"});
  const url = URL.createObjectURL(blob);

  stopAudio();
  audioObj = new Audio(url);
  audioObj.onended = ()=>URL.revokeObjectURL(url);
  audioObj.onerror = ()=>URL.revokeObjectURL(url);
  await audioObj.play();
}

/* ===== STT (MediaRecorder + /api/stt) ===== */
function pickMime(){
  const cands = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/ogg"];
  for(const m of cands){
    try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch{}
  }
  return "";
}
async function sttBlob(blob, lang){
  const fd = new FormData();
  fd.append("file", blob, "speech.webm");
  fd.append("lang", lang);
  const r = await fetch(`${API_BASE}/api/stt`, { method:"POST", body: fd });
  if(!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return String(j.text||"").trim();
}
async function cleanSpeechText(text, lang){
  const t = String(text||"").trim();
  if(!t) return t;
  const r = await fetch(`${API_BASE}/api/translate_ai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, from_lang: lang, to_lang: lang, style:"chat", provider:"auto" })
  });
  if(!r.ok) return t;
  const data = await r.json().catch(()=>null);
  return String(data?.translated||"").trim() || t;
}
async function parseCommand(text){
  const t = String(text||"").trim();
  if(!t) return null;
  const r = await fetch(`${API_BASE}/api/command_parse`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, ui_lang: "tr" })
  });
  if(!r.ok) return null;
  return await r.json().catch(()=>null);
}

/* ===== SEND typed ===== */
async function sendTyped(){
  const raw = String(msgInput.value||"").trim();
  if(!raw) return;
  msgInput.value = "";
  growTA();

  // command
  const cmd = await parseCommand(raw);
  if(cmd?.is_command && cmd?.target_lang){
    myLang = norm(cmd.target_lang);
    localStorage.setItem("f2f_my_lang", myLang);
    langSelect.value = myLang;
    addMeta("Dil değişti ✅");
    return;
  }

  const cleaned = await cleanSpeechText(raw, myLang);
  addMessage("right", MY_PROFILE.name, cleaned, true, myLang);

  if(!ws || ws.readyState !== 1){
    addMeta("Bağlantı yok");
    return;
  }

  ws.send(JSON.stringify({
    type:"translated",
    from: clientId,
    from_name: MY_PROFILE.name,
    text: cleaned,
    lang: myLang
  }));
}
sendBtn.addEventListener("click", sendTyped);

/* ===== MIC toggle ===== */
let recJob=null, isBusy=false;

async function startRecord(){
  if(isBusy) return;
  isBusy=true;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks=[];
    mr.ondataavailable = (e)=>{ if(e.data && e.data.size) chunks.push(e.data); };
    mr.start(250);
    const timer = setTimeout(()=> stopRecord(), 20000);
    recJob = { stream, mr, chunks, timer };
    micBtn.classList.add("listening");
    addMeta("Dinliyorum…");
  }catch{
    addMeta("Mikrofon açılamadı");
  }finally{
    isBusy=false;
  }
}

async function stopRecord(){
  if(!recJob || isBusy) return;
  isBusy=true;
  try{
    clearTimeout(recJob.timer);
    try{ recJob.stream.getTracks().forEach(t=>t.stop()); }catch{}
    try{ recJob.mr.stop(); }catch{}
    micBtn.classList.remove("listening");

    const blob = new Blob(recJob.chunks, { type: recJob.mr.mimeType || "audio/webm" });
    recJob=null;

    if(!blob || blob.size < 800){
      addMeta("Ses alınamadı");
      return;
    }

    const raw = await sttBlob(blob, myLang);
    if(!raw){ addMeta("Metin çıkmadı"); return; }

    const cleaned = await cleanSpeechText(raw, myLang);

    const cmd = await parseCommand(cleaned);
    if(cmd?.is_command && cmd?.target_lang){
      myLang = norm(cmd.target_lang);
      localStorage.setItem("f2f_my_lang", myLang);
      langSelect.value = myLang;
      addMeta("Dil değişti ✅");
      return;
    }

    addMessage("right", MY_PROFILE.name, cleaned, true, myLang);

    if(!ws || ws.readyState !== 1){
      addMeta("Bağlantı yok");
      return;
    }

    ws.send(JSON.stringify({
      type:"translated",
      from: clientId,
      from_name: MY_PROFILE.name,
      text: cleaned,
      lang: myLang
    }));
  }catch{
    addMeta("İşlem hatası");
  }finally{
    isBusy=false;
  }
}

micBtn.addEventListener("click", ()=>{
  if(!recJob) return startRecord();
  return stopRecord();
});
