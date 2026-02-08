// /js/text_translate_page.js — FINAL (api.js + relaxed guard + no random redirects)
import { STORAGE_KEY } from "/js/config.js";
import { apiPOST } from "/js/api.js";
import { applyI18n, t } from "/js/i18n.js";

const $ = (id) => document.getElementById(id);
function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }

function toast(msg){
  const el = $("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> el.classList.remove("show"), 1800);
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

/* ===== Session + Terms guard (HOME/PROFILE ile aynı) ===== */
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
  return u;
}

function paintHeader(u){
  const full = (u.fullname || u.name || u.display_name || u.email || "—").trim();
  $("userName") && ($("userName").textContent = full);
  $("userPlan") && ($("userPlan").textContent = String(u.plan || "FREE").toUpperCase());

  const avatarBtn = $("avatarBtn");
  const fallback = $("avatarFallback");
  const pic = String(u.picture || u.avatar || u.avatar_url || "").trim();

  if(avatarBtn){
    if(pic){
      avatarBtn.innerHTML = `<img src="${pic}" alt="avatar" referrerpolicy="no-referrer">`;
    }else if(fallback){
      fallback.textContent = (full && full[0]) ? full[0].toUpperCase() : "•";
    }
    // ✅ avatara basınca profile (logout değil)
    avatarBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      location.href = "/pages/profile.html";
    });
  }
}

/* ===== Persist (sessionStorage) ===== */
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

  $("fromLangTxt") && ($("fromLangTxt").textContent = fromShown);
  $("fromFlag") && ($("fromFlag").textContent =
    fromLang==="auto" ? (detectedFrom ? getLang(detectedFrom).flag : "🌐") : getLang(fromLang).flag
  );

  $("toLangTxt") && ($("toLangTxt").textContent = getLang(toLang).tr);
  $("toFlag") && ($("toFlag").textContent = getLang(toLang).flag);
}

/* ===== Language sheet ===== */
let sheetFor = "from"; // from|to

function openSheet(which){
  sheetFor = which;
  $("langSheet")?.classList.add("show");
  $("sheetTitle") && ($("sheetTitle").textContent = which === "from" ? "Kaynak Dil" : "Hedef Dil");
  if($("sheetQuery")) $("sheetQuery").value = "";
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
        manualTo = true;
      }
      persist();
      setLangUI();
      closeSheet();
      toast("Dil seçildi");
    });
  });
}

/* ===== Auto target rule ===== */
function applyAutoTargetRule(detected){
  if(manualTo) return;
  const d = String(detected||"").toLowerCase().trim();
  if(!d) return;

  detectedFrom = d;
  toLang = (d === "tr") ? "en" : "tr";

  persist();
  setLangUI();
}

/* ===== counts ===== */
function updateCounts(){
  const inV = String($("inText")?.value || "");
  $("countIn") && ($("countIn").textContent = String(inV.length));

  const outV = String($("outText")?.textContent || "");
  $("countOut") && ($("countOut").textContent = String(outV === "—" ? 0 : outV.length));
}

/* ===== TTS ===== */
function speak(text, langCode){
  const tt = String(text||"").trim();
  if(!tt) return;
  if(!("speechSynthesis" in window)) { toast("Ses desteği yok"); return; }

  try{
    const u = new SpeechSynthesisUtterance(tt);
    u.lang = getLang(langCode).tts || "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{
    toast("Okuma başlatılamadı");
  }
}

/* ===== STT ===== */
let sttBusy = false;
function detectLightTR(text){
  const tt = String(text||"").toLowerCase();
  if(/[çğıöşü]/.test(tt)) return "tr";
  const trHints = [" ve ", " bir ", " için ", " değil ", " merhaba", " selam", " nasılsın", " teşekkür"];
  for(const h of trHints) if(tt.includes(h)) return "tr";
  return "en";
}

function startSTT(){
  if(location.protocol !== "https:" && location.hostname !== "localhost"){
    toast("Mikrofon için HTTPS gerekli.");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ toast("Bu cihaz konuşmayı yazıya çevirmiyor."); return; }
  if(sttBusy) return;

  const micBtn = $("micIn");
  const rec = new SR();
  const listenCode = (fromLang === "auto") ? "tr" : fromLang;
  rec.lang = getLang(listenCode).tts || "tr-TR";
  rec.interimResults = false;
  rec.continuous = false;

  sttBusy = true;
  micBtn?.classList.add("listening");

  rec.onresult = async (e)=>{
    const tr = e.results?.[0]?.[0]?.transcript || "";
    const finalText = String(tr||"").trim();
    if(!finalText) return;

    if($("inText")) $("inText").value = finalText;
    updateCounts();

    if(fromLang === "auto"){
      applyAutoTargetRule(detectLightTR(finalText));
    }

    await doTranslate(true);
  };

  rec.onend = ()=>{
    micBtn?.classList.remove("listening");
    sttBusy = false;
  };

  try{ rec.start(); }
  catch{
    micBtn?.classList.remove("listening");
    sttBusy = false;
    toast("Mikrofon açılamadı.");
  }
}

/* ===== Translate (apiPOST) ===== */
async function translateViaApi(text, source, target){
  const body = {
    text,
    source,
    target,
    from_lang: source,
    to_lang: target,
  };

  const data = await apiPOST("/api/translate", body, { timeoutMs: 20000 });

  const out = String(
    data?.translated || data?.translation || data?.text || data?.translated_text || ""
  ).trim();

  const det = String(
    data?.detected || data?.detected_lang || data?.detected_language || data?.source_lang || data?.source || ""
  ).trim().toLowerCase();

  return { out: out || "", detected: det || null };
}

async function doTranslate(silent=false){
  const text = String($("inText")?.value || "").trim();
  if(!text){
    if(!silent) toast("Metin yaz");
    return;
  }

  if($("outText")) $("outText").textContent = "Çevriliyor…";
  updateCounts();

  const src = (fromLang === "auto") ? "" : fromLang;

  try{
    const { out, detected } = await translateViaApi(text, src, toLang);

    if(fromLang === "auto"){
      applyAutoTargetRule(detected || detectLightTR(text));
    }

    if($("outText")) $("outText").textContent = out || "—";
  }catch(e){
    if($("outText")) $("outText").textContent = "—";
    if(!silent) toast(String(e?.message || "Çeviri alınamadı"));
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

/* ===== Boot ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  const u = ensureLogged();
  if(!u) return;

  // i18n minimal
  try{
    applyI18n(document);
    // istersen i18n.js'e text_translate_title ekleriz, şimdilik dokunmuyorum
  }catch{}

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
  $("sheetQuery")?.addEventListener("input", ()=> renderSheet($("sheetQuery")?.value));

  $("clearBtn")?.addEventListener("click", ()=>{
    if($("inText")) $("inText").value = "";
    if($("outText")) $("outText").textContent = "—";
    detectedFrom = null;
    persist();
    setLangUI();
    updateCounts();
  });

  $("translateBtn")?.addEventListener("click", ()=> doTranslate(false));
  $("inText")?.addEventListener("input", updateCounts);

  $("micIn")?.addEventListener("click", startSTT);

  $("speakIn")?.addEventListener("click", ()=>{
    const txt = String($("inText")?.value||"").trim();
    if(!txt) return toast("Metin yok");
    const lang = (fromLang === "auto") ? (detectedFrom || detectLightTR(txt)) : fromLang;
    speak(txt, lang);
  });

  $("speakOut")?.addEventListener("click", ()=>{
    const txt = String($("outText")?.textContent||"").trim();
    if(!txt || txt==="—") return toast("Çeviri yok");
    speak(txt, toLang);
  });
});
