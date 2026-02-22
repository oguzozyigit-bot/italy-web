// FILE: /js/facetoface_page.js
import { getSiteLang } from "/js/i18n.js";
import { supabase } from "/js/supabase_client.js";
import { setHeaderTokens } from "/js/ui_shell.js";

(function enforceCanonicalHost(){
  try{
    const h = String(location.hostname || "").toLowerCase().trim();
    if(h === "www.italky.ai"){
      const to = "https://italky.ai" + location.pathname + location.search + location.hash;
      location.replace(to);
    }
  }catch{}
})();

const $ = (id)=>document.getElementById(id);

const API_BASE = "https://italky-api.onrender.com";
const LOGIN_PATH = "/index.html";
const HOME_PATH  = "/pages/home.html";
const PROFILE_PATH = "/pages/profile.html";

/* ===== AUTH ===== */
async function waitForSession(maxMs=6000){
  const start = Date.now();
  while(Date.now()-start < maxMs){
    try{
      const { data:{ session } } = await supabase.auth.getSession();
      if(session?.user) return session;
    }catch{}
    await new Promise(r=>setTimeout(r, 250));
  }
  return null;
}

function showLoginNeeded(){
  alert("Giriş gerekli. Lütfen giriş yapın.");
  // Redirect döngüsü olmasın diye otomatik atma yok.
}

async function requireLogin(){
  const session = await waitForSession(6000);
  if(!session?.user){
    showLoginNeeded();
    return false;
  }
  return true;
}

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

/* ===== LANGS ===== */
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
  { code:"az", flag:"🇦🇿", bcp:"az-AZ" },
  { code:"ka", flag:"🇬🇪", bcp:"ka-GE" },
  { code:"hy", flag:"🇦🇲", bcp:"hy-AM" },
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
  { code:"zh-tw", flag:"🇹🇼", bcp:"zh-TW" },
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

/* ===== STATE ===== */
let topLang = "en";
let botLang = "tr";

/* ===== TOKEN SESSION ===== */
let sessionGranted = false;

function unwrapRow(data){
  if(Array.isArray(data)) return data[0] || null;
  if(data && typeof data === "object") return data;
  return null;
}

async function ensureFacetofaceSession(){
  if(sessionGranted) return true;

  const s = await waitForSession(6000);
  if(!s?.user){
    showLoginNeeded();
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
  }catch{
    alert("FaceToFace oturumu başlatılamadı.");
    return false;
  }
}

/* ===== ROOT UI ===== */
function setRootClasses({to, listening=false, speaking=false}){
  const root = $("frameRoot");
  if(!root) return;
  root.classList.remove("to-top","to-bot","listening","speaking");
  if(to === "top") root.classList.add("to-top"); else root.classList.add("to-bot");
  if(listening) root.classList.add("listening");
  if(speaking) root.classList.add("speaking");
}

/* ===== TTS ===== */
let speakTimer = null;
function speakRaw(text, langCode, onDone){
  const t = String(text||"").trim();
  if(!t) { onDone?.(); return; }

  if(window.NativeTTS && typeof window.NativeTTS.speak === "function"){
    try{ window.NativeTTS.stop?.(); }catch{}
    setTimeout(()=>{
      try{ window.NativeTTS.speak(t, String(langCode||"en")); }catch(e){ console.warn(e); }
      const ms = Math.min(7000, Math.max(1200, t.length * 60));
      clearTimeout(speakTimer);
      speakTimer = setTimeout(()=>onDone?.(), ms);
    }, 220);
    return;
  }

  if(!window.speechSynthesis){ onDone?.(); return; }
  try{ window.speechSynthesis.cancel(); }catch{}
  const u = new SpeechSynthesisUtterance(t);
  u.lang = bcp(langCode);
  u.onend = ()=> onDone?.();
  u.onerror = ()=> onDone?.();
  setTimeout(()=>{ try{ window.speechSynthesis.speak(u); }catch{ onDone?.(); } }, 60);
}

let lastSpeakerSide = "bot";
function speakWithUI(side, text, langCode){
  setRootClasses({to: side, listening:false, speaking:true});
  speakRaw(text, langCode, ()=> setRootClasses({to: side, listening:false, speaking:false}));
}

/* ===== POPOVER ===== */
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
  if(willShow){ pop.classList.add("show"); renderPop(side); }
}

/* ===== BUBBLES ===== */
function addBubble(side, kind, text, langForSpeak){
  const wrap = (side==="top") ? $("topBody") : $("botBody");
  if(!wrap) return;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${kind}`;

  const txt = document.createElement("span");
  txt.className = "txt";
  txt.textContent = String(text||"").trim() || "—";
  bubble.appendChild(txt);

  if(kind === "me"){
    wrap.querySelectorAll(".bubble.me.is-latest").forEach(x=>x.classList.remove("is-latest"));
    bubble.classList.add("is-latest");

    const spk = document.createElement("button");
    spk.className = "spk-icon";
    spk.type = "button";
    spk.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 4V6L7 10H3z"></path><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03z"></path><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>`;
    spk.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); speakWithUI(side, txt.textContent, langForSpeak); });
    bubble.appendChild(spk);
  }

  wrap.appendChild(bubble);
  try{ wrap.scrollTop = wrap.scrollHeight; }catch{}
}

/* ===== TRANSLATE ===== */
async function translateViaApi(text, source, target){
  const t = String(text||"").trim();
  if(!t) return t;
  const src = normalizeApiLang(source);
  const dst = normalizeApiLang(target);
  if(src===dst) return t;

  const ctrl = new AbortController();
  const to = setTimeout(()=>ctrl.abort(), 25000);

  try{
    const r = await fetch(`${API_BASE}/api/translate`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ text:t, from_lang:src, to_lang:dst }),
      signal: ctrl.signal
    });
    if(!r.ok) return null;
    const data = await r.json().catch(()=>({}));
    const out = String(data?.translated||data?.translation||data?.text||"").trim();
    return out || null;
  }catch{
    return null;
  }finally{
    clearTimeout(to);
  }
}

/* ===== STT ===== */
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

let active=null, recTop=null, recBot=null, pending=null;

function setMicUI(which,on){
  const btn = (which==="top") ? $("topMic") : $("botMic");
  btn?.classList.toggle("listening", !!on);
}

function stopAll(){
  try{ recTop?.stop?.(); }catch{}
  try{ recBot?.stop?.(); }catch{}
  recTop=null; recBot=null; active=null;
  setMicUI("top", false); setMicUI("bot", false);
  try{ window.NativeTTS?.stop?.(); }catch{}
  try{ window.speechSynthesis?.cancel?.(); }catch{}
  clearTimeout(speakTimer);
  setRootClasses({to:lastSpeakerSide, listening:false, speaking:false});
}

async function start(which){
  const ok = await ensureFacetofaceSession();
  if(!ok) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert("Bu cihaz SpeechRecognition desteklemiyor."); return; }

  if(active && active !== which) stopAll();

  const src = (which==="top") ? topLang : botLang;
  const dst = (which==="top") ? botLang : topLang;

  const rec = buildRecognizer(src);
  if(!rec){ alert("Mikrofon başlatılamadı."); return; }

  active = which;
  setMicUI(which,true);
  setRootClasses({to:(which==="top"?"top":"bot"), listening:true, speaking:false});

  rec.onresult = (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    const finalText = String(t||"").trim();
    if(!finalText) return;

    addBubble(which, "them", finalText, src);
    pending = { which, finalText, src, dst };
    try{ rec.stop(); }catch{}
  };

  rec.onerror = ()=>{ stopAll(); };

  rec.onend = async ()=>{
    if(active===which) active=null;
    setMicUI(which,false);

    const p = pending;
    if(p && p.which===which){
      pending=null;
      const other = (which==="top") ? "bot" : "top";
      const translated = await translateViaApi(p.finalText, p.src, p.dst);
      const speakLang = normalizeApiLang(p.dst);

      if(!translated){
        addBubble(other, "me", "⚠️ Çeviri şu an yapılamadı.", speakLang);
        return;
      }

      addBubble(other, "me", translated, speakLang);
      lastSpeakerSide = other;
      speakWithUI(other, translated, speakLang);
    }else{
      setRootClasses({to:lastSpeakerSide, listening:false, speaking:false});
    }
  };

  if(which==="top") recTop=rec; else recBot=rec;
  try{ rec.start(); }catch{ stopAll(); }
}

/* ===== BINDINGS ===== */
function bindUI(){
  $("homeBtn")?.addEventListener("click", ()=> location.href = HOME_PATH);
  $("homeLink")?.addEventListener("click", ()=> location.href = HOME_PATH);

  $("clearBtn")?.addEventListener("click", ()=>{
    stopAll();
    if($("topBody")) $("topBody").innerHTML="";
    if($("botBody")) $("botBody").innerHTML="";
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

  $("topMic")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); closeAllPop(); if(active==="top") stopAll(); else start("top"); });
  $("botMic")?.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); closeAllPop(); if(active==="bot") stopAll(); else start("bot"); });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const ok = await requireLogin();
  if(!ok) return;

  if($("topLangTxt")) $("topLangTxt").textContent = labelChip(topLang);
  if($("botLangTxt")) $("botLangTxt").textContent = labelChip(botLang);

  bindUI();
  try{ window.speechSynthesis?.getVoices?.(); }catch{}
  setRootClasses({to:"bot", listening:false, speaking:false});
});
