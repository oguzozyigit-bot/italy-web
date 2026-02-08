// FILE: italky-web/js/facetoface_page.js
import { BASE_DOMAIN } from "/js/config.js";

const $ = (id)=>document.getElementById(id);
function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }

/* ✅ Dil listesi + bayrak + TTS locale */
const LANGS = [
  { code:"tr", name:"Türkçe", flag:"🇹🇷", bcp:"tr-TR" },
  { code:"en", name:"İngilizce", flag:"🇬🇧", bcp:"en-US" },
  { code:"de", name:"Almanca", flag:"🇩🇪", bcp:"de-DE" },
  { code:"fr", name:"Fransızca", flag:"🇫🇷", bcp:"fr-FR" },
  { code:"it", name:"İtalyanca", flag:"🇮🇹", bcp:"it-IT" },
  { code:"es", name:"İspanyolca", flag:"🇪🇸", bcp:"es-ES" },
  { code:"pt", name:"Portekizce", flag:"🇵🇹", bcp:"pt-PT" },
  { code:"pt-br", name:"Portekizce (Brezilya)", flag:"🇧🇷", bcp:"pt-BR" },

  { code:"nl", name:"Felemenkçe", flag:"🇳🇱", bcp:"nl-NL" },
  { code:"sv", name:"İsveççe", flag:"🇸🇪", bcp:"sv-SE" },
  { code:"no", name:"Norveççe", flag:"🇳🇴", bcp:"nb-NO" },
  { code:"da", name:"Danca", flag:"🇩🇰", bcp:"da-DK" },
  { code:"fi", name:"Fince", flag:"🇫🇮", bcp:"fi-FI" },

  { code:"pl", name:"Lehçe", flag:"🇵🇱", bcp:"pl-PL" },
  { code:"cs", name:"Çekçe", flag:"🇨🇿", bcp:"cs-CZ" },
  { code:"sk", name:"Slovakça", flag:"🇸🇰", bcp:"sk-SK" },
  { code:"hu", name:"Macarca", flag:"🇭🇺", bcp:"hu-HU" },
  { code:"ro", name:"Romence", flag:"🇷🇴", bcp:"ro-RO" },
  { code:"bg", name:"Bulgarca", flag:"🇧🇬", bcp:"bg-BG" },
  { code:"el", name:"Yunanca", flag:"🇬🇷", bcp:"el-GR" },

  { code:"ru", name:"Rusça", flag:"🇷🇺", bcp:"ru-RU" },
  { code:"uk", name:"Ukraynaca", flag:"🇺🇦", bcp:"uk-UA" },
  { code:"sr", name:"Sırpça", flag:"🇷🇸", bcp:"sr-RS" },
  { code:"hr", name:"Hırvatça", flag:"🇭🇷", bcp:"hr-HR" },
  { code:"bs", name:"Boşnakça", flag:"🇧🇦", bcp:"bs-BA" },
  { code:"sq", name:"Arnavutça", flag:"🇦🇱", bcp:"sq-AL" },

  { code:"ar", name:"Arapça", flag:"🇸🇦", bcp:"ar-SA" },
  { code:"fa", name:"Farsça", flag:"🇮🇷", bcp:"fa-IR" },
  { code:"ur", name:"Urduca", flag:"🇵🇰", bcp:"ur-PK" },
  { code:"hi", name:"Hintçe", flag:"🇮🇳", bcp:"hi-IN" },
  { code:"bn", name:"Bengalce", flag:"🇧🇩", bcp:"bn-BD" },
  { code:"ta", name:"Tamilce", flag:"🇮🇳", bcp:"ta-IN" },
  { code:"te", name:"Teluguca", flag:"🇮🇳", bcp:"te-IN" },

  { code:"th", name:"Tayca", flag:"🇹🇭", bcp:"th-TH" },
  { code:"vi", name:"Vietnamca", flag:"🇻🇳", bcp:"vi-VN" },
  { code:"id", name:"Endonezce", flag:"🇮🇩", bcp:"id-ID" },
  { code:"ms", name:"Malayca", flag:"🇲🇾", bcp:"ms-MY" },

  { code:"zh", name:"Çince", flag:"🇨🇳", bcp:"zh-CN" },
  { code:"zh-tw", name:"Çince (Geleneksel)", flag:"🇹🇼", bcp:"zh-TW" },
  { code:"ja", name:"Japonca", flag:"🇯🇵", bcp:"ja-JP" },
  { code:"ko", name:"Korece", flag:"🇰🇷", bcp:"ko-KR" },
  { code:"he", name:"İbranice", flag:"🇮🇱", bcp:"he-IL" },
];

let topLang = "en";
let botLang = "tr";

function langName(code){ return LANGS.find(x=>x.code===code)?.name || code; }
function langFlag(code){ return LANGS.find(x=>x.code===code)?.flag || "🌐"; }
function bcp(code){ return LANGS.find(x=>x.code===code)?.bcp || "en-US"; }

/* ===== Speech (TTS) ===== */
const mute = { top:false, bot:false };

function setMute(side, on){
  mute[side] = !!on;
  const btn = (side === "top") ? $("topSpeak") : $("botSpeak");
  btn?.classList.toggle("muted", mute[side]);
}

function speak(text, langCode, side){
  if(mute[side]) return;
  const t = String(text||"").trim();
  if(!t) return;
  if(!("speechSynthesis" in window)) return;

  try{
    const u = new SpeechSynthesisUtterance(t);
    u.lang = bcp(langCode);
    // aynı anda iki taraf okumaya kalkmasın
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{}
}

/* ===== bubbles ===== */
function addBubble(side, kind, text){
  const wrap = (side === "top") ? $("topBody") : $("botBody");
  if(!wrap) return;
  const b = document.createElement("div");
  b.className = `bubble ${kind}`; // kind: me/them
  b.textContent = String(text||"").trim() || "—";
  wrap.appendChild(b);
  wrap.scrollTop = wrap.scrollHeight;
}

function setMicUI(which, on){
  const btn = (which === "top") ? $("topMic") : $("botMic");
  btn?.classList.toggle("listening", !!on);
  $("frameRoot")?.classList.toggle("listening", !!on);
}

/* ===== Language sheet ===== */
let sheetFor = "bot"; // "top" | "bot"

function renderSheetList(){
  const list = $("sheetList");
  if(!list) return;

  const sel = (sheetFor === "top") ? topLang : botLang;

  list.innerHTML = LANGS.map(l => `
    <div class="sheetRow ${l.code===sel ? "selected":""}" data-code="${l.code}">
      <div class="left">
        <div class="flag">${l.flag}</div>
        <div class="name">${l.name}</div>
      </div>
      <div class="code">${l.code}</div>
    </div>
  `).join("");

  list.querySelectorAll(".sheetRow").forEach(row=>{
    row.addEventListener("click", ()=>{
      const code = row.getAttribute("data-code") || "en";

      if(sheetFor === "top"){
        topLang = code;
        $("topLangTxt").textContent = `${langFlag(topLang)} ${langName(topLang)}`;
      }else{
        botLang = code;
        $("botLangTxt").textContent = `${langFlag(botLang)} ${langName(botLang)}`;
      }

      stopAll();
      closeSheet();
    });
  });
}

function openSheet(which){
  sheetFor = which;

  const overlay = $("langSheet");
  if(!overlay) return;

  overlay.classList.toggle("fromTop", which === "top");
  overlay.classList.add("show");

  $("sheetTitle").textContent = (which === "top") ? "Üst Dil" : "Alt Dil";
  $("sheetQuery").value = "";
  renderSheetList();

  $("sheetQuery")?.focus?.();

  $("sheetQuery").oninput = ()=>{
    const q = ($("sheetQuery").value || "").toLowerCase().trim();
    overlay.querySelectorAll(".sheetRow").forEach(r=>{
      const code = (r.getAttribute("data-code")||"").toLowerCase();
      const nm = (r.querySelector(".name")?.textContent||"").toLowerCase();
      const show = !q || nm.includes(q) || code.includes(q);
      r.style.display = show ? "flex" : "none";
    });
  };
}

function closeSheet(){
  const overlay = $("langSheet");
  if(!overlay) return;
  overlay.classList.remove("show");
  overlay.classList.remove("fromTop");
}

/* ===== Back ===== */
function bindNav(){
  $("backBtn")?.addEventListener("click", ()=>{
    if(history.length > 1) history.back();
    else location.href="/pages/home.html";
  });
}

/* ===== Translate ===== */
async function translateViaApi(text, source, target){
  const b = base();
  if(!b) return text;

  const body = {
    text,
    source,
    target,
    from_lang: source,
    to_lang: target,
  };

  const r = await fetch(`${b}/api/translate`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });

  const data = await r.json().catch(()=> ({}));
  const out = String(
    data?.translated || data?.translation || data?.text || data?.translated_text || ""
  ).trim();

  return out || text;
}

/* ===== STT ===== */
let active = null;
let recTop = null;
let recBot = null;

function stopAll(){
  try{ recTop?.stop?.(); }catch{}
  try{ recBot?.stop?.(); }catch{}
  recTop = null; recBot = null;
  active = null;
  setMicUI("top", false);
  setMicUI("bot", false);
}

function buildRecognizer(langCode){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const rec = new SR();
  rec.lang = bcp(langCode);
  rec.interimResults = false;
  rec.continuous = false;
  return rec;
}

async function start(which){
  // Mikrofon HTTPS ister (localhost hariç)
  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    alert("Mikrofon için HTTPS gerekli. (Vercel/HTTPS kullan)");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert("Bu tarayıcı SpeechRecognition desteklemiyor (Chrome/Edge dene).");
    return;
  }

  if(active && active !== which) stopAll();

  const src = (which === "top") ? topLang : botLang;
  const dst = (which === "top") ? botLang : topLang;

  const rec = buildRecognizer(src);
  if(!rec){
    alert("Mikrofon başlatılamadı.");
    return;
  }

  active = which;
  setMicUI(which, true);

  rec.onresult = async (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    const finalText = String(t||"").trim();
    if(!finalText) return;

    // konuşanı kendi tarafına yaz (them)
    addBubble(which, "them", finalText);

    // çeviriyi karşı tarafa yaz (me)
    const other = (which === "top") ? "bot" : "top";
    try{
      const translated = await translateViaApi(finalText, src, dst);
      addBubble(other, "me", translated);

      // ✅ otomatik ses: çeviri hangi tarafa yazıldıysa o tarafın hoparlörü kontrol eder
      speak(translated, dst, other);
    }catch{
      // sessiz
    }
  };

  rec.onerror = ()=>{
    stopAll();
    alert("Mikrofon çalışmadı. Site ayarlarından mikrofonu Allow yap (Chrome: kilit simgesi).");
  };

  rec.onend = ()=>{
    setMicUI(which, false);
    active = null;
  };

  if(which === "top") recTop = rec; else recBot = rec;

  try{ rec.start(); }
  catch{
    stopAll();
    alert("Mikrofon başlatılamadı.");
  }
}

/* ===== Buttons ===== */
function bindLangButtons(){
  $("topLangBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSheet("top"); });
  $("botLangBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSheet("bot"); });

  $("sheetClose")?.addEventListener("click", closeSheet);
  $("langSheet")?.addEventListener("click", (e)=>{
    if(e.target === $("langSheet")) closeSheet();
  });
}

function bindMicButtons(){
  $("topMic")?.addEventListener("click", (e)=>{
    e.preventDefault();
    if(active === "top") stopAll();
    else start("top");
  });

  $("botMic")?.addEventListener("click", (e)=>{
    e.preventDefault();
    if(active === "bot") stopAll();
    else start("bot");
  });

  // ✅ hoparlör = mute toggle
  $("topSpeak")?.addEventListener("click", ()=> setMute("top", !mute.top));
  $("botSpeak")?.addEventListener("click", ()=> setMute("bot", !mute.bot));

  // default: açık
  setMute("top", false);
  setMute("bot", false);
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("topLangTxt").textContent = `${langFlag(topLang)} ${langName(topLang)}`;
  $("botLangTxt").textContent = `${langFlag(botLang)} ${langName(botLang)}`;

  bindNav();
  bindLangButtons();
  bindMicButtons();
});
