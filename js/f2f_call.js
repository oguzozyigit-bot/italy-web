// FILE: /js/f2f_call.js
const API_BASE = "https://italky-api.onrender.com";

const $ = (id)=>document.getElementById(id);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const params = new URLSearchParams(location.search);
const room = (params.get("room")||"").trim().toUpperCase();
const role = (params.get("role")||"").trim().toLowerCase(); // host|guest

$("roomPill").textContent = "ROOM: " + (room || "—");
$("rolePill").textContent = role === "host" ? "HOST (Ödeyen)" : "GUEST (Ücretsiz)";

function toast(msg){
  const el = $("toast");
  el.textContent = msg;
  el.style.opacity = "1";
  setTimeout(()=> el.style.opacity = "0", 1200);
}

function setFrame(listening=false, speaking=false, dir="bot"){
  const fr = document.getElementById("frameRoot");
  fr.classList.toggle("listening", listening);
  fr.classList.toggle("speaking", speaking);
  fr.classList.toggle("to-top", dir==="top");
  fr.classList.toggle("to-bot", dir!=="top");
}

let ws = null;

function wsUrl(){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function addBubble(kind, text, opts={}){
  const chat = $("chat");
  const b = document.createElement("div");
  b.className = "bubble " + kind + (opts.latest ? " is-latest" : "");

  if(kind === "me"){
    // speaker icon
    const icon = document.createElement("div");
    icon.className = "spk-icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89 0 5.23 2.34 5.23 5.23S16.89 15.75 14 15.75v2.06c4.02 0 7.29-3.27 7.29-7.29S18.02 3.23 14 3.23z"/></svg>`;
    icon.onclick = ()=> speakViaBackendTTS(text, opts.lang || "en");
    b.appendChild(icon);
  }

  const t = document.createElement("div");
  t.className = "txt";
  t.textContent = text;
  b.appendChild(t);

  // latest handling
  if(kind === "me"){
    chat.querySelectorAll(".bubble.me.is-latest").forEach(x=>x.classList.remove("is-latest"));
  }

  chat.appendChild(b);
  chat.scrollTop = chat.scrollHeight;
}

async function speakViaBackendTTS(text, lang){
  // /api/tts -> {ok, audio_base64, provider_used}
  try{
    const res = await fetch(`${API_BASE}/api/tts`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        text,
        lang,
        speaking_rate: 1,
        pitch: 0
      })
    });
    if(!res.ok){
      toast("🔇 TTS HTTP " + res.status);
      return;
    }
    const data = await res.json().catch(()=>null);
    if(!data?.ok || !data.audio_base64){
      toast("🔇 TTS invalid");
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
    toast("🔇 TTS failed");
  }
}

async function translateAI(text, from, to){
  const res = await fetch(`${API_BASE}/api/translate_ai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      text,
      from_lang: from,
      to_lang: to,
      style: "chat",
      provider: "auto"
    })
  });
  if(!res.ok) return null;
  const data = await res.json().catch(()=>null);
  return data?.translated ? String(data.translated) : null;
}

async function parseCommand(text){
  const res = await fetch(`${API_BASE}/api/command_parse`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text, ui_lang:"tr" })
  });
  if(!res.ok) return null;
  return await res.json().catch(()=>null);
}

// MVP dil kuralı: Host TR, Guest EN (sonraki adım popover)
function myInputBCP(){ return role==="host" ? "tr-TR" : "en-US"; }
function mySrc(){ return role==="host" ? "tr" : "en"; }
function peerLang(){ return role==="host" ? "en" : "tr"; }

function connect(){
  if(!room || !role) {
    toast("Room/role yok.");
    return;
  }
  ws = new WebSocket(wsUrl());

  ws.onopen = ()=>{
    ws.send(JSON.stringify({ type:"hello", role }));
    toast("Bağlandı.");
  };

  ws.onmessage = async (ev)=>{
    const msg = JSON.parse(ev.data);
    if(msg.type === "info"){
      toast(msg.message || "info");
      return;
    }
    if(msg.type === "peer_joined"){
      toast("Guest bağlandı ✅");
      $("hint").textContent = "Hazır. Konuşabilirsin.";
      return;
    }
    if(msg.type === "translated"){
      // gelen çeviri (bu cihazda me bubble)
      const text = String(msg.text||"").trim();
      const lang = String(msg.lang||"en").trim();
      if(text){
        addBubble("me", text, { latest:true, lang });
        setFrame(false, true, "bot");
        await speakViaBackendTTS(text, lang);
        setFrame(false, false, role==="host" ? "top" : "bot");
      }
    }
  };

  ws.onclose = ()=> toast("Bağlantı kapandı.");
}

$("btnLeave").onclick = ()=>{
  try{ ws?.close?.(); }catch{}
  location.href = "/pages/f2f_connect.html";
};

$("btnTalk").onclick = async ()=>{
  if(!SpeechRecognition){
    toast("STT yok (Chrome gerekiyor).");
    return;
  }
  if(!ws || ws.readyState !== 1){
    toast("Bağlantı yok.");
    return;
  }

  // listening visual
  $("btnTalk").classList.add("listening");
  setFrame(true, false, role==="host" ? "top" : "bot");

  const rec = new SpeechRecognition();
  rec.lang = myInputBCP();
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onresult = async (e)=>{
    const spoken = String(e.results?.[0]?.[0]?.transcript || "").trim();
    if(!spoken) return;

    // komut mu? (komut yazdırma yok)
    const cmd = await parseCommand(spoken);
    if(cmd?.is_command && cmd?.target_lang){
      toast("🎯 Target changed");
      // MVP: sadece bilgilendiriyoruz; sonraki adımda dil set’i sync edeceğiz
      return;
    }

    // konuşanı yazdır
    addBubble("them", spoken);

    toast("Çeviriliyor…");
    const translated = await translateAI(spoken, mySrc(), peerLang());
    if(!translated){
      toast("Çeviri hatası.");
      return;
    }

    // karşı tarafa gönder
    ws.send(JSON.stringify({
      type:"translated",
      text: translated,
      lang: peerLang()
    }));

    toast("Gönderildi ✅");
  };

  rec.onerror = ()=> toast("STT hata.");
  rec.onend = ()=>{
    $("btnTalk").classList.remove("listening");
    setFrame(false, false, role==="host" ? "top" : "bot");
  };

  try{ rec.start(); }catch{ toast("STT start edilemedi."); }
};

connect();
