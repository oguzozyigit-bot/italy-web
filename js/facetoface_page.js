// FILE: /js/facetoface_page.js
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
   LANGS
================================ */
const LANGS = [
  { code:"tr", flag:"🇹🇷", bcp:"tr-TR" },
  { code:"en", flag:"🇬🇧", bcp:"en-US" },
  { code:"de", flag:"🇩🇪", bcp:"de-DE" },
  { code:"fr", flag:"🇫🇷", bcp:"fr-FR" },
  { code:"it", flag:"🇮🇹", bcp:"it-IT" },
  { code:"es", flag:"🇪🇸", bcp:"es-ES" },
  { code:"pt", flag:"🇵🇹", bcp:"pt-PT" },
  { code:"pt-br", flag:"🇧🇷", bcp:"pt-BR" },
  { code:"nl", flag:"🇳🇱", bcp:"nl-NL" },
  { code:"sv", flag:"🇸🇪", bcp:"sv-SE" },
  { code:"no", flag:"🇳🇴", bcp:"nb-NO" },
  { code:"da", flag:"🇩🇰", bcp:"da-DK" },
  { code:"fi", flag:"🇫🇮", bcp:"fi-FI" },
  { code:"pl", flag:"🇵🇱", bcp:"pl-PL" },
  { code:"cs", flag:"🇨🇿", bcp:"cs-CZ" },
  { code:"sk", flag:"🇸🇰", bcp:"sk-SK" },
  { code:"hu", flag:"🇭🇺", bcp:"hu-HU" },
  { code:"ro", flag:"🇷🇴", bcp:"ro-RO" },
  { code:"bg", flag:"🇧🇬", bcp:"bg-BG" },
  { code:"el", flag:"🇬🇷", bcp:"el-GR" },
  { code:"uk", flag:"🇺🇦", bcp:"uk-UA" },
  { code:"ru", flag:"🇷🇺", bcp:"ru-RU" },
  { code:"ar", flag:"🇸🇦", bcp:"ar-SA" },
  { code:"he", flag:"🇮🇱", bcp:"he-IL" },
  { code:"fa", flag:"🇮🇷", bcp:"fa-IR" },
  { code:"ur", flag:"🇵🇰", bcp:"ur-PK" },
  { code:"hi", flag:"🇮🇳", bcp:"hi-IN" },
  { code:"bn", flag:"🇧🇩", bcp:"bn-BD" },
  { code:"id", flag:"🇮🇩", bcp:"id-ID" },
  { code:"ms", flag:"🇲🇾", bcp:"ms-MY" },
  { code:"vi", flag:"🇻🇳", bcp:"vi-VN" },
  { code:"th", flag:"🇹🇭", bcp:"th-TH" },
  { code:"zh", flag:"🇨🇳", bcp:"zh-CN" },
  { code:"ja", flag:"🇯🇵", bcp:"ja-JP" },
  { code:"ko", flag:"🇰🇷", bcp:"ko-KR" }
];

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

let isLoggedIn = false;      // ✅ login gate artık UI’yi kesmez
let sessionGranted = false;

/* ===============================
   HALF-DUPLEX (SIRA) ENGINE
================================ */
let phase = "idle";          // idle | recording | translating | speaking
let active = null;           // "top" | "bot" | null
let nextTurn = null;         // null => anyone; otherwise "top" or "bot" (forced alternation)

function canStart(which){
  if(phase !== "idle") return false;
  if(nextTurn && nextTurn !== which) return false;
  return true;
}

function otherSide(which){ return which === "top" ? "bot" : "top"; }

function setPhase(p){
  phase = p;
  updateMicLocks();
}

function setNextTurn(which){
  nextTurn = which; // "top" or "bot" or null
  updateMicLocks();
}

function lockMic(which, locked){
  const el = (which === "top") ? $("topMic") : $("botMic");
  if(!el) return;
  el.style.pointerEvents = locked ? "none" : "auto";
  el.style.opacity = locked ? "0.55" : "1";
}

function updateMicLocks(){
  // Base: everything unlocked
  let lockTop = false;
  let lockBot = false;

  if(phase === "recording"){
    // while one recording: lock the other
    if(active === "top"){ lockBot = true; }
    if(active === "bot"){ lockTop = true; }
  } else if(phase === "translating" || phase === "speaking"){
    // hard lock both
    lockTop = true; lockBot = true;
  } else if(phase === "idle"){
    // enforce turn if nextTurn set
    if(nextTurn === "top") lockBot = true;
    if(nextTurn === "bot") lockTop = true;
  }

  lockMic("top", lockTop);
  lockMic("bot", lockBot);
}

function setMicUI(which,on){
  const btn = (which==="top") ? $("topMic") : $("botMic");
  btn?.classList.toggle("listening", !!on);
}

/* ===============================
   HELPERS
================================ */
function toast(msg){
  // Basit, sessiz: istersen burayı kendi toast’ına bağla
  try{ console.log("[toast]", msg); }catch{}
}

function closeAllPop(){
  $("pop-top")?.classList.remove("show");
  $("pop-bot")?.classList.remove("show");
}

function renderPop(side){
  const list = $(side==="top" ? "list-top" : "list-bot");
  if(!list) return;
  const sel = (side==="top") ? topLang : botLang;

  list.innerHTML = LANGS.map(l=>`
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

function togglePopover(side){
  const pop = $(side==="top" ? "pop-top" : "pop-bot");
  if(!pop) return;
  const willShow = !pop.classList.contains("show");
  closeAllPop();
  if(willShow){
    pop.classList.add("show");
    renderPop(side);
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
  // şimdilik banner yok
}

function ensureLoginByUserAction(){
  location.href = LOGIN_PATH;
}

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
  setPhase("idle");
  updateMicLocks();
}

/* ===============================
   TTS (LOCAL)
================================ */
function speakLocal(text, langCode){
  const t = String(text||"").trim();
  if(!t) return Promise.resolve();

  if(!("speechSynthesis" in window)) return Promise.resolve();

  return new Promise((resolve)=>{
    try{
      const u = new SpeechSynthesisUtterance(t);
      u.lang = bcp(langCode);
      u.rate = 1.0;
      u.pitch = 1.0;

      u.onend = ()=>resolve();
      u.onerror = ()=>resolve();

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }catch{
      resolve();
    }
  });
}

/* ===============================
   TRANSLATE API
================================ */
async function translateViaApi(text, source, target){
  const t = String(text||"").trim();
  if(!t) return t;

  const src = normalizeApiLang(source);
  const dst = normalizeApiLang(target);
  if(src===dst) return t;

  // ✅ AI çeviri endpoint
  try{
    const r = await fetch(`${API_BASE}/api/translate_ai`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        text: t,
        from_lang: src,
        to_lang: dst,
        // istersen sonra açarız:
        style: "chat" // "fast" | "chat"
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
   UI BUBBLES
================================ */
function addBubble(side, kind, text){
  const wrap = (side==="top") ? $("topBody") : $("botBody");
  if(!wrap) return;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${kind}`;
  const txt = document.createElement("span");
  txt.className = "txt";
  txt.textContent = String(text||"").trim() || "—";
  bubble.appendChild(txt);
  wrap.appendChild(bubble);
  try{ wrap.scrollTop = wrap.scrollHeight; }catch{}
}

/* ===============================
   HALF-DUPLEX TURN (MAIN)
================================ */
async function start(which){
  closeAllPop();

  if(!canStart(which)){
    if(phase !== "idle"){
      toast("Sırayla: işlem bitmeden konuşulmaz.");
      return;
    }
    toast("Sıra sende değil 🙂");
    return;
  }

  const ok = await ensureFacetofaceSession();
  if(!ok) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert("Bu cihaz SpeechRecognition desteklemiyor.");
    return;
  }

  // stop any TTS before recording
  try{ window.speechSynthesis?.cancel?.(); }catch{}

  // Build recognizer
  const src = (which==="top") ? topLang : botLang;
  const dst = (which==="top") ? botLang : topLang;

  const rec = buildRecognizer(src);
  if(!rec){ alert("Mikrofon başlatılamadı."); return; }

  // Set phase/locks
  active = which;
  setPhase("recording");
  setMicUI(which, true);

  rec.onresult = (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    const finalText = String(t||"").trim();
    if(!finalText) return;

    // Show original on the speaking side
    addBubble(which, "them", finalText);

    pending = { which, finalText, src, dst };
    try{ rec.stop(); }catch{}
  };

  rec.onerror = ()=>{
    stopAll();
  };

  rec.onend = async ()=>{
    // stop recording UI
    setMicUI(which,false);

    const p = pending;
    pending = null;
    active = null;

    if(!p || p.which !== which){
      setPhase("idle");
      updateMicLocks();
      return;
    }

    // Translation phase (lock both)
    setPhase("translating");

    const other = otherSide(which);

    // Translate
    const translated = await translateViaApi(p.finalText, p.src, p.dst);

    if(!translated){
      addBubble(other, "me", "⚠️ Çeviri şu an yapılamadı.");
      setPhase("idle");
      // sıra yine de diğer tarafa geçsin (konuşma “tur” sayılır)
      setNextTurn(other);
      return;
    }

    // Show translation on the other side
    addBubble(other, "me", translated);

    // Speak phase (lock both while speaking)
    setPhase("speaking");
    await speakLocal(translated, p.dst);

    // Done → next turn is the opposite side (forced alternation)
    setPhase("idle");
    setNextTurn(other);
  };

  if(which==="top") recTop=rec; else recBot=rec;

  try{ rec.start(); }catch{
    stopAll();
  }
}

/* ===============================
   BINDINGS (UI her zaman aktif)
================================ */
function bindUI(){
  // Home nav
  $("homeBtn")?.addEventListener("click", ()=> location.href = HOME_PATH);
  $("homeLink")?.addEventListener("click", ()=> location.href = HOME_PATH);

  // Clear
  $("clearBtn")?.addEventListener("click", ()=>{
    stopAll();
    if($("topBody")) $("topBody").innerHTML="";
    if($("botBody")) $("botBody").innerHTML="";
    // sıra sıfırlansın: isteyen başlasın
    nextTurn = null;
    updateMicLocks();
  });

  // Popovers
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

  // MIC (click to start)
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
  // ✅ UI her zaman hazır
  if($("topLangTxt")) $("topLangTxt").textContent = labelChip(topLang);
  if($("botLangTxt")) $("botLangTxt").textContent = labelChip(botLang);
  bindUI();

  // ✅ Login kontrolü sadece mic için (arkada)
  await checkLoginOnce();
  showLoginBannerIfNeeded();

  // başlangıçta herkes konuşabilir
  updateMicLocks();
});
