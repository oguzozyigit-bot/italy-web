// /js/photo_page.js
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

/* ===== Diller (Türkçe + bayrak) ===== */
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

/* ===== Hedef dil (sessionStorage) ===== */
const SS_TO = "italky_photo_to_lang_v1";
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

/* ===== Kamera ===== */
let stream = null;
async function startCamera(){
  const v = $("cam");
  try{
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    v.srcObject = stream;
    await v.play();
    $("statusChip").textContent = "✅ Kamera hazır • SCAN ile tara";
  }catch{
    $("statusChip").textContent = "❌ Kamera açılamadı (izin/cihaz)";
    toast("Kamera izni gerekli");
  }
}

/* ===== OCR state ===== */
const ocrState = {
  ready: false,
  busy: false,
  words: [],
  imgW: 0,
  imgH: 0,
};
const cache = new Map();

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

async function doScan(){
  if(!window.Tesseract){ toast("OCR yüklenemedi"); return; }
  if(ocrState.busy) return;

  const snap = captureFrame();
  if(!snap){ toast("Kamera hazır değil"); return; }

  ocrState.busy = true;
  $("statusChip").textContent = "🧠 OCR taranıyor…";
  drawClear();

  try{
    const r = await window.Tesseract.recognize(snap, "eng", {
      logger: (m)=>{
        if(m?.status === "recognizing text"){
          const p = Math.round((m.progress || 0) * 100);
          $("statusChip").textContent = `🧠 OCR taranıyor… %${p}`;
        }
      }
    });

    const words = (r?.data?.words || [])
      .filter(w => String(w.text||"").trim().length >= 2)
      .map(w => ({
        text: String(w.text||"").trim(),
        bbox: { x0:w.bbox.x0, y0:w.bbox.y0, x1:w.bbox.x1, y1:w.bbox.y1 }
      }));

    ocrState.words = words;
    ocrState.imgW = snap.width;
    ocrState.imgH = snap.height;
    ocrState.ready = true;

    $("statusChip").textContent = words.length
      ? `✅ Bulundu: ${words.length} • Yazıya tıkla`
      : "⚠️ Yazı bulunamadı • Yaklaştır";
  }catch{
    $("statusChip").textContent = "❌ OCR hata";
    toast("OCR başarısız");
  }finally{
    ocrState.busy = false;
  }
}

function pointToImageXY(clientX, clientY){
  const v = $("cam");
  const rect = v.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const sx = ocrState.imgW / rect.width;
  const sy = ocrState.imgH / rect.height;

  // ekranda video mirror -> x'i tersle
  const imgX = (rect.width - x) * sx;
  const imgY = y * sy;

  return { imgX, imgY };
}

function nearestWord(imgX, imgY){
  let best = null;
  let bestD = Infinity;

  for(const w of ocrState.words){
    const b = w.bbox;
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const dx = cx - imgX;
    const dy = cy - imgY;
    const d = dx*dx + dy*dy;
    if(d < bestD){
      bestD = d;
      best = w;
    }
  }
  return best;
}

async function translateViaApi(text, target){
  const key = `${text}__${target}`;
  if(cache.has(key)) return cache.get(key);

  const b = base();
  if(!b) return text;

  const body = {
    text,
    source: "",
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

  cache.set(key, out);
  return out;
}

function drawOverlayBox(b, text){
  const c = $("overlay");
  const ctx = c.getContext("2d");

  const v = $("cam");
  const rect = v.getBoundingClientRect();

  const sx = rect.width / ocrState.imgW;
  const sy = rect.height / ocrState.imgH;

  // mirror x in screen coords
  const x0 = (rect.width - b.x1) * sx;
  const x1 = (rect.width - b.x0) * sx;
  const y0 = b.y0 * sy;
  const y1 = b.y1 * sy;

  const px0 = Math.round(x0 * devicePixelRatio);
  const py0 = Math.round(y0 * devicePixelRatio);
  const pw = Math.max(10, Math.round((x1 - x0) * devicePixelRatio));
  const ph = Math.max(10, Math.round((y1 - y0) * devicePixelRatio));

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.strokeStyle = "rgba(165,180,252,0.70)";
  ctx.lineWidth = Math.max(2, Math.round(2 * devicePixelRatio));

  ctx.fillRect(px0, py0, pw, ph);
  ctx.strokeRect(px0, py0, pw, ph);

  const fontSize = Math.max(12, Math.min(22, Math.floor(ph / 2.2 / devicePixelRatio)));
  ctx.font = `900 ${Math.round(fontSize * devicePixelRatio)}px Outfit, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textBaseline = "middle";

  const tx = px0 + Math.round(8 * devicePixelRatio);
  const ty = py0 + Math.round(ph / 2);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px0, py0, pw, ph);
  ctx.clip();
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

async function onStageTap(e){
  if(!ocrState.ready){
    toast("Önce SCAN");
    return;
  }
  const pt = pointToImageXY(e.clientX, e.clientY);
  const w = nearestWord(pt.imgX, pt.imgY);
  if(!w){ toast("Kelime yok"); return; }

  $("statusChip").textContent = "⚡ Çeviriliyor…";
  try{
    const tr = await translateViaApi(w.text, toLang);
    drawOverlayBox(w.bbox, tr);
    $("statusChip").textContent = "✅ Basıldı • Başka yazıya tıkla";
  }catch{
    $("statusChip").textContent = "⚠️ Çeviri alınamadı";
    toast("Çeviri hata");
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

  $("scanBtn")?.addEventListener("click", doScan);
  $("clearBtn")?.addEventListener("click", ()=>{
    ocrState.ready = false;
    ocrState.words = [];
    cache.clear();
    drawClear();
    $("statusChip").textContent = "🧽 Temizlendi • SCAN ile tara";
  });

  $("stage").addEventListener("click", onStageTap);

  await startCamera();

  const ro = new ResizeObserver(()=>{ fitCanvasToVideo(); drawClear(); });
  ro.observe($("cam"));
  window.addEventListener("resize", ()=>{ fitCanvasToVideo(); drawClear(); }, { passive:true });
  fitCanvasToVideo();
});
