// italky-web/js/translate_page.js
// Tasarım bozulmadan motor: STT (browser) + Translate (italky-api) + TTS (italky-api, fallback speechSynthesis)
// ✅ Dropdown: arama + scroll gizli + Türkçe dil isimleri + sık kullanılanlar üstte
// ✅ TR/EN label yok
// ✅ Hoparlör butonu: mute toggle
// ✅ Mic: sırayla konuşma, bittiğinde otomatik çeviri + karşı tarafa yaz
// ✅ API: POST {text,target,source?} -> {translated|text|translation...}

import { API_BASE } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = String(msg||"");
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 2000);
}

function setWaveListening(on){
  $("frameRoot")?.classList.toggle("listening", !!on);
}

/* =========================
   Languages (Türkçe isimler + sık kullanılanlar)
   ========================= */
const LANGS = [
  { code:"tr", name:"Türkçe",   speech:"tr-TR", tts:"tr-TR" },
  { code:"en", name:"İngilizce",speech:"en-US", tts:"en-US" },
  { code:"de", name:"Almanca",  speech:"de-DE", tts:"de-DE" },
  { code:"fr", name:"Fransızca",speech:"fr-FR", tts:"fr-FR" },
  { code:"it", name:"İtalyanca",speech:"it-IT", tts:"it-IT" },
  { code:"es", name:"İspanyolca",speech:"es-ES", tts:"es-ES" },
  { code:"pt", name:"Portekizce",speech:"pt-PT", tts:"pt-PT" },
  { code:"nl", name:"Felemenkçe",speech:"nl-NL", tts:"nl-NL" },
  { code:"pl", name:"Lehçe", speech:"pl-PL", tts:"pl-PL" },
  { code:"ro", name:"Romence", speech:"ro-RO", tts:"ro-RO" },
  { code:"ru", name:"Rusça", speech:"ru-RU", tts:"ru-RU" },
  { code:"uk", name:"Ukraynaca", speech:"uk-UA", tts:"uk-UA" },
  { code:"ar", name:"Arapça", speech:"ar-SA", tts:"ar-SA" },
  { code:"fa", name:"Farsça", speech:"fa-IR", tts:"fa-IR" },
  { code:"el", name:"Yunanca", speech:"el-GR", tts:"el-GR" },
  { code:"bg", name:"Bulgarca", speech:"bg-BG", tts:"bg-BG" },
  { code:"sr", name:"Sırpça", speech:"sr-RS", tts:"sr-RS" },
  { code:"hr", name:"Hırvatça", speech:"hr-HR", tts:"hr-HR" },
  { code:"hu", name:"Macarca", speech:"hu-HU", tts:"hu-HU" },
  { code:"sv", name:"İsveççe", speech:"sv-SE", tts:"sv-SE" },
  { code:"no", name:"Norveççe", speech:"nb-NO", tts:"nb-NO" },
  { code:"da", name:"Danca", speech:"da-DK", tts:"da-DK" },
];

const TOP_CODES = ["tr","en","de","fr","it","es","ar","ru"];

function langName(code){
  return (LANGS.find(x=>x.code===code)?.name) || code;
}
function speechLocale(code){
  return LANGS.find(x=>x.code===code)?.speech || "en-US";
}
function ttsLocale(code){
  return LANGS.find(x=>x.code===code)?.tts || "en-US";
}

/* =========================
   API helpers
   ========================= */
function baseUrl(){
  const b = String(API_BASE || "").trim().replace(/\/+$/,"");
  return b;
}

async function translateViaApi(text, source, target){
  const b = baseUrl();
  if(!b) return text;

  const payload = { text, target };
  if(source) payload.source = source;

  try{
    const r = await fetch(`${b}/api/translate`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error("translate");
    const data = await r.json().catch(()=> ({}));
    const out =
      String(data?.translated || data?.text || data?.translation || data?.translatedText || "").trim();
    return out || text;
  }catch{
    return text;
  }
}

async function ttsViaApi(text, lang){
  const b = baseUrl();
  if(!b) return null;

  try{
    const r = await fetch(`${b}/api/tts`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ text, lang })
    });
    if(!r.ok) throw new Error("tts");
    const data = await r.json().catch(()=> ({}));
    const b64 = String(data?.audio_base64 || "").trim();
    if(!b64) return null;
    return `data:audio/mp3;base64,${b64}`;
  }catch{
    return null;
  }
}

/* =========================
   SpeechRecognition
   ========================= */
function buildRecognizer(langCode){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const rec = new SR();
  rec.lang = speechLocale(langCode);
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}

/* =========================
   Auto-follow per side
   ========================= */
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

function addBubble(sideName, kind, text){
  const wrap = $(sideName === "top" ? "topBody" : "botBody");
  const b = document.createElement("div");
  b.className = `bubble ${kind}`;
  b.textContent = String(text || "—");
  wrap.appendChild(b);
  scrollIfNeeded(sideName, wrap);
}

/* =========================
   Dropdown with search + scroll hidden
   ========================= */
function buildDropdown(ddId, btnId, txtId, menuId, defCode, onChange){
  const dd = $(ddId);
  const btn = $(btnId);
  const txt = $(txtId);
  const menu = $(menuId);

  let current = defCode;

  function closeAll(){
    document.querySelectorAll(".dd.open").forEach(x=> x.classList.remove("open"));
  }

  function setValue(code){
    current = code;
    txt.textContent = langName(code);
    onChange?.(code);
  }

  // build menu
  menu.innerHTML = `
    <div class="dd-search-wrap">
      <input class="dd-search" id="${menuId}_q" placeholder="Dil ara…">
    </div>
    <div class="dd-sep">Sık kullanılanlar</div>
    ${TOP_CODES.map(c=>`<div class="dd-item" data-code="${c}">${langName(c)}</div>`).join("")}
    <div class="dd-sep">Tüm diller</div>
    ${LANGS
      .filter(l=>!TOP_CODES.includes(l.code))
      .map(l=>`<div class="dd-item" data-code="${l.code}">${l.name}</div>`).join("")}
  `;

  // click items
  menu.querySelectorAll(".dd-item").forEach(it=>{
    it.addEventListener("click", ()=>{
      const code = it.getAttribute("data-code");
      closeAll();
      setValue(code);
    });
  });

  // search filter
  const q = menu.querySelector(`#${menuId}_q`);
  function filterList(){
    const s = String(q.value || "").toLowerCase().trim();
    menu.querySelectorAll(".dd-item").forEach(it=>{
      const label = (it.textContent || "").toLowerCase();
      it.classList.toggle("hidden", s && !label.includes(s));
    });
  }
  q.addEventListener("input", filterList);

  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const open = dd.classList.contains("open");
    closeAll();
    dd.classList.toggle("open", !open);
    if(!open){
      setTimeout(()=>{ try{ q.focus(); }catch{} }, 50);
    }
  });

  document.addEventListener("click", ()=> closeAll());

  setValue(defCode);
  return { get: ()=> current, set: (c)=> setValue(c) };
}

/* =========================
   Speaker (mute) + play audio
   ========================= */
const mute = { top:false, bot:false }; // false => speak ON
function setMute(side, on){
  mute[side] = !!on;
  const btn = $(side === "top" ? "topSpeak" : "botSpeak");
  btn.classList.toggle("muted", mute[side]);
}

let __audio = null;
function playAudio(url){
  try{
    if(!url) return false;
    if(!__audio) __audio = new Audio();
    __audio.pause();
    __audio.src = url;
    __audio.currentTime = 0;
    __audio.play().catch(()=>{});
    return true;
  }catch{
    return false;
  }
}

function speakFallback(text, langCode){
  if(!("speechSynthesis" in window)) return;
  try{
    const u = new SpeechSynthesisUtterance(String(text||""));
    u.lang = ttsLocale(langCode);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{}
}

async function speakAuto(text, langCode, side){
  if(mute[side]) return;
  const t = String(text||"").trim();
  if(!t) return;

  // try API TTS first
  const url = await ttsViaApi(t, ttsLocale(langCode));
  if(url && playAudio(url)) return;

  // fallback to browser
  speakFallback(t, langCode);
}

/* =========================
   Conversation flow
   ========================= */
let active = null;
let topRec = null;
let botRec = null;

function setMicUI(side, on){
  const mic = $(side === "top" ? "topMic" : "botMic");
  mic.classList.toggle("listening", !!on);
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

  addBubble(side, "them", finalText);

  const translated = await translateViaApi(finalText, srcCode, dstCode);
  addBubble(otherSide, "me", translated);

  await speakAuto(translated, dstCode, otherSide);
}

function startSide(side, getLang, getOtherLang){
  if(active && active !== side){
    stopAll();
  }

  const srcCode = getLang();
  const dstCode = getOtherLang();

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
    toast("Mikrofon izin/HTTPS/cihaz sorunu olabilir.");
    stopAll();
  };

  rec.onend = async ()=>{
    const txt = (finalText || live || "").trim();
    setMicUI(side, false);
    setWaveListening(false);

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

/* =========================
   Boot
   ========================= */
document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn").addEventListener("click", ()=>{
    if(history.length>1) history.back();
    else location.href = "/index.html";
  });

  hookScrollFollow("top", $("topBody"));
  hookScrollFollow("bot", $("botBody"));

  // default languages: top=en, bottom=tr (senin alışkanlık)
  const topDD = buildDropdown("ddTop","ddTopBtn","ddTopTxt","ddTopMenu","en", ()=>{});
  const botDD = buildDropdown("ddBot","ddBotBtn","ddBotTxt","ddBotMenu","tr", ()=>{});

  // speaker buttons toggle mute only
  $("topSpeak").addEventListener("click", ()=>{
    setMute("top", !mute.top);
    toast(mute.top ? "Ses kapalı" : "Ses açık");
  });
  $("botSpeak").addEventListener("click", ()=>{
    setMute("bot", !mute.bot);
    toast(mute.bot ? "Ses kapalı" : "Ses açık");
  });

  // default sound ON
  setMute("top", false);
  setMute("bot", false);

  // mic
  $("topMic").addEventListener("click", ()=> startSide("top", ()=>topDD.get(), ()=>botDD.get()));
  $("botMic").addEventListener("click", ()=> startSide("bot", ()=>botDD.get(), ()=>topDD.get()));

  // clear
  $("topBody").innerHTML = "";
  $("botBody").innerHTML = "";
  setWaveListening(false);
});
