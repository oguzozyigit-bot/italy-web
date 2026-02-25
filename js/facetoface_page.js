// FILE: /js/facetoface_page.js
// ✅ FINAL (TEK DOSYA): Bas -> kayıt başlar | tekrar bas -> durur & çevirir
// ✅ 20 saniye auto-stop: mic kapanır + çeviri çalışır
// ✅ Kayıt sırasında canlı yazı: her 4 sn /api/stt ile güncelle (WebView uyumlu)
// ✅ Konuşma bitince: STT metni LOCAL temizlenir -> sonra STRICT ÇEVİR
// ✅ Sesli komutla dil değiştir: /api/command_parse
// ✅ Daktilo çeviri + TTS + hoparlör üst üste binmez
// ✅ IMPORTANT: FaceToFace'te "chat" tarzı YOK. Sadece çeviri.

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
   SETTINGS
================================ */
const MAX_RECORD_MS = 20000;          // ✅ 20 saniye
const LIVE_STT_EVERY_MS = 4000;       // ✅ canlı yazı güncelleme aralığı
const TYPE_SPEED_MS = 14;             // daktilo
const AUDIO_DEBOUNCE_MS = 250;        // hoparlör spam

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
   LANG POOL -> FACETOFACE LANGS
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

if(!LANGS.find(x=>x.code==="tr")) LANGS.unshift({code:"tr",flag:"🇹🇷",bcp:"tr-TR"});
if(!LANGS.find(x=>x.code==="en")) LANGS.unshift({code:"en",flag:"🇬🇧",bcp:"en-US"});

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

let phase = "idle";          // idle | recording | translating | speaking
let active = null;           // "top" | "bot" | null
let lastMicSide = "bot";

/* ===============================
   VISUAL STATE
================================ */
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
  btn.style.boxShadow = on ? "0 0 48px rgba(99,102,241,0.60), 0 0 22px rgba(236,72,153,0.32)" : "";
  btn.style.transform = on ? "scale(1.04)" : "";
}

/* ===============================
   TOAST
================================ */
let toastEl = null;
let toastTimer = null;

function toast(msg){
  const text = String(msg||"");
  try{ if(navigator.vibrate) navigator.vibrate(14); }catch{}

  if(!toastEl){
    toastEl = document.createElement("div");
    toastEl.style.position="fixed";
    toastEl.style.left="50%";
    toastEl.style.top="14px";
    toastEl.style.transform="translateX(-50%)";
    toastEl.style.zIndex="999999";
    toastEl.style.padding="10px 14px";
    toastEl.style.borderRadius="999px";
    toastEl.style.border="1px solid rgba(255,255,255,0.14)";
    toastEl.style.background="rgba(0,0,0,0.70)";
    toastEl.style.backdropFilter="blur(12px)";
    toastEl.style.color="rgba(255,255,255,0.92)";
    toastEl.style.fontFamily="Outfit,system-ui,sans-serif";
    toastEl.style.fontWeight="900";
    toastEl.style.fontSize="12px";
    toastEl.style.opacity="0";
    toastEl.style.transition="opacity .15s ease";
    toastEl.style.pointerEvents="none";
    document.body.appendChild(toastEl);
  }

  toastEl.textContent = text;
  toastEl.style.opacity = "1";
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ if(toastEl) toastEl.style.opacity="0"; }, 1200);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

/* ===============================
   TIMER BADGES (both sides, top rotated)
================================ */
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

  timerTop = make();
  timerBot = make();

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
  inp.className="lang-search";
  inp.placeholder="Dil ara…";
  inp.autocomplete="off";
  inp.spellcheck=false;

  inp.style.width="calc(100% - 20px)";
  inp.style.margin="10px";
  inp.style.padding="10px 12px";
  inp.style.borderRadius="14px";
  inp.style.border="1px solid rgba(255,255,255,0.14)";
  inp.style.background="rgba(0,0,0,0.25)";
  inp.style.color="#fff";
  inp.style.fontWeight="900";
  inp.style.fontFamily="Outfit,system-ui,sans-serif";

  pop.insertBefore(inp, list);
  inp.addEventListener("input",()=>renderPop(side, inp.value));
  renderPop(side,"");
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
  const t = String(text||"").trim();
  if(!t) return;

  const now = Date.now();
  if(now - lastAudioAt < AUDIO_DEBOUNCE_MS) stopAudio();
  lastAudioAt = now;

  const lang = normalizeApiLang(langCode);

  const res = await fetch(`${API_BASE}/api/tts`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    credentials:"include",
    body: JSON.stringify({ text: t, lang, speaking_rate: 1, pitch: 0 })
  });

  if(!res.ok){ toast("🔇 TTS HTTP " + res.status); return; }
  const data = await res.json().catch(()=>null);
  if(!data?.ok || !data.audio_base64){ toast("🔇 TTS invalid"); return; }

  const bin = atob(data.audio_base64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);

  await playAudioBlob(new Blob([bytes], {type:"audio/mpeg"}));
}

/* ===============================
   COMMAND PARSE
================================ */
async function parseCommand(text){
  const t = String(text||"").trim();
  if(!t) return null;
  const r = await fetch(`${API_BASE}/api/command_parse`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, ui_lang: UI_LANG })
  });
  if(!r.ok) return null;
  return await r.json().catch(()=>null);
}

/* ===============================
   TRANSLATE (STRICT)
   NOTE: style:"fast" => chat vari cevap riskini keser
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
    body: JSON.stringify({
      text: t,
      from_lang: src,
      to_lang: dst,
      style: "fast",         // ✅ chat değil
      provider: "auto",
      strict: true,          // (backend ignore etse bile zarar yok)
      no_extra: true          // (backend ignore etse bile zarar yok)
    })
  });
  if(!r.ok) return null;
  const data = await r.json().catch(()=>null);
  return String(data?.translated||"").trim() || null;
}

/* ===============================
   LOCAL CLEAN (NO AI)
   - Chat hissini bitirir. Sadece düzenler.
================================ */
function localCleanSpeechText(text){
  let s = String(text||"").trim();
  if(!s) return s;

  // normalize spaces
  s = s.replace(/\s+/g, " ").trim();

  // remove repeated tiny fillers (çok abartmadan)
  s = s.replace(/\b(eee+|ııı+|umm+|hmm+)\b/gi, "").replace(/\s+/g, " ").trim();

  // basic punctuation
  if(!/[.!?…]$/.test(s)) s += ".";

  // capitalize first letter (Latin)
  s = s.charAt(0).toUpperCase() + s.slice(1);

  return s.trim();
}

/* ===============================
   STT (MediaRecorder -> /api/stt)
================================ */
function pickMime(){
  const cands = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/ogg"];
  for(const m of cands){
    try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch{}
  }
  return "";
}

async function sttBlob(blob, lang){
  const fd = new FormData();
  fd.append("file", blob, "speech.webm");
  fd.append("lang", lang);

  const r = await fetch(`${API_BASE}/api/stt`, { method:"POST", body: fd });
  if(!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return String(j.text || "").trim();
}

/* ===============================
   TYPEWRITER
================================ */
async function typeWriter(el, text, speed=TYPE_SPEED_MS){
  el.textContent = "";
  const s = String(text||"");
  for(let i=0;i<s.length;i++){
    el.textContent += s[i];
    try{
      const wrap = el.closest?.(".chat-body");
      if(wrap) wrap.scrollTop = wrap.scrollHeight;
    }catch{}
    await sleep(speed);
  }
}

/* ===============================
   BUBBLES + SPEAKER
================================ */
function clearLatestTranslated(side){
  const wrap = (side==="top") ? $("topBody") : $("botBody");
  if(!wrap) return;
  wrap.querySelectorAll(".bubble.me.is-latest").forEach(el=>el.classList.remove("is-latest"));
}

function makeSpeakerIcon(onClick){
  const btn = document.createElement("div");
  btn.className="spk-icon";
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89 0 5.23 2.34 5.23 5.23S16.89 15.75 14 15.75v2.06c4.02 0 7.29-3.27 7.29-7.29S18.02 3.23 14 3.23z"/>
    </svg>`;
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
    bubble.appendChild(makeSpeakerIcon(()=> speakLocal(text, opts.speakLang||"en")));
  }

  const txt = document.createElement("span");
  txt.className="txt";
  txt.textContent = String(text||"").trim() || "—";
  bubble.appendChild(txt);

  wrap.appendChild(bubble);
  try{ wrap.scrollTop = wrap.scrollHeight; }catch{}
  return { txt, bubble };
}

/* ===============================
   LIVE TEXT (during recording)
================================ */
function commonPrefixLen(a,b){
  const n = Math.min(a.length,b.length);
  let i=0;
  for(; i<n; i++){
    if(a[i] !== b[i]) break;
  }
  return i;
}
function mergeLiveText(oldText, newText){
  const a = String(oldText||"");
  const b = String(newText||"");
  if(!a) return b;
  if(!b) return a;
  const k = commonPrefixLen(a, b);
  if(k >= Math.min(20, a.length, b.length)) return b;
  if(a.includes(b)) return a;
  if(b.includes(a)) return b;
  return (a + " " + b).trim();
}

/* ===============================
   RECORD TOGGLE (CLICK START/STOP)
================================ */
let recJob = null;           // { stream, mr, chunks, hardTimer, tickTimer, liveTimer }
let recSide = null;
let liveNode = null;         // { txt, bubble }
let liveText = "";
let liveLastSentAt = 0;

async function startRecording(which){
  if(recJob) return;

  closeAllPop();
  const ok = await ensureFacetofaceSession();
  if(!ok) return;

  recSide = which;
  active = which;
  lastMicSide = which;

  setCenterDirection(which);
  setFrameState("listening", which);
  setPhase("recording");
  setMicUI(which, true);

  toast("🎙️ Kayıt başladı (tekrar bas → bitir)");

  liveNode = addBubble(which, "them", "…");
  liveText = "";
  liveLastSentAt = 0;

  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  const mime = pickMime();
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

  const chunks = [];
  mr.ondataavailable = (e)=>{ if(e.data && e.data.size) chunks.push(e.data); };
  mr.start(250);

  const startedAt = Date.now();
  ensureTimerBadges();

  const tickTimer = setInterval(()=>{
    const left = MAX_RECORD_MS - (Date.now() - startedAt);
    setTimerBadges(left);
  }, 250);

  const hardTimer = setTimeout(()=>{
    stopAndProcess();
  }, MAX_RECORD_MS);

  const liveTimer = setInterval(async ()=>{
    if(!recJob) return;
    if(Date.now() - liveLastSentAt < LIVE_STT_EVERY_MS - 50) return;
    liveLastSentAt = Date.now();

    if(chunks.length < 2) return;
    const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
    const srcLang = (which==="top") ? topLang : botLang;

    try{
      const text = await sttBlob(blob, normalizeApiLang(srcLang));
      if(text){
        liveText = mergeLiveText(liveText, text);
        if(liveNode?.txt) liveNode.txt.textContent = liveText;
      }
    }catch{}
  }, LIVE_STT_EVERY_MS);

  recJob = { stream, mr, chunks, hardTimer, tickTimer, liveTimer };
}

async function stopAndProcess(){
  if(!recJob) return;

  const which = recSide;

  try{ clearTimeout(recJob.hardTimer); }catch{}
  try{ clearInterval(recJob.tickTimer); }catch{}
  try{ clearInterval(recJob.liveTimer); }catch{}
  setTimerBadges(null);

  try{ recJob.stream.getTracks().forEach(t=>t.stop()); }catch{}
  try{ recJob.mr.stop(); }catch{}

  const blob = new Blob(recJob.chunks, { type: recJob.mr.mimeType || "audio/webm" });

  recJob = null;
  recSide = null;

  setMicUI(which, false);
  setFrameState("idle", lastMicSide);

  if(!blob || blob.size < 800){
    toast("Ses alınamadı");
    setPhase("idle");
    updateMicLocks();
    return;
  }

  setPhase("translating");

  const src = (which==="top") ? topLang : botLang;
  const dst = (which==="top") ? botLang : topLang;
  const other = otherSide(which);

  let text = "";
  try{
    text = await sttBlob(blob, normalizeApiLang(src));
  }catch(e){
    console.warn(e);
    toast("STT çalışmadı");
    setPhase("idle");
    updateMicLocks();
    return;
  }

  if(!text){
    toast("Metin çıkmadı");
    setPhase("idle");
    updateMicLocks();
    return;
  }

  // ✅ komut kontrolü RAW metinden (düzeltmeden önce)
  const cmd = await parseCommand(text);
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
    setPhase("idle");
    updateMicLocks();
    return;
  }

  // ✅ LOCAL temizle (AI yok)
  const cleaned = localCleanSpeechText(text);

  try{
    if(liveNode?.txt) liveNode.txt.textContent = cleaned;
  }catch{}
  liveNode = null;
  liveText = "";

  const translated = await translateViaApi(cleaned, src, dst);
  if(!translated){
    addBubble(other, "me", "⚠️ Çeviri yapılamadı.");
    setPhase("idle");
    updateMicLocks();
    return;
  }

  clearLatestTranslated(other);
  const node = addBubble(other, "me", "", { latest:true, speakable:true, speakLang:dst });
  if(node?.txt) await typeWriter(node.txt, translated, TYPE_SPEED_MS);

  setCenterDirection(other);
  setFrameState("speaking", other);
  setPhase("speaking");

  await speakLocal(translated, dst);

  setFrameState("idle", lastMicSide);
  setPhase("idle");
  updateMicLocks();
}

/* ===============================
   BINDINGS
================================ */
function bindUI(){
  $("homeBtn")?.addEventListener("click", ()=> location.href = HOME_PATH);
  $("homeLink")?.addEventListener("click", ()=> location.href = HOME_PATH);

  $("clearBtn")?.addEventListener("click", ()=>{
    stopAudio();

    if(recJob){
      try{ clearTimeout(recJob.hardTimer); }catch{}
      try{ clearInterval(recJob.tickTimer); }catch{}
      try{ clearInterval(recJob.liveTimer); }catch{}
      try{ recJob.stream.getTracks().forEach(t=>t.stop()); }catch{}
      try{ recJob.mr.stop(); }catch{}
      recJob = null;
      recSide = null;
    }

    setTimerBadges(null);
    liveNode = null;
    liveText = "";

    if($("topBody")) $("topBody").innerHTML="";
    if($("botBody")) $("botBody").innerHTML="";

    setMicUI("top",false);
    setMicUI("bot",false);
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

  $("topMic")?.addEventListener("click", async (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(recJob) return await stopAndProcess();
    return await startRecording("top");
  });

  $("botMic")?.addEventListener("click", async (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(recJob) return await stopAndProcess();
    return await startRecording("bot");
  });
}

/* ===============================
   BOOT
================================ */
document.addEventListener("DOMContentLoaded", async ()=>{
  if($("topLangTxt")) $("topLangTxt").textContent = labelChip(topLang);
  if($("botLangTxt")) $("botLangTxt").textContent = labelChip(botLang);

  setCenterDirection("bot");
  setFrameState("idle", "bot");

  bindUI();

  await checkLoginOnce();
  updateMicLocks();
});
