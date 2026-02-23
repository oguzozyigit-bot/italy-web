// FILE: /js/f2f_call.js
const API_BASE = "https://italky-api.onrender.com";
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const $ = (id)=>document.getElementById(id);

const params = new URLSearchParams(location.search);
const room = (params.get("room")||"").trim().toUpperCase();
const role = (params.get("role")||"").trim().toLowerCase(); // host|guest

$("roomPill").textContent = "ROOM: " + (room || "—");
$("rolePill").textContent = role === "host" ? "HOST (Ödeyen)" : "GUEST (Ücretsiz)";

let ws = null;

function wsUrl(){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function addBubble(kind, text, opts={}){
  const chat = $("chat");
  const b = document.createElement("div");
  b.className = "bubble " + kind + (opts.latest ? " is-latest" : "");

  if(kind === "me"){
    const icon = document.createElement("div");
    icon.className = "spk-icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89 0 5.23 2.34 5.23 5.23S16.89 15.75 14 15.75v2.06c4.02 0 7.29-3.27 7.29-7.29S18.02 3.23 14 3.23z"/></svg>`;
    icon.onclick = ()=> speakViaTTS(text, opts.lang || "en");
    b.appendChild(icon);
  }

  const t = document.createElement("div");
  t.className = "txt";
  t.textContent = text;
  b.appendChild(t);

  if(kind === "me"){
    chat.querySelectorAll(".bubble.me.is-latest").forEach(x=>x.classList.remove("is-latest"));
  }

  chat.appendChild(b);
  chat.scrollTop = chat.scrollHeight;
}

async function speakViaTTS(text, lang){
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
    const audio = new Audio(url);
    audio.onended = ()=>URL.revokeObjectURL(url);
    audio.onerror = ()=>URL.revokeObjectURL(url);
    await audio.play();
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

// MVP sabit dil: host TR <-> guest EN
function myInputBCP(){ return role === "host" ? "tr-TR" : "en-US"; }
function mySrc(){ return role === "host" ? "tr" : "en"; }
function peerLang(){ return role === "host" ? "en" : "tr"; }

function connect(){
  if(!room || !role){
    $("hint").textContent = "Room/role eksik";
    return;
  }
  ws = new WebSocket(wsUrl());

  ws.onopen = ()=>{
    ws.send(JSON.stringify({ type:"hello", role }));
    $("hint").textContent = "Bağlandı. Diğer kişi bekleniyor…";
  };

  ws.onmessage = async (ev)=>{
    const msg = JSON.parse(ev.data);

    if(msg.type === "peer_joined"){
      $("hint").textContent = "Guest bağlandı ✅ Konuşabilirsiniz.";
      return;
    }

    if(msg.type === "translated"){
      const text = String(msg.text||"").trim();
      const lang = String(msg.lang||"en").trim();
      if(text){
        addBubble("me", text, { latest:true, lang });
        await speakViaTTS(text, lang);
      }
      return;
    }

    if(msg.type === "info"){
      $("hint").textContent = msg.message || "info";
    }
  };

  ws.onclose = ()=>{
    $("hint").textContent = "Bağlantı kapandı.";
  };
}

$("btnLeave").onclick = ()=>{
  try{ ws?.close?.(); }catch{}
  location.href = "/pages/f2f_connect.html";
};

$("btnTalk").onclick = async ()=>{
  if(!SpeechRecognition){
    $("hint").textContent = "STT yok (Chrome gerekiyor)";
    return;
  }
  if(!ws || ws.readyState !== 1){
    $("hint").textContent = "Bağlantı yok";
    return;
  }

  $("btnTalk").classList.add("listening");
  $("hint").textContent = "Dinliyorum…";

  const rec = new SpeechRecognition();
  rec.lang = myInputBCP();
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = async (e)=>{
    const spoken = String(e.results?.[0]?.[0]?.transcript || "").trim();
    if(!spoken) return;

    addBubble("them", spoken);

    $("hint").textContent = "Çeviriliyor…";
    const translated = await translateAI(spoken, mySrc(), peerLang());
    if(!translated){
      $("hint").textContent = "Çeviri hatası";
      return;
    }

    ws.send(JSON.stringify({ type:"translated", text: translated, lang: peerLang() }));
    $("hint").textContent = "Gönderildi ✅";
  };

  rec.onend = ()=>{
    $("btnTalk").classList.remove("listening");
  };

  rec.onerror = ()=>{
    $("btnTalk").classList.remove("listening");
    $("hint").textContent = "STT hata";
  };

  try{ rec.start(); }catch{
    $("btnTalk").classList.remove("listening");
    $("hint").textContent = "STT start edilemedi";
  }
};

connect();
