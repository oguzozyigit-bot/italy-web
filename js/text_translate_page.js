// /js/text_translate_page.js
import { BASE_DOMAIN } from "/js/config.js";

const $ = (id) => document.getElementById(id);
function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.classList.remove("show"), 1800);
}

const LANGS = [
  { code:"auto", tr:"Dili Algıla", native:"Auto" },
  { code:"tr", tr:"Türkçe", native:"Türkçe" },
  { code:"en", tr:"İngilizce", native:"English" },
  { code:"de", tr:"Almanca", native:"Deutsch" },
  { code:"fr", tr:"Fransızca", native:"Français" },
  { code:"es", tr:"İspanyolca", native:"Español" },
  { code:"it", tr:"İtalyanca", native:"Italiano" },
  { code:"pt", tr:"Portekizce", native:"Português" },
  { code:"ru", tr:"Rusça", native:"Русский" },
  { code:"ar", tr:"Arapça", native:"العربية" },
  { code:"zh", tr:"Çince", native:"中文" },
  { code:"ja", tr:"Japonca", native:"日本語" },
  { code:"ko", tr:"Korece", native:"한국어" },
];

function labelOf(code){
  const x = LANGS.find(l=>l.code===code);
  return x ? x.tr : code;
}

let fromLang = "auto";
let toLang = "tr";
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
    if(sheetFor === "to" && l.code === "auto") return false; // hedefte auto yok
    if(!q) return true;
    const hay = `${l.tr} ${l.native} ${l.code}`.toLowerCase();
    return hay.includes(q);
  });

  list.innerHTML = items.map(l=>{
    const sel = (l.code === current) ? "selected" : "";
    return `
      <div class="sheetRow ${sel}" data-code="${l.code}">
        <div>
          <div class="name">${l.tr}</div>
          <div class="code">${l.native} • ${l.code}</div>
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
        $("fromLangTxt").textContent = labelOf(fromLang);
      }else{
        toLang = code;
        $("toLangTxt").textContent = labelOf(toLang);
      }
      closeSheet();
      toast("Dil seçildi");
    });
  });
}

async function translateViaApi(text, source, target){
  const b = base();
  if(!b) return "";

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

  return out || "";
}

function updateCounts(){
  const inV = String($("inText").value || "");
  $("countIn").textContent = String(inV.length);

  const outV = String($("outText").textContent || "");
  $("countOut").textContent = String(outV === "—" ? 0 : outV.length);
}

async function doTranslate(){
  const text = String($("inText").value || "").trim();
  if(!text){
    toast("Metin yaz");
    return;
  }

  $("outText").textContent = "Çevriliyor…";
  updateCounts();

  const src = fromLang === "auto" ? "" : fromLang;

  try{
    const out = await translateViaApi(text, src, toLang);
    $("outText").textContent = out || "—";
  }catch{
    $("outText").textContent = "—";
    toast("Çeviri alınamadı");
  }

  updateCounts();
}

function swapLang(){
  if(fromLang === "auto"){
    // auto ile swap mantıksız; hedefi kaynak yapmayalım
    toast("Kaynak dil 'Algıla' iken değiştirilemez");
    return;
  }
  const a = fromLang; fromLang = toLang; toLang = a;
  $("fromLangTxt").textContent = labelOf(fromLang);
  $("toLangTxt").textContent = labelOf(toLang);
  toast("Diller değişti");
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("backBtn")?.addEventListener("click", ()=>{
    if(history.length>1) history.back();
    else location.href = "/pages/home.html";
  });
  $("logoHome")?.addEventListener("click", ()=> location.href="/pages/home.html");

  $("fromLangTxt").textContent = labelOf(fromLang);
  $("toLangTxt").textContent = labelOf(toLang);

  $("fromLangBtn")?.addEventListener("click", ()=> openSheet("from"));
  $("toLangBtn")?.addEventListener("click", ()=> openSheet("to"));
  $("swapBtn")?.addEventListener("click", swapLang);

  $("sheetClose")?.addEventListener("click", closeSheet);
  $("langSheet")?.addEventListener("click", (e)=>{ if(e.target === $("langSheet")) closeSheet(); });
  $("sheetQuery")?.addEventListener("input", ()=> renderSheet($("sheetQuery").value));

  $("clearBtn")?.addEventListener("click", ()=>{
    $("inText").value = "";
    $("outText").textContent = "—";
    updateCounts();
  });

  $("translateBtn")?.addEventListener("click", doTranslate);
  $("inText")?.addEventListener("input", updateCounts);

  updateCounts();
});
