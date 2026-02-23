// FILE: /js/f2f_connect.js
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

$("goHome").onclick = ()=>location.href = HOME_PATH;

$("btnHost").onclick = ()=>{
  $("lobby").style.display="none";
  $("guestCard").style.display="none";
  $("hostCard").style.display="block";

  const room = randomRoomId();
  $("roomCode").textContent = room;

  // ✅ QR direkt CALL sayfasına götürür (404 fix: dosya aşağıda verildi)
  const joinUrl = `${location.origin}${CALL_PATH}?room=${room}&role=guest`;
  $("qrImg").src = qrUrl(joinUrl);

  $("btnCopy").onclick = async ()=>{
    try{ await navigator.clipboard.writeText(room); }catch{}
  };

  $("btnBackHost").onclick = ()=>{
    $("hostCard").style.display="none";
    $("lobby").style.display="block";
  };

  // Host konuşma ekranına geçer
  location.href = `${CALL_PATH}?room=${room}&role=host`;
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
