// FILE: /js/facetoface_page.js
import { LANG_POOL } from "/js/lang_pool_full.js";
import { getSiteLang } from "/js/i18n.js";
import { supabase } from "/js/supabase_client.js";
import { setHeaderTokens } from "/js/ui_shell.js";

/* ✅ CANONICAL HOST */
(function enforceCanonicalHost(){
  try{
    const h = String(location.hostname || "").toLowerCase().trim();
    if(h === "www.italky.ai"){
      location.replace("https://italky.ai" + location.pathname + location.search + location.hash);
    }
  }catch{}
})();

const $ = (id)=>document.getElementById(id);

const API_BASE = "https://italky-api.onrender.com";
const LOGIN_PATH = "/index.html";
const HOME_PATH  = "/pages/home.html";
const PROFILE_PATH = "/pages/profile.html";

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
   LANG POOL (FULL) -> FACETOFACE LANGS
   (code, flag, bcp) + search support
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

const LANGS = (Array.isArray(LANG_POOL) ? LANG_POOL : []).map(l => {
  const code = String(l.code || "").toLowerCase().trim();
  if(!code) return null;
  const flag = l.flag || "🌐";
  const bcp = BCP[code] || "en-US";
  return { code, flag, bcp };
}).filter(Boolean);

// ensure basics
if(!LANGS.find(x=>x.code==="tr")) LANGS.unshift({code:"tr",flag:"🇹🇷",bcp:"tr-TR"});
if(!LANGS.find(x=>x.code==="en")) LANGS.unshift({code:"en",flag:"🇬🇧",bcp:"en-US"});

/* ===============================
   LANG HELPERS
================================ */
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
   ENGINE / VISUAL STATE
================================ */
let phase = "idle";          // idle | recording | translating | speaking
let active = null;           // "top" | "bot" | null
let lastMicSide = "bot";     // konuşma bitince logo buraya döner

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

function canStart(){
  return phase === "idle";
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
  btn?.classList.toggle("listening", !!on);
}

/* ===============================
   TOAST
================================ */
let toastEl = null;
let toastTimer = null;

function showToast(text){
  try{ if(navigator.vibrate) navigator.vibrate(18); }catch{}

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
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = text;
  toastEl.style.opacity = "1";

  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{
    if(toastEl) toastEl.style.opacity = "0";
  }, 1400);
}
function toast(msg){ showToast(String(msg||"")); }

/* ===============================
   POPUP HELPERS + SEARCH
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

      if(side==="top") topLang = code;
      else botLang = code;

      const t = (side==="top") ? $("topLangTxt") : $("botLangTxt");
      if(t) t.textContent = labelChip(code);

      toast("🎙️ Sesli komut: 'Dil değiştir İngilizce'  /  'Translate to English'");
      closeAllPop();
    });
  });
}

function ensureSearchBox(side){
  const listId = (side==="top") ? "list-top" : "list-bot";
  const list = $(listId);
  if(!list) return;

  // already inserted
  if(list.parentElement?.querySelector?.(".lang-search")) return;

  const inp = document.createElement("input");
  inp.className = "lang-search";
  inp.placeholder = "Dil ara…";
  inp.autocomplete = "off";
  inp.spellcheck = false;

  // style inline (CSS file yoksa da çalışsın)
  inp.style.width = "calc(100% - 20px)";
  inp.style.margin = "10px";
  inp.style.padding = "10px 12px";
  inp.style.borderRadius = "14px";
  inp.style.border = "1px solid rgba(255,255,255,0.14)";
  inp.style.background = "rgba(0,0,0,0.25)";
  inp.style.color = "#fff";
  inp.style.fontWeight = "900";
  inp.style.fontFamily = "Outfit, system-ui, sans-serif";
  inp.style.letterSpacing = ".2px";

  list.parentElement.insertBefore(inp, list);

  inp.addEventListener("input", ()=>{
    renderPop(side, inp.value);
  });

  // initial render
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
    // ensureSearchBox calls renderPop
    try{
      const inp = pop.querySelector(".lang-search");
      inp?.focus?.();
    }catch{}
  }
}

/* ===============================
   AUTH
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

/* ===============================
   TOKEN SESSION / RPC
================================ */
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
        alert("Jeton yetersiz. Devam etmek için jeton yükleyin.");
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

  }catch(e){
    console.warn(e);
    alert("FaceToFace oturumu başlatılamadı.");
    return false;
  }
}

/* ===============================
   STT (MIC)
================================ */
function buildRecognizer(langCode){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const rec = new SR();
  rec.lang = bcp(langCode);
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  return rec;
}

let recTop=null, recBot=null, pending=null;

function stopAll(){
  try{ recTop?.stop?.(); }catch{}
  try{ recBot?.stop?.(); }catch{}
  recTop=null; recBot=null; active=null; pending=null;

  setMicUI("top", false);
  setMicUI("bot", false);

  try{ window.speechSynthesis?.cancel?.(); }catch{}
  setFrameState("idle", lastMicSide);

  setPhase("idle");
  updateMicLocks();
}

/* ===============================
   TTS (BACKEND /api/tts -> {ok,audio_base64})
================================ */
async function speakLocal(text, langCode){
  const t = String(text || "").trim();
  if(!t) return;

  const lang = normalizeApiLang(langCode);

  try{
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      credentials: "include",
      body: JSON.stringify({
        text: t,
        lang: lang,
        speaking_rate: 1,
        pitch: 0
      })
    });

    if(!res.ok){
      const err = await res.text().catch(()=> "");
      console.log("TTS HTTP ERROR:", res.status, err);
      toast("🔇 TTS HTTP " + res.status);
      return;
    }

    const data = await res.json().catch(()=>null);
    if(!data || !data.ok || !data.audio_base64){
      console.log("TTS INVALID RESPONSE:", data);
      toast("🔇 TTS response invalid");
      return;
    }

    const b64 = data.audio_base64;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const objUrl = URL.createObjectURL(blob);

    const audio = new Audio(objUrl);
    audio.playsInline = true;
    audio.onended = () => URL.revokeObjectURL(objUrl);
    audio.onerror = () => URL.revokeObjectURL(objUrl);

    await audio.play();

  }catch(e){
    console.log("TTS FAILED:", e);
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
      body: JSON.stringify({
        text: t,
        ui_lang: UI_LANG
      })
    });

    if(!r.ok) return null;
    const data = await r.json().catch(()=>null);
    return data || null;
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
      body: JSON.stringify({
        text: t,
        from_lang: src,
        to_lang: dst,
        style: "chat",
        provider: "auto"
      })
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
   UI BUBBLES + SPEAKER ICON
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
  if(!wrap) return;

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
}

/* ===============================
   MAIN
================================ */
async function start(which){
  closeAllPop();

  if(!canStart()){
    toast("İşlem bitmeden tekrar konuşulmaz.");
    return;
  }

  const ok = await ensureFacetofaceSession();
  if(!ok) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert("Bu cihaz SpeechRecognition desteklemiyor.");
    return;
  }

  try{ window.speechSynthesis?.cancel?.(); }catch{}

  const src = (which==="top") ? topLang : botLang;
  const dst = (which==="top") ? botLang : topLang;

  const rec = buildRecognizer(src);
  if(!rec){ alert("Mikrofon başlatılamadı."); return; }

  active = which;
  lastMicSide = which;

  setCenterDirection(which);
  setFrameState("listening", which);

  setPhase("recording");
  setMicUI(which, true);

  rec.onresult = (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    const finalText = String(t||"").trim();
    if(!finalText) return;

    pending = { which, finalText, src, dst };
    try{ rec.stop(); }catch{}
  };

  rec.onerror = ()=>{ stopAll(); };

  rec.onend = async ()=>{
    setMicUI(which,false);
    setFrameState("idle", lastMicSide);

    const p = pending;
    pending = null;
    active = null;

    if(!p || p.which !== which){
      setPhase("idle");
      updateMicLocks();
      return;
    }

    setPhase("translating");

    const other = otherSide(which);

    // ✅ COMMAND: yazdırma yok
    const cmd = await parseCommand(p.finalText);
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

    // normal konuşma: yazdır
    addBubble(which, "them", p.finalText);

    const translated = await translateViaApi(p.finalText, p.src, p.dst);
    if(!translated){
      addBubble(other, "me", "⚠️ Çeviri şu an yapılamadı.", { latest:false, speakable:false });
      setPhase("idle");
      updateMicLocks();
      return;
    }

    clearLatestTranslated(other);
    addBubble(other, "me", translated, { latest:true, speakable:true, speakLang:p.dst });

    // speaking anim + yön
    setCenterDirection(other);
    setFrameState("speaking", other);

    setPhase("speaking");
    await speakLocal(translated, p.dst);

    setFrameState("idle", lastMicSide);
    setPhase("idle");
    updateMicLocks();
  };

  if(which==="top") recTop=rec; else recBot=rec;

  try{ rec.start(); }catch{ stopAll(); }
}

/* ===============================
   BINDINGS
================================ */
function bindUI(){
  $("homeBtn")?.addEventListener("click", ()=> location.href = HOME_PATH);
  $("homeLink")?.addEventListener("click", ()=> location.href = HOME_PATH);

  $("clearBtn")?.addEventListener("click", ()=>{
    stopAll();
    if($("topBody")) $("topBody").innerHTML="";
    if($("botBody")) $("botBody").innerHTML="";
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

  $("topMic")?.addEventListener("click",(e)=>{
    e.preventDefault(); e.stopPropagation();
    start("top");
  });
  $("botMic")?.addEventListener("click",(e)=>{
    e.preventDefault(); e.stopPropagation();
    start("bot");
  });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  if($("topLangTxt")) $("topLangTxt").textContent = labelChip(topLang);
  if($("botLangTxt")) $("botLangTxt").textContent = labelChip(botLang);

  setCenterDirection("bot");
  setFrameState("idle", "bot");

  bindUI();

  await checkLoginOnce();
  showLoginBannerIfNeeded();

  updateMicLocks();
});
