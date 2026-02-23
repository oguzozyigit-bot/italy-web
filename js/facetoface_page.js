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
  { code:"ko", flag:"🇰🇷", bcp:"ko-KR" },
  { code:"ka", flag:"🇬🇪", bcp:"ka-GE" } // ✅ Gürcüce
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

let isLoggedIn = false;
let sessionGranted = false;

/* ===============================
   ENGINE (SIRA YOK — sadece çakışma önleme)
================================ */
let phase = "idle";          // idle | recording | translating | speaking
let active = null;           // "top" | "bot" | null
let lastMicSide = "bot";     // "top" | "bot" — konuşma bitince logo buraya döner

function canStart(){
  return phase === "idle";
}
function otherSide(which){ return which === "top" ? "bot" : "top"; }

function frame(){
  return document.getElementById("frameRoot");
}

// Logo yön: to-top => üst mic tarafı, to-bot => alt mic tarafı
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
    lockTop = true;
    lockBot = true;
  }

  lockMic("top", lockTop);
  lockMic("bot", lockBot);
}

function setMicUI(which,on){
  const btn = (which==="top") ? $("topMic") : $("botMic");
  btn?.classList.toggle("listening", !!on);
}

/* ===============================
   UI FEEDBACK (chip + vibrate)
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
   HELPERS
================================ */
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

      if(side==="top") topLang = code;
      else botLang = code;

      const t = (side==="top") ? $("topLangTxt") : $("botLangTxt");
      if(t) t.textContent = labelChip(code);

      toast("🎙️ Sesli komut: 'Dil değiştir İngilizce'  /  'Translate to English'");
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
   TTS (LOCAL -> /api/tts fallback)
================================ */
async function speakLocal(text, langCode){
  const t = String(text || "").trim();
  if(!t) return;

  // 1) Web Speech (Chrome)
  try{
    if("speechSynthesis" in window){
      await new Promise((resolve)=>{
        const u = new SpeechSynthesisUtterance(t);
        u.lang = bcp(langCode);
        u.rate = 1.0;
        u.pitch = 1.0;
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
      return;
    }
  }catch{}

  // 2) WebView/APK için garanti: Backend TTS (/api/tts)
  try{
    const lang = normalizeApiLang(langCode);
    const url = `${API_BASE}/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(t)}`;

    const res = await fetch(url, { method: "GET" });
    if(!res.ok) throw new Error("TTS HTTP " + res.status);

    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);

    const a = new Audio(objUrl);
    a.playsInline = true;
    a.muted = false;
    a.onended = () => URL.revokeObjectURL(objUrl);
    a.onerror  = () => URL.revokeObjectURL(objUrl);

    await a.play();
  }catch(e){
    console.log("TTS failed:", e);
    toast("🔇 Ses çıkmadı (TTS)");
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
   TRANSLATE API (AI)
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

  // translated big
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

  // stop any TTS before recording
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

    // Komut/çeviri ayrımını onend'de yapacağız
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

    // ✅ 1) COMMAND CHECK (komutsa: yazdırma yok)
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

    // ✅ 2) Komut değilse: konuşanı yazdır
    addBubble(which, "them", p.finalText);

    // ✅ 3) NORMAL TRANSLATION
    const translated = await translateViaApi(p.finalText, p.src, p.dst);

    if(!translated){
      addBubble(other, "me", "⚠️ Çeviri şu an yapılamadı.", { latest:false, speakable:false });
      setPhase("idle");
      updateMicLocks();
      return;
    }

    // Son çeviri büyük, öncekini küçült
    clearLatestTranslated(other);
    addBubble(other, "me", translated, {
      latest: true,
      speakable: true,
      speakLang: p.dst
    });

    // ✅ 4) Speaking state + yön: hoparlör tarafına dön (diğer tarafa), bittiğinde geri mic tarafına dön
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

  // başlangıç yönü
  setCenterDirection("bot");
  setFrameState("idle", "bot");

  bindUI();

  await checkLoginOnce();
  showLoginBannerIfNeeded();

  updateMicLocks();
});
