// FILE: italky-web/js/facetoface_page.js
import { BASE_DOMAIN } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

/* ✅ Dil listesi: çok daha geniş + bayrak */
const LANGS = [
  { code:"tr", name:"Türkçe", flag:"🇹🇷" },
  { code:"en", name:"English", flag:"🇬🇧" },
  { code:"de", name:"Deutsch", flag:"🇩🇪" },
  { code:"fr", name:"Français", flag:"🇫🇷" },
  { code:"it", name:"Italiano", flag:"🇮🇹" },
  { code:"es", name:"Español", flag:"🇪🇸" },
  { code:"pt", name:"Português", flag:"🇵🇹" },
  { code:"pt-br", name:"Português (Brasil)", flag:"🇧🇷" },
  { code:"nl", name:"Nederlands", flag:"🇳🇱" },
  { code:"sv", name:"Svenska", flag:"🇸🇪" },
  { code:"no", name:"Norsk", flag:"🇳🇴" },
  { code:"da", name:"Dansk", flag:"🇩🇰" },
  { code:"fi", name:"Suomi", flag:"🇫🇮" },
  { code:"pl", name:"Polski", flag:"🇵🇱" },
  { code:"cs", name:"Čeština", flag:"🇨🇿" },
  { code:"sk", name:"Slovenčina", flag:"🇸🇰" },
  { code:"hu", name:"Magyar", flag:"🇭🇺" },
  { code:"ro", name:"Română", flag:"🇷🇴" },
  { code:"bg", name:"Български", flag:"🇧🇬" },
  { code:"el", name:"Ελληνικά", flag:"🇬🇷" },
  { code:"ru", name:"Русский", flag:"🇷🇺" },
  { code:"uk", name:"Українська", flag:"🇺🇦" },
  { code:"sr", name:"Српски", flag:"🇷🇸" },
  { code:"hr", name:"Hrvatski", flag:"🇭🇷" },
  { code:"bs", name:"Bosanski", flag:"🇧🇦" },
  { code:"sq", name:"Shqip", flag:"🇦🇱" },
  { code:"ar", name:"العربية", flag:"🇸🇦" },
  { code:"fa", name:"فارسی", flag:"🇮🇷" },
  { code:"ur", name:"اردو", flag:"🇵🇰" },
  { code:"hi", name:"हिन्दी", flag:"🇮🇳" },
  { code:"bn", name:"বাংলা", flag:"🇧🇩" },
  { code:"ta", name:"தமிழ்", flag:"🇮🇳" },
  { code:"te", name:"తెలుగు", flag:"🇮🇳" },
  { code:"th", name:"ไทย", flag:"🇹🇭" },
  { code:"vi", name:"Tiếng Việt", flag:"🇻🇳" },
  { code:"id", name:"Bahasa Indonesia", flag:"🇮🇩" },
  { code:"ms", name:"Bahasa Melayu", flag:"🇲🇾" },
  { code:"zh", name:"中文", flag:"🇨🇳" },
  { code:"zh-tw", name:"中文 (繁體)", flag:"🇹🇼" },
  { code:"ja", name:"日本語", flag:"🇯🇵" },
  { code:"ko", name:"한국어", flag:"🇰🇷" },
  { code:"he", name:"עברית", flag:"🇮🇱" },
];

let topLang = "en";
let botLang = "tr";

function langName(code){
  return LANGS.find(x=>x.code===code)?.name || code;
}
function langFlag(code){
  return LANGS.find(x=>x.code===code)?.flag || "🌐";
}

function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }

/* ========= UI small fixes (requested) ========= */
function applyVisualFixes(){
  // 1) 180° tarafındaki mikrofon ikonunu çevir
  // HTML'de id'ler farklıysa da kırılmasın diye birkaç olasılığı deniyoruz:
  const cand = ["botMic","bottomMic","micBottom","micB"];
  for(const id of cand){
    const el = $(id);
    if(el){
      el.classList.add("rot180");
      break;
    }
  }
  // 2) italkyAI / BE FREE aşağı insin (bordo üstüne kaymasın)
  // Bu başlık alanına class basıyoruz; CSS'te .brandLower ile aşağı kaydıracağız.
  const brand = $("brandBlock") || $("miniBrand") || $("logoHome");
  if(brand) brand.classList.add("brandLower");
}

/* ========= Language sheet ========= */
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
        // recognizer dili değişsin diye: aktif varsa durdur
        stopAll();
      }else{
        botLang = code;
        $("botLangTxt").textContent = `${langFlag(botLang)} ${langName(botLang)}`;
        stopAll();
      }

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

/* ========= Back ========= */
function bindNav(){
  $("backBtn")?.addEventListener("click", ()=>{
    if(history.length > 1) history.back();
    else location.href="/pages/home.html";
  });
}

/* ========= Speech + Translate Engine ========= */
function srAvailable(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function normalizeLangForSpeech(code){
  // browser SR çoğunlukla BCP-47 ister
  const map = {
    "tr":"tr-TR",
    "en":"en-US",
    "de":"de-DE",
    "fr":"fr-FR",
    "it":"it-IT",
    "es":"es-ES",
    "pt":"pt-PT",
    "pt-br":"pt-BR",
    "nl":"nl-NL",
    "sv":"sv-SE",
    "no":"nb-NO",
    "da":"da-DK",
    "fi":"fi-FI",
    "pl":"pl-PL",
    "cs":"cs-CZ",
    "sk":"sk-SK",
    "hu":"hu-HU",
    "ro":"ro-RO",
    "bg":"bg-BG",
    "el":"el-GR",
    "ru":"ru-RU",
    "uk":"uk-UA",
    "sr":"sr-RS",
    "hr":"hr-HR",
    "bs":"bs-BA",
    "sq":"sq-AL",
    "ar":"ar-SA",
    "fa":"fa-IR",
    "ur":"ur-PK",
    "hi":"hi-IN",
    "bn":"bn-BD",
    "ta":"ta-IN",
    "te":"te-IN",
    "th":"th-TH",
    "vi":"vi-VN",
    "id":"id-ID",
    "ms":"ms-MY",
    "zh":"zh-CN",
    "zh-tw":"zh-TW",
    "ja":"ja-JP",
    "ko":"ko-KR",
    "he":"he-IL",
  };
  return map[code] || "en-US";
}

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

function speak(text, langCode){
  const t = String(text||"").trim();
  if(!t) return;
  if(!("speechSynthesis" in window)) return;

  try{
    const u = new SpeechSynthesisUtterance(t);
    u.lang = normalizeLangForSpeech(langCode);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{}
}

function setMicUI(which, on){
  // HTML'deki id’ler farklı olabilir diye birkaç aday deniyoruz
  const ids = (which === "top")
    ? ["topMic","micTop","micA","mic1"]
    : ["botMic","bottomMic","micBottom","micB","mic2"];

  for(const id of ids){
    const el = $(id);
    if(el){
      el.classList.toggle("listening", !!on);
      break;
    }
  }

  $("frameRoot")?.classList.toggle("listening", !!on);
}

function appendLine(side, text){
  // Facetoface HTML’inde hangi alanlar varsa ona yazacağız:
  // topBox/botBox yoksa console’a düşmeden sessiz geçsin.
  const topOut = $("topOut") || $("topText") || $("topTranscript");
  const botOut = $("botOut") || $("botText") || $("botTranscript");

  if(side === "top"){
    if(topOut) topOut.textContent = text;
  }else{
    if(botOut) botOut.textContent = text;
  }
}

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
  rec.lang = normalizeLangForSpeech(langCode);
  rec.interimResults = true;
  rec.continuous = false;
  return rec;
}

async function start(which){
  if(!srAvailable()){
    alert("Bu cihaz konuşmayı yazıya çevirmiyor (SpeechRecognition yok).");
    return;
  }

  if(active && active !== which) stopAll();

  const src = (which === "top") ? topLang : botLang;
  const dst = (which === "top") ? botLang : topLang;

  const rec = buildRecognizer(src);
  if(!rec){
    alert("Mikrofon açılamadı.");
    return;
  }

  active = which;
  setMicUI(which, true);

  let live = "";
  let finalText = "";

  rec.onresult = (e)=>{
    let chunk = "";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t = e.results[i]?.[0]?.transcript || "";
      if(e.results[i].isFinal) finalText += t + " ";
      else chunk += t + " ";
    }
    live = (finalText + chunk).trim();
    // canlı yazdır
    appendLine(which, live);
  };

  rec.onerror = ()=>{
    stopAll();
    alert("Mikrofon izin/HTTPS/cihaz sorunu olabilir.");
  };

  rec.onend = async ()=>{
    setMicUI(which, false);
    const txt = (finalText || live || "").trim();
    active = null;

    if(!txt) return;

    // çevir
    try{
      const translated = await translateViaApi(txt, src, dst);

      // diğer tarafa yaz
      const other = (which === "top") ? "bot" : "top";
      appendLine(other, translated);

      // otomatik ses (varsa)
      const speakBtn = (other === "top")
        ? ($("topSpeak") || $("speakTop"))
        : ($("botSpeak") || $("speakBot"));

      const muted = speakBtn?.classList?.contains("muted");
      if(!muted) speak(translated, dst);
    }catch{
      // sessiz fail
    }
  };

  if(which === "top") recTop = rec; else recBot = rec;

  try{ rec.start(); }
  catch{
    stopAll();
    alert("Mikrofon başlatılamadı.");
  }
}

/* ========= Buttons ========= */
function bindLangButtons(){
  $("topLangBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSheet("top"); });
  $("botLangBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSheet("bot"); });

  $("sheetClose")?.addEventListener("click", closeSheet);
  $("langSheet")?.addEventListener("click", (e)=>{
    if(e.target === $("langSheet")) closeSheet();
  });
}

function bindMicButtons(){
  // Üst mikrofon
  const topMic = $("topMic") || $("micTop") || $("micA") || $("mic1");
  topMic?.addEventListener("click", (e)=>{
    e.preventDefault();
    if(active === "top") stopAll();
    else start("top");
  });

  // Alt mikrofon (180°)
  const botMic = $("botMic") || $("bottomMic") || $("micBottom") || $("micB") || $("mic2");
  botMic?.addEventListener("click", (e)=>{
    e.preventDefault();
    if(active === "bot") stopAll();
    else start("bot");
  });

  // Speak butonları (mute)
  const t = $("topSpeak") || $("speakTop");
  const b = $("botSpeak") || $("speakBot");
  t?.addEventListener("click", ()=> t.classList.toggle("muted"));
  b?.addEventListener("click", ()=> b.classList.toggle("muted"));
}

function injectCssFixes(){
  // İstenen iki tasarım fixini sayfaya CSS olarak enjekte ediyoruz
  const css = `
    .rot180 { transform: rotate(180deg) !important; }
    .brandLower { transform: translateY(6px) !important; }
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
}

document.addEventListener("DOMContentLoaded", ()=>{
  injectCssFixes();
  applyVisualFixes();

  $("topLangTxt").textContent = `${langFlag(topLang)} ${langName(topLang)}`;
  $("botLangTxt").textContent = `${langFlag(botLang)} ${langName(botLang)}`;

  bindNav();
  bindLangButtons();
  bindMicButtons();

  // ilk açılışta SR yoksa kullanıcıyı boş bırakma
  if(!srAvailable()){
    // alert yok, sessiz: sadece mikrofonlara "disabled" efekti verelim
    const m1 = $("topMic") || $("micTop") || $("micA") || $("mic1");
    const m2 = $("botMic") || $("bottomMic") || $("micBottom") || $("micB") || $("mic2");
    m1?.classList?.add("muted");
    m2?.classList?.add("muted");
  }
});
