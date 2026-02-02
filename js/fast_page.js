// FILE: italky-web/js/fast_page.js
// Anında Çeviri v5
// ✅ Konuşurken anlık çeviri: interim -> throttle -> ekranda tek akış
// ✅ Dropdown seçim fix (pointerdown + stopPropagation)
// ✅ “Çeviri” label yok, ekranı şişirme yok
// ✅ Play/Pause renk ile (sessiz). Biz ekstra ses çalmıyoruz.

import { BASE_DOMAIN } from "/js/config.js";
const $ = (id)=>document.getElementById(id);

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 2200);
}

const LANGS = [
  { code:"tr", name:"Türkçe",     sr:"tr-TR", tts:"tr-TR" },
  { code:"en", name:"English",    sr:"en-US", tts:"en-US" },
  { code:"de", name:"Deutsch",    sr:"de-DE", tts:"de-DE" },
  { code:"fr", name:"Français",   sr:"fr-FR", tts:"fr-FR" },
  { code:"it", name:"Italiano",   sr:"it-IT", tts:"it-IT" },
  { code:"es", name:"Español",    sr:"es-ES", tts:"es-ES" },
  { code:"pt", name:"Português",  sr:"pt-PT", tts:"pt-PT" },
  { code:"ru", name:"Русский",    sr:"ru-RU", tts:"ru-RU" },
  { code:"ar", name:"العربية",    sr:"ar-SA", tts:"ar-SA" },
  { code:"nl", name:"Nederlands", sr:"nl-NL", tts:"nl-NL" },
  { code:"sv", name:"Svenska",    sr:"sv-SE", tts:"sv-SE" },
  { code:"no", name:"Norsk",      sr:"nb-NO", tts:"nb-NO" },
  { code:"da", name:"Dansk",      sr:"da-DK", tts:"da-DK" },
  { code:"pl", name:"Polski",     sr:"pl-PL", tts:"pl-PL" },
];

function by(code){
  return LANGS.find(x=>x.code===code) || LANGS[0];
}
function baseUrl(){
  return String(BASE_DOMAIN||"").replace(/\/+$/,"");
}

function escapeHtml(s=""){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function norm(s){
  return String(s||"")
    .toLowerCase()
    .trim()
    .replace(/\s+/g," ")
    .replace(/[’']/g,"'")
    .replace(/[.,!?;:]+$/g,"");
}

/* ========= UI helpers ========= */
function addLine(text){
  const wrap = $("stream");
  const b = document.createElement("div");
  b.className = "bubble";
  b.innerHTML = escapeHtml(text || "—");
  wrap.appendChild(b);
  // keep last ~10 items max
  while(wrap.children.length > 10) wrap.removeChild(wrap.firstElementChild);
  wrap.scrollTop = wrap.scrollHeight;
}

function setStatus(s){
  $("panelStatus").textContent = s;
}

function setPlayUI(on){
  $("playBtn")?.classList.toggle("running", !!on);
  $("icoPlay").style.display = on ? "none" : "block";
  $("icoPause").style.display = on ? "block" : "none";
}

/* ========= Custom Dropdown (mobile-safe) ========= */
function buildDropdown(rootId, btnId, txtId, menuId, defCode){
  const root = $(rootId);
  const btn = $(btnId);
  const txt = $(txtId);
  const menu = $(menuId);

  let current = defCode;

  function closeAll(){
    document.querySelectorAll(".dd.open").forEach(x=>x.classList.remove("open"));
  }

  function setValue(code, silent=false){
    current = code;
    txt.textContent = by(code).name;
    if(!silent) root.dispatchEvent(new CustomEvent("italky:change", { detail:{ code } }));
  }

  menu.innerHTML = `
    <div class="ddSearchWrap"><input class="ddSearch" type="text" placeholder="Ara..." /></div>
    ${LANGS.map(l=>`<div class="ddItem" data-code="${l.code}">${l.name}</div>`).join("")}
  `;

  const search = menu.querySelector(".ddSearch");
  const items = Array.from(menu.querySelectorAll(".ddItem"));

  function filter(q){
    const s = String(q||"").toLowerCase().trim();
    items.forEach(it=>{
      const name = (it.textContent||"").toLowerCase();
      it.classList.toggle("hidden", s && !name.includes(s));
    });
  }
  search.addEventListener("input", ()=> filter(search.value));

  // ✅ item selection: pointerdown + stopPropagation
  items.forEach(it=>{
    it.addEventListener("pointerdown", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const code = it.getAttribute("data-code");
      closeAll();
      setValue(code, false);
    });
  });

  // open/close
  btn.addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    const open = root.classList.contains("open");
    closeAll();
    root.classList.toggle("open", !open);
    if(!open){
      search.value = "";
      filter("");
      setTimeout(()=> search.focus(), 0);
    }
  });

  // click outside
  document.addEventListener("pointerdown", ()=> closeAll(), { passive:true });

  setValue(defCode, true);
  return { get:()=>current, set:(c)=>setValue(c,false), root };
}

/* ========= SpeechRecognition ========= */
function srSupported(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function buildRecognizer(srLocale){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = srLocale;
  r.interimResults = true;
  r.continuous = true;
  return r;
}

/* ========= Translate API ========= */
async function translateViaApi(text, src, dst){
  const base = baseUrl();
  if(!base) return text;

  const body = { text, source: src, target: dst, from_lang: src, to_lang: dst };

  const r = await fetch(`${base}/api/translate`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });

  const raw = await r.text().catch(()=> "");
  if(!r.ok) throw new Error(raw || `HTTP ${r.status}`);

  let data = {};
  try{ data = JSON.parse(raw || "{}"); }catch{ data = {}; }

  return String(data.text || data.translated || data.translation || data.translatedText || "").trim() || text;
}

/* ========= Engine: live translate while speaking ========= */
let srcDD, dstDD;
let rec = null;
let running = false;

// speech buffers
let interimText = "";
let finalText = "";

// translate throttling
let tickTimer = null;
let inFlight = false;
let lastSent = "";
let lastShown = "";
let sentenceBreakTimer = null;

function clearTimers(){
  if(tickTimer){ clearInterval(tickTimer); tickTimer=null; }
  if(sentenceBreakTimer){ clearTimeout(sentenceBreakTimer); sentenceBreakTimer=null; }
}

function enforceDifferent(){
  if(srcDD.get() === dstDD.get()){
    dstDD.set(srcDD.get()==="tr" ? "en" : "tr");
  }
}

async function translateTick(){
  if(!running) return;
  if(inFlight) return;

  const src = srcDD.get();
  const dst = dstDD.get();

  const combined = (finalText + " " + interimText).trim();
  const n = norm(combined);

  // boş / aynı / çok kısa
  if(!n || n.length < 3) return;
  if(n === lastSent) return;

  // her tick’te Google’a spam olmasın: küçük değişimde bekle
  const bigChange = Math.abs(n.length - lastSent.length) >= 8 || (lastSent && !n.startsWith(lastSent.slice(0, Math.min(12,lastSent.length))));
  if(!bigChange && n.length - lastSent.length < 4) return;

  inFlight = true;
  lastSent = n;
  setStatus("Dinliyor");

  try{
    const out = await translateViaApi(combined, src, dst);
    // ekranda şişirme yok: sadece değişince satır ekle
    const outN = norm(out);
    if(outN && outN !== lastShown){
      // Eğer konuşma devam ediyorsa tek satır güncelle (append yerine replace)
      // Basit yaklaşım: son bubble'ı güncelle
      const wrap = $("stream");
      const last = wrap.lastElementChild;
      if(last && last.dataset.live === "1"){
        last.innerHTML = escapeHtml(out);
      }else{
        const b = document.createElement("div");
        b.className = "bubble";
        b.dataset.live = "1";
        b.innerHTML = escapeHtml(out);
        wrap.appendChild(b);
      }
      wrap.scrollTop = wrap.scrollHeight;
      lastShown = outN;
    }
  }catch(e){
    const m = String(e?.message || e || "").slice(0, 240);
    toast(`Çeviri hatası: ${m || "bilinmiyor"}`);
    console.warn("TRANSLATE_ERR:", e);
  }finally{
    inFlight = false;
  }
}

function finalizeCurrentLine(){
  const wrap = $("stream");
  const last = wrap.lastElementChild;
  if(last && last.dataset.live === "1"){
    last.dataset.live = "0";
  }
}

function stop(){
  running = false;
  setPlayUI(false);
  setStatus("Hazır");

  clearTimers();
  interimText = "";
  finalText = "";
  lastSent = "";
  inFlight = false;

  try{ rec?.stop?.(); }catch{}
  rec = null;

  finalizeCurrentLine();
}

function start(){
  if(!srSupported()){
    toast("Bu cihaz konuşmayı yazıya çevirmiyor.");
    return;
  }

  enforceDifferent();
  const src = srcDD.get();
  const srLocale = by(src).sr || "en-US";

  rec = buildRecognizer(srLocale);
  if(!rec){
    toast("Mikrofon başlatılamadı.");
    return;
  }

  running = true;
  setPlayUI(true);
  setStatus("Dinliyor");

  interimText = "";
  finalText = "";
  lastSent = "";
  lastShown = "";
  inFlight = false;

  // tick: 650ms (canlı)
  clearTimers();
  tickTimer = setInterval(translateTick, 650);

  rec.onresult = (e)=>{
    let finals = "";
    let interim = "";

    for(let i=e.resultIndex; i<e.results.length; i++){
      const t = e.results[i]?.[0]?.transcript || "";
      if(e.results[i].isFinal) finals += t + " ";
      else interim += t + " ";
    }

    if(finals.trim()){
      finalText = (finalText ? finalText + " " : "") + finals.trim();
      interimText = "";
      // “cümle bitti” varsayımı: 1.2s sessizlikte satırı sabitle
      if(sentenceBreakTimer) clearTimeout(sentenceBreakTimer);
      sentenceBreakTimer = setTimeout(()=>{
        finalizeCurrentLine();
        // yeni cümle gelecekse canlı satır yeniden başlar
        lastShown = ""; // yeni satır için
      }, 1200);
      return;
    }

    // interim akış
    if(interim.trim()){
      interimText = interim.trim();
    }
  };

  rec.onerror = ()=>{
    toast("Mikrofon izin/HTTPS/cihaz sorunu olabilir.");
    stop();
  };

  rec.onend = ()=>{
    // running ise yeniden başlatmayı dene (bazı cihazlar kendini durduruyor)
    if(running){
      try{ rec?.start?.(); }catch{ stop(); }
    }
  };

  try{ rec.start(); }
  catch{
    toast("Mikrofon başlatılamadı.");
    stop();
  }
}

/* ========= init ========= */
document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn").addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    if(history.length>1) history.back();
    else location.href = "/pages/home.html";
  });

  $("brandHome").addEventListener("pointerdown", (e)=>{
    e.preventDefault();
    location.href = "/pages/home.html";
  });

  srcDD = buildDropdown("ddSrc","ddSrcBtn","ddSrcTxt","ddSrcMenu","en");
  dstDD = buildDropdown("ddDst","ddDstBtn","ddDstTxt","ddDstMenu","tr");

  srcDD.root.addEventListener("italky:change", ()=>{
    enforceDifferent();
    if(running){
      stop();
      start();
    }
  });

  dstDD.root.addEventListener("italky:change", ()=>{
    enforceDifferent();
  });

  // Speaker: sadece “opsiyonel” TTS için; default OFF
  let ttsOn = false;
  const setTts = (on)=>{
    ttsOn = !!on;
    $("spkBtn")?.classList.toggle("on", ttsOn);
    toast(ttsOn ? "Ses açık" : "Sessiz");
  };
  setTts(false);
  $("spkBtn").addEventListener("pointerdown", (e)=>{
    e.preventDefault(); e.stopPropagation();
    setTts(!ttsOn);
  });

  // Play/Pause
  setPlayUI(false);
  setStatus("Hazır");

  $("playBtn").addEventListener("pointerdown", (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(running) stop();
    else start();
  });
});
