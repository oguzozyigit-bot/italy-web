// FILE: /js/f2f_call.js
import { LANG_POOL } from "/js/lang_pool_full.js";

const API_BASE = "https://italky-api.onrender.com";
const $ = (id)=>document.getElementById(id);

const params = new URLSearchParams(location.search);
const room = (params.get("room")||"").trim().toUpperCase();
const role = (params.get("role")||"").trim().toLowerCase(); // host|guest|...
let myLang = (params.get("me_lang")||localStorage.getItem("f2f_my_lang")||"tr").trim().toLowerCase();

localStorage.setItem("f2f_my_lang", myLang);

$("roomPill").textContent = "ROOM: " + (room || "—");
$("rolePill").textContent = role ? role.toUpperCase() : "—";
$("meLangTxt").textContent = langLabel(myLang);

let ws = null;
const clientId = (crypto?.randomUUID?.() || ("c_" + Math.random().toString(16).slice(2))).slice(0,18);

/* ===============================
   LANG PICKER
================================ */
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

function renderLangList(){
  const list = $("popList");
  if(!list) return;
  list.innerHTML = LANGS.map(l=>{
    const c = norm(l.code);
    const active = (c === myLang);
    return `
      <div class="pop-item ${active?"active":""}" data-code="${c}">
        <div class="pop-left">
          <div class="pop-flag">${l.flag || "🌐"}</div>
          <div class="pop-name">${l.name || c.toUpperCase()}</div>
        </div>
        <div class="pop-code">${c.toUpperCase()}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".pop-item").forEach(item=>{
    item.addEventListener("click", ()=>{
      const c = item.getAttribute("data-code") || "tr";
      myLang = c;
      localStorage.setItem("f2f_my_lang", myLang);
      $("meLangTxt").textContent = langLabel(myLang);
      closeLangPop();
      $("hint").textContent = "Dil güncellendi ✅";
    });
  });
}

function openLangPop(){
  renderLangList();
  $("langPop")?.classList.add("show");
}
function closeLangPop(){
  $("langPop")?.classList.remove("show");
}

$("meLangBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openLangPop(); });
$("popClose")?.addEventListener("click", closeLangPop);

document.addEventListener("click",(e)=>{
  const pop = $("langPop");
  if(!pop || !pop.classList.contains("show")) return;
  const inside = pop.contains(e.target);
  const isBtn = e.target?.closest?.("#meLangBtn");
  if(!inside && !isBtn) closeLangPop();
}, {capture:true});

/* ===============================
   WS
================================ */
function wsUrl(){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function connect(){
  if(!room){
    $("hint").textContent = "Room eksik";
    return;
  }

  ws = new WebSocket(wsUrl());

  ws.onopen = ()=>{
    ws.send(JSON.stringify({ type:"hello", room, role, from: clientId, me_lang: myLang }));
    $("hint").textContent = "Bağlandı ✅";
  };

  ws.onmessage = async (ev)=>{
    let msg = null;
    try{ msg = JSON.parse(ev.data); }catch{ return; }

    // eski mesajlar
    if(msg.type === "info"){
      $("hint").textContent = msg.message || "info";
      return;
    }

    // ✅ biz "translated" tipini hem broadcast hem compat için kullanıyoruz:
    // {type:"translated", from, text, lang}
    if(msg.type === "translated"){
      const from = String(msg.from || "");
      if(from && from === clientId) return; // kendini tekrar gösterme

      const srcLang = String(msg.lang || "en").trim().toLowerCase();
      const raw = String(msg.text || "").trim();
      if(!raw) return;

      // Karşıdan gelen ham metni önce göster (them)
      addBubble("them", raw);

      // Herkes kendi diline çevirsin
      let out = raw;
      if(srcLang && myLang && srcLang !== myLang){
        $("hint").textContent = "Çeviriliyor…";
        const tr = await translateAI(raw, srcLang, myLang);
        if(tr) out = tr;
      }

      // Çeviriyi büyük yaz (me)
      addBubble("me", out, { latest:true, lang: myLang });
      await speakViaTTS(out, myLang);

      $("hint").textContent = "✅";
      return;
    }
  };

  ws.onclose = ()=>{
    $("hint").textContent = "Bağlantı kapandı.";
  };
}

/* ===============================
   UI BUBBLES
================================ */
function addBubble(kind, text, opts={}){
  const chat = $("chat");
  const b = document.createElement("div");
  b.className = "bubble " + kind + (opts.latest ? " is-latest" : "");

  if(kind === "me"){
    const icon = document.createElement("div");
    icon.className = "spk-icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89 0 5.23 2.34 5.23 5.23S16.89 15.75 14 15.75v2.06c4.02 0 7.29-3.27 7.29-7.29S18.02 3.23 14 3.23z"/></svg>`;
    icon.onclick = ()=> speakViaTTS(text, opts.lang || myLang || "en");
    b.appendChild(icon);

    chat.querySelectorAll(".bubble.me.is-latest").forEach(x=>x.classList.remove("is-latest"));
  }

  const t = document.createElement("div");
  t.className = "txt";
  t.textContent = text;
  b.appendChild(t);

  chat.appendChild(b);
  chat.scrollTop = chat.scrollHeight;
}

/* ===============================
   TTS + TRANSLATE
================================ */
let audioObj = null;
let lastAudioAt = 0;

function stopAudio(){
  try{
    if(audioObj){
      audioObj.pause();
      audioObj.currentTime = 0;
    }
  }catch{}
  audioObj = null;
}

async function speakViaTTS(text, lang){
  const now = Date.now();
  if(now - lastAudioAt < 250) stopAudio();
  lastAudioAt = now;

  try{
    const res = await fetch(`${API_BASE}/api/tts`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ text, lang, speaking_rate: 1, pitch: 0 })
    });
    if(!res.ok){
      $("hint").textContent = "TTS HTTP " + res.status;
      return;
    }
    const data = await res.json().catch(()=>null);
    if(!data?.ok || !data.audio_base64){
      $("hint").textContent = "TTS invalid";
      return;
    }
    const b64 = data.audio_base64;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type:"audio/mpeg" });
    const url = URL.createObjectURL(blob);

    stopAudio();
    audioObj = new Audio(url);
    audioObj.onended = ()=>URL.revokeObjectURL(url);
    audioObj.onerror = ()=>URL.revokeObjectURL(url);
    await audioObj.play();
  }catch{
    $("hint").textContent = "TTS failed";
  }
}

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

/* ===============================
   STT + CLEAN + COMMAND
================================ */
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

// ✅ aynı dilde düzeltme (noktalama + akıcılık)
async function cleanSpeechText(text, lang){
  const t = String(text||"").trim();
  if(!t) return t;

  try{
    const r = await fetch(`${API_BASE}/api/translate_ai`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        text: t,
        from_lang: lang,
        to_lang: lang,
        style:"chat",
        provider:"auto"
      })
    });
    if(!r.ok) return t;
    const data = await r.json().catch(()=>null);
    const out = String(data?.translated||"").trim();
    return out || t;
  }catch{
    return t;
  }
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

/* ===============================
   TALK BUTTON: toggle record
================================ */
let recJob = null; // {stream,mr,chunks,timer}
let isBusy = false;

async function startRecord(){
  if(isBusy) return;
  isBusy = true;

  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];

    mr.ondataavailable = (e)=>{ if(e.data && e.data.size) chunks.push(e.data); };

    mr.start(250);

    const timer = setTimeout(()=> stopRecord(), 20000);

    recJob = { stream, mr, chunks, timer };

    $("btnTalk").classList.add("listening");
    $("hint").textContent = "Dinliyorum… (Tekrar bas: Bitir)";

  }catch{
    $("hint").textContent = "Mikrofon açılamadı";
  }finally{
    isBusy = false;
  }
}

async function stopRecord(){
  if(!recJob || isBusy) return;
  isBusy = true;

  try{
    clearTimeout(recJob.timer);
    try{ recJob.stream.getTracks().forEach(t=>t.stop()); }catch{}
    try{ recJob.mr.stop(); }catch{}

    $("btnTalk").classList.remove("listening");
    $("hint").textContent = "Metne çevriliyor…";

    const blob = new Blob(recJob.chunks, { type: recJob.mr.mimeType || "audio/webm" });
    recJob = null;

    if(!blob || blob.size < 800){
      $("hint").textContent = "Ses alınamadı";
      return;
    }

    // STT
    const raw = await sttBlob(blob, myLang);
    if(!raw){
      $("hint").textContent = "Metin çıkmadı";
      return;
    }

    // CLEAN
    const cleaned = await cleanSpeechText(raw, myLang);

    // COMMAND? (benim dili değiştir)
    const cmd = await parseCommand(cleaned);
    if(cmd?.is_command && cmd?.target_lang){
      myLang = String(cmd.target_lang).toLowerCase();
      localStorage.setItem("f2f_my_lang", myLang);
      $("meLangTxt").textContent = langLabel(myLang);
      $("hint").textContent = "Dil değişti ✅";
      return;
    }

    // Ekranda benim söylediklerim (them)
    addBubble("them", cleaned);

    // WS broadcast: herkes kendi diline çevirir
    if(!ws || ws.readyState !== 1){
      $("hint").textContent = "Bağlantı yok";
      return;
    }

    ws.send(JSON.stringify({
      type:"translated",
      from: clientId,
      text: cleaned,
      lang: myLang
    }));

    $("hint").textContent = "Gönderildi ✅";
  }catch(e){
    console.warn(e);
    $("hint").textContent = "İşlem hatası";
  }finally{
    isBusy = false;
  }
}

$("btnTalk").onclick = async ()=>{
  if(!recJob) return startRecord();
  return stopRecord();
};

$("btnLeave").onclick = ()=>{
  try{ ws?.close?.(); }catch{}
  location.href = "/pages/f2f_connect.html";
};

connect();
