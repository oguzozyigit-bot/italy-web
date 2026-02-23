// FILE: /js/facetoface_page.js
import { getSiteLang } from "/js/i18n.js";
import { supabase } from "/js/supabase_client.js";
import { setHeaderTokens } from "/js/ui_shell.js";

const $ = (id)=>document.getElementById(id);

const API_BASE = "https://italky-api.onrender.com";
const LOGIN_PATH = "/index.html";
const HOME_PATH  = "/pages/home.html";
const PROFILE_PATH = "/pages/profile.html";

/* ===============================
   SETTINGS
================================ */
const HOLD_MAX_MS = 45000;       // ✅ 45 saniye
const RELEASE_DELAY_MS = 350;
const MIN_HOLD_MS = 160;
const TYPE_SPEED_MS = 14;
const AUDIO_DEBOUNCE_MS = 250;

const SR_RESTART_GAP_MS = 120;   // SR kendi kapanırsa
const SR_NO_TEXT_MS = 2000;      // 2 sn hiç metin yoksa uyar+bitir

/* ===============================
   UI LANG
================================ */
function getSystemUILang(){
  try{
    const l = String(getSiteLang?.() || "").toLowerCase().trim();
    if(l) return l;
  }catch{}
  try{
    const l2 = String(localStorage.getItem("italky_site_lang_v1") || "").toLowerCase().trim();
    if(l2) return l2;
  }catch{}
  return "tr";
}
let UI_LANG = getSystemUILang();

/* ===============================
   LANGS (dynamic load)
================================ */
const BCP = {
  "tr":"tr-TR","en":"en-US","de":"de-DE","fr":"fr-FR","it":"it-IT","es":"es-ES",
  "pt":"pt-PT","pt-br":"pt-BR","nl":"nl-NL","sv":"sv-SE","no":"nb-NO","da":"da-DK",
  "fi":"fi-FI","pl":"pl-PL","cs":"cs-CZ","sk":"sk-SK","hu":"hu-HU","ro":"ro-RO",
  "bg":"bg-BG","el":"el-GR","uk":"uk-UA","ru":"ru-RU","ar":"ar-SA","he":"he-IL",
  "fa":"fa-IR","ur":"ur-PK","hi":"hi-IN","bn":"bn-BD","id":"id-ID","ms":"ms-MY",
  "vi":"vi-VN","th":"th-TH","zh":"zh-CN","ja":"ja-JP","ko":"ko-KR","ka":"ka-GE",
  "az":"az-AZ","hy":"hy-AM","kk":"kk-KZ","ky":"ky-KG","uz":"uz-UZ","tk":"tk-TM","tg":"tg-TJ",
  "sr":"sr-RS","hr":"hr-HR","bs":"bs-BA","sl":"sl-SI","mk":"mk-MK","sq":"sq-AL",
  "et":"et-EE","lv":"lv-LV","lt":"lt-LT","af":"af-ZA","sw":"sw-KE","am":"am-ET",
  "ca":"ca-ES","eu":"eu-ES","gl":"gl-ES","is":"is-IS","ga":"ga-IE","cy":"cy-GB",
  "fil":"fil-PH","mn":"mn-MN","ne":"ne-NP","si":"si-LK","ta":"ta-IN","te":"te-IN","mr":"mr-IN","gu":"gu-IN"
};

let LANGS = [
  { code:"tr", flag:"🇹🇷", bcp:"tr-TR" },
  { code:"en", flag:"🇬🇧", bcp:"en-US" },
];

async function loadLangPool(){
  try{
    const mod = await import("/js/lang_pool_full.js");
    const pool = mod?.LANG_POOL;
    if(!Array.isArray(pool) || pool.length < 5) return;

    LANGS = pool.map(l=>{
      const code = String(l.code||"").toLowerCase().trim();
      if(!code) return null;
      return { code, flag: l.flag || "🌐", bcp: BCP[code] || "en-US" };
    }).filter(Boolean);

    if(!LANGS.find(x=>x.code==="tr")) LANGS.unshift({code:"tr",flag:"🇹🇷",bcp:"tr-TR"});
    if(!LANGS.find(x=>x.code==="en")) LANGS.unshift({code:"en",flag:"🇬🇧",bcp:"en-US"});
  }catch(e){
    console.warn("LANG_POOL load failed:", e);
  }
}

function canonicalLangCode(code){
  const c = String(code||"").toLowerCase();
  return c.split("-")[0];
}
function normalizeApiLang(code){ return canonicalLangCode(code); }

function langObj(code){
  const c = String(code||"").toLowerCase();
  return LANGS.find(x=>x.code===c) || LANGS.find(x=>x.code===canonicalLangCode(c));
}
function bcp(code){ return langObj(code)?.bcp || "en-US"; }

function langLabel(code){
  const base = canonicalLangCode(code);
  try{
    const dn = new Intl.DisplayNames([UI_LANG], { type:"language" });
    const name = dn.of(base);
    if(name) return name;
  }catch{}
  return String(code||"").toUpperCase();
}
function labelChip(code){
  const o = langObj(code);
  const flag = o?.flag || "🌐";
  return `${flag} ${langLabel(code)}`;
}

/* ===============================
   STATE
================================ */
let topLang = "en";
let botLang = "tr";
let isLoggedIn = false;
let sessionGranted = false;

/* ===============================
   VISUAL / LOCKS
================================ */
let phase = "idle";
let active = null;
let lastMicSide = "bot";

function frame(){ return document.getElementById("frameRoot"); }

function setCenterDirection(side){
  const fr = frame();
  if(!fr) return;
  fr.classList.toggle("to-top", side === "top");
  fr.classList.toggle("to-bot", side !== "top");
}
function setFrameState(state, side){
  const fr = frame();
  if(!fr) return;
  fr.classList.toggle("listening", state === "listening");
  fr.classList.toggle("speaking", state === "speaking");
  if(side) setCenterDirection(side);
}

function setPhase(p){
  phase = p;
  updateMicLocks();
}

function otherSide(which){ return which === "top" ? "bot" : "top"; }

function lockMic(which, locked){
  const el = (which === "top") ? $("topMic") : $("botMic");
  if(!el) return;
  el.style.pointerEvents = locked ? "none" : "auto";
  el.style.opacity = locked ? "0.55" : "1";
}

function updateMicLocks(){
  let lockTop = false, lockBot = false;

  if(phase === "recording"){
    if(active === "top") lockBot = true;
    if(active === "bot") lockTop = true;
  } else if(phase === "translating" || phase === "speaking"){
    lockTop = true; lockBot = true;
  }

  lockMic("top", lockTop);
  lockMic("bot", lockBot);
}

function setMicUI(which,on){
  const btn = (which==="top") ? $("topMic") : $("botMic");
  if(!btn) return;
  btn.classList.toggle("listening", !!on);
  if(on){
    btn.style.boxShadow = "0 0 48px rgba(99,102,241,0.60), 0 0 22px rgba(236,72,153,0.32)";
    btn.style.transform = "scale(1.04)";
  }else{
    btn.style.boxShadow = "";
    btn.style.transform = "";
  }
}

/* ===============================
   TOAST + TIMER
================================ */
let toastEl = null, toastTimer = null;

function toast(msg){
  const text = String(msg||"");
  try{ if(navigator.vibrate) navigator.vibrate(12); }catch{}
  if(!toastEl){
    toastEl = document.createElement("div");
    toastEl.style.position = "fixed";
    toastEl.style.left = "50%";
    toastEl.style.top = "14px";
    toastEl.style.transform = "translateX(-50%)";
    toastEl.style.zIndex = "999999";
    toastEl.style.padding = "10px 14px";
    toastEl.style.borderRadius = "999px";
    toastEl.style.border = "1px solid rgba(255,255,255,0.14)";
    toastEl.style.background = "rgba(0,0,0,0.70)";
    toastEl.style.backdropFilter = "blur(12px)";
    toastEl.style.color = "rgba(255,255,255,0.92)";
    toastEl.style.fontFamily = "Outfit, system-ui, sans-serif";
    toastEl.style.fontWeight = "900";
    toastEl.style.fontSize = "12px";
    toastEl.style.opacity = "0";
    toastEl.style.transition = "opacity .15s ease";
    toastEl.style.pointerEvents = "none";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.style.opacity = "1";
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ if(toastEl) toastEl.style.opacity="0"; }, 1200);
}

let timerTop=null, timerBot=null;
function ensureTimerBadges(){
  if(timerTop && timerBot) return;
  const make = ()=>{
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.right = "14px";
    el.style.zIndex = "999999";
    el.style.padding = "8px 10px";
    el.style.borderRadius = "999px";
    el.style.border = "1px solid rgba(255,255,255,0.14)";
    el.style.background = "rgba(0,0,0,0.55)";
    el.style.backdropFilter = "blur(10px)";
    el.style.color = "rgba(255,255,255,0.92)";
    el.style.fontFamily = "Outfit, system-ui, sans-serif";
    el.style.fontWeight = "900";
    el.style.fontSize = "12px";
    el.style.opacity = "0";
    el.style.transition = "opacity .15s ease";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    return el;
  };
  timerTop = make(); timerBot = make();
  timerTop.style.top = "18px";
  timerTop.style.transform = "rotate(180deg)";
  timerBot.style.bottom = "18px";
}
function setTimerBadges(msLeft){
  ensureTimerBadges();
  if(msLeft == null){
    timerTop.style.opacity="0";
    timerBot.style.opacity="0";
    return;
  }
  const s = Math.max(0, Math.ceil(msLeft/1000));
  const txt = `⏱ ${s}s`;
  timerTop.textContent = txt;
  timerBot.textContent = txt;
  timerTop.style.opacity="1";
  timerBot.style.opacity="1";
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

/* ===============================
   POPUP + SEARCH
================================ */
function closeAllPop(){
  $("pop-top")?.classList.remove("show");
  $("pop-bot")?.classList.remove("show");
}

function renderPop(side, filterText=""){
  const list = $(side==="top" ? "list-top" : "list-bot");
  if(!list) return;
  const sel = (side==="top") ? topLang : botLang;

  const q = String(filterText||"").trim().toLowerCase();
  const filtered = !q ? LANGS : LANGS.filter(l=>{
    const name = String(langLabel(l.code) || "").toLowerCase();
    return l.code.includes(q) || name.includes(q);
  });

  list.innerHTML = filtered.map(l=>`
    <div class="pop-item ${l.code===sel?"active":""}" data-code="${l.code}">
      <div class="pop-left">
        <div class="pop-flag">${l.flag}</div>
        <div class="pop-name">${langLabel(l.code)}</div>
      </div>
      <div class="pop-code">${String(l.code).toUpperCase()}</div>
    </div>
  `).join("");

  list.querySelectorAll(".pop-item").forEach(item=>{
    item.addEventListener("click",(e)=>{
      e.preventDefault(); e.stopPropagation();
      const code = item.getAttribute("data-code") || "en";
      if(side==="top") topLang = code; else botLang = code;
      const t = (side==="top") ? $("topLangTxt") : $("botLangTxt");
      if(t) t.textContent = labelChip(code);
      closeAllPop();
    });
  });
}

function ensureSearchBox(side){
  const pop = $(side==="top" ? "pop-top" : "pop-bot");
  const list = $(side==="top" ? "list-top" : "list-bot");
  if(!pop || !list) return;
  if(pop.querySelector(".lang-search")) return;

  const inp = document.createElement("input");
  inp.className = "lang-search";
  inp.placeholder = "Dil ara…";
  inp.autocomplete = "off";
  inp.spellcheck = false;

  inp.style.width = "calc(100% - 20px)";
  inp.style.margin = "10px";
  inp.style.padding = "10px 12px";
  inp.style.borderRadius = "14px";
  inp.style.border = "1px solid rgba(255,255,255,0.14)";
  inp.style.background = "rgba(0,0,0,0.25)";
  inp.style.color = "#fff";
  inp.style.fontWeight = "900";
  inp.style.fontFamily = "Outfit, system-ui, sans-serif";

  pop.insertBefore(inp, list);
  inp.addEventListener("input", ()=> renderPop(side, inp.value));
  renderPop(side, "");
}

function togglePopover(side){
  const pop = $(side==="top" ? "pop-top" : "pop-bot");
  if(!pop) return;
  const willShow = !pop.classList.contains("show");
  closeAllPop();
  if(willShow){
    pop.classList.add("show");
    ensureSearchBox(side);
  }
}

/* ===============================
   AUTH / TOKENS
================================ */
async function checkLoginOnce(){
  try{
    const { data:{ session } } = await supabase.auth.getSession();
    isLoggedIn = !!session?.user;
  }catch{
    isLoggedIn = false;
  }
}

function unwrapRow(data){
  if(Array.isArray(data)) return data[0] || null;
  if(data && typeof data === "object") return data;
  return null;
}

async function ensureFacetofaceSession(){
  if(sessionGranted) return true;

  await checkLoginOnce();
  if(!isLoggedIn){
    alert("Bu özellik için giriş gerekli.");
    location.href = LOGIN_PATH;
    return false;
  }

  try{
    const { data, error } = await supabase.rpc("start_facetoface_session");
    if(error){
      const msg = String(error.message||"");
      if(msg.includes("INSUFFICIENT_TOKENS")){
        alert("Jeton yetersiz.");
        location.href = PROFILE_PATH;
        return false;
      }
      alert("FaceToFace oturumu başlatılamadı.");
      return false;
    }

    const row = unwrapRow(data) || {};
    if(row?.tokens_left != null) setHeaderTokens(row.tokens_left);

    sessionGranted = true;
    return true;
  }catch{
    alert("FaceToFace oturumu başlatılamadı.");
    return false;
  }
}

/* ===============================
   AUDIO (no overlap)
================================ */
let audioObj = null;
let lastAudioAt = 0;

function stopAudio(){
  try{
    if(audioObj){
      audioObj.pause();
      audioObj.currentTime = 0;
    }
  }catch{}
  audioObj = null;
}

async function playAudioBlob(blob){
  stopAudio();
  const url = URL.createObjectURL(blob);
  audioObj = new Audio(url);
  audioObj.playsInline = true;
  audioObj.onended = ()=>{ try{ URL.revokeObjectURL(url); }catch{} };
  audioObj.onerror = ()=>{ try{ URL.revokeObjectURL(url); }catch{} };
  await audioObj.play();
}

/* ===============================
   TTS
================================ */
async function speakLocal(text, langCode){
  const t = String(text || "").trim();
  if(!t) return;

  const now = Date.now();
  if(now - lastAudioAt < AUDIO_DEBOUNCE_MS) stopAudio();
  lastAudioAt = now;

  const lang = normalizeApiLang(langCode);

  const res = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    credentials: "include",
    body: JSON.stringify({ text: t, lang, speaking_rate: 1, pitch: 0 })
  });

  if(!res.ok){ toast("🔇 TTS HTTP " + res.status); return; }

  const data = await res.json().catch(()=>null);
  if(!data || !data.ok || !data.audio_base64){ toast("🔇 TTS invalid"); return; }

  const binary = atob(data.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  await playAudioBlob(new Blob([bytes], { type:"audio/mpeg" }));
}

/* ===============================
   COMMAND PARSE (voice command language switch)
================================ */
async function parseCommand(text){
  const t = String(text||"").trim();
  if(!t) return null;

  const r = await fetch(`${API_BASE}/api/command_parse`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, ui_lang: UI_LANG })
  });
  if(!r.ok) return null;
  return await r.json().catch(()=>null);
}

/* ===============================
   TRANSLATE AI
================================ */
async function translateViaApi(text, source, target){
  const t = String(text||"").trim();
  if(!t) return t;

  const src = normalizeApiLang(source);
  const dst = normalizeApiLang(target);
  if(src===dst) return t;

  const r = await fetch(`${API_BASE}/api/translate_ai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, from_lang: src, to_lang: dst, style:"chat", provider:"auto" })
  });
  if(!r.ok) return null;
  const data = await r.json().catch(()=>({}));
  const out = String(data?.translated || "").trim();
  return out || null;
}

/* ===============================
   TYPEWRITER
================================ */
async function typeWriter(el, fullText, speed=TYPE_SPEED_MS){
  el.textContent = "";
  const text = String(fullText||"");
  for(let i=0;i<text.length;i++){
    el.textContent += text[i];
    try{
      const wrap = el.closest?.(".chat-body");
      if(wrap) wrap.scrollTop = wrap.scrollHeight;
    }catch{}
    await sleep(speed);
  }
}

/* ===============================
   UI BUBBLES
================================ */
function clearLatestTranslated(side){
  const wrap = (side==="top") ? $("topBody") : $("botBody");
  if(!wrap) return;
  wrap.querySelectorAll(".bubble.me.is-latest").forEach(el=>el.classList.remove("is-latest"));
}

function makeSpeakerIcon(onClick){
  const btn = document.createElement("div");
  btn.className = "spk-icon";
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89 0 5.23 2.34 5.23 5.23S16.89 15.75 14 15.75v2.06c4.02 0 7.29-3.27 7.29-7.29S18.02 3.23 14 3.23z"/>
    </svg>
  `;
  btn.addEventListener("click", onClick);
  return btn;
}

function addBubble(side, kind, text, opts={}){
  const wrap = (side==="top") ? $("topBody") : $("botBody");
  if(!wrap) return null;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${kind}`;
  if(kind === "me" && opts.latest) bubble.classList.add("is-latest");

  if(kind === "me" && opts.speakable){
    bubble.appendChild(makeSpeakerIcon(()=> speakLocal(text, opts.speakLang || "en")));
  }

  const txt = document.createElement("span");
  txt.className = "txt";
  txt.textContent = String(text||"").trim() || "—";
  bubble.appendChild(txt);

  wrap.appendChild(bubble);
  try{ wrap.scrollTop = wrap.scrollHeight; }catch{}
  return { bubble, txt, wrap };
}

/* ===============================
   HOLD (robust - SR can stop at 4-5s)
================================ */
let holdActive = false;
let holdSide = null;
let holdStartAt = 0;

let holdHardStopTimer = null;
let holdTickTimer = null;
let srNoTextTimer = null;

let rec = null;
let finalParts = "";
let interimParts = "";
let gotAnyText = false;

function resetHoldBuffers(){
  finalParts = "";
  interimParts = "";
  gotAnyText = false;
}

function bufferText(){
  return (finalParts + " " + interimParts).trim();
}

function stopTimers(){
  if(holdHardStopTimer){ clearTimeout(holdHardStopTimer); holdHardStopTimer=null; }
  if(holdTickTimer){ clearInterval(holdTickTimer); holdTickTimer=null; }
  if(srNoTextTimer){ clearTimeout(srNoTextTimer); srNoTextTimer=null; }
  setTimerBadges(null);
}

function scheduleTimers(){
  stopTimers();
  const start = Date.now();

  // kesin bitiş (setTimeout) ✅ garanti
  holdHardStopTimer = setTimeout(()=>{
    endHold(true); // 45s doldu
  }, HOLD_MAX_MS);

  // sayaç
  holdTickTimer = setInterval(()=>{
    const left = HOLD_MAX_MS - (Date.now() - start);
    setTimerBadges(left);
  }, 250);

  // 2 sn içinde hiç metin yoksa uyarıp bitir
  srNoTextTimer = setTimeout(()=>{
    if(holdActive && !gotAnyText){
      toast("🎤 Ses algılanmadı (STT yok/izin?)");
      endHold(false);
    }
  }, SR_NO_TEXT_MS);
}

function stopRec(){
  try{ rec?.stop?.(); }catch{}
  rec = null;
}

function buildRec(langCode){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = bcp(langCode);
  r.interimResults = true;
  r.continuous = true;
  r.maxAlternatives = 1;
  return r;
}

function attachRecHandlers(langCode){
  if(!rec) return;

  rec.onresult = (e)=>{
    let interimNow = "";
    for(let i=0;i<e.results.length;i++){
      const r = e.results[i];
      const txt = r?.[0]?.transcript || "";
      if(!txt) continue;

      gotAnyText = true;

      if(r.isFinal){
        finalParts = (finalParts + " " + txt.trim()).trim();
      }else{
        interimNow = (interimNow + " " + txt.trim()).trim();
      }
    }
    if(interimNow) interimParts = interimNow;
  };

  rec.onerror = ()=>{
    // hata → onend gelecek → restart deneyeceğiz
    try{ rec?.stop?.(); }catch{}
  };

  rec.onend = async ()=>{
    // basılı tutma sürüyorsa restart
    if(holdActive){
      await sleep(SR_RESTART_GAP_MS);
      try{
        rec = buildRec(langCode);
        if(rec){
          attachRecHandlers(langCode);
          rec.start();
          return;
        }
      }catch{}
    }
  };
}

async function beginHold(which){
  closeAllPop();

  if(phase !== "idle"){
    toast("İşlem bitmeden konuşulmaz.");
    return;
  }

  const ok = await ensureFacetofaceSession();
  if(!ok) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert("Bu cihazda konuşma tanıma yok. (Chrome gerekli)");
    return;
  }

  holdActive = true;
  holdSide = which;
  holdStartAt = Date.now();
  resetHoldBuffers();

  active = which;
  lastMicSide = which;

  setCenterDirection(which);
  setFrameState("listening", which);
  setPhase("recording");
  setMicUI(which, true);

  scheduleTimers();

  const langCode = (which==="top") ? topLang : botLang;

  rec = buildRec(langCode);
  if(!rec){
    toast("STT başlatılamadı");
    await endHold(false);
    return;
  }

  attachRecHandlers(langCode);

  try{
    rec.start();
  }catch{
    toast("STT start edilemedi");
    await endHold(false);
  }
}

async function finalizeHold(forced){
  const duration = Date.now() - holdStartAt;
  if(!forced && duration < MIN_HOLD_MS) return;

  const finalText = bufferText();
  if(!finalText){
    toast("Metin oluşmadı");
    return;
  }

  await sleep(RELEASE_DELAY_MS);
  setPhase("translating");

  const which = holdSide;
  const other = otherSide(which);

  const src = (which==="top") ? topLang : botLang;
  const dst = (which==="top") ? botLang : topLang;

  // ✅ sesli komutla dil değiştir
  const cmd = await parseCommand(finalText);
  if(cmd && cmd.is_command && cmd.target_lang){
    if(which === "top"){
      botLang = cmd.target_lang;
      if($("botLangTxt")) $("botLangTxt").textContent = labelChip(botLang);
      toast(`🎯 Hedef: ${langLabel(botLang)}`);
    }else{
      topLang = cmd.target_lang;
      if($("topLangTxt")) $("topLangTxt").textContent = labelChip(topLang);
      toast(`🎯 Hedef: ${langLabel(topLang)}`);
    }
    return;
  }

  // konuşanı yaz
  addBubble(which, "them", finalText);

  const translated = await translateViaApi(finalText, src, dst);
  if(!translated){
    addBubble(other, "me", "⚠️ Çeviri yapılamadı.");
    return;
  }

  clearLatestTranslated(other);
  const node = addBubble(other, "me", "", { latest:true, speakable:true, speakLang:dst });
  if(node?.txt){
    await typeWriter(node.txt, translated, TYPE_SPEED_MS);
  }

  setCenterDirection(other);
  setFrameState("speaking", other);
  setPhase("speaking");

  await speakLocal(translated, dst);

  setFrameState("idle", lastMicSide);
}

async function endHold(forced=false){
  if(!holdActive) return;
  holdActive = false;

  stopTimers();
  setMicUI(holdSide, false);
  setFrameState("idle", lastMicSide);

  stopRec();

  // finalize
  await finalizeHold(!!forced);

  setPhase("idle");
  updateMicLocks();
}

/* ===============================
   BINDINGS
================================ */
function bindHold(btnId, side){
  const btn = $(btnId);
  if(!btn) return;

  btn.addEventListener("pointerdown",(e)=>{
    e.preventDefault();
    try{ btn.setPointerCapture(e.pointerId); }catch{}
    beginHold(side);
  });

  btn.addEventListener("pointerup", async (e)=>{
    e.preventDefault();
    try{ btn.releasePointerCapture(e.pointerId); }catch{}
    await endHold(false);
  });

  btn.addEventListener("pointercancel", ()=> endHold(false));
  btn.addEventListener("pointerleave", ()=> endHold(false));
}

function bindUI(){
  $("homeBtn")?.addEventListener("click", ()=> location.href = HOME_PATH);
  $("homeLink")?.addEventListener("click", ()=> location.href = HOME_PATH);

  $("clearBtn")?.addEventListener("click", ()=>{
    stopAudio();
    stopTimers();
    stopRec();
    holdActive = false;

    if($("topBody")) $("topBody").innerHTML="";
    if($("botBody")) $("botBody").innerHTML="";

    setMicUI("top", false);
    setMicUI("bot", false);

    setFrameState("idle", lastMicSide);
    setPhase("idle");
    updateMicLocks();
  });

  $("topLangBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); togglePopover("top"); });
  $("botLangBtn")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); togglePopover("bot"); });

  $("close-top")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); closeAllPop(); });
  $("close-bot")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); closeAllPop(); });

  document.addEventListener("click",(e)=>{
    const pt = $("pop-top");
    const pb = $("pop-bot");
    const insidePop = (pt && pt.contains(e.target)) || (pb && pb.contains(e.target));
    const isBtn = e.target?.closest?.("#topLangBtn,#botLangBtn");
    if(!insidePop && !isBtn) closeAllPop();
  }, { capture:true });

  bindHold("topMic","top");
  bindHold("botMic","bot");
}

/* ===============================
   BOOT
================================ */
document.addEventListener("DOMContentLoaded", async ()=>{
  await loadLangPool();

  if($("topLangTxt")) $("topLangTxt").textContent = labelChip(topLang);
  if($("botLangTxt")) $("botLangTxt").textContent = labelChip(botLang);

  setCenterDirection("bot");
  setFrameState("idle", "bot");

  bindUI();
  await checkLoginOnce();
  updateMicLocks();
});
