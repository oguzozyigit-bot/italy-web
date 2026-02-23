// FILE: /js/f2f_connect.js
const API_BASE = "https://italky-api.onrender.com";

const HOME_PATH = "/pages/home.html";
const CALL_PATH = "/pages/f2f_call.html";

const $ = (id)=>document.getElementById(id);

const LANGS = [
  { code:"tr", flag:"🇹🇷", name_tr:"TÜRKÇE", name_en:"TURKISH" },
  { code:"en", flag:"🇬🇧", name_tr:"ENGLISH", name_en:"ENGLISH" },
  { code:"de", flag:"🇩🇪", name_tr:"ALMANCA", name_en:"GERMAN" },
  { code:"fr", flag:"🇫🇷", name_tr:"FRANSIZCA", name_en:"FRENCH" },
  { code:"it", flag:"🇮🇹", name_tr:"İTALYANCA", name_en:"ITALIAN" },
  { code:"es", flag:"🇪🇸", name_tr:"İSPANYOLCA", name_en:"SPANISH" },
  { code:"ru", flag:"🇷🇺", name_tr:"RUSÇA", name_en:"RUSSIAN" },
  { code:"ar", flag:"🇸🇦", name_tr:"ARAPÇA", name_en:"ARABIC" },
  { code:"fa", flag:"🇮🇷", name_tr:"FARSÇA", name_en:"PERSIAN" },
  { code:"zh", flag:"🇨🇳", name_tr:"ÇİNCE", name_en:"CHINESE" },
  { code:"ja", flag:"🇯🇵", name_tr:"JAPONCA", name_en:"JAPANESE" },
  { code:"ko", flag:"🇰🇷", name_tr:"KORECE", name_en:"KOREAN" },
  { code:"ka", flag:"🇬🇪", name_tr:"GÜRCÜCE", name_en:"GEORGIAN" },
];

let hostLang = "tr";
let guestLang = "en";

function langLabel(code){
  const o = LANGS.find(x=>x.code===code) || LANGS[0];
  return `${o.flag} ${o.name_tr}`;
}

function setLangUI(){
  $("hostLangTxt").textContent = `${LANGS.find(x=>x.code===hostLang)?.flag||"🌐"} HOST: ${LANGS.find(x=>x.code===hostLang)?.name_tr||hostLang.toUpperCase()}`;
  $("guestLangTxt").textContent = `${LANGS.find(x=>x.code===guestLang)?.flag||"🌐"} GUEST: ${LANGS.find(x=>x.code===guestLang)?.name_tr||guestLang.toUpperCase()}`;
}

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

function go(url){
  try{ location.assign(url); }catch{ location.href = url; }
}

$("goHome").onclick = ()=>go(HOME_PATH);

/* ===============================
   DİL POPOVER (FaceToFace aynısı)
================================ */
let popTarget = "host"; // "host" | "guest"

function openPop(target){
  popTarget = target;
  $("popTitle").textContent = (target === "host") ? "HOST DİLİ" : "GUEST DİLİ";

  const sel = (target === "host") ? hostLang : guestLang;
  $("popList").innerHTML = LANGS.map(l=>`
    <div class="pop-item ${l.code===sel ? "active":""}" data-code="${l.code}">
      <div class="pop-left">
        <div class="pop-flag">${l.flag}</div>
        <div class="pop-name">${l.name_tr}</div>
      </div>
      <div class="pop-code">${l.code.toUpperCase()}</div>
    </div>
  `).join("");

  $("popList").querySelectorAll(".pop-item").forEach(it=>{
    it.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      const code = it.getAttribute("data-code");
      if(popTarget === "host") hostLang = code;
      else guestLang = code;
      setLangUI();
      closePop();
    });
  });

  $("langPop").classList.add("show");
}

function closePop(){
  $("langPop").classList.remove("show");
}

$("hostLangBtn").onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); openPop("host"); };
$("guestLangBtn").onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); openPop("guest"); };
$("popClose").onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); closePop(); };

document.addEventListener("click",(e)=>{
  const pop = $("langPop");
  if(pop?.classList.contains("show")){
    const inside = pop.contains(e.target);
    const isBtn = e.target?.closest?.("#hostLangBtn,#guestLangBtn");
    if(!inside && !isBtn) closePop();
  }
}, { capture:true });

/* ===============================
   HOST FLOW
================================ */
$("btnHost").onclick = ()=>{
  $("lobby").style.display="none";
  $("guestCard").style.display="none";
  $("hostCard").style.display="block";

  const room = randomRoomId();
  $("roomCode").textContent = room;

  // ✅ QR: guest call link + diller
  const joinUrl =
    `${location.origin}${CALL_PATH}` +
    `?room=${encodeURIComponent(room)}` +
    `&role=guest` +
    `&host_lang=${encodeURIComponent(hostLang)}` +
    `&guest_lang=${encodeURIComponent(guestLang)}`;

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

  // ✅ Host burada KALIR, WS ile guest bekler
  closeWS();
  ws = new WebSocket(wsUrl(room));

  ws.onopen = ()=>{
    ws.send(JSON.stringify({ type:"hello", role:"host" }));
    // Host dillerini WS'e yaz (host kontrol eder)
    ws.send(JSON.stringify({ type:"set_lang", host_lang: hostLang, guest_lang: guestLang }));
  };

  ws.onmessage = (ev)=>{
    let msg=null;
    try{ msg = JSON.parse(ev.data); }catch{}
    if(!msg) return;

    if(msg.type === "peer_joined"){
      setHostWaitingUI(false);
      // ✅ Host otomatik konuşma sayfasına geçer (diller query ile gider)
      setTimeout(()=>{
        go(`${CALL_PATH}?room=${encodeURIComponent(room)}&role=host&host_lang=${encodeURIComponent(hostLang)}&guest_lang=${encodeURIComponent(guestLang)}`);
      }, 450);
    }
  };
};

/* ===============================
   GUEST FLOW
================================ */
$("btnGuest").onclick = ()=>{
  $("lobby").style.display="none";
  $("hostCard").style.display="none";
  $("guestCard").style.display="block";
};

$("btnBackGuest").onclick = ()=>{
  $("guestCard").style.display="none";
  $("lobby").style.display="block";
};
$("btnBackGuestTop").onclick = ()=>{
  $("guestCard").style.display="none";
  $("lobby").style.display="block";
};

$("btnJoin").onclick = ()=>{
  const code = ($("roomInput").value||"").trim().toUpperCase();
  if(!code) return;
  go(`${CALL_PATH}?room=${encodeURIComponent(code)}&role=guest`);
};

/* ===============================
   QR SCANNER (BarcodeDetector varsa)
================================ */
let scanStream = null;
let scanTimer = null;

async function stopScan(){
  if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
  try{
    scanStream?.getTracks?.().forEach(t=>t.stop());
  }catch{}
  scanStream = null;
  $("scanner").classList.remove("show");
}

$("scanClose").onclick = ()=>stopScan();

$("btnScan").onclick = async ()=>{
  // BarcodeDetector yoksa: bilgi ver, kodla devam
  if(!("BarcodeDetector" in window)){
    $("scanHint").textContent = "Bu cihaz QR taramayı desteklemiyor. Kod girerek bağlan.";
    $("scanner").classList.add("show");
    return;
  }

  try{
    $("scanner").classList.add("show");
    $("scanHint").textContent = "QR koda tut…";

    const video = $("scanVideo");
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio:false });
    video.srcObject = scanStream;
    await video.play();

    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    scanTimer = setInterval(async ()=>{
      try{
        const barcodes = await detector.detect(video);
        if(barcodes && barcodes.length){
          const raw = barcodes[0].rawValue || "";
          // beklenen URL: /pages/f2f_call.html?room=XXX&role=guest&host_lang=..&guest_lang=..
          try{
            const u = new URL(raw);
            const room = (u.searchParams.get("room")||"").toUpperCase();
            if(room){
              $("roomInput").value = room;
              await stopScan();
              // Direkt guest call sayfasına git
              go(raw);
            }
          }catch{
            // raw direk kodsa
            const code = String(raw).trim().toUpperCase();
            if(code.length >= 4){
              $("roomInput").value = code;
              await stopScan();
            }
          }
        }
      }catch{}
    }, 350);
  }catch(e){
    $("scanHint").textContent = "Kamera açılamadı. Kod girerek bağlan.";
  }
};

/* ===============================
   INIT
================================ */
(function initFromQuery(){
  // QR ile connect sayfasına geldiysen ?join=KOD
  const p = new URLSearchParams(location.search);
  const join = (p.get("join")||"").trim().toUpperCase();
  if(join){
    $("btnGuest").click();
    $("roomInput").value = join;
  }
})();

setLangUI();
