// FILE: italky-web/js/voice_ai.page.js
const $ = (id)=>document.getElementById(id);

const STORAGE_KEY = "caynana_user_v1";
const VOICE_KEY = "italky_voice_choice_v1";

const DISPLAY_FEMALE = ["Jale","Hüma","Selden","Ayşem","Eles"];
const DISPLAY_MALE   = ["Ozan","Oğuz","Barış","Emrah","Yavuz","Yılmaz"];

// Basit toast yerine status yazıyoruz
function setStatus(txt){
  const s = $("status");
  if(s) s.textContent = txt;
}

function goHome(){
  location.href = "/pages/home.html";
}

function openModal(){
  $("voiceModal")?.classList.add("show");
  $("voiceModal")?.setAttribute("aria-hidden","false");
}
function closeModal(){
  $("voiceModal")?.classList.remove("show");
  $("voiceModal")?.setAttribute("aria-hidden","true");
}

function safeJson(s, fb=null){ try{return JSON.parse(s||"");}catch{return fb;} }

function loadUser(){
  return safeJson(localStorage.getItem(STORAGE_KEY), {});
}

function getVoicesSafe(){
  const v = window.speechSynthesis?.getVoices?.() || [];
  return Array.isArray(v) ? v : [];
}

// Tercih: TR varsa TR, yoksa EN
function pickDefaultVoice(voices){
  const tr = voices.find(v => String(v.lang||"").toLowerCase().startsWith("tr"));
  if(tr) return tr;
  const en = voices.find(v => String(v.lang||"").toLowerCase().startsWith("en"));
  return en || voices[0] || null;
}

function saveVoiceChoice(obj){
  try{ localStorage.setItem(VOICE_KEY, JSON.stringify(obj||{})); }catch{}
}
function loadVoiceChoice(){
  return safeJson(localStorage.getItem(VOICE_KEY), {});
}

function speakPreview(text, voice){
  if(!("speechSynthesis" in window)) return;
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if(voice) u.voice = voice;
    u.lang = voice?.lang || "tr-TR";
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  }catch{}
}

function buildDisplayNames(){
  // UI isimlerini sırayla döndürür
  const out = [];
  for(const n of DISPLAY_FEMALE) out.push({label:n, gender:"F"});
  for(const n of DISPLAY_MALE) out.push({label:n, gender:"M"});
  return out;
}

function renderVoiceList(){
  const list = $("voiceList");
  if(!list) return;

  const voices = getVoicesSafe();
  if(!voices.length){
    list.innerHTML = `<div class="voice-row"><div>Sesler yükleniyor…</div><small>Bekle</small></div>`;
    return;
  }

  const saved = loadVoiceChoice();
  const display = buildDisplayNames();

  // Sesleri TR/EN ağırlıklı sırala
  const sorted = [...voices].sort((a,b)=>{
    const la = String(a.lang||"").toLowerCase();
    const lb = String(b.lang||"").toLowerCase();
    const wa = la.startsWith("tr") ? 0 : (la.startsWith("en") ? 1 : 2);
    const wb = lb.startsWith("tr") ? 0 : (lb.startsWith("en") ? 1 : 2);
    return wa - wb;
  });

  // UI satırı: DisplayName + (lang)
  list.innerHTML = "";

  const rows = [];
  for(let i=0;i<Math.min(sorted.length, display.length); i++){
    const v = sorted[i];
    const d = display[i];
    const key = v.voiceURI || v.name || `${v.lang}-${i}`;
    const sel = (saved && saved.key === key);

    rows.push(`
      <div class="voice-row ${sel ? "sel":""}" data-key="${key}" data-idx="${i}">
        <div>${d.label} <small>(${String(v.lang||"")})</small></div>
        <small>${sel ? "Seçili" : "Dinle"}</small>
      </div>
    `);
  }

  // Eğer hiç eşleşmediyse yine de default seç
  if(!saved || !saved.key){
    const def = pickDefaultVoice(sorted);
    if(def){
      const key = def.voiceURI || def.name || "default";
      saveVoiceChoice({ key });
    }
  }

  list.innerHTML = rows.join("");

  list.querySelectorAll(".voice-row").forEach(el=>{
    el.addEventListener("click", ()=>{
      const idx = parseInt(el.getAttribute("data-idx") || "0", 10) || 0;
      const v = sorted[idx];
      const key = el.getAttribute("data-key") || (v.voiceURI || v.name || "default");
      saveVoiceChoice({ key });

      // seçili class güncelle
      list.querySelectorAll(".voice-row").forEach(x=>x.classList.remove("sel"));
      el.classList.add("sel");

      speakPreview("Merhaba! Ben italkyAI. Sesim nasıl?", v);
    });
  });
}

function findSelectedVoice(){
  const voices = getVoicesSafe();
  const saved = loadVoiceChoice();
  if(!voices.length) return null;
  if(saved && saved.key){
    const v = voices.find(x => (x.voiceURI === saved.key) || (x.name === saved.key));
    if(v) return v;
  }
  return pickDefaultVoice(voices);
}

// Basit demo animasyon (sadece UI)
let listening = false;
function toggleListening(){
  listening = !listening;

  const stage = $("stage");
  const mic = $("micBtn");

  if(!stage || !mic) return;

  if(listening){
    stage.classList.remove("speaking");
    stage.classList.add("listening");
    mic.classList.add("listening");
    setStatus("Dinliyor");
  }else{
    stage.classList.remove("listening");
    mic.classList.remove("listening");
    setStatus("Konuşuyor");

    // demo konuşma
    stage.classList.add("speaking");

    const v = findSelectedVoice();
    speakPreview("Merhaba! Ben italkyAI. Sesli sohbet modülü hazır.", v);

    setTimeout(()=>{
      stage.classList.remove("speaking");
      setStatus("Hazır");
    }, 2400);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  // tıklama test sigortası
  $("backBtn")?.addEventListener("click", goHome);
  $("homeBtn")?.addEventListener("click", goHome);

  $("openVoice")?.addEventListener("click", ()=>{
    openModal();
    renderVoiceList();
  });
  $("closeVoice")?.addEventListener("click", closeModal);

  $("voiceModal")?.addEventListener("click", (e)=>{
    if(e.target === $("voiceModal")) closeModal();
  });

  // ✅ mic click
  $("micBtn")?.addEventListener("click", toggleListening);

  // Ses listesi geç gelirse
  if("speechSynthesis" in window){
    window.speechSynthesis.onvoiceschanged = () => {
      // modal açıksa listeyi tazele
      if($("voiceModal")?.classList.contains("show")) renderVoiceList();
    };
  }

  // İlk yükte bir kere ses seçmediyse modal aç
  const saved = loadVoiceChoice();
  const voices = getVoicesSafe();
  if(!saved?.key){
    // sesler gelmediyse kısa bekle
    setTimeout(()=>{
      openModal();
      renderVoiceList();
    }, 250);
  }else{
    // yoksa status hazır
    setStatus("Hazır");
  }
});
