// FILE: /js/f2f_connect.js
import { LANG_POOL } from "/js/lang_pool_full.js";

const $ = (id)=>document.getElementById(id);

const LANGS = Array.isArray(LANG_POOL) ? LANG_POOL : [
  { code:"tr", flag:"🇹🇷" },
  { code:"en", flag:"🇬🇧" },
];

function norm(code){
  return String(code||"").toLowerCase().trim();
}

function label(code){
  const c = norm(code);
  const f = (LANGS.find(x=>norm(x.code)===c)?.flag) || "🌐";
  // basit label: kodu büyük yaz
  return `${f} ${c.toUpperCase()}`;
}

function randCode(n=6){
  const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s="";
  for(let i=0;i<n;i++) s += a[Math.floor(Math.random()*a.length)];
  return s;
}

function qs(k){
  return new URLSearchParams(location.search).get(k);
}

function go(u){
  try{ location.assign(u); }catch{ location.href=u; }
}

/* ===============================
   Shared lang state
================================ */
let hostLang = localStorage.getItem("f2f_host_lang") || "tr";
let guestLang = localStorage.getItem("f2f_guest_lang") || "en";

/* ===============================
   Popover lang picker
================================ */
let popTarget = null; // "host" or "guest"

function closePop(){
  $("langPop")?.classList.remove("show");
}

function openPop(target){
  popTarget = target;
  const pop = $("langPop");
  const list = $("popList");
  const title = $("popTitle");
  if(!pop || !list || !title) return;

  title.textContent = (target === "host") ? "HOST DİLİ" : "GUEST DİLİ";
  list.innerHTML = LANGS.map(l=>{
    const c = norm(l.code);
    const active = (target==="host" ? hostLang : guestLang) === c;
    return `
      <div class="pop-item ${active?"active":""}" data-code="${c}">
        <div class="pop-left">
          <div class="pop-flag">${l.flag || "🌐"}</div>
          <div class="pop-name">${(l.name || c.toUpperCase())}</div>
        </div>
        <div class="pop-code">${c.toUpperCase()}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".pop-item").forEach(item=>{
    item.addEventListener("click", ()=>{
      const c = item.getAttribute("data-code") || "en";
      if(popTarget === "host") hostLang = c; else guestLang = c;

      localStorage.setItem("f2f_host_lang", hostLang);
      localStorage.setItem("f2f_guest_lang", guestLang);

      syncLangLabels();
      closePop();
    });
  });

  pop.classList.add("show");
}

function syncLangLabels(){
  // host page & join page shared ids
  if($("hostLangTxt")) $("hostLangTxt").textContent = `${label(hostLang).replace(hostLang.toUpperCase(), "")}HOST: ${hostLang.toUpperCase()}`.replace("  "," ");
  if($("guestLangTxt")) $("guestLangTxt").textContent = `${label(guestLang).replace(guestLang.toUpperCase(), "")}GUEST: ${guestLang.toUpperCase()}`.replace("  "," ");
}

/* ===============================
   Host page logic
================================ */
function initHost(){
  const codeEl = $("roomCode");
  const imgEl = $("qrImg");
  const copyBtn = $("btnCopy");
  const goBtn = $("btnGoCall");
  const backBtn = $("btnBack");

  // create room if not exist
  const room = qs("room") || randCode(6);
  if(codeEl) codeEl.textContent = room;

  // QR data is URL to guest join page with join param
  const joinUrl = `https://italky.ai/pages/f2f_join.html?join=${encodeURIComponent(room)}`;

  // QR image (simple external generator)
  if(imgEl) imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  copyBtn?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(room);
      copyBtn.textContent = "Kopyalandı ✅";
      setTimeout(()=>copyBtn.textContent="Kodu Kopyala", 1000);
    }catch{
      alert("Kopyalama yok. Kod: " + room);
    }
  });

  goBtn?.addEventListener("click", ()=>{
    // Konuşma ekranına geç (şimdilik facetoface)
    const url = `/facetoface.html?room=${encodeURIComponent(room)}&role=host&host_lang=${encodeURIComponent(hostLang)}&guest_lang=${encodeURIComponent(guestLang)}`;
    go(url);
  });

  backBtn?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ===============================
   Join page logic
================================ */
let scanStream = null;
let scanTimer = null;

async function stopScanner(){
  try{ if(scanTimer) clearInterval(scanTimer); }catch{}
  scanTimer = null;
  try{
    scanStream?.getTracks?.().forEach(t=>t.stop());
  }catch{}
  scanStream = null;
  const sc = $("scanner");
  if(sc) sc.classList.remove("show");
}

async function startScanner(){
  const sc = $("scanner");
  const vid = $("scanVideo");
  const hint = $("scanHint");
  if(!sc || !vid) return;

  // BarcodeDetector support?
  const hasBD = ("BarcodeDetector" in window);
  if(!hasBD){
    if(hint) hint.textContent = "QR tarayıcı desteklenmiyor. Kod girerek devam et.";
    sc.classList.add("show");
    return;
  }

  sc.classList.add("show");
  if(hint) hint.textContent = "QR koda tut. Okuyunca otomatik doldurur.";

  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    vid.srcObject = scanStream;
    await vid.play();

    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    scanTimer = setInterval(async ()=>{
      try{
        const barcodes = await detector.detect(vid);
        if(barcodes && barcodes.length){
          const raw = barcodes[0].rawValue || "";
          // expecting join URL: ...?join=CODE
          const u = new URL(raw, location.origin);
          const j = u.searchParams.get("join");
          if(j){
            $("roomInput").value = j.toUpperCase();
            await stopScanner();
          }
        }
      }catch{}
    }, 240);
  }catch(e){
    if(hint) hint.textContent = "Kamera açılamadı. Kod girerek devam et.";
  }
}

function initJoin(){
  const roomInput = $("roomInput");
  const joinBtn = $("btnJoin");
  const backBtn = $("btnBack");
  const scanBtn = $("btnScan");
  const scanClose = $("scanClose");

  // if came from qr url
  const j = qs("join");
  if(j && roomInput) roomInput.value = String(j).toUpperCase();

  scanBtn?.addEventListener("click", ()=> startScanner());
  scanClose?.addEventListener("click", ()=> stopScanner());

  joinBtn?.addEventListener("click", ()=>{
    const room = String(roomInput?.value || "").trim().toUpperCase();
    if(room.length < 4){
      alert("Kod gir.");
      return;
    }
    const url = `/facetoface.html?room=${encodeURIComponent(room)}&role=guest&host_lang=${encodeURIComponent(hostLang)}&guest_lang=${encodeURIComponent(guestLang)}`;
    go(url);
  });

  backBtn?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* ===============================
   Common bindings
================================ */
function bindCommon(){
  $("popClose")?.addEventListener("click", closePop);

  document.addEventListener("click",(e)=>{
    const pop = $("langPop");
    if(!pop) return;
    if(!pop.classList.contains("show")) return;
    const inside = pop.contains(e.target);
    const isBtn = e.target?.closest?.("#hostLangBtn,#guestLangBtn");
    if(!inside && !isBtn) closePop();
  }, { capture:true });

  $("hostLangBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openPop("host"); });
  $("guestLangBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openPop("guest"); });

  syncLangLabels();
}

/* ===============================
   BOOT
================================ */
document.addEventListener("DOMContentLoaded", ()=>{
  bindCommon();

  // Page routing by presence of elements
  if($("roomCode") && $("qrImg")) initHost();
  if($("roomInput") && $("btnJoin")) initJoin();
});
