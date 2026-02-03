// FILE: italky-web/js/italky_chat_page.js
// Italky Chat Page Controller (Gemini backend - text only)
// ✅ STT -> auto-send (no enter needed)
// ✅ No TTS here (no sound)
// ✅ No photo/document here (chat = text only)
// ✅ Fix: STT final text is sent directly (no timing/empty bug)

import { BASE_DOMAIN, STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }

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
    if(fallback) fallback.textContent = (full && full[0]) ? full[0].toUpperCase() : "•";
  }

  avatarBtn?.addEventListener("click", ()=> location.href="/pages/profile.html");
  $("logoHome")?.addEventListener("click", ()=> location.href="/pages/home.html");
  $("backBtn")?.addEventListener("click", ()=> location.href="/pages/home.html");
}

function chatKey(u){
  const uid = String(u.user_id || u.id || u.email || "guest").toLowerCase().trim();
  return `italky_chat_hist::${uid}`;
}

function loadHist(u){
  return safeJson(localStorage.getItem(chatKey(u)), []);
}

function saveHist(u, h){
  try{ localStorage.setItem(chatKey(u), JSON.stringify((h||[]).slice(-30))); }catch{}
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

function addBubble(role, text){
  const chat = $("chat");
  if(!chat) return;

  const d = document.createElement("div");
  d.className = `bubble ${role==="user" ? "user" : (role==="meta" ? "meta" : "bot")}`;
  function formatTextToParagraphs(text){
  const t = String(text||"").trim();

  // Zaten paragraf varsa dokunma
  if(t.includes("\n\n")) return t;

  // Cümle bazlı böl
  const parts = t.split(/([.!?…]+)/);
  let out = [];
  let buf = "";

  for(let i=0;i<parts.length;i+=2){
    buf += (parts[i] || "") + (parts[i+1] || "");
    if(buf.length > 280){
      out.push(buf.trim());
      buf = "";
    }
  }
  if(buf.trim()) out.push(buf.trim());

  return out.join("\n\n");
}

d.textContent = formatTextToParagraphs(text);
  chat.appendChild(d);

  scrollBottom(false);
}

function typingBubble(){
  const chat = $("chat");
  if(!chat) return null;

  const d = document.createElement("div");
  d.className = "bubble bot";
  d.textContent = "…";
  chat.appendChild(d);

  scrollBottom(false);
  return d;
}

async function apiChat(u, text, history){
  const base = String(BASE_DOMAIN||"").replace(/\/+$/,"");
  const url = `${base}/api/chat`;

  const body = {
    user_id: (u.user_id || u.id || u.email),
    text,
    history: (history || []).slice(-20),
    user_meta: {
      fullname: u.fullname || u.name || u.display_name || "",
      plan: u.plan || "FREE",
      product: "italkyAI",
    }
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

function autoGrow(){
  const ta = $("msgInput");
  if(!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
}

let sttBusy = false;

/**
 * STT:
 * - Konuşma bittiğinde tek sefer finalText üretir.
 * - FinalText direkt sendText(finalText) ile gönderilir.
 */
function startSTT(onFinalText){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert("Bu cihaz konuşmayı yazıya çevirmiyor."); return; }
  if(sttBusy) return;

  const micBtn = $("micBtn");
  const ta = $("msgInput");

  const rec = new SR();
  rec.lang = "tr-TR";
  rec.interimResults = false;
  rec.continuous = false;

  sttBusy = true;
  micBtn?.classList.add("listening");

  let finalText = "";

  rec.onresult = (e)=>{
    finalText = String(e.results?.[0]?.[0]?.transcript || "").trim();
    if(finalText){
      // kullanıcı görsün diye textarea'ya da basıyoruz
      if(ta){
        ta.value = finalText;
        autoGrow();
      }
    }
  };

  rec.onerror = ()=>{};

  rec.onend = ()=>{
    micBtn?.classList.remove("listening");
    sttBusy = false;

    const t = String(finalText || "").trim();
    if(t && typeof onFinalText === "function"){
      onFinalText(t);
    }
  };

  try{ rec.start(); }
  catch{
    micBtn?.classList.remove("listening");
    sttBusy = false;
  }
}

async function main(){
  const u = ensureLogged();
  if(!u) return;

  paintHeader(u);

  const chat = $("chat");
  chat?.addEventListener("scroll", ()=>{ follow = isNearBottom(chat); }, { passive:true });

  // history load
  const hist = loadHist(u);
  if(chat) chat.innerHTML = "";

  if(!hist.length){
    addBubble("meta", "italkyAI • Bu alan yazılı bilgi içindir. Mikrofon konuşmanı yazıya çevirir ve otomatik gönderir.");
  }else{
    hist.forEach(m=> addBubble(m.role, m.text));
  }

  follow = true;
  scrollBottom(true);

  /**
   * Tek kaynak gönderim: her yer burayı çağırır
   */
  async function sendText(text){
    const t = String(text||"").trim();
    if(!t) return;

    // textarea temizle (STT’den geldiyse de temizle)
    const ta = $("msgInput");
    if(ta){
      ta.value = "";
      autoGrow();
    }

    const h = loadHist(u);

    addBubble("user", t);
    h.push({ role:"user", text: t });

    const loader = typingBubble();

    try{
      const out = await apiChat(u, t, h.map(x=>({ role:x.role, content:x.text })));
      try{ loader?.remove(); }catch{}
      addBubble("assistant", out);
      h.push({ role:"assistant", text: out });
      saveHist(u, h);
    }catch{
      try{ loader?.remove(); }catch{}
      const msg = "Şu an cevap veremedim. Bir daha dener misin?";
      addBubble("assistant", msg);
      h.push({ role:"assistant", text: msg });
      saveHist(u, h);
    }

    scrollBottom(false);
  }

  // Send btn: manual
  $("sendBtn")?.addEventListener("click", ()=>{
    const ta = $("msgInput");
    sendText(String(ta?.value || ""));
  });

  // Keyboard send
  $("msgInput")?.addEventListener("input", autoGrow);
  $("msgInput")?.addEventListener("keydown",(e)=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault();
      const ta = $("msgInput");
      sendText(String(ta?.value || ""));
    }
  });

  // ✅ Mic => STT => auto-send (finalText direkt)
  $("micBtn")?.addEventListener("click", ()=>{
    startSTT((finalText)=> sendText(finalText));
  });

  // küçük bilgi butonu (varsa)
  $("helpBtn")?.addEventListener("click", ()=>{
    addBubble("meta", "İpucu: Mikrofon konuşmanı yazıya çevirir ve otomatik gönderir. Bu sayfada sesli cevap yok.");
  });

  autoGrow();
}

document.addEventListener("DOMContentLoaded", main);
