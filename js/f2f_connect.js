// FILE: /js/f2f_connect.js
import { LANG_POOL } from "/js/lang_pool_full.js";

const $ = (id)=>document.getElementById(id);
const LANGS = Array.isArray(LANG_POOL) ? LANG_POOL : [
  { code:"tr", flag:"🇹🇷", name:"Türkçe" },
  { code:"en", flag:"🇬🇧", name:"English" },
];

function norm(code){ return String(code||"").toLowerCase().trim(); }
function displayName(code){
  const c = norm(code);
  const item = LANGS.find(x=>norm(x.code)===c);
  const flag = item?.flag || "🌐";
  const name = item?.name || c.toUpperCase();
  return `${flag} ${name}`;
}
function randCode(n=6){
  const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s=""; for(let i=0;i<n;i++) s += a[Math.floor(Math.random()*a.length)];
  return s;
}
function qs(k){ return new URLSearchParams(location.search).get(k); }
function go(u){ try{ location.assign(u); }catch{ location.href=u; } }

let myLang = localStorage.getItem("f2f_my_lang") || "tr";

/* Popover */
function closePop(){ $("langPop")?.classList.remove("show"); }
function openPop(){
  const list = $("popList");
  if(!list) return;

  list.innerHTML = LANGS.map(l=>{
    const c = norm(l.code);
    const active = (c === myLang);
    return `
      <div class="pop-item ${active?"active":""}" data-code="${c}">
        <div class="pop-left">
          <div class="pop-flag">${l.flag || "🌐"}</div>
          <div class="pop-name">${l.name || c.toUpperCase()}</div>
        </div>
        <div class="pop-code">${c.toUpperCase()}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".pop-item").forEach(item=>{
    item.addEventListener("click", ()=>{
      const c = item.getAttribute("data-code") || "tr";
      myLang = c;
      localStorage.setItem("f2f_my_lang", myLang);
      syncLangLabel();
      closePop();
    });
  });

  $("langPop")?.classList.add("show");
}
function syncLangLabel(){
  const t = $("meLangTxt");
  if(t) t.textContent = `BENİM DİLİM: ${displayName(myLang)}`;
}

/* Host page */
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
    const url = `/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=host&me_lang=${encodeURIComponent(myLang)}`;
    go(url);
  });

  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* Join page: camera */
let scanStream=null;
let scanTimer=null;

async function stopScanner(){
  try{ if(scanTimer) clearInterval(scanTimer); }catch{}
  scanTimer = null;
  try{ scanStream?.getTracks?.().forEach(t=>t.stop()); }catch{}
  scanStream = null;
  $("scanner")?.classList.remove("show");
}

async function startScanner(){
  const sc = $("scanner");
  const vid = $("scanVideo");
  const hint = $("scanHint");
  if(!sc || !vid) return;

  sc.classList.add("show");

  // iOS/WebView güvence
  try{
    vid.setAttribute("playsinline","");
    vid.muted = true;
    vid.autoplay = true;
  }catch{}

  if(hint) hint.textContent = "Kamera izni istenebilir…";

  // BarcodeDetector var mı?
  const hasBD = ("BarcodeDetector" in window);

  // Kamera açmayı dene (facingMode + fallback)
  let constraintsList = [
    { video: { facingMode: { ideal: "environment" } }, audio:false },
    { video: { facingMode: "environment" }, audio:false },
    { video: true, audio:false }
  ];

  for(const cons of constraintsList){
    try{
      scanStream = await navigator.mediaDevices.getUserMedia(cons);
      break;
    }catch(e){
      scanStream = null;
    }
  }

  if(!scanStream){
    if(hint) hint.textContent = "Kamera açılamadı. (İzin/cihaz) Kod girerek devam et.";
    return;
  }

  try{
    vid.srcObject = scanStream;
    await vid.play();
  }catch{
    if(hint) hint.textContent = "Video oynatılamadı. Kod girerek devam et.";
    return;
  }

  if(!hasBD){
    if(hint) hint.textContent = "QR okuma cihazda desteklenmiyor. Kamerayı kapatıp kod gir.";
    return;
  }

  if(hint) hint.textContent = "QR koda tut. Okuyunca otomatik doldurur.";

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
        }
      }
    }catch{}
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
    const url = `/pages/f2f_call.html?room=${encodeURIComponent(room)}&role=guest&me_lang=${encodeURIComponent(myLang)}`;
    go(url);
  });

  $("btnBack")?.addEventListener("click", ()=> go("/pages/f2f_connect.html"));
}

/* Boot */
document.addEventListener("DOMContentLoaded", ()=>{
  $("popClose")?.addEventListener("click", closePop);
  $("meLangBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openPop(); });

  document.addEventListener("click",(e)=>{
    const pop = $("langPop");
    if(!pop || !pop.classList.contains("show")) return;
    const inside = pop.contains(e.target);
    const isBtn = e.target?.closest?.("#meLangBtn");
    if(!inside && !isBtn) closePop();
  }, { capture:true });

  syncLangLabel();

  if($("roomCode") && $("qrImg")) initHost();
  if($("roomInput") && $("btnJoin")) initJoin();
});
