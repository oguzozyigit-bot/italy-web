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
    if(!raw) return { name:"Kullanıcı", picture:"", lang:(localStorage.getItem("f2f_my_lang")||"tr") };
    const u = JSON.parse(raw);
    const full = u.display_name || u.full_name || u.name || "";
    const name = shortDisplayName(full || "Kullanıcı");
    const picture = u.picture || u.avatar || u.avatar_url || "";
    const lang = localStorage.getItem("f2f_my_lang") || "tr";
    return { name, picture, lang };
  }catch{
    return { name:"Kullanıcı", picture:"", lang:(localStorage.getItem("f2f_my_lang")||"tr") };
  }
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

/* ✅ HOST: Odayı gerçekten oluştur */
async function createRoomOnBackend(room){
  return new Promise((resolve)=>{
    const me = getProfileFromCache();
    let ok = false;

    let ws;
    try{ ws = new WebSocket(wsUrl(room)); }catch{ return resolve(false); }

    const to = setTimeout(()=>{
      try{ ws.close(); }catch{}
      resolve(false);
    }, 3500);

    ws.onopen = ()=>{
      // NEW backend protocol
      ws.send(JSON.stringify({
        type: "create",
        room,
        from: "host",
        from_name: me.name,
        from_pic: me.picture || "",
        me_lang: (me.lang || "tr")
      }));
      // create başarılıysa room_created gelir; gelmezse open olsa bile 1sn sonra true say
      setTimeout(()=>{
        if(!ok){
          ok = true;
          clearTimeout(to);
          try{ ws.close(); }catch{}
          resolve(true);
        }
      }, 900);
    };

    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type === "room_created"){
          ok = true;
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

    ws.onclose = ()=>{
      if(!ok){
        clearTimeout(to);
        resolve(false);
      }
    };
  });
}

/* ---------- HOST PAGE ---------- */
async function initHost(){
  const room = (qs("room") || randCode(6)).toUpperCase();

  $("roomCode").textContent = room;

  const joinUrl = `https://italky.ai/pages/f2f_join.html?join=${encodeURIComponent(room)}`;
  $("qrImg").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  // ✅ oda hazırla
  const statusEl = $("hostStatus");
  if(statusEl) statusEl.textContent = "Oda hazırlanıyor…";

  const created = await createRoomOnBackend(room);
  if(statusEl){
    statusEl.textContent = created ? "Oda hazır ✅" : "Oda oluşturulamadı ❌ (internet/backend)";
  }

  $("btnCopy")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(room);
      $("btnCopy").textContent = "Kopyalandı ✅";
      setTimeout(()=> $("btnCopy").textContent="Kodu Kopyala", 900);
    }catch{
      alert("Kod: " + room);
    }
  });

  // call sayfasında host olarak devam
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
    const msg = "❌ Kod hatalı olabilir veya sohbet odası kapanmış olabilir.";
    setJoinHint(msg);
    alert(msg);
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
