// FILE: /js/f2f_connect.js
const API_BASE = "https://italky-api.onrender.com";
const $ = (id)=>document.getElementById(id);

function qs(k){ return new URLSearchParams(location.search).get(k); }
function go(u){ try{ location.assign(u); }catch{ location.href=u; } }

function randCode(n=6){
  const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s=""; for(let i=0;i<n;i++) s += a[Math.floor(Math.random()*a.length)];
  return s;
}
function wsUrl(room){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

async function wsJoinCheck(room, timeoutMs=2500){
  return new Promise((resolve)=>{
    let done=false;
    const finish=(ok)=>{
      if(done) return;
      done=true;
      try{ ws?.close?.(); }catch{}
      resolve(!!ok);
    };

    let ws;
    try{ ws = new WebSocket(wsUrl(room)); }catch{ return finish(false); }

    const to = setTimeout(()=>finish(false), timeoutMs);

    ws.onopen = ()=>{
      try{ ws.send(JSON.stringify({ type:"join_check", room })); }catch{}
    };
    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type === "room_ok"){ clearTimeout(to); finish(true); }
        if(msg.type === "room_not_found"){ clearTimeout(to); finish(false); }
      }catch{}
    };
    ws.onerror = ()=>{ clearTimeout(to); finish(false); };
    ws.onclose = ()=>{ clearTimeout(to); finish(false); };
  });
}

/* ---------- HOST PAGE ---------- */
function initHost(){
  const room = qs("room") || randCode(6);
  $("roomCode").textContent = room;

  // QR join link
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

  // ✅ Host odasını backend’de GERÇEKTEN oluştur
  $("btnGoCall")?.addEventListener("click", ()=>{
    go(`/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=host`);
  });

  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ---------- JOIN PAGE ---------- */
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

  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    setScanHint("Kamera için HTTPS gerekir. Kod gir.");
    return;
  }

  const hasBD = ("BarcodeDetector" in window);

  try{
    vid.setAttribute("playsinline","");
    vid.muted = true;
    vid.autoplay = true;
  }catch{}

  setScanHint("Kamera izni istenebilir…");

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
    }catch{}
  }

  if(!scanStream){
    setScanHint("Kamera açılamadı. Kod girerek devam et.");
    return;
  }

  try{
    vid.srcObject = scanStream;
    await vid.play();
  }catch{
    setScanHint("Video açılamadı. Kod gir.");
    return;
  }

  if(!hasBD){
    setScanHint("Bu cihaz QR okumayı desteklemiyor. Kod gir.");
    return;
  }

  setScanHint("QR koda tut. Okuyunca otomatik dolar.");

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
    }catch{}
  }, 240);
}

async function joinFlow(){
  const room = String($("roomInput")?.value || "").trim().toUpperCase();
  if(room.length < 4){
    alert("Kod gir.");
    return;
  }

  setJoinHint("Kontrol ediliyor…");

  const ok = await wsJoinCheck(room);
  if(!ok){
    setJoinHint("❌ Kod hatalı olabilir veya sohbet odası kapanmış olabilir.");
    alert("Kod hatalı olabilir veya sohbet odası kapanmış olabilir.");
    return;
  }

  go(`/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=guest`);
}

function initJoin(){
  const j = qs("join");
  if(j && $("roomInput")) $("roomInput").value = String(j).toUpperCase();

  $("btnScan")?.addEventListener("click", ()=> startScanner());
  $("scanClose")?.addEventListener("click", ()=> stopScanner());

  $("btnJoin")?.addEventListener("click", joinFlow);
  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  if($("roomCode") && $("qrImg")) initHost();
  if($("roomInput") && $("btnJoin")) initJoin();
});
