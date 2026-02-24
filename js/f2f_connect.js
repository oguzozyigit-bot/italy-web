// FILE: /js/f2f_connect.js
const $ = (id)=>document.getElementById(id);

function qs(k){ return new URLSearchParams(location.search).get(k); }
function go(u){ try{ location.assign(u); }catch{ location.href=u; } }

/* ---------- HOST PAGE (unchanged basics) ---------- */
function randCode(n=6){
  const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s=""; for(let i=0;i<n;i++) s += a[Math.floor(Math.random()*a.length)];
  return s;
}

function initHost(){
  const room = qs("room") || randCode(6);
  $("roomCode").textContent = room;

  const joinUrl = `https://italky.ai/pages/f2f_join.html?join=${encodeURIComponent(room)}`;
  $("qrImg").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  $("btnCopy")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(room);
      $("btnCopy").textContent = "Kopyalandı ✅";
      setTimeout(()=> $("btnCopy").textContent="Kodu Kopyala", 900);
    }catch{
      alert("Kod: " + room);
    }
  });

  $("btnGoCall")?.addEventListener("click", ()=>{
    // Dil seçimi sohbet sayfasında
    const url = `/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=host`;
    go(url);
  });

  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ---------- JOIN PAGE (camera always opens preview) ---------- */
let scanStream=null;
let scanTimer=null;

async function stopScanner(){
  try{ if(scanTimer) clearInterval(scanTimer); }catch{}
  scanTimer = null;
  try{ scanStream?.getTracks?.().forEach(t=>t.stop()); }catch{}
  scanStream = null;
  $("scanner")?.classList.remove("show");
}

function setScanHint(msg){
  const el = $("scanHint");
  if(el) el.textContent = msg;
}
function setJoinHint(msg){
  const el = $("joinHint");
  if(el) el.textContent = msg;
}

async function startScanner(){
  const sc = $("scanner");
  const vid = $("scanVideo");
  if(!sc || !vid) return;

  sc.classList.add("show");

  // Secure context check (WebView sometimes)
  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    setScanHint("Kamera için HTTPS gerekir. Kod girerek devam et.");
    return;
  }

  // barcode detector optional
  const hasBD = ("BarcodeDetector" in window);

  try{
    vid.setAttribute("playsinline","");
    vid.muted = true;
    vid.autoplay = true;
  }catch{}

  setScanHint("Kamera izni istenebilir…");

  // Try multiple constraints (environment -> fallback)
  const tries = [
    { video: { facingMode: { ideal: "environment" } }, audio:false },
    { video: { facingMode: "environment" }, audio:false },
    { video: true, audio:false }
  ];

  scanStream = null;
  for(const cons of tries){
    try{
      scanStream = await navigator.mediaDevices.getUserMedia(cons);
      break;
    }catch(e){
      scanStream = null;
    }
  }

  if(!scanStream){
    setScanHint("Kamera açılamadı. (İzin/cihaz) Kod girerek devam et.");
    return;
  }

  try{
    vid.srcObject = scanStream;
    await vid.play();
  }catch{
    setScanHint("Video oynatılamadı. Kod girerek devam et.");
    return;
  }

  // If no QR decoding support, still show camera preview
  if(!hasBD){
    setScanHint("Bu cihaz QR taramayı desteklemiyor. Kod girerek devam et.");
    return;
  }

  setScanHint("QR koda tut. Okuyunca otomatik doldurur.");

  const detector = new BarcodeDetector({ formats:["qr_code"] });
  scanTimer = setInterval(async ()=>{
    try{
      const barcodes = await detector.detect(vid);
      if(barcodes?.length){
        const raw = barcodes[0].rawValue || "";
        const u = new URL(raw, location.origin);
        const j = u.searchParams.get("join");
        if(j){
          $("roomInput").value = String(j).toUpperCase();
          await stopScanner();
          setJoinHint("QR okundu ✅ Bağlan’a bas.");
        }
      }
    }catch{
      // keep trying
    }
  }, 240);
}

function initJoin(){
  const j = qs("join");
  if(j && $("roomInput")) $("roomInput").value = String(j).toUpperCase();

  $("btnScan")?.addEventListener("click", ()=> startScanner());
  $("scanClose")?.addEventListener("click", ()=> stopScanner());

  $("btnJoin")?.addEventListener("click", ()=>{
    const room = String($("roomInput")?.value || "").trim().toUpperCase();
    if(room.length < 4){
      alert("Kod gir.");
      return;
    }
    const url = `/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=guest`;
    go(url);
  });

  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  if($("roomCode") && $("qrImg")) initHost();
  if($("roomInput") && $("btnJoin")) initJoin();
});
