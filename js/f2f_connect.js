// FILE: /js/f2f_connect.js
const API_BASE = "https://italky-api.onrender.com";

const HOME_PATH = "/pages/home.html";
const CALL_PATH = "/pages/f2f_call.html";

const $ = (id)=>document.getElementById(id);

function randomRoomId(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function qrUrl(data){
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(data);
}

function wsUrl(room){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

let ws = null;
let currentRoom = null;

function setHostWaitingUI(waiting){
  const dot = $("connDot");
  const txt = $("connText");
  if(!dot || !txt) return;

  if(waiting){
    dot.classList.remove("ok");
    txt.textContent = "Bekleniyor…";
  } else {
    dot.classList.add("ok");
    txt.textContent = "Bağlandı ✅";
  }
}

function closeWS(){
  try{ ws?.close?.(); }catch{}
  ws = null;
}

$("goHome").onclick = ()=>location.href = HOME_PATH;

$("btnHost").onclick = async ()=>{
  $("lobby").style.display="none";
  $("guestCard").style.display="none";
  $("hostCard").style.display="block";

  // ✅ Room üret
  const room = randomRoomId();
  currentRoom = room;

  $("roomCode").textContent = room;

  // ✅ QR: Guest'i doğrudan call sayfasına götürür
  const joinUrl = `${location.origin}${CALL_PATH}?room=${room}&role=guest`;
  $("qrImg").src = qrUrl(joinUrl);

  setHostWaitingUI(true);

  $("btnCopy").onclick = async ()=>{
    try{ await navigator.clipboard.writeText(room); }catch{}
  };

  $("btnBackHost").onclick = ()=>{
    closeWS();
    $("hostCard").style.display="none";
    $("lobby").style.display="block";
  };

  // ✅ Host burada KALIR, WS ile guest'i bekler
  closeWS();
  ws = new WebSocket(wsUrl(room));

  ws.onopen = ()=>{
    ws.send(JSON.stringify({ type:"hello", role:"host" }));
  };

  ws.onmessage = (ev)=>{
    let msg=null;
    try{ msg = JSON.parse(ev.data); }catch{}
    if(!msg) return;

    if(msg.type === "peer_joined"){
      setHostWaitingUI(false);

      // ✅ Host'u otomatik call'a geçir
      // (istersen 600ms gecikmeyle daha smooth)
      setTimeout(()=>{
        location.href = `${CALL_PATH}?room=${room}&role=host`;
      }, 450);
    }
  };

  ws.onerror = ()=>{};
  ws.onclose = ()=>{};
};

$("btnGuest").onclick = ()=>{
  $("lobby").style.display="none";
  $("hostCard").style.display="none";
  $("guestCard").style.display="block";
};

$("btnBackGuest").onclick = ()=>{
  $("guestCard").style.display="none";
  $("lobby").style.display="block";
};

$("btnJoin").onclick = ()=>{
  const code = ($("roomInput").value||"").trim().toUpperCase();
  if(!code) return;
  location.href = `${CALL_PATH}?room=${code}&role=guest`;
};

// QR linkiyle gelirse ?join=KOD
(function initFromQuery(){
  const p = new URLSearchParams(location.search);
  const join = (p.get("join")||"").trim().toUpperCase();
  if(join){
    $("btnGuest").click();
    $("roomInput").value = join;
  }
})();
