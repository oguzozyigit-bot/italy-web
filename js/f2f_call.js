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
const norm = (c)=>String(c||"").toLowerCase().trim();
function langLabel(code){
  const c = norm(code);
  const item = LANGS.find(x=>norm(x.code)===c);
  const flag = item?.flag || "🌐";
  const name = item?.name || c.toUpperCase();
  return `${flag} ${name}`;
}

// UI
const chat = $("chat");
const msgInput = $("msgInput");
const sendBtn = $("sendBtn");
const micBtn = $("micBtn");
const langSelect = $("langSelect");
const peopleScroll = $("peopleScroll");
const peopleCount = $("peopleCount");

if(!chat || !msgInput || !sendBtn || !micBtn || !peopleScroll || !peopleCount){
  console.error("[F2F_CALL] Missing required elements", {
    chat:!!chat, msgInput:!!msgInput, sendBtn:!!sendBtn, micBtn:!!micBtn,
    peopleScroll:!!peopleScroll, peopleCount:!!peopleCount
  });
}

// Profile
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
const MY = getProfileFromCache();

// Lang select
if(langSelect){
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
}

// Exit confirm (same as before)
const I18N = {
  tr: { confirm:"Sohbetten çıkmak istiyor musunuz?" },
  en: { confirm:"Do you want to leave the chat?" },
  de: { confirm:"Möchten Sie den Chat verlassen?" },
  fr: { confirm:"Voulez-vous quitter le chat ?" },
  es: { confirm:"¿Quieres salir del chat?" },
  it: { confirm:"Vuoi uscire dalla chat?" },
  ru: { confirm:"Выйти из чата?" },
  ar: { confirm:"هل تريد مغادرة الدردشة؟" },
};
function t(key){
  const pack = I18N[myLang] || I18N.en;
  return pack[key] || I18N.en[key] || "";
}
$("exitBtn")?.addEventListener("click", ()=>{
  const ok = confirm(t("confirm"));
  if(ok) location.href = "/pages/home.html";
});

// textarea grow + Enter send (Shift+Enter new line)
function growTA(){
  try{
    msgInput.style.height = "0px";
    const h = Math.min(120, msgInput.scrollHeight || 54);
    msgInput.style.height = h + "px";
    chat.scrollTop = chat.scrollHeight;
  }catch{}
}
msgInput?.addEventListener("input", growTA);
setTimeout(growTA, 0);

msgInput?.addEventListener("keydown",(e)=>{
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    sendTyped();
  }
});

// ===== Participants strip (always show self + seen senders)
const participants = new Map(); // key -> {name,pic}
function chipName(name){
  // "Oğuz Ö." -> "Oğuz.Ö"
  const s = String(name||"").trim();
  return s.replace(/\s+([A-ZÇĞİÖŞÜ])\./, ".$1").replace(/\s+/g," ");
}
function renderParticipants(){
  if(!peopleScroll) return;
  peopleScroll.innerHTML = "";
  for(const [k,p] of participants.entries()){
    const item = document.createElement("div");
    item.className = "pItem";

    const av = document.createElement("div");
    av.className = "pAvatar";
    if(p.pic){
      const img = document.createElement("img");
      img.src = p.pic;
      img.referrerPolicy = "no-referrer";
      av.appendChild(img);
    }else{
      av.textContent = (String(p.name||"•")[0]||"•").toUpperCase();
    }

    const nm = document.createElement("div");
    nm.className = "pName";
    nm.textContent = chipName(p.name);

    item.appendChild(av);
    item.appendChild(nm);
    peopleScroll.appendChild(item);
  }
}
function upsertParticipant(key, name, pic){
  if(!key) return;
  if(!participants.has(key)) participants.set(key, { name:name||"User", pic:pic||"" });
  else{
    const p = participants.get(key);
    p.name = name || p.name;
    p.pic = pic || p.pic;
  }
  renderParticipants();
}

// self
const clientId = (crypto?.randomUUID?.() || ("c_" + Math.random().toString(16).slice(2))).slice(0,18);
upsertParticipant(clientId, MY.name, MY.picture);

// ===== Chat bubbles
function addMessage(side, name, pic, text){
  const row = document.createElement("div");
  row.className = "msgRow " + (side === "right" ? "right" : "left");

  const av = document.createElement("div");
  av.className = "msgAvatar";
  if(pic){
    const img = document.createElement("img");
    img.src = pic;
    img.referrerPolicy = "no-referrer";
    av.appendChild(img);
  }else{
    av.textContent = (String(name||"•")[0]||"•").toUpperCase();
  }

  const wrap = document.createElement("div");
  wrap.className = "bubbleWrap";

  const nm = document.createElement("div");
  nm.className = "nameLine";
  nm.textContent = name || "";
  wrap.appendChild(nm);

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (side === "right" ? "user" : "bot");
  bubble.textContent = text;

  wrap.appendChild(bubble);
  row.appendChild(av);
  row.appendChild(wrap);

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

// ===== API
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

// ===== WS (message-only, but **do not show ANY incoming** until presence confirmed)
let ws = null;
let presenceKnown = false;
let presenceCount = 1;

function wsUrl(){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function connect(){
  if(!room) return;

  ws = new WebSocket(wsUrl());

  ws.onopen = ()=>{
    const helloType = (role === "host") ? "create" : "join";
    ws.send(JSON.stringify({
      type: helloType,
      room,
      from: clientId,
      from_name: MY.name,
      from_pic: MY.picture || "",
      me_lang: myLang
    }));
  };

  ws.onmessage = async (ev)=>{
    let msg=null;
    try{ msg = JSON.parse(ev.data); }catch{ return; }

    if(msg.type === "presence"){
      presenceKnown = true;
      const c = Number(msg.count||0);
      if(Number.isFinite(c) && c >= 0) presenceCount = c;

      // UI count (always show)
      peopleCount.textContent = String(Math.max(1, presenceCount));
      return;
    }

    if(msg.type === "room_not_found"){
      alert(msg.message || "Kod hatalı olabilir veya sohbet odası kapanmış olabilir.");
      location.href = "/pages/f2f_connect.html";
      return;
    }

    // ✅ kritik: presence gelmeden hiçbir gelen mesajı gösterme
    if(!presenceKnown) return;

    // ✅ tek kişiyken hiçbir gelen mesajı gösterme
    if(presenceCount <= 1) return;

    if(msg.type === "message"){
      const srcLang = norm(msg.lang || "en");
      const raw = String(msg.text||"").trim();
      const fromName = String(msg.from_name||"Katılımcı").trim();
      const fromPic = String(msg.from_pic||"").trim();
      const fromId = String(msg.from||"").trim();

      if(!raw) return;

      // sender in strip
      upsertParticipant(fromId || ("p_"+fromName), fromName, fromPic);

      // show in my language
      let shown = raw;
      if(srcLang && myLang && srcLang !== myLang){
        const tr = await translateAI(raw, srcLang, myLang);
        if(tr) shown = tr;
      }

      addMessage("left", fromName, fromPic, shown);
      await speakViaTTS(shown, myLang);
    }
  };

  ws.onclose = ()=>{};
}
connect();

// ===== SEND typed: always show my own message immediately
async function sendTyped(){
  const raw = String(msgInput?.value || "").trim();
  if(!raw) return;

  msgInput.value = "";
  growTA();

  const cleaned = await cleanSpeechText(raw, myLang);

  // always show right
  addMessage("right", MY.name, MY.picture, cleaned);

  // also keep self in strip + update count at least 1
  upsertParticipant(clientId, MY.name, MY.picture);
  if(!presenceKnown){
    // offline/unknown: show at least 1
    peopleCount.textContent = "1";
  }

  if(ws && ws.readyState === 1){
    ws.send(JSON.stringify({ type:"message", text: cleaned }));
  }
}

sendBtn?.addEventListener("click", sendTyped);

// ===== MIC toggle (send as message-only)
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
  }catch{}
  finally{ isBusy=false; }
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
    if(!blob || blob.size < 800) return;

    const raw = await sttBlob(blob, myLang);
    if(!raw) return;

    const cleaned = await cleanSpeechText(raw, myLang);

    addMessage("right", MY.name, MY.picture, cleaned);

    if(ws && ws.readyState === 1){
      ws.send(JSON.stringify({ type:"message", text: cleaned }));
    }
  }catch{}
  finally{ isBusy=false; }
}

micBtn?.addEventListener("click", ()=>{
  if(!recJob) return startRecord();
  return stopRecord();
});

// default count visible at least 1
peopleCount.textContent = "1";
