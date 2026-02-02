// FILE: italky-web/js/fast_page.js
// Italky - Anında Çeviri (Toplantı Modu)
// ✅ STT (SpeechRecognition) -> interim transcript
// ✅ Throttled translate -> /api/translate
// ✅ Auto append lines + auto-scroll
// ✅ Speaker toggle (TTS on/off) for translated text
// ✅ Two language selects: source -> target
// ✅ Microphone button start/stop
// ⚠️ Requires HTTPS + mic permission

import { BASE_DOMAIN } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1800);
}

const LANGS = [
  // en sık kullanılanlar üstte (Türkçe en başta)
  { code:"tr", name:"Türkçe",   sr:"tr-TR", tts:"tr-TR" },
  { code:"en", name:"English",  sr:"en-US", tts:"en-US" },
  { code:"de", name:"Deutsch",  sr:"de-DE", tts:"de-DE" },
  { code:"fr", name:"Français", sr:"fr-FR", tts:"fr-FR" },
  { code:"it", name:"Italiano", sr:"it-IT", tts:"it-IT" },
  { code:"es", name:"Español",  sr:"es-ES", tts:"es-ES" },
  { code:"pt", name:"Português",sr:"pt-PT", tts:"pt-PT" },
  { code:"ru", name:"Русский",  sr:"ru-RU", tts:"ru-RU" },
  { code:"ar", name:"العربية",  sr:"ar-SA", tts:"ar-SA" },
  { code:"nl", name:"Nederlands",sr:"nl-NL", tts:"nl-NL" },
  { code:"sv", name:"Svenska",  sr:"sv-SE", tts:"sv-SE" },
  { code:"no", name:"Norsk",    sr:"nb-NO", tts:"nb-NO" },
  { code:"da", name:"Dansk",    sr:"da-DK", tts:"da-DK" },
  { code:"pl", name:"Polski",   sr:"pl-PL", tts:"pl-PL" },
  { code:"el", name:"Ελληνικά", sr:"el-GR", tts:"el-GR" },
];

function langBy(code){
  return LANGS.find(x=>x.code===code) || LANGS[0];
}

function fillSelect(sel, def){
  sel.innerHTML = LANGS.map(l=>`<option value="${l.code}">${l.name}</option>`).join("");
  sel.value = def;
}

function baseUrl(){
  return String(BASE_DOMAIN||"").replace(/\/+$/,"");
}

async function translateViaApi(text, source, target){
  const base = baseUrl();
  if(!base) return text;

  // backend'in translate endpoint'i: {text, source, target}
  const payload = { text, target };
  if(source) payload.source = source;

  const r = await fetch(`${base}/api/translate`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  if(!r.ok){
    const tx = await r.text().catch(()=> "");
    throw new Error(tx || `HTTP ${r.status}`);
  }

  const data = await r.json().catch(()=> ({}));
  const out = String(data.text || data.translated || data.translation || data.translatedText || "").trim();
  return out || text;
}

function addLine(kind, text){
  const wrap = $("lines");
  const b = document.createElement("div");
  b.className = `bubble ${kind}`;
  b.innerHTML = kind === "src"
    ? `<div class="small">Duyulan</div>${escapeHtml(text)}`
    : `<div class="small">Çeviri</div>${escapeHtml(text)}`;

  wrap.appendChild(b);
  wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(s=""){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

// Speaker (TTS)
let muted = false;
function setMuted(on){
  muted = !!on;
  $("spkBtn").classList.toggle("muted", muted);
}
function speak(text, langCode){
  if(muted) return;
  if(!("speechSynthesis" in window)) return;

  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text||""));
    u.lang = langBy(langCode).tts || "en-US";
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }catch{}
}

// SpeechRecognition (continuous)
let rec = null;
let running = false;

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

// throttling
let lastInterim = "";
let lastTranslatedSource = "";
let lastTranslateAt = 0;
let translateInFlight = false;

function shouldTranslateNow(text){
  const t = String(text||"").trim();
  if(t.length < 3) return false;
  if(t === lastTranslatedSource) return false;
  const now = Date.now();
  if(now - lastTranslateAt < 650) return false; // throttle
  return true;
}

async function doTranslateChunk(sourceText){
  if(translateInFlight) return;
  translateInFlight = true;

  const src = $("srcLang").value;
  const dst = $("dstLang").value;

  try{
    $("panelStatus").textContent = "Çeviriyorum…";
    const out = await translateViaApi(sourceText, src, dst);

    addLine("src", sourceText);
    addLine("trg", out);
    speak(out, dst);

    lastTranslatedSource = sourceText;
    lastTranslateAt = Date.now();
    $("panelStatus").textContent = "Dinliyor";
  }catch(e){
    $("panelStatus").textContent = "Hata";
    toast("Çeviri hatası (API/Key/CORS).");
  }finally{
    translateInFlight = false;
  }
}

function stop(){
  running = false;
  $("micBtn").classList.remove("listening");
  $("panelStatus").textContent = "Durdu";

  try{ rec && rec.stop && rec.stop(); }catch{}
  rec = null;
}

function start(){
  if(!srSupported()){
    toast("Bu cihaz konuşmayı yazıya çevirmiyor.");
    return;
  }

  const src = $("srcLang").value;
  const srLocale = langBy(src).sr || "en-US";
  rec = buildRecognizer(srLocale);

  if(!rec){
    toast("Mikrofon başlatılamadı.");
    return;
  }

  running = true;
  $("micBtn").classList.add("listening");
  $("panelStatus").textContent = "Dinliyor";

  // reset for new run
  lastInterim = "";
  lastTranslatedSource = "";
  lastTranslateAt = 0;
  translateInFlight = false;

  rec.onresult = async (e)=>{
    // build interim + finals
    let interim = "";
    let finals = "";

    for(let i=e.resultIndex; i<e.results.length; i++){
      const t = e.results[i]?.[0]?.transcript || "";
      if(e.results[i].isFinal) finals += t + " ";
      else interim += t + " ";
    }

    const live = String((finals + interim) || "").trim();
    if(!live) return;

    // if final sentence ended -> translate that final chunk
    if(finals.trim()){
      const chunk = finals.trim();
      await doTranslateChunk(chunk);
      return;
    }

    // else throttle interim translation (optional)
    if(live !== lastInterim){
      lastInterim = live;
      if(shouldTranslateNow(live)){
        // “konuşma akarken ekrana düşsün” için interim de çeviriyoruz,
        // ama spam olmasın diye throttle var.
        await doTranslateChunk(live);
      }
    }
  };

  rec.onerror = ()=>{
    toast("Mikrofon izin/HTTPS/cihaz sorunu olabilir.");
    stop();
  };

  rec.onend = ()=>{
    if(running){
      // bazı cihazlarda continuous kendiliğinden biter; tekrar başlat
      try{
        rec && rec.start && rec.start();
      }catch{
        stop();
      }
    }
  };

  try{ rec.start(); }
  catch{
    toast("Mikrofon başlatılamadı.");
    stop();
  }
}

function swapIfSame(){
  const a = $("srcLang").value;
  const b = $("dstLang").value;
  if(a === b){
    // hedef dili otomatik değiştir (en pratik)
    $("dstLang").value = (a === "tr") ? "en" : "tr";
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  // back
  $("backBtn").addEventListener("click", ()=>{
    if(history.length > 1) history.back();
    else location.href = "/pages/home.html";
  });

  // fill selects
  fillSelect($("srcLang"), "en");
  fillSelect($("dstLang"), "tr");
  swapIfSame();

  $("srcLang").addEventListener("change", ()=>{
    // running iken dil değişirse stop/start
    swapIfSame();
    if(running){
      stop();
      start();
    }
  });
  $("dstLang").addEventListener("change", ()=>{
    swapIfSame();
  });

  // speaker
  setMuted(false);
  $("spkBtn").addEventListener("click", ()=>{
    setMuted(!muted);
    toast(muted ? "Ses kapalı" : "Ses açık");
  });

  // mic toggle
  $("micBtn").addEventListener("click", ()=>{
    if(running) stop();
    else start();
  });

  // initial status
  $("panelStatus").textContent = "Hazır";
});
