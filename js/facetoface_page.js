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
const HOLD_MAX_MS = 90000;      // ✅ 1.5 dakika (istersen 120000 yap)
const RELEASE_DELAY_MS = 350;   // ✅ bırakınca nefes payı
const MIN_HOLD_MS = 160;        // kazara dokunma filtresi

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
   VISUAL STATE
================================ */
let phase = "idle";          // idle | recording | translating | speaking
let active = null;           // "top" | "bot" | null
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
  let lockTop = false;
  let lockBot = false;

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
   TOAST + TIMER BADGE
================================ */
let toastEl = null;
let toastTimer = null;

function showToast(text){
  try{ if(navigator.vibrate) navigator.vibrate(14); }catch{}

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
    toastEl.style.letterSpacing = ".2px";
    toastEl.style.opacity = "0";
    toastEl.style.transition = "opacity .15s ease";
    toastEl.style.pointerEvents = "none";
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = text;
  toastEl.style.opacity = "1";

  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ if(toastEl) toastEl.style.opacity = "0"; }, 1200);
}
function toast(msg){ showToast(String(msg||"")); }

let timerBadge = null;
function ensureTimerBadge(){
  if(timerBadge) return;
  timerBadge = document.createElement("div");
  timerBadge.style.position = "fixed";
  timerBadge.style.right = "14px";
  timerBadge.style.top = "14px";
  timerBadge.style.zIndex = "999999";
  timerBadge.style.padding = "8px 10px";
  timerBadge.style.borderRadius = "999px";
  timerBadge.style.border = "1px solid rgba(255,255,255,0.14)";
  timerBadge.style.background = "rgba(0,0,0,0.55)";
  timerBadge.style.backdropFilter = "blur(10px)";
  timerBadge.style.color = "rgba(255,255,255,0.92)";
  timerBadge.style.fontFamily = "Outfit, system-ui, sans-serif";
  timerBadge.style.fontWeight = "900";
  timerBadge.style.fontSize = "12px";
  timerBadge.style.opacity = "0";
  timerBadge.style.transition = "opacity .15s ease";
  timerBadge.style.pointerEvents = "none";
  document.body.appendChild(timerBadge);
}
function setTimerBadge(msLeft){
  ensureTimerBadge();
  if(msLeft == null){
    timerBadge.style.opacity = "0";
    return;
  }
  const s = Math.max(0, Math.ceil(msLeft/1000));
  timerBadge.textContent = `⏱ ${s}s`;
  timerBadge.style.opacity = "1";
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

      toast("🎙️ Sesli komut: 'Dil değiştir İngilizce'");
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
  setTimeout(()=>{ try{ inp.focus(); }catch{} }, 0);
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
function showLoginBannerIfNeeded(){
  if(isLoggedIn) return;
}
function ensureLoginByUserAction(){ location.href = LOGIN_PATH; }

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
    ensureLoginByUserAction();
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
   STT
================================ */
function buildRecognizer(langCode){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const rec = new SR();
  rec.lang = bcp(langCode);
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  return rec;
}

/* ===============================
   AUDIO (prevent overlap)
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

  // double click spam: 250ms debounce
  const now = Date.now();
  if(now - lastAudioAt < 250){
    stopAudio();
    lastAudioAt = now;
  } else {
    lastAudioAt = now;
  }

  const lang = normalizeApiLang(langCode);

  try{
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      credentials: "include",
      body: JSON.stringify({ text: t, lang, speaking_rate: 1, pitch: 0 })
    });

    if(!res.ok){
      toast("🔇 TTS HTTP " + res.status);
      return;
    }

    const data = await res.json().catch(()=>null);
    if(!data || !data.ok || !data.audio_base64){
      toast("🔇 TTS invalid");
      return;
    }

    const b64 = data.audio_base64;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type: "audio/mpeg" });
    await playAudioBlob(blob);
  }catch{
    toast("🔇 TTS failed");
  }
}

/* ===============================
   COMMAND PARSE
================================ */
async function parseCommand(text){
  const t = String(text || "").trim();
  if(!t) return null;

  try{
    const r = await fetch(`${API_BASE}/api/command_parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, ui_lang: UI_LANG })
    });

    if(!r.ok) return null;
    return await r.json().catch(()=>null);
  }catch{
    return null;
  }
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

  try{
    const r = await fetch(`${API_BASE}/api/translate_ai`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ text: t, from_lang: src, to_lang: dst, style: "chat", provider: "auto" })
    });
    if(!r.ok) return null;
    const data = await r.json().catch(()=>({}));
    const out = String(data?.translated || "").trim();
    return out || null;
  }catch{
    return null;
  }
}

/* ===============================
   TYPEWRITER
================================ */
async function typeWriter(el, fullText, speed=14){
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

  if(kind === "me" && opts.latest){
    bubble.classList.add("is-latest");
  }

  if(kind === "me" && opts.speakable){
    const icon = makeSpeakerIcon(()=> speakLocal(text, opts.speakLang || "en"));
    bubble.appendChild(icon);
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
   PUSH TO TALK (HOLD)
================================ */
let currentRec = null;
let holdStart = 0;
let holdTimer = null;

let finalParts = "";
let lastInterim = "";

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

  const src = (which==="top") ? topLang : botLang;
  const rec = buildRecognizer(src);
  if(!rec) return;

  holdStart = Date.now();
  finalParts = "";
  lastInterim = "";

  active = which;
  lastMicSide = which;

  setCenterDirection(which);
  setFrameState("listening", which);
  setPhase("recording");
  setMicUI(which, true);

  // Max süre sayacı
  if(holdTimer) clearInterval(holdTimer);
  const startAt = Date.now();
  holdTimer = setInterval(()=>{
    const elapsed = Date.now() - startAt;
    const left = HOLD_MAX_MS - elapsed;
    setTimerBadge(left);
    if(left <= 0){
      endHold(); // süre doldu
    }
  }, 250);

  rec.onresult = (e)=>{
    // hem final hem interim topla
    let interimNow = "";
    for(let i=0;i<e.results.length;i++){
      const r = e.results[i];
      const txt = r?.[0]?.transcript || "";
      if(!txt) continue;

      if(r.isFinal){
        finalParts = (finalParts + " " + txt.trim()).trim();
      }else{
        interimNow = (interimNow + " " + txt.trim()).trim();
      }
    }
    if(interimNow) lastInterim = interimNow;
  };

  rec.onerror = ()=>{
    endHold();
  };

  rec.onend = async ()=>{
    if(holdTimer){ clearInterval(holdTimer); holdTimer = null; }
    setTimerBadge(null);

    setMicUI(which,false);
    setFrameState("idle", lastMicSide);

    const duration = Date.now() - holdStart;
    if(duration < MIN_HOLD_MS){
      setPhase("idle");
      updateMicLocks();
      return;
    }

    // ✅ kritik: final hiç gelmezse interim ile kurtar
    const finalText = (finalParts + " " + lastInterim).trim();
    if(!finalText){
      setPhase("idle");
      updateMicLocks();
      return;
    }

    await sleep(RELEASE_DELAY_MS);
    setPhase("translating");

    const other = otherSide(which);
    const dst = (which==="top") ? botLang : topLang;

    // komut mu?
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
      closeAllPop();
      setPhase("idle");
      updateMicLocks();
      return;
    }

    // konuşanı yaz
    addBubble(which, "them", finalText);

    const translated = await translateViaApi(finalText, src, dst);
    if(!translated){
      addBubble(other, "me", "⚠️ Çeviri şu an yapılamadı.");
      setPhase("idle");
      updateMicLocks();
      return;
    }

    // typewriter + big latest + speaker
    clearLatestTranslated(other);
    const node = addBubble(other, "me", "", { latest:true, speakable:true, speakLang:dst });
    if(node?.txt){
      await typeWriter(node.txt, translated, 14);
    }

    setCenterDirection(other);
    setFrameState("speaking", other);
    setPhase("speaking");

    await speakLocal(translated, dst);

    setFrameState("idle", lastMicSide);
    setPhase("idle");
    updateMicLocks();
  };

  currentRec = rec;
  try{ rec.start(); }catch{ endHold(); }
}

function endHold(){
  try{ currentRec?.stop?.(); }catch{}
  currentRec = null;
}

/* ===============================
   BINDINGS
================================ */
function bindHold(btnId, side){
  const btn = $(btnId);
  if(!btn) return;

  // Pointer Events: mobil/pc tek sistem
  btn.addEventListener("pointerdown",(e)=>{
    e.preventDefault();
    try{ btn.setPointerCapture(e.pointerId); }catch{}
    beginHold(side);
  });

  btn.addEventListener("pointerup",(e)=>{
    e.preventDefault();
    try{ btn.releasePointerCapture(e.pointerId); }catch{}
    endHold();
  });

  btn.addEventListener("pointercancel",()=> endHold());
  btn.addEventListener("pointerleave",()=> endHold());
}

function bindUI(){
  $("homeBtn")?.addEventListener("click", ()=> location.href = HOME_PATH);
  $("homeLink")?.addEventListener("click", ()=> location.href = HOME_PATH);

  $("clearBtn")?.addEventListener("click", ()=>{
    try{ currentRec?.stop?.(); }catch{}
    currentRec = null;

    stopAudio();

    if(holdTimer){ clearInterval(holdTimer); holdTimer = null; }
    setTimerBadge(null);

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
  showLoginBannerIfNeeded();

  updateMicLocks();
});
