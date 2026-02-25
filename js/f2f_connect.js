// FILE: /js/f2f_connect.js
import { STORAGE_KEY } from "/js/config.js";
import { shortDisplayName } from "/js/ui_shell.js";

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

function getProfileFromCache(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const lang = (localStorage.getItem("f2f_my_lang") || "tr");
    if(!raw) return { name:"Kullanıcı", picture:"", lang };

    const u = JSON.parse(raw);
    const full = u.display_name || u.full_name || u.name || "";
    const name = shortDisplayName(full || "Kullanıcı");
    const picture = u.picture || u.avatar || u.avatar_url || "";
    return { name, picture, lang };
  }catch{
    return { name:"Kullanıcı", picture:"", lang:(localStorage.getItem("f2f_my_lang")||"tr") };
  }
}

/* ===============================
   WS JOIN CHECK
================================ */
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

/* ===============================
   HOST CREATE (must receive room_created)
================================ */
async function createRoomOnBackend(room){
  return new Promise((resolve)=>{
    const me = getProfileFromCache();
    let ws;
    try{ ws = new WebSocket(wsUrl(room)); }catch{ return resolve(false); }

    const to = setTimeout(()=>{
      try{ ws.close(); }catch{}
      resolve(false);
    }, 3500);

    ws.onopen = ()=>{
      ws.send(JSON.stringify({
        type: "create",
        room,
        from: "host",              // host panelde sabit olabilir
        from_name: me.name,
        from_pic: me.picture || "",
        me_lang: (me.lang || "tr")
      }));
    };

    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type === "room_created"){
          clearTimeout(to);
          try{ ws.close(); }catch{}
          resolve(true);
        }
      }catch{}
    };

    ws.onerror = ()=>{
      clearTimeout(to);
      try{ ws.close(); }catch{}
      resolve(false);
    };
  });
}

/* ===============================
   QR IMAGE DECODE FALLBACK
================================ */
async function decodeQrFromImageFile(file){
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("https://api.qrserver.com/v1/read-qr-code/", { method:"POST", body: fd });
  if(!r.ok) return null;
  const data = await r.json().catch(()=>null);
  const txt = data?.[0]?.symbol?.[0]?.data || null;
  return txt ? String(txt) : null;
}

/* ===============================
   CAMERA SCANNER (BarcodeDetector varsa)
================================ */
let scanStream=null;
let scanTimer=null;
let detector=null;

async function stopScanner(){
  try{ if(scanTimer) clearInterval(scanTimer); }catch{}
  scanTimer=null;
  detector=null;
  try{ scanStream?.getTracks?.().forEach(t=>t.stop()); }catch{}
  scanStream=null;
  $("scanner")?.classList.remove("show");
}

function setScanHint(msg){ const el=$("scanHint"); if(el) el.textContent = msg; }
function setJoinHint(msg){ const el=$("joinHint"); if(el) el.textContent = msg; }

async function startScanner(){
  const sc = $("scanner");
  const vid = $("scanVideo");
  if(!sc || !vid) return;

  sc.classList.add("show");

  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    setScanHint("Kamera için HTTPS gerekir. Kod gir.");
    return;
  }

  setScanHint("Kamera izni istenebilir…");

  const tries = [
    { video: { facingMode: { ideal: "environment" } }, audio:false },
    { video: { facingMode: "environment" }, audio:false },
    { video: true, audio:false }
  ];

  scanStream=null;
  for(const cons of tries){
    try{
      scanStream = await navigator.mediaDevices.getUserMedia(cons);
      break;
    }catch{}
  }

  if(!scanStream){
    setScanHint("Kamera açılamadı. Kod gir veya Foto ile QR seç.");
    return;
  }

  try{
    vid.srcObject = scanStream;
    await vid.play();
  }catch{
    setScanHint("Video açılamadı. Kod gir veya Foto ile QR seç.");
    return;
  }

  if(!("BarcodeDetector" in window)){
    setScanHint("Bu cihaz canlı QR okumayı desteklemiyor. Foto ile QR seç veya kod gir.");
    return;
  }

  try{
    detector = new BarcodeDetector({ formats:["qr_code"] });
  }catch{
    detector = null;
    setScanHint("QR okuyucu başlatılamadı. Foto ile QR seç veya kod gir.");
    return;
  }

  setScanHint("QR koda tut. Okuyunca otomatik dolar.");

  scanTimer = setInterval(async ()=>{
    if(!detector) return;
    try{
      const barcodes = await detector.detect(vid);
      if(barcodes?.length){
        const raw = barcodes[0].rawValue || "";
        const u = new URL(raw, location.origin);
        const code = u.searchParams.get("join");
        if(code){
          $("roomInput").value = String(code).toUpperCase();
          await stopScanner();
          setJoinHint("QR okundu ✅ Bağlan’a bas.");
        }
      }
    }catch{}
  }, 240);
}

/* ===============================
   HOST INIT
================================ */
async function initHost(){
  const room = (qs("room") || randCode(6)).toUpperCase();

  $("roomCode").textContent = room;

  // QR: aynı sayfaya join ile dön
  const joinUrl = `https://italky.ai/pages/f2f_connect.html?join=${encodeURIComponent(room)}`;
  $("qrImg").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  $("hostStatus").textContent = "Oda hazırlanıyor…";
  const created = await createRoomOnBackend(room);
  $("hostStatus").textContent = created ? "Oda hazır ✅" : "Oda oluşturulamadı ❌";

  $("btnCopy")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(room);
      $("btnCopy").querySelector("span").textContent = "Kopyalandı ✅";
      setTimeout(()=> $("btnCopy").querySelector("span").textContent="Kodu Kopyala", 900);
    }catch{
      alert("Kod: " + room);
    }
  });

  $("btnGoCall")?.addEventListener("click", ()=>{
    go(`/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=host`);
  });
}

/* ===============================
   JOIN INIT
================================ */
async function joinFlow(){
  const code = String($("roomInput")?.value || "").trim().toUpperCase();
  if(code.length < 4){
    alert("Kod gir.");
    return;
  }

  setJoinHint("Kontrol ediliyor…");

  const ok = await wsJoinCheck(code);
  if(!ok){
    const msg = "❌ Kod hatalı olabilir veya oda kapanmış olabilir.";
    setJoinHint(msg);
    alert(msg);
    return;
  }

  go(`/pages/f2f_call.html?room=${encodeURIComponent(code)}&role=guest`);
}

function initJoin(){
  const join = qs("join");
  if(join && $("roomInput")){
    $("roomInput").value = String(join).toUpperCase();
    setJoinHint("QR/kod alındı ✅ Bağlan’a bas.");
  }

  $("btnScan")?.addEventListener("click", startScanner);
  $("scanClose")?.addEventListener("click", stopScanner);
  $("btnJoin")?.addEventListener("click", joinFlow);

  $("btnPickQR")?.addEventListener("click", async ()=>{
    try{
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.capture = "environment";
      inp.onchange = async ()=>{
        const f = inp.files?.[0];
        if(!f) return;
        setJoinHint("QR çözülüyor…");
        const raw = await decodeQrFromImageFile(f);
        if(!raw){
          setJoinHint("QR okunamadı. Kod gir.");
          return;
        }
        try{
          const u = new URL(raw, location.origin);
          const code = u.searchParams.get("join");
          if(code){
            $("roomInput").value = String(code).toUpperCase();
            setJoinHint("QR çözüldü ✅ Bağlan’a bas.");
          }else{
            setJoinHint("QR geçersiz. Kod gir.");
          }
        }catch{
          setJoinHint("QR geçersiz. Kod gir.");
        }
      };
      inp.click();
    }catch{
      setJoinHint("Foto seçilemiyor. Kod gir.");
    }
  });

  document.addEventListener("visibilitychange", ()=>{ if(document.hidden) stopScanner(); });
}

/* ===============================
   BOOT
================================ */
document.addEventListener("DOMContentLoaded", ()=>{
  // Host panel açık mı?
  if($("hostPanel") && !$("hostPanel").classList.contains("hide")){
    initHost();
  }
  // Join panel açık mı?
  if($("joinPanel") && !$("joinPanel").classList.contains("hide")){
    initJoin();
  }

  // Panel değişince init tekrar çalışsın (mode switch)
  // (Home JS'in history.replaceState ile yaptığı switch sonrası)
  const obs = new MutationObserver(()=>{
    if($("hostPanel") && !$("hostPanel").classList.contains("hide")){
      if(!$("roomCode").textContent || $("roomCode").textContent.includes("-")) initHost();
    }
    if($("joinPanel") && !$("joinPanel").classList.contains("hide")){
      initJoin();
    }
  });
  obs.observe(document.body, { attributes:true, childList:true, subtree:true });
});
