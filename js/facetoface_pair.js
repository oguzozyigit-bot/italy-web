// FILE: /js/facetoface_pair.js
const API_BASE = "https://italky-api.onrender.com";
const HOME_PATH = "/pages/home.html";

const $ = (id)=>document.getElementById(id);

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function randomRoomId(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

// Basit QR görüntüsü (hızlı MVP)
function qrUrl(data){
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(data);
}

function toast(msg){
  // minimal
  console.log("[toast]", msg);
  const hint = $("callHint");
  if(hint) hint.textContent = msg;
}

// ---- WS ----
let ws = null;
let role = null; // "host" | "guest"
let roomId = null;

function wsUrl(room){
  // https -> wss
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function connectWS(room, myRole){
  return new Promise((resolve, reject)=>{
    role = myRole;
    roomId = room;

    ws = new WebSocket(wsUrl(room));

    ws.onopen = () => {
      ws.send(JSON.stringify({ type:"hello", role: myRole }));
      resolve();
    };

    ws.onmessage = (ev) => {
      try{
        const msg = JSON.parse(ev.data);
        handleWS(msg);
      }catch{}
    };

    ws.onerror = (e) => reject(e);
    ws.onclose = () => {
      // UI düşür
      toast("Bağlantı kapandı.");
    };
  });
}

function handleWS(msg){
  if(!msg || !msg.type) return;

  if(msg.type === "peer_joined"){
    if($("connDot")) $("connDot").classList.add("ok");
    if($("connText")) $("connText").textContent = "Guest bağlandı ✅";
    openCallUI();
  }

  if(msg.type === "translated"){
    // karşıdan gelen çeviri metnini TTS ile okut
    const text = String(msg.text || "").trim();
    const lang = String(msg.lang || "en").trim();

    if(text){
      toast("🔊 " + text);
      speakViaBackendTTS(text, lang);
    }
  }

  if(msg.type === "info"){
    toast(msg.message || "info");
  }
}

async function speakViaBackendTTS(text, lang){
  // Senin backend /api/tts (POST) -> {ok, audio_base64}
  try{
    const res = await fetch(`${API_BASE}/api/tts`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      credentials:"include",
      body: JSON.stringify({
        text,
        lang,
        speaking_rate: 1,
        pitch: 0
      })
    });
    if(!res.ok) return;

    const data = await res.json().catch(()=>null);
    if(!data?.ok || !data.audio_base64) return;

    const b64 = data.audio_base64;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type:"audio/mpeg" });
    const objUrl = URL.createObjectURL(blob);
    const audio = new Audio(objUrl);
    audio.playsInline = true;
    audio.onended = () => URL.revokeObjectURL(objUrl);
    audio.onerror  = () => URL.revokeObjectURL(objUrl);
    await audio.play();
  }catch(e){}
}

// ---- UI ----
$("goHome").addEventListener("click", ()=> location.href = HOME_PATH);

$("btnHost").addEventListener("click", async ()=>{
  $("guestJoinCard").style.display = "none";
  $("hostCard").style.display = "block";

  // backend create_room (host pays) — MVP: client generates room; backend will validate later
  const room = randomRoomId();
  $("roomCode").textContent = room;
  $("qrImg").src = qrUrl(`${location.origin}/pages/facetoface_pair.html?join=${room}`);

  // connect host
  await connectWS(room, "host");
  toast("Host olarak bağlandın. Partneri bekle…");
});

$("btnGuest").addEventListener("click", ()=>{
  $("hostCard").style.display = "none";
  $("guestJoinCard").style.display = "block";
});

$("btnBack1").addEventListener("click", ()=>{
  $("guestJoinCard").style.display = "none";
});
$("btnBack2").addEventListener("click", ()=>{
  $("hostCard").style.display = "none";
});

$("btnCopy").addEventListener("click", async ()=>{
  const code = $("roomCode").textContent.trim();
  try{ await navigator.clipboard.writeText(code); }catch{}
  toast("Kod kopyalandı.");
});

$("btnJoin").addEventListener("click", async ()=>{
  const code = ($("roomInput").value || "").trim().toUpperCase();
  if(!code) return;

  $("guestJoinCard").style.display = "none";
  $("callCard").style.display = "block";

  await connectWS(code, "guest");
  openCallUI();
});

function openCallUI(){
  $("stepLobby").style.display = "none";
  $("callCard").style.display = "block";
  $("roomLive").textContent = "ROOM: " + roomId;
  $("roleText").textContent = "Rol: " + (role === "host" ? "HOST (Ödeyen)" : "GUEST (Ücretsiz)");
  toast("Hazır. Konuşmak için 🎤 Konuş.");
}

// URL ile join gelirse (QR linki)
(function initFromQuery(){
  try{
    const p = new URLSearchParams(location.search);
    const join = (p.get("join") || "").trim().toUpperCase();
    if(join){
      $("btnGuest").click();
      $("roomInput").value = join;
    }
  }catch{}
})();

// ---- Talk / STT / Translate / Send ----
function makeRecognizer(lang){
  if(!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.lang = lang || "tr-TR";
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
}

// MVP: Host TR konuşur, Guest EN konuşur gibi sabitleyebiliriz; şimdilik TR<->EN
// Sonra dil seçim ekleriz.
function myInputBCP(){
  return role === "host" ? "tr-TR" : "en-US";
}
function mySrc(){
  return role === "host" ? "tr" : "en";
}
function peerLang(){
  return role === "host" ? "en" : "tr";
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

$("btnTalk").addEventListener("click", async ()=>{
  if(!SpeechRecognition){
    toast("Bu cihaz STT desteklemiyor. (Chrome gerekiyor)");
    return;
  }
  if(!ws || ws.readyState !== 1){
    toast("Bağlantı yok.");
    return;
  }

  toast("Dinliyorum… konuş.");
  const rec = makeRecognizer(myInputBCP());
  if(!rec){ toast("STT başlatılamadı."); return; }

  rec.onresult = async (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    const spoken = String(t).trim();
    if(!spoken) return;

    toast("Çeviriliyor…");

    const translated = await translateAI(spoken, mySrc(), peerLang());
    if(!translated){
      toast("Çeviri hatası.");
      return;
    }

    // karşı tarafa gönder
    ws.send(JSON.stringify({
      type: "translated",
      text: translated,
      lang: peerLang()
    }));

    // Host pays TODO: burada host jeton düşer (backend side gerçek olmalı)
    toast("Gönderildi ✅");
  };

  rec.onerror = ()=> toast("STT hata.");
  try{ rec.start(); }catch{ toast("STT start edilemedi."); }
});

$("btnLeave").addEventListener("click", ()=>{
  try{ ws?.close?.(); }catch{}
  location.reload();
});
