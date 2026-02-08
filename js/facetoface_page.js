// FILE: italky-web/js/facetoface_page.js
import { BASE_DOMAIN } from "/js/config.js";

const $ = (id)=>document.getElementById(id);
function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }

// ✅ FULL LANGS (geniş + mümkün olduğunca eksiksiz)
const LANGS = [
  // --- Türkçe & Avrupa çekirdek ---
  { code:"tr", name:"Türkçe", flag:"🇹🇷", bcp:"tr-TR" },
  { code:"en", name:"English", flag:"🇬🇧", bcp:"en-US" },
  { code:"en-gb", name:"English (UK)", flag:"🇬🇧", bcp:"en-GB" },
  { code:"de", name:"Deutsch", flag:"🇩🇪", bcp:"de-DE" },
  { code:"fr", name:"Français", flag:"🇫🇷", bcp:"fr-FR" },
  { code:"it", name:"Italiano", flag:"🇮🇹", bcp:"it-IT" },
  { code:"es", name:"Español", flag:"🇪🇸", bcp:"es-ES" },
  { code:"pt", name:"Português", flag:"🇵🇹", bcp:"pt-PT" },
  { code:"pt-br", name:"Português (Brasil)", flag:"🇧🇷", bcp:"pt-BR" },
  { code:"nl", name:"Nederlands", flag:"🇳🇱", bcp:"nl-NL" },
  { code:"sv", name:"Svenska", flag:"🇸🇪", bcp:"sv-SE" },
  { code:"no", name:"Norsk (Bokmål)", flag:"🇳🇴", bcp:"nb-NO" },
  { code:"da", name:"Dansk", flag:"🇩🇰", bcp:"da-DK" },
  { code:"fi", name:"Suomi", flag:"🇫🇮", bcp:"fi-FI" },
  { code:"is", name:"Íslenska", flag:"🇮🇸", bcp:"is-IS" },
  { code:"ga", name:"Gaeilge", flag:"🇮🇪", bcp:"ga-IE" },
  { code:"cy", name:"Cymraeg", flag:"🏴", bcp:"cy-GB" },
  { code:"mt", name:"Malti", flag:"🇲🇹", bcp:"mt-MT" },

  // --- Orta/Doğu Avrupa ---
  { code:"pl", name:"Polski", flag:"🇵🇱", bcp:"pl-PL" },
  { code:"cs", name:"Čeština", flag:"🇨🇿", bcp:"cs-CZ" },
  { code:"sk", name:"Slovenčina", flag:"🇸🇰", bcp:"sk-SK" },
  { code:"hu", name:"Magyar", flag:"🇭🇺", bcp:"hu-HU" },
  { code:"ro", name:"Română", flag:"🇷🇴", bcp:"ro-RO" },
  { code:"bg", name:"Български", flag:"🇧🇬", bcp:"bg-BG" },
  { code:"el", name:"Ελληνικά", flag:"🇬🇷", bcp:"el-GR" },
  { code:"sr", name:"Српски", flag:"🇷🇸", bcp:"sr-RS" },
  { code:"hr", name:"Hrvatski", flag:"🇭🇷", bcp:"hr-HR" },
  { code:"bs", name:"Bosanski", flag:"🇧🇦", bcp:"bs-BA" },
  { code:"sl", name:"Slovenščina", flag:"🇸🇮", bcp:"sl-SI" },
  { code:"mk", name:"Македонски", flag:"🇲🇰", bcp:"mk-MK" },
  { code:"sq", name:"Shqip", flag:"🇦🇱", bcp:"sq-AL" },
  { code:"lv", name:"Latviešu", flag:"🇱🇻", bcp:"lv-LV" },
  { code:"lt", name:"Lietuvių", flag:"🇱🇹", bcp:"lt-LT" },
  { code:"et", name:"Eesti", flag:"🇪🇪", bcp:"et-EE" },
  { code:"uk", name:"Українська", flag:"🇺🇦", bcp:"uk-UA" },
  { code:"ru", name:"Русский", flag:"🇷🇺", bcp:"ru-RU" },
  { code:"be", name:"Беларуская", flag:"🇧🇾", bcp:"be-BY" },

  // --- Kafkas & Orta Asya ---
  { code:"az", name:"Azərbaycanca", flag:"🇦🇿", bcp:"az-AZ" },
  { code:"ka", name:"ქართული", flag:"🇬🇪", bcp:"ka-GE" },
  { code:"hy", name:"Հայերեն", flag:"🇦🇲", bcp:"hy-AM" },
  { code:"kk", name:"Қазақша", flag:"🇰🇿", bcp:"kk-KZ" },
  { code:"uz", name:"Oʻzbek", flag:"🇺🇿", bcp:"uz-UZ" },
  { code:"ky", name:"Кыргызча", flag:"🇰🇬", bcp:"ky-KG" },
  { code:"mn", name:"Монгол", flag:"🇲🇳", bcp:"mn-MN" },
  { code:"tg", name:"Тоҷикӣ", flag:"🇹🇯", bcp:"tg-TJ" },
  { code:"tk", name:"Türkmen", flag:"🇹🇲", bcp:"tk-TM" },

  // --- Orta Doğu ---
  { code:"ar", name:"العربية", flag:"🇸🇦", bcp:"ar-SA" },
  { code:"ar-eg", name:"العربية (مصر)", flag:"🇪🇬", bcp:"ar-EG" },
  { code:"he", name:"עברית", flag:"🇮🇱", bcp:"he-IL" },
  { code:"fa", name:"فارسی", flag:"🇮🇷", bcp:"fa-IR" },
  { code:"ur", name:"اردو", flag:"🇵🇰", bcp:"ur-PK" },
  { code:"ku", name:"Kurdî (Genel)", flag:"🌐", bcp:"ku" },

  // --- Güney Asya ---
  { code:"hi", name:"हिन्दी", flag:"🇮🇳", bcp:"hi-IN" },
  { code:"bn", name:"বাংলা", flag:"🇧🇩", bcp:"bn-BD" },
  { code:"bn-in", name:"বাংলা (India)", flag:"🇮🇳", bcp:"bn-IN" },
  { code:"ta", name:"தமிழ்", flag:"🇮🇳", bcp:"ta-IN" },
  { code:"te", name:"తెలుగు", flag:"🇮🇳", bcp:"te-IN" },
  { code:"kn", name:"ಕನ್ನಡ", flag:"🇮🇳", bcp:"kn-IN" },
  { code:"ml", name:"മലയാളം", flag:"🇮🇳", bcp:"ml-IN" },
  { code:"mr", name:"मराठी", flag:"🇮🇳", bcp:"mr-IN" },
  { code:"gu", name:"ગુજરાતી", flag:"🇮🇳", bcp:"gu-IN" },
  { code:"pa", name:"ਪੰਜਾਬੀ", flag:"🇮🇳", bcp:"pa-IN" },
  { code:"or", name:"ଓଡ଼ିଆ", flag:"🇮🇳", bcp:"or-IN" },
  { code:"as", name:"অসমীয়া", flag:"🇮🇳", bcp:"as-IN" },
  { code:"si", name:"සිංහල", flag:"🇱🇰", bcp:"si-LK" },
  { code:"ne", name:"नेपाली", flag:"🇳🇵", bcp:"ne-NP" },

  // --- Doğu/Güneydoğu Asya ---
  { code:"zh", name:"中文 (简体)", flag:"🇨🇳", bcp:"zh-CN" },
  { code:"zh-tw", name:"中文 (繁體)", flag:"🇹🇼", bcp:"zh-TW" },
  { code:"ja", name:"日本語", flag:"🇯🇵", bcp:"ja-JP" },
  { code:"ko", name:"한국어", flag:"🇰🇷", bcp:"ko-KR" },
  { code:"th", name:"ไทย", flag:"🇹🇭", bcp:"th-TH" },
  { code:"vi", name:"Tiếng Việt", flag:"🇻🇳", bcp:"vi-VN" },
  { code:"id", name:"Bahasa Indonesia", flag:"🇮🇩", bcp:"id-ID" },
  { code:"ms", name:"Bahasa Melayu", flag:"🇲🇾", bcp:"ms-MY" },
  { code:"fil", name:"Filipino", flag:"🇵🇭", bcp:"fil-PH" },
  { code:"km", name:"ភាសាខ្មែរ", flag:"🇰🇭", bcp:"km-KH" },
  { code:"lo", name:"ລາວ", flag:"🇱🇦", bcp:"lo-LA" },
  { code:"my", name:"မြန်မာ", flag:"🇲🇲", bcp:"my-MM" },

  // --- Afrika dilleri (yaygın) ---
  { code:"sw", name:"Kiswahili", flag:"🇰🇪", bcp:"sw-KE" },
  { code:"am", name:"አማርኛ", flag:"🇪🇹", bcp:"am-ET" },
  { code:"ha", name:"Hausa", flag:"🇳🇬", bcp:"ha-NG" },
  { code:"yo", name:"Yorùbá", flag:"🇳🇬", bcp:"yo-NG" },
  { code:"ig", name:"Igbo", flag:"🇳🇬", bcp:"ig-NG" },
  { code:"zu", name:"isiZulu", flag:"🇿🇦", bcp:"zu-ZA" },
  { code:"xh", name:"isiXhosa", flag:"🇿🇦", bcp:"xh-ZA" },
  { code:"st", name:"Sesotho", flag:"🇿🇦", bcp:"st-ZA" },
  { code:"tn", name:"Setswana", flag:"🇧🇼", bcp:"tn-BW" },
  { code:"rw", name:"Kinyarwanda", flag:"🇷🇼", bcp:"rw-RW" },
  { code:"so", name:"Soomaali", flag:"🇸🇴", bcp:"so-SO" },
  { code:"om", name:"Oromoo", flag:"🇪🇹", bcp:"om-ET" },
  { code:"mg", name:"Malagasy", flag:"🇲🇬", bcp:"mg-MG" },

  // --- İspanya yerelleri & diğer Avrupa ---
  { code:"ca", name:"Català", flag:"🇪🇸", bcp:"ca-ES" },
  { code:"eu", name:"Euskara", flag:"🇪🇸", bcp:"eu-ES" },
  { code:"gl", name:"Galego", flag:"🇪🇸", bcp:"gl-ES" },

  // --- Ek popüler (internet dilleri) ---
  { code:"jv", name:"Jawa", flag:"🇮🇩", bcp:"jv-ID" },
  { code:"su", name:"Sunda", flag:"🇮🇩", bcp:"su-ID" },
  { code:"ceb", name:"Cebuano", flag:"🇵🇭", bcp:"ceb-PH" },
];

let topLang = "en";
let botLang = "tr";

function bcp(code){ return LANGS.find(x=>x.code===code)?.bcp || "en-US"; }
function flag(code){ return LANGS.find(x=>x.code===code)?.flag || "🌐"; }

function speak(text, langCode){
  const t = String(text||"").trim();
  if(!t) return;
  if(!("speechSynthesis" in window)) return;
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = bcp(langCode);
    window.speechSynthesis.speak(u);
  }catch{}
}

/* ===== bubbles =====
   ✅ Hoparlör SADECE çeviri (me) bubble’ında.
*/
function addBubble(side, kind, text, langForSpeak){
  const wrap = (side === "top") ? $("topBody") : $("botBody");
  if(!wrap) return;

  const row = document.createElement("div");
  row.className = `bubble ${kind}`;

  const txt = document.createElement("span");
  txt.className = "txt";
  txt.textContent = String(text||"").trim() || "—";
  row.appendChild(txt);

  if(kind === "me"){
    const spk = document.createElement("button");
    spk.className = "spk";
    spk.type = "button";
    spk.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    `;
    spk.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      speak(txt.textContent, langForSpeak);
    });
    row.appendChild(spk);
  }

  wrap.appendChild(row);
  try{ wrap.scrollTop = wrap.scrollHeight; }catch{}
}

/* ===== UI ===== */
function setMicUI(which, on){
  const btn = (which === "top") ? $("topMic") : $("botMic");
  btn?.classList.toggle("listening", !!on);
  $("frameRoot")?.classList.toggle("listening", !!on);
}

/* ===== Popover Language (NO SEARCH) ===== */
function closeAllPop(){
  $("pop-top")?.classList.remove("show");
  $("pop-bot")?.classList.remove("show");
}

function renderPop(side){
  const list = $(side === "top" ? "list-top" : "list-bot");
  if(!list) return;

  const sel = (side === "top") ? topLang : botLang;

  list.innerHTML = LANGS.map(l => `
    <div class="pop-item ${l.code===sel ? "active":""}" data-code="${l.code}">
      <div class="pop-left">
        <div class="pop-flag">${l.flag}</div>
        <div class="pop-name">${l.name}</div>
      </div>
      <div class="pop-code">${l.code}</div>
    </div>
  `).join("");

  list.querySelectorAll(".pop-item").forEach(item=>{
    item.addEventListener("click", ()=>{
      const code = item.getAttribute("data-code") || "en";

      if(side === "top"){
        topLang = code;
        if($("topLangTxt")) $("topLangTxt").textContent = `${flag(topLang)} ${topLang.toUpperCase()}`;
      }else{
        botLang = code;
        if($("botLangTxt")) $("botLangTxt").textContent = `${flag(botLang)} ${botLang.toUpperCase()}`;
      }

      stopAll();
      closeAllPop();
    });
  });
}

function togglePop(side){
  const pop = $(side === "top" ? "pop-top" : "pop-bot");
  if(!pop) return;

  const willShow = !pop.classList.contains("show");
  closeAllPop();
  if(!willShow) return;

  pop.classList.add("show");
  renderPop(side);
}

/* ===== Translate ===== */
async function translateViaApi(text, source, target){
  const b = base();
  if(!b) return text;

  const body = { text, source, target, from_lang: source, to_lang: target };

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
  recTop = null;
  recBot = null;
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
  rec.maxAlternatives = 1;
  return rec;
}

async function start(which){
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

    // konuşulan metin (them) — hoparlör YOK
    addBubble(which, "them", finalText, src);

    // çeviri diğer tarafa (me) — hoparlör VAR
    const other = (which === "top") ? "bot" : "top";
    try{
      const translated = await translateViaApi(finalText, src, dst);
      addBubble(other, "me", translated, dst);

      // otomatik ses: çeviriyi hedef dilde okut
      speak(translated, dst);
    }catch{}
  };

  rec.onerror = ()=>{
    stopAll();
    alert("Mikrofon çalışmadı. Site ayarlarından mikrofonu Allow yap (Chrome: kilit simgesi).");
  };

  rec.onend = ()=>{
    setMicUI(which, false);
    active = null;
  };

  if(which === "top") recTop = rec;
  else recBot = rec;

  try{ rec.start(); }
  catch{
    stopAll();
    alert("Mikrofon başlatılamadı.");
  }
}

/* ===== Buttons ===== */
function bindNav(){
  $("homeBtn")?.addEventListener("click", ()=>{
    location.href = "/pages/home.html";
  });

  $("topBack")?.addEventListener("click", ()=>{
    stopAll();
    closeAllPop();
    if(history.length > 1) history.back();
    else location.href="/pages/home.html";
  });
}

function bindLangButtons(){
  $("topLangBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); togglePop("top"); });
  $("botLangBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); togglePop("bot"); });

  $("close-top")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); closeAllPop(); });
  $("close-bot")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); closeAllPop(); });
}

function bindMicButtons(){
  $("topMic")?.addEventListener("click", (e)=>{
    e.preventDefault();
    closeAllPop();
    if(active === "top") stopAll();
    else start("top");
  });

  $("botMic")?.addEventListener("click", (e)=>{
    e.preventDefault();
    closeAllPop();
    if(active === "bot") stopAll();
    else start("bot");
  });
}

function bindOutsideClose(){
  document.addEventListener("click", (e)=>{
    const t = e.target;
    const inTop = $("pop-top")?.contains(t) || $("topLangBtn")?.contains(t);
    const inBot = $("pop-bot")?.contains(t) || $("botLangBtn")?.contains(t);
    const inClose = $("close-top")?.contains(t) || $("close-bot")?.contains(t);
    if(inTop || inBot || inClose) return;
    closeAllPop();
  }, { capture:true });
}

document.addEventListener("DOMContentLoaded", ()=>{
  if($("topLangTxt")) $("topLangTxt").textContent = `${flag(topLang)} ${topLang.toUpperCase()}`;
  if($("botLangTxt")) $("botLangTxt").textContent = `${flag(botLang)} ${botLang.toUpperCase()}`;

  bindNav();
  bindLangButtons();
  bindMicButtons();
  bindOutsideClose();
});
