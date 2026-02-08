// /js/text_translate_page.js — FINAL+
// ✅ Dil sayısı = facetoface kadar
// ✅ Dil isimleri: profile'daki site diline göre (Intl.DisplayNames)
// ✅ apiPOST ile translate + timeout

import { STORAGE_KEY } from "/js/config.js";
import { apiPOST } from "/js/api.js";
import { getSiteLang, applyI18n } from "/js/i18n.js";

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

/* ===============================
   UI language (profile)
   =============================== */
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

const AUTO_LABELS = {
  tr: "Dili Algıla",
  en: "Detect language",
  de: "Sprache erkennen",
  it: "Rileva lingua",
  fr: "Détecter la langue",
};

function autoLabel(){
  return AUTO_LABELS[UI_LANG] || AUTO_LABELS.tr;
}
function sourceLabel(){
  const m = { tr:"Kaynak Dil", en:"Source", de:"Quelle", it:"Sorgente", fr:"Source" };
  return m[UI_LANG] || m.tr;
}
function targetLabel(){
  const m = { tr:"Hedef Dil", en:"Target", de:"Ziel", it:"Destinazione", fr:"Cible" };
  return m[UI_LANG] || m.tr;
}
function searchLabel(){
  const m = { tr:"Ara…", en:"Search…", de:"Suchen…", it:"Cerca…", fr:"Rechercher…" };
  return m[UI_LANG] || m.tr;
}

/* ===============================
   LANG REGISTRY (same spirit as facetoface)
   code + flag + bcp
   =============================== */
const LANGS = [
  { code:"auto", flag:"🌐", bcp:"" },

  { code:"tr", flag:"🇹🇷", bcp:"tr-TR" },
  { code:"en", flag:"🇬🇧", bcp:"en-US" },
  { code:"en-gb", flag:"🇬🇧", bcp:"en-GB" },
  { code:"de", flag:"🇩🇪", bcp:"de-DE" },
  { code:"fr", flag:"🇫🇷", bcp:"fr-FR" },
  { code:"it", flag:"🇮🇹", bcp:"it-IT" },
  { code:"es", flag:"🇪🇸", bcp:"es-ES" },
  { code:"pt", flag:"🇵🇹", bcp:"pt-PT" },
  { code:"pt-br", flag:"🇧🇷", bcp:"pt-BR" },

  // Travel / neighbors / common
  { code:"ru", flag:"🇷🇺", bcp:"ru-RU" },
  { code:"uk", flag:"🇺🇦", bcp:"uk-UA" },
  { code:"bg", flag:"🇧🇬", bcp:"bg-BG" },
  { code:"el", flag:"🇬🇷", bcp:"el-GR" },
  { code:"ro", flag:"🇷🇴", bcp:"ro-RO" },
  { code:"sr", flag:"🇷🇸", bcp:"sr-RS" },
  { code:"hr", flag:"🇭🇷", bcp:"hr-HR" },
  { code:"bs", flag:"🇧🇦", bcp:"bs-BA" },
  { code:"sq", flag:"🇦🇱", bcp:"sq-AL" },
  { code:"mk", flag:"🇲🇰", bcp:"mk-MK" },

  // Caucasus / Central Asia
  { code:"az", flag:"🇦🇿", bcp:"az-AZ" },
  { code:"ka", flag:"🇬🇪", bcp:"ka-GE" },
  { code:"hy", flag:"🇦🇲", bcp:"hy-AM" },
  { code:"kk", flag:"🇰🇿", bcp:"kk-KZ" },
  { code:"uz", flag:"🇺🇿", bcp:"uz-UZ" },
  { code:"ky", flag:"🇰🇬", bcp:"ky-KG" },
  { code:"mn", flag:"🇲🇳", bcp:"mn-MN" },

  // EU / Nordics
  { code:"nl", flag:"🇳🇱", bcp:"nl-NL" },
  { code:"sv", flag:"🇸🇪", bcp:"sv-SE" },
  { code:"no", flag:"🇳🇴", bcp:"nb-NO" },
  { code:"da", flag:"🇩🇰", bcp:"da-DK" },
  { code:"fi", flag:"🇫🇮", bcp:"fi-FI" },
  { code:"pl", flag:"🇵🇱", bcp:"pl-PL" },
  { code:"cs", flag:"🇨🇿", bcp:"cs-CZ" },
  { code:"sk", flag:"🇸🇰", bcp:"sk-SK" },
  { code:"hu", flag:"🇭🇺", bcp:"hu-HU" },
  { code:"sl", flag:"🇸🇮", bcp:"sl-SI" },

  // Middle East
  { code:"ar", flag:"🇸🇦", bcp:"ar-SA" },
  { code:"ar-eg", flag:"🇪🇬", bcp:"ar-EG" },
  { code:"he", flag:"🇮🇱", bcp:"he-IL" },
  { code:"fa", flag:"🇮🇷", bcp:"fa-IR" },
  { code:"ur", flag:"🇵🇰", bcp:"ur-PK" },

  // South / SE Asia
  { code:"hi", flag:"🇮🇳", bcp:"hi-IN" },
  { code:"bn", flag:"🇧🇩", bcp:"bn-BD" },
  { code:"ta", flag:"🇮🇳", bcp:"ta-IN" },
  { code:"te", flag:"🇮🇳", bcp:"te-IN" },
  { code:"th", flag:"🇹🇭", bcp:"th-TH" },
  { code:"vi", flag:"🇻🇳", bcp:"vi-VN" },
  { code:"id", flag:"🇮🇩", bcp:"id-ID" },
  { code:"ms", flag:"🇲🇾", bcp:"ms-MY" },
  { code:"fil", flag:"🇵🇭", bcp:"fil-PH" },

  // East Asia
  { code:"zh", flag:"🇨🇳", bcp:"zh-CN" },
  { code:"zh-tw", flag:"🇹🇼", bcp:"zh-TW" },
  { code:"ja", flag:"🇯🇵", bcp:"ja-JP" },
  { code:"ko", flag:"🇰🇷", bcp:"ko-KR" },

  // Africa common
  { code:"sw", flag:"🇰🇪", bcp:"sw-KE" },
  { code:"am", flag:"🇪🇹", bcp:"am-ET" },
];

function canonicalLangCode(code){
  const c = String(code||"").toLowerCase();
  return c.split("-")[0];
}
function langObj(code){ return LANGS.find(x=>x.code===code) || null; }
function langFlag(code){ return (langObj(code)?.flag) || "🌐"; }
function bcp(code){ return (langObj(code)?.bcp) || "en-US"; }

/* ===============================
   DisplayNames (localized language names)
   =============================== */
let _dn = null;
function getDisplayNames(){
  if(_dn && _dn.__lang === UI_LANG) return _dn;
  _dn = null;
  try{
    const dn = new Intl.DisplayNames([UI_LANG], { type:"language" });
    dn.__lang = UI_LANG;
    _dn = dn;
  }catch{
    _dn = null;
  }
  return _dn;
}

function langLabel(code){
  const c = String(code||"").toLowerCase();
  if(c === "auto") return autoLabel();

  const dn = getDisplayNames();
  const base = canonicalLangCode(c);

  // dn.of expects base language, works best with "en", "de" etc.
  if(dn){
    const name = dn.of(base);
    if(name) return name;
  }
  return c.toUpperCase();
}

function chipLabel(code){
  return `${langFlag(code)} ${langLabel(code)}`;
}

/* ===============================
   Guard (email + terms only)
   =============================== */
function termsKey(email=""){
  return `italky_terms_accepted_at::${String(email||"").toLowerCase().trim()}`;
}
function getUser(){ return safeJson(localStorage.getItem(STORAGE_KEY), {}); }

function ensureLogged(){
  const u = getUser();
  if(!u || !u.email){ location.replace("/index.html"); return null; }
  if(!localStorage.getItem(termsKey(u.email))){ location.replace("/index.html"); return null; }
  return u;
}

/* ===============================
   Header fill
   =============================== */
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
    // avatara basınca profile
    avatarBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      location.href = "/pages/profile.html";
    });
  }
}

/* ===============================
   Persist (sessionStorage)
   =============================== */
const SS_FROM = "italky_text_translate_from_v3";
const SS_TO   = "italky_text_translate_to_v3";
const SS_MANUAL_TO = "italky_text_translate_to_manual_v3";

let fromLang = sessionStorage.getItem(SS_FROM) || "auto";
let toLang   = sessionStorage.getItem(SS_TO) || "tr";
let manualTo = (sessionStorage.getItem(SS_MANUAL_TO) || "0") === "1";
let detectedFrom = null; // auto detection

function persist(){
  sessionStorage.setItem(SS_FROM, fromLang);
  sessionStorage.setItem(SS_TO, toLang);
  sessionStorage.setItem(SS_MANUAL_TO, manualTo ? "1" : "0");
}

function setLangUI(){
  const fromShown = (fromLang==="auto")
    ? `${autoLabel()}${detectedFrom ? ` (${String(detectedFrom).toUpperCase()})` : ""}`
    : langLabel(fromLang);

  $("fromLangTxt") && ($("fromLangTxt").textContent = fromShown);
  $("fromFlag") && ($("fromFlag").textContent =
    fromLang==="auto" ? (detectedFrom ? langFlag(detectedFrom) : "🌐") : langFlag(fromLang)
  );

  $("toLangTxt") && ($("toLangTxt").textContent = langLabel(toLang));
  $("toFlag") && ($("toFlag").textContent = langFlag(toLang));
}

/* ===============================
   Sheet
   =============================== */
let sheetFor = "from"; // from|to

function openSheet(which){
  sheetFor = which;

  $("langSheet")?.classList.add("show");
  $("sheetTitle") && ($("sheetTitle").textContent = (which==="from") ? sourceLabel() : targetLabel());
  $("sheetQuery") && ($("sheetQuery").placeholder = searchLabel());
  if($("sheetQuery")) $("sheetQuery").value = "";

  renderSheet("");
  setTimeout(()=>{ try{ $("sheetQuery")?.focus(); }catch{} }, 0);
}
function closeSheet(){ $("langSheet")?.classList.remove("show"); }

function renderSheet(filter){
  const q = String(filter||"").toLowerCase().trim();
  const list = $("sheetList");
  if(!list) return;

  const current = (sheetFor==="from") ? fromLang : toLang;

  const items = LANGS.filter(l=>{
    if(sheetFor==="to" && l.code==="auto") return false;
    if(!q) return true;

    const label = langLabel(l.code).toLowerCase();
    const code = String(l.code).toLowerCase();
    const hay = `${label} ${code}`; // localized label + code
    return hay.includes(q);
  });

  list.innerHTML = items.map(l=>{
    const sel = (l.code === current) ? "selected" : "";
    return `
      <div class="sheetRow ${sel}" data-code="${l.code}">
        <div class="left" style="display:flex;align-items:center;gap:10px;min-width:0;">
          <div class="code" style="min-width:28px; text-align:center; font-size:18px;">${l.flag}</div>
          <div class="name" style="font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${langLabel(l.code)}</div>
        </div>
        <div class="code" style="opacity:.6;font-weight:900;color:#fff;">${String(l.code).toUpperCase()}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".sheetRow").forEach(row=>{
    row.addEventListener("click", ()=>{
      const code = row.getAttribute("data-code") || "en";
      if(sheetFor==="from"){
        fromLang = code;
        detectedFrom = null;
      }else{
        toLang = code;
        manualTo = true; // user locks target
      }
      persist();
      setLangUI();
      closeSheet();
      toast(UI_LANG==="tr" ? "Dil seçildi" : "Saved");
    });
  });
}

/* ===============================
   Auto target rule
   - detected TR => EN
   - else => TR
   - unless manualTo
   =============================== */
function applyAutoTargetRule(detected){
  if(manualTo) return;
  const d = String(detected||"").toLowerCase().trim();
  if(!d) return;

  detectedFrom = d;
  toLang = (d === "tr") ? "en" : "tr";
  persist();
  setLangUI();
}

/* ===============================
   Counts
   =============================== */
function updateCounts(){
  const inV = String($("inText")?.value || "");
  $("countIn") && ($("countIn").textContent = String(inV.length));

  const outV = String($("outText")?.textContent || "");
  $("countOut") && ($("countOut").textContent = String(outV === "—" ? 0 : outV.length));
}

/* ===============================
   TTS
   =============================== */
function speak(text, langCode){
  const tt = String(text||"").trim();
  if(!tt) return;
  if(!("speechSynthesis" in window)) { toast(UI_LANG==="tr" ? "Ses desteği yok" : "No TTS"); return; }

  try{
    const u = new SpeechSynthesisUtterance(tt);
    u.lang = bcp(langCode);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{
    toast(UI_LANG==="tr" ? "Okuma başlatılamadı" : "TTS failed");
  }
}

/* ===============================
   STT (mic)
   =============================== */
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
    toast(UI_LANG==="tr" ? "Mikrofon için HTTPS gerekli." : "HTTPS required for mic.");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ toast(UI_LANG==="tr" ? "Bu cihaz konuşmayı yazıya çevirmiyor." : "STT not supported."); return; }
  if(sttBusy) return;

  const micBtn = $("micIn");
  const rec = new SR();

  const listenCode = (fromLang === "auto") ? "tr" : fromLang;
  rec.lang = bcp(listenCode);
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
    toast(UI_LANG==="tr" ? "Mikrofon açılamadı." : "Mic failed.");
  }
}

/* ===============================
   Translate (apiPOST)
   =============================== */
async function translateViaApi(text, source, target){
  const body = { text, source, target, from_lang: source, to_lang: target };

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
    if(!silent) toast(UI_LANG==="tr" ? "Metin yaz" : "Type text");
    return;
  }

  if($("outText")) $("outText").textContent = (UI_LANG==="tr" ? "Çevriliyor…" : "Translating…");
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
    if(!silent) toast(String(e?.message || (UI_LANG==="tr" ? "Çeviri alınamadı" : "Translate failed")));
  }

  setLangUI();
  updateCounts();
}

function swapLang(){
  if(fromLang === "auto"){
    toast(UI_LANG==="tr" ? "Kaynak dil 'Algıla' iken değiştirilemez" : "Can't swap when auto.");
    return;
  }
  const a = fromLang; fromLang = toLang; toLang = a;
  manualTo = true;
  detectedFrom = null;
  persist();
  setLangUI();
  toast(UI_LANG==="tr" ? "Diller değişti" : "Swapped");
}

/* ===============================
   UI lang refresh (profile changes)
   =============================== */
function refreshUILang(){
  const now = getSystemUILang();
  if(now === UI_LANG) return;
  UI_LANG = now;

  // Sheet placeholder/title
  if($("sheetQuery")) $("sheetQuery").placeholder = searchLabel();
  if($("sheetTitle")) $("sheetTitle").textContent = (sheetFor==="from") ? sourceLabel() : targetLabel();

  // Buttons
  setLangUI();
  // If sheet open, rerender with localized names
  if($("langSheet")?.classList.contains("show")) renderSheet($("sheetQuery")?.value || "");
}

/* ===============================
   Boot
   =============================== */
document.addEventListener("DOMContentLoaded", ()=>{
  const u = ensureLogged();
  if(!u) return;

  // apply i18n for any data-i18n used in HTML (safe)
  try{ applyI18n(document); }catch{}

  paintHeader(u);

  $("backBtn")?.addEventListener("click", (e)=>{
    // link var ama safe olsun
    e?.preventDefault?.();
    if(history.length>1) history.back();
    else location.href = "/pages/home.html";
  });
  $("logoHome")?.addEventListener("click", ()=> location.href="/pages/home.html");

  // init UI
  setLangUI();
  updateCounts();

  // bind
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
    if(!txt) return toast(UI_LANG==="tr" ? "Metin yok" : "No text");
    const lang = (fromLang === "auto") ? (detectedFrom || detectLightTR(txt)) : fromLang;
    speak(txt, lang);
  });

  $("speakOut")?.addEventListener("click", ()=>{
    const txt = String($("outText")?.textContent||"").trim();
    if(!txt || txt==="—") return toast(UI_LANG==="tr" ? "Çeviri yok" : "No output");
    speak(txt, toLang);
  });

  // if profile language changes in another tab/page
  window.addEventListener("storage", (e)=>{
    if(e.key === "italky_site_lang_v1" || e.key === "italky_lang_ping"){
      refreshUILang();
    }
  });
});
