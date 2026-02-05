// /js/document_page.js
import { BASE_DOMAIN, STORAGE_KEY } from "/js/config.js";
import { logout } from "/js/auth.js";

const $ = (id)=>document.getElementById(id);
function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }
function base(){ return String(BASE_DOMAIN||"").replace(/\/+$/,""); }

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.classList.remove("show"), 1800);
}

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
  avatarBtn.addEventListener("click", logout);
}

/* ===== Diller (Türkçe) ===== */
const LANGS = [
  { code:"tr", name:"Türkçe", flag:"🇹🇷" },
  { code:"en", name:"İngilizce", flag:"🇬🇧" },
  { code:"de", name:"Almanca", flag:"🇩🇪" },
  { code:"fr", name:"Fransızca", flag:"🇫🇷" },
  { code:"it", name:"İtalyanca", flag:"🇮🇹" },
  { code:"es", name:"İspanyolca", flag:"🇪🇸" },
  { code:"pt", name:"Portekizce", flag:"🇵🇹" },
  { code:"pt-br", name:"Portekizce (Brezilya)", flag:"🇧🇷" },
  { code:"ru", name:"Rusça", flag:"🇷🇺" },
  { code:"ar", name:"Arapça", flag:"🇸🇦" },
  { code:"zh", name:"Çince", flag:"🇨🇳" },
  { code:"zh-tw", name:"Çince (Geleneksel)", flag:"🇹🇼" },
  { code:"ja", name:"Japonca", flag:"🇯🇵" },
  { code:"ko", name:"Korece", flag:"🇰🇷" },
  { code:"nl", name:"Felemenkçe", flag:"🇳🇱" },
  { code:"sv", name:"İsveççe", flag:"🇸🇪" },
  { code:"no", name:"Norveççe", flag:"🇳🇴" },
  { code:"da", name:"Danca", flag:"🇩🇰" },
  { code:"fi", name:"Fince", flag:"🇫🇮" },
  { code:"pl", name:"Lehçe", flag:"🇵🇱" },
  { code:"cs", name:"Çekçe", flag:"🇨🇿" },
  { code:"sk", name:"Slovakça", flag:"🇸🇰" },
  { code:"hu", name:"Macarca", flag:"🇭🇺" },
  { code:"ro", name:"Romence", flag:"🇷🇴" },
  { code:"bg", name:"Bulgarca", flag:"🇧🇬" },
  { code:"el", name:"Yunanca", flag:"🇬🇷" },
  { code:"uk", name:"Ukraynaca", flag:"🇺🇦" },
  { code:"sr", name:"Sırpça", flag:"🇷🇸" },
  { code:"hr", name:"Hırvatça", flag:"🇭🇷" },
  { code:"bs", name:"Boşnakça", flag:"🇧🇦" },
  { code:"sq", name:"Arnavutça", flag:"🇦🇱" },
  { code:"fa", name:"Farsça", flag:"🇮🇷" },
  { code:"ur", name:"Urduca", flag:"🇵🇰" },
  { code:"hi", name:"Hintçe", flag:"🇮🇳" },
  { code:"bn", name:"Bengalce", flag:"🇧🇩" },
  { code:"th", name:"Tayca", flag:"🇹🇭" },
  { code:"vi", name:"Vietnamca", flag:"🇻🇳" },
  { code:"id", name:"Endonezce", flag:"🇮🇩" },
  { code:"ms", name:"Malayca", flag:"🇲🇾" },
  { code:"he", name:"İbranice", flag:"🇮🇱" },
];

function langBy(code){
  return LANGS.find(x=>x.code===code) || { code, name: code, flag:"🌐" };
}

/* ===== Hedef dil: sayfa boyunca kalsın ===== */
const SS_TO = "italky_doc_to_lang_v1";
let toLang = sessionStorage.getItem(SS_TO) || "tr";

function setToUI(){
  $("toFlag").textContent = langBy(toLang).flag;
  $("toLangTxt").textContent = langBy(toLang).name;
  sessionStorage.setItem(SS_TO, toLang);
}

/* ===== Language sheet ===== */
function openSheet(){
  $("langSheet").classList.add("show");
  $("sheetQuery").value = "";
  renderSheet("");
  setTimeout(()=>{ try{ $("sheetQuery").focus(); }catch{} }, 0);
}
function closeSheet(){ $("langSheet").classList.remove("show"); }

function renderSheet(filter){
  const q = String(filter||"").toLowerCase().trim();
  const list = $("sheetList");
  if(!list) return;

  const items = LANGS.filter(l=>{
    if(!q) return true;
    const hay = `${l.name} ${l.code}`.toLowerCase();
    return hay.includes(q);
  });

  list.innerHTML = items.map(l=>{
    const sel = (l.code===toLang) ? "selected" : "";
    return `
      <div class="sheetRow ${sel}" data-code="${l.code}">
        <div class="left">
          <div class="code" style="min-width:28px; text-align:center;">${l.flag}</div>
          <div class="name">${l.name}</div>
        </div>
        <div class="code">${l.code.toUpperCase()}</div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".sheetRow").forEach(row=>{
    row.addEventListener("click", ()=>{
      toLang = row.getAttribute("data-code") || "tr";
      setToUI();
      closeSheet();
      toast("Dil seçildi");
    });
  });
}

/* ===== State ===== */
const state = {
  file: null,
  kind: "", // image|pdf
  imageCanvas: null, // canvas for OCR
};

/* ===== Helpers ===== */
function setTopStatus(msg){ $("statusTop").textContent = msg; }
function setBotStatus(msg){ $("statusBot").textContent = msg; }

function clearPreview(){
  $("imgPreview").style.display = "none";
  $("pdfCanvas").style.display = "none";
  $("imgPreview").src = "";
  const c = $("pdfCanvas");
  const ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
}

async function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = ()=> rej(new Error("file read failed"));
    fr.readAsDataURL(file);
  });
}

async function readFileAsArrayBuffer(file){
  return await file.arrayBuffer();
}

/* ===== PDF render to canvas (first page) ===== */
async function renderPdfFirstPageToCanvas(pdfBytes){
  if(!window.pdfjsLib) throw new Error("pdfjs missing");
  // worker
  try{
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.js";
  }catch{}

  const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = $("pdfCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  canvas.style.display = "block";
  $("imgPreview").style.display = "none";

  // OCR image canvas is the same pdfCanvas
  state.imageCanvas = canvas;
}

/* ===== Image render to canvas ===== */
async function renderImageToCanvas(dataUrl){
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = dataUrl;

  await new Promise((r, rej)=>{
    img.onload = r;
    img.onerror = rej;
  });

  $("imgPreview").src = dataUrl;
  $("imgPreview").style.display = "block";
  $("pdfCanvas").style.display = "none";

  // create OCR canvas offscreen
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  state.imageCanvas = c;
}

/* ===== OCR ===== */
async function doOCR(){
  if(!window.Tesseract) throw new Error("tesseract missing");
  if(!state.imageCanvas) throw new Error("no image canvas");

  setTopStatus("OCR taranıyor…");
  setBotStatus("OCR…");
  $("outText").value = "";

  const r = await window.Tesseract.recognize(state.imageCanvas, "eng", {
    logger: (m)=>{
      if(m?.status === "recognizing text"){
        const p = Math.round((m.progress || 0) * 100);
        setTopStatus(`OCR taranıyor… %${p}`);
      }
    }
  });

  const txt = String(r?.data?.text || "").trim();
  setTopStatus(txt ? "OCR tamam" : "Yazı bulunamadı");
  return txt;
}

/* ===== Translate ===== */
async function translateViaApi(text, target){
  const b = base();
  if(!b) return text;

  const body = {
    text,
    source: "",       // auto
    target,
    from_lang: "",
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
  ).trim() || text;

  return out;
}

/* ===== Main flow ===== */
async function handlePickedFile(file){
  state.file = file;
  state.kind = "";
  state.imageCanvas = null;

  clearPreview();
  setTopStatus("Dosya seçildi");
  setBotStatus("—");
  $("outText").value = "";

  const type = String(file.type || "").toLowerCase();

  try{
    if(type.includes("pdf")){
      state.kind = "pdf";
      setTopStatus("PDF yükleniyor…");
      const bytes = await readFileAsArrayBuffer(file);
      await renderPdfFirstPageToCanvas(bytes);
      setTopStatus("PDF hazır (1. sayfa)");
    }else if(type.startsWith("image/")){
      state.kind = "image";
      setTopStatus("Görsel yükleniyor…");
      const url = await readFileAsDataURL(file);
      await renderImageToCanvas(url);
      setTopStatus("Görsel hazır");
    }else{
      toast("Desteklenmeyen format");
      setTopStatus("Format desteklenmiyor");
    }
  }catch{
    toast("Dosya açılamadı");
    setTopStatus("Hata");
  }
}

async function run(){
  if(!state.file || !state.imageCanvas){
    toast("Önce dosya/kamera seç");
    return;
  }

  try{
    const ocrText = await doOCR();
    if(!ocrText){
      setBotStatus("OCR boş");
      return;
    }

    setBotStatus("Çeviri…");
    const translated = await translateViaApi(ocrText, toLang);

    $("outText").value = translated || "";
    setBotStatus("Tamam");
  }catch{
    toast("İşlem başarısız");
    setBotStatus("Hata");
  }
}

/* ===== Boot ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  const u = ensureLogged();
  if(!u) return;

  paintHeader(u);

  $("backBtn")?.addEventListener("click", ()=>{
    if(history.length>1) history.back();
    else location.href = "/pages/home.html";
  });
  $("logoHome")?.addEventListener("click", ()=> location.href="/pages/home.html");

  setToUI();

  $("toLangBtn")?.addEventListener("click", openSheet);
  $("sheetClose")?.addEventListener("click", closeSheet);
  $("langSheet")?.addEventListener("click", (ev)=>{ if(ev.target === $("langSheet")) closeSheet(); });
  $("sheetQuery")?.addEventListener("input", ()=> renderSheet($("sheetQuery").value));

  $("pickFileBtn")?.addEventListener("click", ()=> $("filePick").click());
  $("pickCamBtn")?.addEventListener("click", ()=> $("camPick").click());

  $("filePick")?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) handlePickedFile(f);
    e.target.value = "";
  });

  $("camPick")?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) handlePickedFile(f);
    e.target.value = "";
  });

  $("runBtn")?.addEventListener("click", run);

  setTopStatus("Dosya veya Kamera seç");
  setBotStatus("—");
});
