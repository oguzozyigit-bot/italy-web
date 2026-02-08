// FILE: /js/photo_page.js
import { STORAGE_KEY } from "/js/config.js";
import { apiPOST } from "/js/api.js";

const $ = (id)=>document.getElementById(id);
function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }

/* ===== Toast ===== */
function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=> t.classList.remove("show"), 1800);
}

/* ===== Guard (home/profile standard) ===== */
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
  $("userName").textContent = full;
  $("userPlan").textContent = String(u.plan || "FREE").toUpperCase();

  const avatarBtn = $("avatarBtn");
  const fallback = $("avatarFallback");
  const pic = String(u.picture || u.avatar || u.avatar_url || "").trim();
  if(pic){
    avatarBtn.innerHTML = `<img src="${pic}" alt="avatar" referrerpolicy="no-referrer">`;
  }else{
    fallback.textContent = (full && full[0]) ? full[0].toUpperCase() : "•";
  }

  avatarBtn.addEventListener("click", ()=> location.href="/pages/profile.html");
}

/* ===== Languages ===== */
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

/* ===== Target lang session ===== */
const SS_TO = "italky_photo_to_lang_v3";
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

/* ===== Camera ===== */
let stream = null;
async function startCamera(){
  const v = $("cam");
  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    v.srcObject = stream;
    await v.play();
    $("statusChip").textContent = "✅ Kamera hazır • Yazıya dokun";
  }catch(e){
    console.error(e);
    $("statusChip").textContent = "❌ Kamera açılamadı (izin/cihaz)";
    toast("Kamera izni gerekli");
  }
}

/* ===== Canvas mapping ===== */
function fitCanvasToVideo(){
  const v = $("cam");
  const c = $("overlay");
  const rect = v.getBoundingClientRect();
  c.width = Math.floor(rect.width * devicePixelRatio);
  c.height = Math.floor(rect.height * devicePixelRatio);
}
function drawClear(){
  const c = $("overlay");
  const ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
}

function captureFrame(){
  const v = $("cam");
  if(!v || v.videoWidth === 0) return null;
  const tmp = document.createElement("canvas");
  tmp.width = v.videoWidth;
  tmp.height = v.videoHeight;
  tmp.getContext("2d").drawImage(v, 0, 0, tmp.width, tmp.height);
  return tmp;
}

function stageToFrameXY(clientX, clientY, frameW, frameH){
  const v = $("cam");
  const rect = v.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const sx = frameW / rect.width;
  const sy = frameH / rect.height;
  return { fx: x * sx, fy: y * sy };
}

function cropROI(frameCanvas, fx, fy){
  const roiW = Math.floor(Math.min(520, frameCanvas.width * 0.60));
  const roiH = Math.floor(Math.min(260, frameCanvas.height * 0.25));

  let x0 = Math.floor(fx - roiW/2);
  let y0 = Math.floor(fy - roiH/2);

  x0 = Math.max(0, Math.min(frameCanvas.width - roiW, x0));
  y0 = Math.max(0, Math.min(frameCanvas.height - roiH, y0));

  const roi = document.createElement("canvas");
  roi.width = roiW;
  roi.height = roiH;

  const ctx = roi.getContext("2d");
  ctx.drawImage(frameCanvas, x0, y0, roiW, roiH, 0, 0, roiW, roiH);

  return { roi, x0, y0, roiW, roiH };
}

/* ===== OCR (single worker, fast) ===== */
let OCR_READY = false;
let OCR_WORKER = null;

async function initOCR(){
  if(OCR_READY) return;
  if(!window.Tesseract) throw new Error("Tesseract yüklenmedi");

  $("statusChip").textContent = "🧠 OCR hazırlanıyor…";

  OCR_WORKER = await window.Tesseract.createWorker("eng+tur", 1, {
    logger: (m)=>{} // sessiz
  });

  // speed tweaks
  try{
    await OCR_WORKER.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1"
    });
  }catch{}

  OCR_READY = true;
  $("statusChip").textContent = "✅ Kamera hazır • Yazıya dokun";
}

async function ocrCanvas(canvas){
  await initOCR();
  const { data } = await OCR_WORKER.recognize(canvas);
  const txt = String(data?.text || "").trim();
  return txt;
}

/* ===== Translate (backend) ===== */
const cache = new Map();
async function translateViaApi(text, target){
  const clean = String(text||"").replace(/\s+/g," ").trim();
  if(!clean) return "";

  const key = `${clean}__${target}`;
  if(cache.has(key)) return cache.get(key);

  const data = await apiPOST("/api/translate", {
    text: clean,
    source: "",
    target,
    from_lang: "",
    to_lang: target
  }, { timeoutMs: 25000 });

  const out = String(
    data?.translated || data?.translation || data?.text || data?.translated_text || ""
  ).trim() || clean;

  cache.set(key, out);
  return out;
}

/* ===== Draw overlay ===== */
function drawOverlayTextBox(x0, y0, w, h, text){
  const c = $("overlay");
  const ctx = c.getContext("2d");

  const v = $("cam");
  const rect = v.getBoundingClientRect();

  const frameW = v.videoWidth;
  const frameH = v.videoHeight;

  const sx = rect.width / frameW;
  const sy = rect.height / frameH;

  const px0 = Math.round((x0 * sx) * devicePixelRatio);
  const py0 = Math.round((y0 * sy) * devicePixelRatio);
  const pw  = Math.round((w  * sx) * devicePixelRatio);
  const ph  = Math.round((h  * sy) * devicePixelRatio);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.strokeStyle = "rgba(165,180,252,0.70)";
  ctx.lineWidth = Math.max(2, Math.round(2 * devicePixelRatio));
  ctx.fillRect(px0, py0, pw, ph);
  ctx.strokeRect(px0, py0, pw, ph);

  const fontSize = Math.max(12, Math.min(22, Math.floor((ph / 2.3) / devicePixelRatio)));
  ctx.font = `900 ${Math.round(fontSize * devicePixelRatio)}px Outfit, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textBaseline = "middle";

  const tx = px0 + Math.round(10 * devicePixelRatio);
  const ty = py0 + Math.round(ph / 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px0, py0, pw, ph);
  ctx.clip();
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

/* ===== Interaction ===== */
let busy = false;
let holding = false;
let lastRun = 0;

async function translateAt(clientX, clientY){
  if(busy) return;
  const v = $("cam");
  if(!v || v.videoWidth === 0) return;

  busy = true;
  $("statusChip").textContent = "🧠 Okunuyor…";

  try{
    const frame = captureFrame();
    if(!frame) throw new Error("frame yok");

    const { fx, fy } = stageToFrameXY(clientX, clientY, frame.width, frame.height);
    const { roi, x0, y0, roiW, roiH } = cropROI(frame, fx, fy);

    const raw = await ocrCanvas(roi);
    const clean = raw.replace(/\s+/g, " ").trim();

    if(!clean){
      $("statusChip").textContent = "⚠️ Yazı yok • Yaklaştır";
      return;
    }

    const out = await translateViaApi(clean, toLang);
    drawOverlayTextBox(x0, y0, roiW, roiH, out);
    $("statusChip").textContent = "✅ Basıldı • Tutmaya devam et";
  }catch(e){
    console.error(e);
    $("statusChip").textContent = "⚠️ OCR/Çeviri hata";
    toast("OCR/Çeviri hata");
  }finally{
    busy = false;
  }
}

function onPointerDown(e){
  holding = true;
  lastRun = 0;
  translateAt(e.clientX, e.clientY);
}
function onPointerMove(e){
  if(!holding) return;
  const now = Date.now();
  if(now - lastRun < 700) return;
  lastRun = now;
  translateAt(e.clientX, e.clientY);
}
function onPointerUp(){ holding = false; }

/* ===== Full scan ===== */
async function doFullScan(){
  if(busy) return;
  const v = $("cam");
  if(!v || v.videoWidth === 0) return toast("Kamera hazır değil");

  busy = true;
  $("statusChip").textContent = "🧠 SCAN…";

  try{
    const frame = captureFrame();
    if(!frame) throw new Error("frame yok");

    const raw = await ocrCanvas(frame);
    const txt = raw.replace(/\s+/g," ").trim();
    if(!txt){ $("statusChip").textContent = "⚠️ Yazı bulunamadı"; return; }

    const out = await translateViaApi(txt, toLang);
    drawClear();
    drawOverlayTextBox(
      Math.floor(frame.width*0.05),
      Math.floor(frame.height*0.05),
      Math.floor(frame.width*0.90),
      Math.floor(frame.height*0.20),
      out
    );
    $("statusChip").textContent = "✅ SCAN basıldı";
  }catch(e){
    console.error(e);
    $("statusChip").textContent = "❌ SCAN hata";
    toast("SCAN hata");
  }finally{
    busy = false;
  }
}

/* ===== Boot ===== */
document.addEventListener("DOMContentLoaded", async ()=>{
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

  $("scanBtn")?.addEventListener("click", doFullScan);
  $("clearBtn")?.addEventListener("click", ()=>{
    cache.clear();
    drawClear();
    $("statusChip").textContent = "🧽 Temizlendi • Yazıya dokun";
  });

  const stage = $("stage");
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);

  await startCamera();

  const ro = new ResizeObserver(()=>{ fitCanvasToVideo(); drawClear(); });
  ro.observe($("cam"));
  window.addEventListener("resize", ()=>{ fitCanvasToVideo(); drawClear(); }, { passive:true });

  fitCanvasToVideo();
  drawClear();
});
