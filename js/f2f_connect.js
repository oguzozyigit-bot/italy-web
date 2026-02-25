// FILE: /js/f2f_connect.js
import { STORAGE_KEY } from "/js/config.js";
import { shortDisplayName } from "/js/ui_shell.js";

const API_BASE = "https://italky-api.onrender.com";
const $ = (id)=>document.getElementById(id);

const qs = (k)=>new URLSearchParams(location.search).get(k);
const normRoom = (s)=>String(s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);

function randCode(n=6){
  const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s=""; for(let i=0;i<n;i++) s += a[Math.floor(Math.random()*a.length)];
  return s;
}
function wsUrl(room){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${encodeURIComponent(room)}`;
}
function setText(id, v){
  const el = $(id);
  if(el) el.textContent = String(v ?? "");
}

/* ===== Profile cache ===== */
function getProfileFromCache(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { name:"Kullanıcı", picture:"" };
    const u = JSON.parse(raw);
    const full = u.display_name || u.full_name || u.name || "";
    const name = shortDisplayName(full || "Kullanıcı");
    const picture = u.picture || u.avatar || u.avatar_url || "";
    return { name, picture };
  }catch{
    return { name:"Kullanıcı", picture:"" };
  }
}
const ME = getProfileFromCache();

/* ===== WS: create & join_check ===== */
async function createRoomOnBackend(room, timeoutMs=4500){
  return new Promise((resolve)=>{
    let done=false;
    let ws;

    const finish=(ok)=>{
      if(done) return;
      done=true;
      try{ ws?.close?.(); }catch{}
      resolve(!!ok);
    };

    try{ ws = new WebSocket(wsUrl(room)); }catch{ return finish(false); }

    const to = setTimeout(()=>finish(false), timeoutMs);

    ws.onopen = ()=>{
      try{
        ws.send(JSON.stringify({
          type:"create",
          from: "host_" + Math.random().toString(16).slice(2,10),
          from_name: ME.name,
          from_pic: ME.picture || "",
          me_lang: (localStorage.getItem("f2f_my_lang")||"tr"),
        }));
      }catch{}
    };

    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type === "room_created"){
          clearTimeout(to);
          return finish(true);
        }
        // room_created gelmese bile presence gelirse oda var
        if(msg.type === "presence"){
          clearTimeout(to);
          return finish(true);
        }
      }catch{}
    };

    ws.onerror = ()=>{ clearTimeout(to); finish(false); };
  });
}

async function wsJoinCheck(room, timeoutMs=2500){
  return new Promise((resolve)=>{
    let done=false;
    let ws;

    const finish=(ok)=>{
      if(done) return;
      done=true;
      try{ ws?.close?.(); }catch{}
      resolve(!!ok);
    };

    try{ ws = new WebSocket(wsUrl(room)); }catch{ return finish(false); }

    const to = setTimeout(()=>finish(false), timeoutMs);

    ws.onopen = ()=>{
      try{ ws.send(JSON.stringify({ type:"join_check" })); }catch{}
    };

    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type === "room_ok"){ clearTimeout(to); return finish(true); }
        if(msg.type === "room_not_found"){ clearTimeout(to); return finish(false); }
      }catch{}
    };

    ws.onerror = ()=>{ clearTimeout(to); finish(false); };
  });
}

/* ===== QR (kamera) ===== */
let scanStream=null;
let scanTimer=null;

function setScanHint(msg){ setText("scanHint", msg); }

async function stopScanner(){
  try{ if(scanTimer) clearInterval(scanTimer); }catch{}
  scanTimer=null;
  try{ scanStream?.getTracks?.().forEach(t=>t.stop()); }catch{}
  scanStream=null;
  $("scanner")?.classList.remove("show");
}

async function startScanner(){
  const sc = $("scanner");
  const vid = $("scanVideo");
  if(!sc || !vid) return;

  sc.classList.add("show");

  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    setScanHint("Kamera için HTTPS gerekir. Kod girerek devam et.");
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

  scanStream=null;
  for(const cons of tries){
    try{
      scanStream = await navigator.mediaDevices.getUserMedia(cons);
      break;
    }catch{}
  }

  if(!scanStream){
    setScanHint("Kamera açılamadı. (İzin / WebView) Kod girerek devam et.");
    return;
  }

  try{
    vid.srcObject = scanStream;
    await vid.play();
  }catch{
    setScanHint("Video açılamadı. Kod girerek devam et.");
    return;
  }

  if(!hasBD){
    setScanHint("Bu cihaz QR okumayı desteklemiyor. Kod girerek devam et.");
    return;
  }

  setScanHint("QR koda tut. Okuyunca kod otomatik dolar.");

  const detector = new BarcodeDetector({ formats:["qr_code"] });
  scanTimer = setInterval(async ()=>{
    try{
      const barcodes = await detector.detect(vid);
      if(barcodes?.length){
        const raw = barcodes[0].rawValue || "";
        const u = new URL(raw, location.origin);
        const j = u.searchParams.get("join");
        if(j){
          const code = normRoom(j);
          if($("roomInput")) $("roomInput").value = code;
          await stopScanner();
          setText("joinHint", "QR okundu ✅ Bağlan’a bas.");
        }
      }
    }catch{}
  }, 240);
}

/* ===== MODE UI (tek kaynak: JS) ===== */
function setMode(m){
  $("hostPanel")?.classList.toggle("hide", m!=="host");
  $("joinPanel")?.classList.toggle("hide", m!=="join");
  $("cardHome")?.classList.toggle("hide", m!=="home");
  $("cardActions")?.classList.toggle("hide", m!=="home");
}

function setUrlMode(mode, extra={}){
  const u = new URL(location.href);
  u.searchParams.set("mode", mode);
  // join paramını temizle/kur
  if(extra.join){
    u.searchParams.set("join", extra.join);
  }else{
    u.searchParams.delete("join");
  }
  history.replaceState(null, "", u.toString());
}

let hostInitDone = false;

async function initHostMode(){
  if(hostInitDone) return;
  hostInitDone = true;

  const room = normRoom(qs("room") || randCode(6));
  setText("roomCode", room);

  const joinUrl = `https://italky.ai/pages/f2f_connect.html?mode=join&join=${encodeURIComponent(room)}`;
  const qr = $("qrImg");
  if(qr){
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;
  }

  setText("hostStatus", "Oda hazırlanıyor…");

  const ok = await createRoomOnBackend(room);
  setText("hostStatus", ok ? "Oda hazır ✅ Kod paylaşabilirsin." : "Oda oluşturulamadı ❌ (backend/bağlantı)");

  $("btnCopy")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(room);
      setText("hostStatus", "Kopyalandı ✅");
      setTimeout(()=>setText("hostStatus", ok ? "Oda hazır ✅ Kod paylaşabilirsin." : "Oda oluşturulamadı ❌"), 900);
    }catch{
      alert("Kod: " + room);
    }
  });

  $("btnGoCall")?.addEventListener("click", ()=>{
    location.href = `/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=host`;
  });
}

function initJoinMode(){
  const join = qs("join");
  if(join && $("roomInput")){
    $("roomInput").value = normRoom(join);
    setText("joinHint", "Kod alındı ✅ Bağlan’a bas.");
  }else{
    setText("joinHint", "Kodu gir ve Bağlan’a bas.");
  }

  $("btnScan")?.addEventListener("click", ()=> startScanner());
  $("scanClose")?.addEventListener("click", ()=> stopScanner());

  $("btnJoin")?.addEventListener("click", async ()=>{
    const room = normRoom($("roomInput")?.value || "");
    if(room.length < 4){
      alert("Kod gir.");
      return;
    }

    setText("joinHint", "Kontrol ediliyor…");

    const ok = await wsJoinCheck(room);
    if(!ok){
      const msg = "❌ Kod hatalı olabilir veya oda kapanmış olabilir.";
      setText("joinHint", msg);
      alert(msg);
      return;
    }

    location.href = `/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=guest`;
  });
}

/* ===== BOOT ===== */
document.addEventListener("DOMContentLoaded", async ()=>{
  // Butonlar
  $("goHost")?.addEventListener("click", async ()=>{
    setUrlMode("host");
    setMode("host");
    hostInitDone = false;
    await initHostMode();
  });

  $("goGuest")?.addEventListener("click", ()=>{
    setUrlMode("join");
    setMode("join");
    initJoinMode();
  });

  $("btnBackHost")?.addEventListener("click", ()=>{
    setUrlMode("home");
    setMode("home");
  });

  $("btnBackJoin")?.addEventListener("click", ()=>{
    setUrlMode("home");
    setMode("home");
    stopScanner();
  });

  // Sayfa açılış modu
  const mode = qs("mode") || (qs("join") ? "join" : "home");
  setMode(mode);

  if(mode === "host"){
    await initHostMode();
  }else if(mode === "join"){
    initJoinMode();
  }

  // Scanner kapatma garanti
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) stopScanner();
  });
});
