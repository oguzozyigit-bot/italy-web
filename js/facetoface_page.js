// FILE: italky-web/js/facetoface_page.js
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

function setWaveListening(on){
  $("frameRoot")?.classList.toggle("listening", !!on);
}

const LANGS = [
  { code:"tr", name:"Türkçe",  speech:"tr-TR", tts:"tr-TR" },
  { code:"en", name:"English", speech:"en-US", tts:"en-US" },
  { code:"de", name:"Deutsch", speech:"de-DE", tts:"de-DE" },
  { code:"fr", name:"Français",speech:"fr-FR", tts:"fr-FR" },
  { code:"es", name:"Español", speech:"es-ES", tts:"es-ES" },
  { code:"it", name:"Italiano", speech:"it-IT", tts:"it-IT" },
  { code:"ar", name:"العربية", speech:"ar-SA", tts:"ar-SA" },
  { code:"ru", name:"Русский", speech:"ru-RU", tts:"ru-RU" },
];

function speechLocale(code){ return LANGS.find(x=>x.code===code)?.speech || "en-US"; }
function ttsLocale(code){ return LANGS.find(x=>x.code===code)?.tts || "en-US"; }

async function translateViaApi(text, source, target){
  const base = (BASE_DOMAIN || "").replace(/\/+$/,"");
  if(!base) return text;

  try{
    const payload = { text, source, target, from_lang: source, to_lang: target }; // iki formatı da destekle
    const r = await fetch(`${base}/api/translate`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error("api");
    const data = await r.json();

    const out = String(
      data?.translated || data?.text || data?.translation || data?.translatedText || ""
    ).trim();

    return out || text;
  }catch{
    return text;
  }
}

/* ========= ✅ SES DÜZELTME (HOPARLÖR) =========
   - topSpeak/botSpeak artık o paneldeki SON üretilen metni okur
   - (Autoplay yok; kullanıcı dokunuşu ile güvenli)
*/
let lastSpeakTop = "";
let lastSpeakBot = "";
function rememberLast(side, txt){
  const t = String(txt||"").trim();
  if(!t) return;
  if(side === "top") lastSpeakTop = t;
  else lastSpeakBot = t;
}

function speakText(text, langCode){
  const t = String(text||"").trim();
  if(!t) { toast("Okunacak metin yok."); return; }
  if(!("speechSynthesis" in window)) { toast("TTS desteklenmiyor."); return; }

  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = ttsLocale(langCode);
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
  }catch(e){
    console.warn("TTS error", e);
    toast("Ses çalınamadı.");
  }
}

/* ========= Speech Recognition ========= */
function buildRecognizer(langCode){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const rec = new SR();
  rec.lang = speechLocale(langCode);
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}

/* Auto-follow */
const follow = { top:true, bot:true };
function isNearBottom(el, slack=140){
  try{ return (el.scrollHeight - el.scrollTop - el.clientHeight) < slack; }
  catch{ return true; }
}
function hookScrollFollow(sideName, el){
  el.addEventListener("scroll", ()=>{ follow[sideName] = isNearBottom(el); }, { passive:true });
}
function scrollIfNeeded(sideName, el){
  if(follow[sideName]) el.scrollTop = el.scrollHeight;
}

/* Bubbles */
function addBubble(sideName, kind, text){
  const wrap = $(sideName === "top" ? "topBody" : "botBody");
  const b = document.createElement("div");
  b.className = `bubble ${kind === "me" ? "me" : "them"}`;
  b.textContent = text || "—";
  wrap.appendChild(b);
  scrollIfNeeded(sideName, wrap);

  // son metni hatırla (✅ hoparlör için)
  if(kind === "me") rememberLast(sideName, b.textContent);
  if(kind === "them") rememberLast(sideName, b.textContent);
}

/* ========= Language sheet ========= */
let activeSheetSide = "bot"; // hangi buton açtıysa
let topLang = "en";
let botLang = "tr";

function renderSheet(selectedCode){
  const list = $("sheetList");
  const q = ($("sheetQuery")?.value || "").trim().toLowerCase();

  list.innerHTML = "";
  LANGS.forEach(l=>{
    const key = (l.name + " " + l.code).toLowerCase();
    if(q && !key.includes(q)) return;

    const row = document.createElement("div");
    row.className = "sheetRow" + (l.code === selectedCode ? " selected" : "");
    row.innerHTML = `<span class="name">${l.name}</span><span class="code">${l.code}</span>`;
    row.addEventListener("click", ()=>{
      if(activeSheetSide === "top"){
        topLang = l.code;
        $("topLangTxt").textContent = l.name;
      }else{
        botLang = l.code;
        $("botLangTxt").textContent = l.name;
      }
      closeSheet();
    });
    list.appendChild(row);
  });
}

function openSheet(side){
  activeSheetSide = side;
  $("sheetTitle").textContent = (side==="top") ? "Üst Dil" : "Alt Dil";
  $("sheetQuery").value = "";
  renderSheet(side==="top" ? topLang : botLang);
  $("langSheet").classList.add("show");
}
function closeSheet(){
  $("langSheet").classList.remove("show");
}

/* ========= Mic flow ========= */
let active = null;
let topRec = null;
let botRec = null;

function setMicUI(side, on){
  const mic = $(side === "top" ? "topMic" : "botMic");
  mic?.classList.toggle("listening", !!on);
  setWaveListening(!!on);
}

function stopAll(){
  try{ topRec?.stop?.(); }catch{}
  try{ botRec?.stop?.(); }catch{}
  topRec = null;
  botRec = null;
  active = null;
  setMicUI("top", false);
  setMicUI("bot", false);
  setWaveListening(false);
}

async function onFinal(side, srcCode, dstCode, finalText){
  const otherSide = (side === "top") ? "bot" : "top";

  // konuşan
  addBubble(side, "them", finalText);

  // çeviri
  const out = await translateViaApi(finalText, srcCode, dstCode);
  addBubble(otherSide, "me", out);

  // Not: otomatik ses yok (önceden böyleyse) — hoparlör butonuyla okutuluyor
}

function startSide(side){
  if(active && active !== side) stopAll();

  const srcCode = (side==="top") ? topLang : botLang;
  const dstCode = (side==="top") ? botLang : topLang;

  const rec = buildRecognizer(srcCode);
  if(!rec){
    toast("Bu cihaz konuşmayı yazıya çevirmiyor.");
    return;
  }

  active = side;
  setMicUI(side, true);

  let live = "";
  let finalText = "";

  rec.onresult = (e)=>{
    let chunk = "";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t = e.results[i]?.[0]?.transcript || "";
      if(e.results[i].isFinal) finalText += t + " ";
      else chunk += t + " ";
    }
    live = (finalText + chunk).trim();
  };

  rec.onerror = ()=>{
    toast("Mikrofon izin/HTTPS/cihaz sıkıntısı olabilir.");
    stopAll();
  };

  rec.onend = async ()=>{
    const txt = (finalText || live || "").trim();
    setMicUI(side, false);

    if(!txt){
      active = null;
      return;
    }

    await onFinal(side, srcCode, dstCode, txt);
    active = null;
  };

  if(side === "top") topRec = rec;
  else botRec = rec;

  try{ rec.start(); }
  catch{
    toast("Mikrofon açılamadı.");
    stopAll();
  }
}

/* ========= Boot ========= */
document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn").addEventListener("click", ()=>{
    if(history.length>1) history.back();
    else location.href = "/pages/home.html";
  });

  hookScrollFollow("top", $("topBody"));
  hookScrollFollow("bot", $("botBody"));

  // init labels
  $("topLangTxt").textContent = LANGS.find(x=>x.code===topLang)?.name || "English";
  $("botLangTxt").textContent = LANGS.find(x=>x.code===botLang)?.name || "Türkçe";

  // sheet open
  $("topLangBtn").addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSheet("top"); });
  $("botLangBtn").addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSheet("bot"); });

  $("sheetClose").addEventListener("click", closeSheet);
  $("langSheet").addEventListener("click", (e)=>{ if(e.target === $("langSheet")) closeSheet(); });
  $("sheetQuery").addEventListener("input", ()=> renderSheet(activeSheetSide==="top" ? topLang : botLang));

  // mic
  $("topMic").addEventListener("click", ()=> startSide("top"));
  $("botMic").addEventListener("click", ()=> startSide("bot"));

  // ✅ hoparlör: son metni oku
  $("topSpeak").addEventListener("click", ()=>{
    speakText(lastSpeakTop, topLang);
  });
  $("botSpeak").addEventListener("click", ()=>{
    speakText(lastSpeakBot, botLang);
  });

  // İlk metin boşsa uyarı olmasın diye küçük demo
  // (İstersen kaldırırsın)
  // addBubble("bot", "me", "Hazırım. Konuş, ben çevireyim.");

  setWaveListening(false);
});
