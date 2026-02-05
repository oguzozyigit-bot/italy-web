// /js/text_translate_page.js
import { BASE_DOMAIN, STORAGE_KEY } from "/js/config.js";
import { logout } from "/js/auth.js";

const $ = (id) => document.getElementById(id);
function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }
function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.classList.remove("show"), 1800);
}

/* ✅ Bayraklı dil listesi */
const LANGS = [
  { code:"auto", tr:"Dili Algıla", native:"Auto", flag:"🌐", tts:"" },

  { code:"tr", tr:"Türkçe", native:"Türkçe", flag:"🇹🇷", tts:"tr-TR" },
  { code:"en", tr:"İngilizce", native:"English", flag:"🇬🇧", tts:"en-US" },
  { code:"de", tr:"Almanca", native:"Deutsch", flag:"🇩🇪", tts:"de-DE" },
  { code:"fr", tr:"Fransızca", native:"Français", flag:"🇫🇷", tts:"fr-FR" },
  { code:"it", tr:"İtalyanca", native:"Italiano", flag:"🇮🇹", tts:"it-IT" },
  { code:"es", tr:"İspanyolca", native:"Español", flag:"🇪🇸", tts:"es-ES" },

  { code:"pt", tr:"Portekizce", native:"Português", flag:"🇵🇹", tts:"pt-PT" },
  { code:"pt-br", tr:"Portekizce (Brezilya)", native:"Português (Brasil)", flag:"🇧🇷", tts:"pt-BR" },

  { code:"nl", tr:"Felemenkçe", native:"Nederlands", flag:"🇳🇱", tts:"nl-NL" },
  { code:"sv", tr:"İsveççe", native:"Svenska", flag:"🇸🇪", tts:"sv-SE" },
  { code:"no", tr:"Norveççe", native:"Norsk", flag:"🇳🇴", tts:"nb-NO" },
  { code:"da", tr:"Danca", native:"Dansk", flag:"🇩🇰", tts:"da-DK" },
  { code:"fi", tr:"Fince", native:"Suomi", flag:"🇫🇮", tts:"fi-FI" },

  { code:"pl", tr:"Lehçe", native:"Polski", flag:"🇵🇱", tts:"pl-PL" },
  { code:"cs", tr:"Çekçe", native:"Čeština", flag:"🇨🇿", tts:"cs-CZ" },
  { code:"sk", tr:"Slovakça", native:"Slovenčina", flag:"🇸🇰", tts:"sk-SK" },
  { code:"hu", tr:"Macarca", native:"Magyar", flag:"🇭🇺", tts:"hu-HU" },
  { code:"ro", tr:"Romence", native:"Română", flag:"🇷🇴", tts:"ro-RO" },
  { code:"bg", tr:"Bulgarca", native:"Български", flag:"🇧🇬", tts:"bg-BG" },
  { code:"el", tr:"Yunanca", native:"Ελληνικά", flag:"🇬🇷", tts:"el-GR" },

  { code:"ru", tr:"Rusça", native:"Русский", flag:"🇷🇺", tts:"ru-RU" },
  { code:"uk", tr:"Ukraynaca", native:"Українська", flag:"🇺🇦", tts:"uk-UA" },
  { code:"sr", tr:"Sırpça", native:"Српски", flag:"🇷🇸", tts:"sr-RS" },
  { code:"hr", tr:"Hırvatça", native:"Hrvatski", flag:"🇭🇷", tts:"hr-HR" },
  { code:"bs", tr:"Boşnakça", native:"Bosanski", flag:"🇧🇦", tts:"bs-BA" },
  { code:"sq", tr:"Arnavutça", native:"Shqip", flag:"🇦🇱", tts:"sq-AL" },

  { code:"ar", tr:"Arapça", native:"العربية", flag:"🇸🇦", tts:"ar-SA" },
  { code:"fa", tr:"Farsça", native:"فارسی", flag:"🇮🇷", tts:"fa-IR" },
  { code:"ur", tr:"Urduca", native:"اردو", flag:"🇵🇰", tts:"ur-PK" },
  { code:"hi", tr:"Hintçe", native:"हिन्दी", flag:"🇮🇳", tts:"hi-IN" },
  { code:"bn", tr:"Bengalce", native:"বাংলা", flag:"🇧🇩", tts:"bn-BD" },
  { code:"ta", tr:"Tamilce", native:"தமிழ்", flag:"🇮🇳", tts:"ta-IN" },
  { code:"te", tr:"Teluguca", native:"తెలుగు", flag:"🇮🇳", tts:"te-IN" },

  { code:"th", tr:"Tayca", native:"ไทย", flag:"🇹🇭", tts:"th-TH" },
  { code:"vi", tr:"Vietnamca", native:"Tiếng Việt", flag:"🇻🇳", tts:"vi-VN" },
  { code:"id", tr:"Endonezce", native:"Bahasa Indonesia", flag:"🇮🇩", tts:"id-ID" },
  { code:"ms", tr:"Malayca", native:"Bahasa Melayu", flag:"🇲🇾", tts:"ms-MY" },

  { code:"zh", tr:"Çince", native:"中文", flag:"🇨🇳", tts:"zh-CN" },
  { code:"zh-tw", tr:"Çince (Geleneksel)", native:"中文 (繁體)", flag:"🇹🇼", tts:"zh-TW" },
  { code:"ja", tr:"Japonca", native:"日本語", flag:"🇯🇵", tts:"ja-JP" },
  { code:"ko", tr:"Korece", native:"한국어", flag:"🇰🇷", tts:"ko-KR" },
  { code:"he", tr:"İbranice", native:"עברית", flag:"🇮🇱", tts:"he-IL" },
];

function getLang(code){
  return LANGS.find(l=>l.code===code) || { code, tr: code, native: code, flag:"🌐", tts:"en-US" };
}

/* ===== Session + Terms guard (home/chat ile aynı mantık) ===== */
function termsKey(email=""){
  return `italky_terms_accepted_at::${String(email||"").toLowerCase().trim()}`;
}
function getUser(){
  return safeJson(localStorage.getItem(STORAGE_KEY), {});
}
function ensureLogged(){
  const u = getUser();
  if(!u || !u.email){ location.replace("/index.html"); return null; }
  if(!localStorage.getItem(termsKey(u.email))){ location.replace("/index.html"); return null; }
  const gid = (localStorage.getItem("google_id_token") || "").trim();
  if(!gid){ location.replace("/index.html"); return null; }
  if(!u.isSessionActive){ location.replace("/index.html"); return null; }
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

  // şimdilik: avatara basınca çıkış (home ile aynı)
  avatarBtn.addEventListener("click", logout);
}

/* ===== Persist: sayfadan çıkana kadar kalsın (sessionStorage) ===== */
const SS_FROM = "italky_text_translate_from_v2";
const SS_TO   = "italky_text_translate_to_v2";
const SS_MANUAL_TO = "italky_text_translate_to_manual_v2";

let fromLang = sessionStorage.getItem(SS_FROM) || "auto";
let toLang   = sessionStorage.getItem(SS_TO) || "tr";
let manualTo = (sessionStorage.getItem(SS_MANUAL_TO) || "0") === "1";

let detectedFrom = null; // auto algılandığında

function persist(){
  sessionStorage.setItem(SS_FROM, fromLang);
  sessionStorage.setItem(SS_TO, toLang);
  sessionStorage.setItem(SS_MANUAL_TO, manualTo ? "1" : "0");
}

function setLangUI(){
  const fromShown = (fromLang==="auto")
    ? `Dili Algıla${detectedFrom ? ` (${String(detectedFrom).toUpperCase()})` : ""}`
    : getLang(fromLang).tr;

  $("fromLangTxt").textContent = fromShown;
  $("fromFlag").textContent = fromLang==="auto"
    ? (detectedFrom ? getLang(detectedFrom).flag : "🌐")
    : getLang(fromLang).flag;

  $("toLangTxt").textContent = getLang(toLang).tr;
  $("toFlag").textContent = getLang(toLang).flag;
}

/* ===== Language sheet ===== */
let sheetFor = "from"; // from|to

function openSheet(which){
  sheetFor = which;
  $("langSheet")?.classList.add("show");
  $("sheetTitle").textContent = which === "from" ? "Kaynak Dil" : "Hedef Dil";
  $("sheetQuery").value = "";
  renderSheet("");
  setTimeout(()=>{ try{ $("sheetQuery")?.focus(); }catch{} }, 0);
}
function closeSheet(){ $("langSheet")?.classList.remove("show"); }

function renderSheet(filter){
  const q = String(filter||"").toLowerCase().trim();
  const list = $("sheetList");
  if(!list) return;

  const current = sheetFor === "from" ? fromLang : toLang;

  const items = LANGS.filter(l=>{
    if(sheetFor === "to" && l.code === "auto") return false;
    if(!q) return true;
    const hay = `${l.tr} ${l.native} ${l.code}`.toLowerCase();
    return hay.includes(q);
  });

  list.innerHTML = items.map(l=>{
    const sel = (l.code === current) ? "selected" : "";
    return `
      <div class="sheetRow ${sel}" data-code="${l.code}">
        <div class="left">
          <div class="code" style="min-width:28px; text-align:center;">${l.flag}</div>
          <div class="name">${l.tr}</div>
        </div>
        <div class="code">${l.code.toUpperCase()}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".sheetRow").forEach(row=>{
    row.addEventListener("click", ()=>{
      const code = row.getAttribute("data-code") || "en";
      if(sheetFor === "from"){
        fromLang = code;
        detectedFrom = null;
      }else{
        toLang = code;
        manualTo = true; // kullanıcı hedefi seçerse sayfada kilitle
      }
      persist();
      setLangUI();
      closeSheet();
      toast("Dil seçildi");
    });
  });
}

/* ===== Translate API ===== */
async function translateViaApi(text, source, target){
  const b = base();
  if(!b) return { out:"", detected:null };

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

  const det = String(
    data?.detected || data?.detected_lang || data?.detected_language || data?.source_lang || data?.source || ""
  ).trim().toLowerCase();

  return { out: out || "", detected: det || null };
}

/* ===== Auto target rule (senin kuralın) =====
   - Algıladığı dil Türkçe ise hedef otomatik İngilizce
   - Türkçe harici ne algılarsa algılasın hedef otomatik Türkçe
   - Kullanıcı hedefi değiştirirse sayfa boyunca sabit (manualTo=true)
*/
function applyAutoTargetRule(detected){
  if(manualTo) return;

  const d = String(detected||"").toLowerCase().trim();
  if(!d) return;

  detectedFrom = d;

  if(d === "tr") toLang = "en";
  else toLang = "tr";

  persist();
  setLangUI();
}

/* ===== counts ===== */
function updateCounts(){
  const inV = String($("inText").value || "");
  $("countIn").textContent = String(inV.length);

  const outV = String($("outText").textContent || "");
  $("countOut").textContent = String(outV === "—" ? 0 : outV.length);
}

/* ===== TTS ===== */
function speak(text, langCode){
  const t = String(text||"").trim();
  if(!t) return;
  if(!("speechSynthesis" in window)) { toast("Ses desteği yok"); return; }

  try{
    const u = new SpeechSynthesisUtterance(t);
    const info = getLang(langCode);
    u.lang = info.tts || "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{
    toast("Okuma başlatılamadı");
  }
}

/* ===== STT (mikrofon) ===== */
let sttBusy = false;
function detectLightTR(text){
  const t = String(text||"").toLowerCase();
  if(/[çğıöşü]/.test(t)) return "tr";
  const trHints = [" ve ", " bir ", " için ", " değil ", " merhaba", " selam", " nasılsın", " teşekkür"];
  for(const h of trHints) if(t.includes(h)) return "tr";
  return "en";
}

function startSTT(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ toast("Bu cihaz konuşmayı yazıya çevirmiyor."); return; }
  if(sttBusy) return;

  const micBtn = $("micIn");
  const rec = new SR();
  // kaynak auto ise TR dinleyelim (Türkiye default), değilse seçilen dili dinle
  const listenCode = (fromLang === "auto") ? "tr" : fromLang;
  rec.lang = getLang(listenCode).tts || "tr-TR";
  rec.interimResults = false;
  rec.continuous = false;

  sttBusy = true;
  micBtn.classList.add("listening");

  rec.onresult = async (e)=>{
    const t = e.results?.[0]?.[0]?.transcript || "";
    const finalText = String(t||"").trim();
    if(!finalText) return;

    $("inText").value = finalText;
    updateCounts();

    // auto kaynak ise: yazıdan hızlı TR tahmini (backend detected yoksa diye)
    if(fromLang === "auto"){
      const guess = detectLightTR(finalText);
      applyAutoTargetRule(guess); // TR -> EN, diğer -> TR
    }

    await doTranslate(true);
  };

  rec.onerror = ()=>{
    // sessiz geç
  };
  rec.onend = ()=>{
    micBtn.classList.remove("listening");
    sttBusy = false;
  };

  try{ rec.start(); }
  catch{
    micBtn.classList.remove("listening");
    sttBusy = false;
    toast("Mikrofon açılamadı.");
  }
}

/* ===== translate ===== */
async function doTranslate(silent=false){
  const text = String($("inText").value || "").trim();
  if(!text){
    if(!silent) toast("Metin yaz");
    return;
  }

  $("outText").textContent = "Çevriliyor…";
  updateCounts();

  const src = (fromLang === "auto") ? "" : fromLang;

  try{
    const { out, detected } = await translateViaApi(text, src, toLang);

    // auto ise backend detected geldiyse asıl kuralı onunla uygula
    if(fromLang === "auto"){
      applyAutoTargetRule(detected || detectLightTR(text));
    }

    $("outText").textContent = out || "—";
  }catch{
    $("outText").textContent = "—";
    if(!silent) toast("Çeviri alınamadı");
  }

  setLangUI();
  updateCounts();
}

function swapLang(){
  if(fromLang === "auto"){
    toast("Kaynak dil 'Algıla' iken değiştirilemez");
    return;
  }
  const a = fromLang; fromLang = toLang; toLang = a;
  manualTo = true;
  detectedFrom = null;
  persist();
  setLangUI();
  toast("Diller değişti");
}

document.addEventListener("DOMContentLoaded", ()=>{
  const u = ensureLogged();
  if(!u) return;

  paintHeader(u);

  $("backBtn")?.addEventListener("click", ()=>{
    if(history.length>1) history.back();
    else location.href = "/pages/home.html";
  });
  $("logoHome")?.addEventListener("click", ()=> location.href="/pages/home.html");

  setLangUI();
  updateCounts();

  $("fromLangBtn")?.addEventListener("click", ()=> openSheet("from"));
  $("toLangBtn")?.addEventListener("click", ()=> openSheet("to"));
  $("swapBtn")?.addEventListener("click", swapLang);

  $("sheetClose")?.addEventListener("click", closeSheet);
  $("langSheet")?.addEventListener("click", (e)=>{ if(e.target === $("langSheet")) closeSheet(); });
  $("sheetQuery")?.addEventListener("input", ()=> renderSheet($("sheetQuery").value));

  $("clearBtn")?.addEventListener("click", ()=>{
    $("inText").value = "";
    $("outText").textContent = "—";
    detectedFrom = null;
    // hedef dili kullanıcı manuel seçmediyse burada resetlemiyoruz; sayfada kalsın
    persist();
    setLangUI();
    updateCounts();
  });

  $("translateBtn")?.addEventListener("click", ()=> doTranslate(false));
  $("inText")?.addEventListener("input", updateCounts);

  $("micIn")?.addEventListener("click", startSTT);

  $("speakIn")?.addEventListener("click", ()=>{
    const txt = String($("inText").value||"").trim();
    if(!txt) return toast("Metin yok");
    const lang = (fromLang === "auto") ? (detectedFrom || detectLightTR(txt)) : fromLang;
    speak(txt, lang);
  });

  $("speakOut")?.addEventListener("click", ()=>{
    const txt = String($("outText").textContent||"").trim();
    if(!txt || txt==="—") return toast("Çeviri yok");
    speak(txt, toLang);
  });
});
