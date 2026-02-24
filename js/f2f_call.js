// FILE: /js/f2f_call.js
import { LANG_POOL } from "/js/lang_pool_full.js";
import { STORAGE_KEY } from "/js/config.js";
import { shortDisplayName } from "/js/ui_shell.js";

const API_BASE = "https://italky-api.onrender.com";
const $ = (id)=>document.getElementById(id);

const params = new URLSearchParams(location.search);
const room = (params.get("room")||"").trim().toUpperCase();
const role = (params.get("role")||"").trim().toLowerCase();

let myLang = (params.get("me_lang")||localStorage.getItem("f2f_my_lang")||"tr").trim().toLowerCase();
localStorage.setItem("f2f_my_lang", myLang);

const LANGS = Array.isArray(LANG_POOL) ? LANG_POOL : [
  { code:"tr", flag:"🇹🇷", name:"Türkçe" },
  { code:"en", flag:"🇬🇧", name:"English" },
];

function norm(code){ return String(code||"").toLowerCase().trim(); }

function getProfileFromCache(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { name:"Kullanıcı", picture:"" };
    const u = JSON.parse(raw);
    const full = u.display_name || u.full_name || u.name || "";
    const name = shortDisplayName(full || "Kullanıcı");
    const picture = u.picture || u.avatar || u.avatar_url || "";
    return { name, picture };
  }catch{
    return { name:"Kullanıcı", picture:"" };
  }
}
const MY = getProfileFromCache();

/* ===== UI refs ===== */
const chat = $("chat");
const msgInput = $("msgInput");
const micBtn = $("micBtn");
const sendBtn = $("sendBtn");
const langSelect = $("langSelect");
const peopleScroll = $("peopleScroll");
const peopleCount = $("peopleCount");

/* ===== language select ===== */
(function initLangSelect(){
  langSelect.innerHTML = LANGS.map(l=>{
    const c = norm(l.code);
    const label = `${l.flag||"🌐"} ${l.name||c.toUpperCase()}`;
    return `<option value="${c}">${label}</option>`;
  }).join("");
  langSelect.value = myLang;
  langSelect.addEventListener("change", ()=>{
    myLang = norm(langSelect.value);
    localStorage.setItem("f2f_my_lang", myLang);
  });
})();

/* ===== exit confirm ===== */
const I18N = {
  tr: { confirm:"Sohbetten çıkmak istiyor musunuz?" },
  en: { confirm:"Do you want to leave the chat?" },
  de: { confirm:"Möchten Sie den Chat verlassen?" },
  fr: { confirm:"Voulez-vous quitter le chat ?" },
  es: { confirm:"¿Quieres salir del chat?" },
  it: { confirm:"Vuoi uscire dalla chat?" },
  ru: { confirm:"Выйти из чата?" },
  ar: { confirm:"هل تريد مغادرة الدردشة؟" },
};
function t(key){
  const pack = I18N[myLang] || I18N.en;
  return pack[key] || I18N.en[key] || "";
}
$("exitBtn").onclick = ()=>{
  const ok = confirm(t("confirm"));
  if(ok) location.href = "/pages/home.html";
};

/* ===== textarea grow + enter send ===== */
function growTA(){
  msgInput.style.height = "0px";
  const h = Math.min(120, msgInput.scrollHeight);
  msgInput.style.height = h + "px";
  chat.scrollTop = chat.scrollHeight;
}
msgInput.addEventListener("input", growTA);
setTimeout(growTA, 0);

msgInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    sendTyped();
  }
});

/* ===== participants strip (seen users) ===== */
const participants = new Map(); // id -> {name,picture}
function nameChip(n){
  const s = String(n||"").trim();
  if(!s) return "•";
  return s.replace(/\s+([A-ZÇĞİÖŞÜ])\./, ".$1").replace(/\s+/g," ");
}
function upsertParticipant(id, name, picture){
  if(!id) return;
  if(!participants.has(id)){
    participants.set(id, { name: name || "User", picture: picture || "" });
  }else{
    const p = participants.get(id);
    p.name = name || p.name;
    p.picture = picture || p.picture;
  }
  renderParticipants();
}
function renderParticipants(){
  peopleScroll.innerHTML = "";
  for(const [id,p] of participants.entries()){
    const item = document.createElement("div");
    item.className = "pItem";

    const av = document.createElement("div");
    av.className = "pAvatar";
    if(p.picture){
      const img = document.createElement("img");
      img.src = p.picture;
      img.referrerPolicy = "no-referrer";
      av.appendChild(img);
    }else{
      av.textContent = (String(p.name||"•")[0]||"•").toUpperCase();
    }

    const nm = document.createElement("div");
    nm.className = "pName";
    nm.textContent = nameChip(p.name);

    item.appendChild(av);
    item.appendChild(nm);
    peopleScroll.appendChild(item);
  }
  peopleCount.textContent = String(participants.size);
}

/* self */
const clientId = (crypto?.randomUUID?.() || ("c_" + Math.random().toString(16).slice(2))).slice(0,18);
upsertParticipant(clientId, MY.name, MY.picture);

/* ===== HARD RULES (no OpenAI/Gemini names + identity lock) ===== */
function stripForbidden(text){
  let s = String(text||"");
  // asla görünmesin
  const bad = [/openai/ig, /gemini/ig, /chatgpt/ig, /gpt[- ]?\d+/ig];
  for(const re of bad) s = s.replace(re, "");
  return s.replace(/\s{2,}/g," ").trim();
}

function isIdentityQuestionTR(text){
  const s = String(text||"").toLowerCase();
  return (
    s.includes("sen kimsin") ||
    s.includes("seni kim yaratt") ||
    s.includes("seni kim yaptı") ||
    s.includes("senin programcın") ||
    s.includes("programcın kim") ||
    s.includes("seni kim yazdı") ||
    s.includes("hangi model") ||
    s.includes("openai") ||
    s.includes("gemini") ||
    s.includes("chatgpt")
  );
}

function identityAnswer(){
  // kilitli cevap
  return "Ben italky Academy tarafından geliştirildim. Programcım Oğuz Özyiğit.";
}

/* ===== ECHO KILLER (çok sert) =====
   Server senin mesajını farklı biçimde geri yolluyor olabilir.
   Bu yüzden sadece “exact değil”, benzerlik de yakalayıp kesiyoruz.
*/
function tokenize(s){
  return String(s||"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu," ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 60);
}
function jaccard(a,b){
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if(A.size===0 || B.size===0) return 0;
  let inter=0;
  for(const x of A) if(B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter/uni : 0;
}

const sentLog = []; // {text, lang, t}
function rememberSent(text, lang){
  sentLog.push({ text:String(text||"").trim(), lang:norm(lang), t:Date.now() });
  // 30 saniyelik tut
  const now = Date.now();
  while(sentLog.length && (now - sentLog[0].t > 30000)) sentLog.shift();
}

function isEcho(msgText, msgLang, msgFrom, msgFromName){
  const txt = String(msgText||"").trim();
  const lang = norm(msgLang||"");
  const from = String(msgFrom||"").trim();
  const fromName = String(msgFromName||"").trim().toLowerCase();
  const myName = String(MY.name||"").trim().toLowerCase();

  // 1) from eşleşirse kesin echo
  if(from && from === clientId) return true;

  // 2) isim eşleşirse büyük ihtimal echo (backend from’u bozuyorsa)
  if(fromName && myName && fromName === myName) return true;

  // 3) son 30 sn içinde gönderdiğim mesajlarla benzerlik
  for(const it of sentLog){
    // çok yakın zamanda geldiyse ve benzerlik yüksekse echo kabul
    const sim = jaccard(it.text, txt);
    if(sim >= 0.72) return true;

    // dil farklı olsa bile aynı cümle “çevirilmiş echo” olabilir:
    // yine sim 0.55 üstüyse ve 8 sn içindeyse kes
    if(Date.now() - it.t < 8000 && sim >= 0.55) return true;
  }
  return false;
}

/* ===== WS ===== */
let ws = null;

function wsUrl(){
  return `${API_BASE.replace("https://","wss://")}/api/f2f/ws/${room}`;
}

function connect(){
  if(!room) return;

  ws = new WebSocket(wsUrl());
  ws.onopen = ()=>{
    ws.send(JSON.stringify({
      type:"hello",
      room,
      role,
      from: clientId,
      from_name: MY.name,
      from_pic: MY.picture || "",
      me_lang: myLang
    }));
  };

  ws.onmessage = async (ev)=>{
    let msg=null;
    try{ msg = JSON.parse(ev.data); }catch{ return; }

    // Sadece user mesajlarını al: translated
    if(msg.type !== "translated") return;

    const from = String(msg.from||"").trim();
    const srcLang = norm(msg.lang || "en");
    let raw = String(msg.text || "").trim();
    const fromName = String(msg.from_name || "Katılımcı").trim();
    const fromPic  = String(msg.from_pic || "").trim();

    if(!raw) return;

    // ✅ yasak kelime süpür
    raw = stripForbidden(raw);
    if(!raw) return;

    // ✅ AI/bot/server mesajlarını tamamen reddet
    const lowerName = fromName.toLowerCase();
    if(lowerName.includes("ai") || lowerName.includes("bot") || lowerName.includes("assistant") || lowerName.includes("server")){
      return;
    }

    // ✅ echo killer: burada AI hissi bitiyor
    if(isEcho(raw, srcLang, from, fromName)) return;

    upsertParticipant(from || ("p_"+fromName), fromName, fromPic);

    // Solda: benim dilimde göster
    let shown = raw;
    if(srcLang && myLang && srcLang !== myLang){
      const tr = await translateAI(raw, srcLang, myLang);
      if(tr) shown = stripForbidden(tr);
    }

    if(!shown) return;

    addMessage("left", fromName, fromPic, shown);
    await speakViaTTS(shown, myLang);
  };
}
connect();

/* ===== chat bubbles ===== */
function addMessage(side, name, pic, text){
  const row = document.createElement("div");
  row.className = "msgRow " + (side === "right" ? "right" : "left");

  const av = document.createElement("div");
  av.className = "msgAvatar";
  if(pic){
    const img = document.createElement("img");
    img.src = pic;
    img.referrerPolicy = "no-referrer";
    av.appendChild(img);
  }else{
    av.textContent = (String(name||"•")[0]||"•").toUpperCase();
  }

  const wrap = document.createElement("div");
  wrap.className = "bubbleWrap";

  const nm = document.createElement("div");
  nm.className = "nameLine";
  nm.textContent = name || "";
  wrap.appendChild(nm);

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (side === "right" ? "user" : "bot");
  bubble.textContent = text;

  wrap.appendChild(bubble);

  row.appendChild(av);
  row.appendChild(wrap);

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

/* ===== API ===== */
async function translateAI(text, from, to){
  const res = await fetch(`${API_BASE}/api/translate_ai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text, from_lang: from, to_lang: to, style:"chat", provider:"auto" })
  });
  if(!res.ok) return null;
  const data = await res.json().catch(()=>null);
  return data?.translated ? String(data.translated) : null;
}

let audioObj=null, lastAudioAt=0;
function stopAudio(){
  try{ if(audioObj){ audioObj.pause(); audioObj.currentTime=0; } }catch{}
  audioObj=null;
}
async function speakViaTTS(text, lang){
  const now = Date.now();
  if(now - lastAudioAt < 250) stopAudio();
  lastAudioAt = now;

  const res = await fetch(`${API_BASE}/api/tts`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text, lang, speaking_rate: 1, pitch: 0 })
  });
  if(!res.ok) return;

  const data = await res.json().catch(()=>null);
  if(!data?.ok || !data.audio_base64) return;

  const binary = atob(data.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const blob = new Blob([bytes], {type:"audio/mpeg"});
  const url = URL.createObjectURL(blob);

  stopAudio();
  audioObj = new Audio(url);
  audioObj.onended = ()=>URL.revokeObjectURL(url);
  audioObj.onerror = ()=>URL.revokeObjectURL(url);
  await audioObj.play();
}

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
  return String(j.text||"").trim();
}
async function cleanSpeechText(text, lang){
  const t = String(text||"").trim();
  if(!t) return t;
  const r = await fetch(`${API_BASE}/api/translate_ai`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ text: t, from_lang: lang, to_lang: lang, style:"chat", provider:"auto" })
  });
  if(!r.ok) return t;
  const data = await r.json().catch(()=>null);
  return String(data?.translated||"").trim() || t;
}

/* ===== SEND typed ===== */
async function sendTyped(){
  let raw = String(msgInput.value||"").trim();
  if(!raw) return;

  msgInput.value = "";
  growTA();

  // ✅ kimlik sorusu geldiyse: sabit cevap (kilit)
  if(isIdentityQuestionTR(raw)){
    raw = identityAnswer();
  }

  raw = stripForbidden(raw);
  if(!raw) return;

  const cleaned = stripForbidden(await cleanSpeechText(raw, myLang));

  // benim mesajım sağda
  addMessage("right", MY.name, MY.picture, cleaned);

  // echo engel
  rememberSent(cleaned, myLang);

  // odaya gönder
  if(ws && ws.readyState === 1){
    ws.send(JSON.stringify({
      type:"translated",
      from: clientId,
      from_name: MY.name,
      from_pic: MY.picture || "",
      text: cleaned,
      lang: myLang
    }));
  }
}
sendBtn.addEventListener("click", sendTyped);

/* ===== MIC toggle ===== */
let recJob=null, isBusy=false;

async function startRecord(){
  if(isBusy) return;
  isBusy=true;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks=[];
    mr.ondataavailable = (e)=>{ if(e.data && e.data.size) chunks.push(e.data); };
    mr.start(250);
    const timer = setTimeout(()=> stopRecord(), 20000);
    recJob = { stream, mr, chunks, timer };
    micBtn.classList.add("listening");
  }catch{}
  finally{ isBusy=false; }
}

async function stopRecord(){
  if(!recJob || isBusy) return;
  isBusy=true;
  try{
    clearTimeout(recJob.timer);
    try{ recJob.stream.getTracks().forEach(t=>t.stop()); }catch{}
    try{ recJob.mr.stop(); }catch{}
    micBtn.classList.remove("listening");

    const blob = new Blob(recJob.chunks, { type: recJob.mr.mimeType || "audio/webm" });
    recJob=null;
    if(!blob || blob.size < 800) return;

    let raw = await sttBlob(blob, myLang);
    if(!raw) return;

    if(isIdentityQuestionTR(raw)){
      raw = identityAnswer();
    }

    raw = stripForbidden(raw);
    if(!raw) return;

    const cleaned = stripForbidden(await cleanSpeechText(raw, myLang));

    addMessage("right", MY.name, MY.picture, cleaned);
    rememberSent(cleaned, myLang);

    if(ws && ws.readyState === 1){
      ws.send(JSON.stringify({
        type:"translated",
        from: clientId,
        from_name: MY.name,
        from_pic: MY.picture || "",
        text: cleaned,
        lang: myLang
      }));
    }
  }catch{}
  finally{ isBusy=false; }
}

micBtn.addEventListener("click", ()=>{
  if(!recJob) return startRecord();
  return stopRecord();
});
