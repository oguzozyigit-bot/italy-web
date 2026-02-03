// FILE: italky-web/js/italky_chat_page.js
// Italky Chat Page Controller (Caynana chat UX -> Italky)
// ✅ Uses italky-api: POST {BASE_DOMAIN}/api/chat
// ✅ Simple local history per user (last 30)
// ✅ STT mic toggle -> fills textarea (send manually or Enter)
// ✅ Auto-grow textarea + chat bottom padding follows dock height
// ✅ Brand guard: "Seni kim yazdı?" -> Google DEMEZ

import { BASE_DOMAIN, STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);
function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function getUser(){
  return safeJson(localStorage.getItem(STORAGE_KEY), {});
}
function ensureLogged(){
  const u = getUser();
  if(!u || !u.email || !u.isSessionActive){
    location.replace("/index.html");
    return null;
  }
  return u;
}

function paintHeader(u){
  const full = (u.fullname || u.name || u.display_name || u.email || "—").trim();
  $("userName").textContent = full;
  $("userPlan").textContent = String(u.plan || "FREE").toUpperCase();

  const avatarBtn = $("avatarBtn");
  const fallback = $("avatarFallback");
  const pic = String(u.picture || u.avatar || u.avatar_url || "").trim();
  if(pic){
    avatarBtn.innerHTML = `<img src="${pic}" alt="avatar">`;
  }else{
    fallback.textContent = (full && full[0]) ? full[0].toUpperCase() : "•";
  }

  avatarBtn.addEventListener("click", ()=> location.href="/pages/profile.html");
  $("logoHome").addEventListener("click", ()=> location.href="/pages/home.html");
  $("backBtn").addEventListener("click", ()=> location.href="/pages/home.html");
}

function chatKey(u){
  const uid = String(u.user_id || u.id || u.email || "guest").toLowerCase().trim();
  return `italky_chat_hist::${uid}`;
}
function loadHist(u){
  return safeJson(localStorage.getItem(chatKey(u)), []);
}
function saveHist(u, h){
  try{ localStorage.setItem(chatKey(u), JSON.stringify(h.slice(-30))); }catch{}
}

function isNearBottom(el, slack=140){
  try{ return (el.scrollHeight - el.scrollTop - el.clientHeight) < slack; }
  catch{ return true; }
}

let follow = true;
function scrollBottom(force=false){
  const el = $("chat");
  if(!el) return;
  requestAnimationFrame(()=>{
    if(force || follow) el.scrollTop = el.scrollHeight;
  });
}

function bubble(role, text){
  const chat = $("chat");
  const d = document.createElement("div");
  d.className = `bubble ${role==="user" ? "user" : "bot"}`;
  d.textContent = String(text||"");
  chat.appendChild(d);
  scrollBottom(false);
}

function typing(){
  const chat = $("chat");
  const d = document.createElement("div");
  d.className = "bubble bot";
  d.textContent = "…";
  chat.appendChild(d);
  scrollBottom(false);
  return d;
}

/* ===== Brand guard (Google demesin) ===== */
function isBrandQuestion(t){
  const s = String(t||"").toLowerCase();
  return (
    s.includes("seni kim yazdı") ||
    s.includes("seni kim yaptı") ||
    s.includes("seni kim yarattı") ||
    s.includes("kimin ürünüsün") ||
    s.includes("kime aitsin") ||
    s.includes("kimin yapay zekasısın") ||
    s.includes("kimin yazılımısın")
  );
}
function brandAnswer(){
  return "Ben italkyAI’nin geliştirdiği dil yazılımıyım. Amacım konuşmayı, öğrenmeyi ve çeviriyi mümkün olduğunca pratik hale getirmek.";
}

/* ===== API ===== */
async function apiChat(u, text, history){
  const base = String(BASE_DOMAIN||"").replace(/\/+$/,"");
  const url = `${base}/api/chat`;

  const body = {
    user_id: (u.user_id || u.id || u.email),
    text,
    history: (history || []).slice(-20),
    // backend ignore etse bile sorun yok:
    user_meta: { app: "italkyAI", brand: "italkyAI" }
  };

  const r = await fetch(url,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });

  const raw = await r.text().catch(()=> "");
  if(!r.ok) throw new Error(raw || `HTTP ${r.status}`);
  let data = {};
  try{ data = JSON.parse(raw || "{}"); }catch{}
  const out = String(data.text || data.reply || data.answer || "").trim();
  return out || "…";
}

/* ===== Auto-grow + chat bottom offset ===== */
function autoGrow(){
  const ta = $("msgInput");
  if(!ta) return;

  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 120) + "px";

  // chat bottom padding: dock yüksekliği kadar
  const dock = document.querySelector(".input-dock");
  const chat = $("chat");
  if(dock && chat){
    const h = Math.ceil(dock.getBoundingClientRect().height || 74);
    chat.style.bottom = h + "px";
  }
}

/* ===== STT toggle ===== */
let _rec = null;
let _sttOn = false;

function stopSTT(){
  const micBtn = $("micBtn");
  try{ _rec && _rec.stop && _rec.stop(); }catch{}
  try{ _rec && _rec.abort && _rec.abort(); }catch{}
  _rec = null;
  _sttOn = false;
  micBtn?.classList.remove("listening");
}

function startSTT(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert("Bu cihaz konuşmayı yazıya çevirmiyor."); return; }

  const micBtn = $("micBtn");
  const ta = $("msgInput");

  // toggle: açıksa kapat
  if(_sttOn){
    stopSTT();
    return;
  }

  const rec = new SR();
  _rec = rec;
  _sttOn = true;

  // şimdilik TR; istersen site dili ayarına bağlarız
  rec.lang = "tr-TR";
  rec.interimResults = false;
  rec.continuous = false;

  micBtn?.classList.add("listening");

  rec.onresult = (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    if(t){
      ta.value = (ta.value ? ta.value + " " : "") + t;
      autoGrow();
    }
  };
  rec.onerror = ()=>{};
  rec.onend = ()=> stopSTT();

  try{ rec.start(); }
  catch{ stopSTT(); }
}

/* ===== Plus sheet ===== */
function bindPlusSheet(){
  const camBtn = $("camBtn");
  const plusSheet = $("plusSheet");
  const fileCamera = $("fileCamera");
  const filePhotos = $("filePhotos");
  const fileFiles  = $("fileFiles");

  const pickCamera = $("pickCamera");
  const pickPhotos = $("pickPhotos");
  const pickFiles  = $("pickFiles");

  function toggle(open){
    plusSheet.classList.toggle("show", !!open);
  }

  camBtn.addEventListener("click",(e)=>{
    e.preventDefault();
    toggle(!plusSheet.classList.contains("show"));
  });

  document.addEventListener("click",(e)=>{
    if(!plusSheet.classList.contains("show")) return;
    if(plusSheet.contains(e.target)) return;
    if(camBtn.contains(e.target)) return;
    toggle(false);
  }, true);

  pickCamera.onclick = ()=>{ toggle(false); fileCamera.click(); };
  pickPhotos.onclick = ()=>{ toggle(false); filePhotos.click(); };
  pickFiles.onclick  = ()=>{ toggle(false); fileFiles.click(); };
}

async function main(){
  const u = ensureLogged();
  if(!u) return;

  paintHeader(u);
  bindPlusSheet();

  const chat = $("chat");
  chat.addEventListener("scroll", ()=>{ follow = isNearBottom(chat); }, { passive:true });

  // load history
  const hist = loadHist(u);
  chat.innerHTML = "";
  hist.forEach(m=> bubble(m.role, m.text));
  follow = true;
  scrollBottom(true);

  // bind
  $("micBtn").addEventListener("click", startSTT);

  async function send(){
    const ta = $("msgInput");
    const text = String(ta.value||"").trim();
    if(!text) return;

    stopSTT();

    ta.value = "";
    autoGrow();

    const h = loadHist(u);
    bubble("user", text);
    h.push({ role:"user", text });

    // brand guard (API'ye gitmeden)
    if(isBrandQuestion(text)){
      const out = brandAnswer();
      bubble("assistant", out);
      h.push({ role:"assistant", text: out });
      saveHist(u, h);
      scrollBottom(false);
      return;
    }

    const loader = typing();

    try{
      const out = await apiChat(u, text, h.map(x=>({role:x.role, content:x.text})));
      try{ loader.remove(); }catch{}
      bubble("assistant", out);
      h.push({ role:"assistant", text: out });
      saveHist(u, h);
    }catch(e){
      try{ loader.remove(); }catch{}
      const fallback = "Şu an cevap veremedim. Bir daha dener misin?";
      bubble("assistant", fallback);
      h.push({ role:"assistant", text: fallback });
      saveHist(u, h);
    }

    scrollBottom(false);
  }

  $("sendBtn").addEventListener("click", send);
  $("msgInput").addEventListener("input", autoGrow);
  $("msgInput").addEventListener("keydown",(e)=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  // ilk ölçüm
  autoGrow();
}

document.addEventListener("DOMContentLoaded", main);
