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

/* ===============================
   WS JOIN CHECK (oda var mı?)
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
      // backend join_check destekliyorsa room_ok/room_not_found döner
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
   HOST: Odayı gerçekten oluştur
   - room_created gelirse ✅
   - gelmezse FAIL (artık "open oldu diye true" yok)
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
        from: "host",
        from_name: me.name,
        from_pic: me.picture || "",
        me_lang: (me.lang || "tr")
      }));
    };

    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type === "room_created" || msg.type === "room_ok"){
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
      // timeout resolve edecek
    };
  });
}

/* ===============================
   HOST PAGE
================================ */
async function initHost(){
  const room = (qs("room") || randCode(6)).toUpperCase();

  $("roomCode") && ($("roomCode").textContent = room);

  // ✅ QR link: aynı sayfaya join ile dönsün (f2f_join.html yoksa sorun biter)
  const joinUrl = `https://italky.ai/pages/f2f_connect.html?join=${encodeURIComponent(room)}`;
  if($("qrImg")){
    $("qrImg").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;
  }

  const statusEl = $("hostStatus");
  if(statusEl) statusEl.textContent = "Oda hazırlanıyor…";

  const created = await createRoomOnBackend(room);
  if(statusEl) statusEl.textContent = created ? "Oda hazır ✅" : "Oda oluşturulamadı ❌ (backend)";

  $("btnCopy")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(room);
      $("btnCopy").textContent = "Kopyalandı ✅";
      setTimeout(()=> $("btnCopy").textContent="Kodu Kopyala", 900);
    }catch{
      alert("Kod: " + room);
    }
  });

  // Host call
  $("btnGoCall")?.addEventListener("click", ()=>{
    go(`/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=host`);
  });

  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ===============================
   JOIN PAGE (QR + Code)
================================ */
let scanStream=null;
let scanTimer=null;
let detector=null;

async function stopScanner(){
  try{ if(scanTimer) clearInterval(scanTimer); }catch{}
  scanTimer = null;
  detector = null;
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

/* --- Image QR decode fallback (BarcodeDetector yoksa) --- */
async function decodeQrFromImageFile(file){
  // api.qrserver.com read-qr-code endpoint
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("https://api.qrserver.com/v1/read-qr-code/", { method:"POST", body: fd });
  if(!r.ok) return null;
  const data = await r.json().catch(()=>null);
  const txt = data?.[0]?.symbol?.[0]?.data || null;
  return txt ? String(txt) : null;
}

async function startScanner(){
  const sc = $("scanner");
  const vid = $("scanVideo");
  if(!sc || !vid) return;

  sc.classList.add("show");

  // HTTPS check
  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    setScanHint("Kamera için HTTPS gerekir. Kod gir.");
    return;
  }

  // Camera preview
  try{
    vid.setAttribute("playsinline","");
    vid.muted = true;
    vid.autoplay = true;
  }catch{}

  setScanHint("Kamera izni istenebilir…");

  // Try camera
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
      // keep trying
    }
  }

  if(!scanStream){
    setScanHint("Kamera açılamadı. (WebView izinleri) Kod gir veya Foto ile QR seç.");
    return;
  }

  try{
    vid.srcObject = scanStream;
    await vid.play();
  }catch{
    setScanHint("Video açılamadı. Kod gir veya Foto ile QR seç.");
    return;
  }

  const hasBD = ("BarcodeDetector" in window);

  // ✅ BarcodeDetector varsa canlı çöz
  if(hasBD){
    setScanHint("QR koda tut. Okuyunca otomatik dolar.");
    try{ detector = new BarcodeDetector({ formats:["qr_code"] }); }catch{ detector=null; }

    scanTimer = setInterval(async ()=>{
      if(!detector) return;
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

    return;
  }

  // ✅ BarcodeDetector yoksa: kamerayı göster ama “Foto ile QR” fallback
  setScanHint("Bu cihaz canlı QR okumayı desteklemiyor. Foto ile QR seç veya kod gir.");
}

/* --- Join by code --- */
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

/* --- init join page --- */
function initJoin(){
  const j = qs("join");
  if(j && $("roomInput")) $("roomInput").value = String(j).toUpperCase();

  $("btnScan")?.addEventListener("click", ()=> startScanner());
  $("scanClose")?.addEventListener("click", ()=> stopScanner());

  // ✅ “Foto ile QR seç” butonu varsa bağla (HTML’e eklemeni öneririm)
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

  $("btnJoin")?.addEventListener("click", joinFlow);
  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));

  // Page hide => camera stop
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) stopScanner();
  });
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // host vs join sayfası ayrımı HTML’deki elemanlarla
  if($("roomCode") && $("qrImg")) initHost();
  if($("roomInput") && $("btnJoin")) initJoin();
});
