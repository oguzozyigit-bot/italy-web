import { BASE_DOMAIN } from "/js/config.js";

const $ = (id) => document.getElementById(id);

// --- KARAKTER LİSTESİ ---
const VOICES = [
  // KADINLAR
  { id: "dora",   label: "Dora",   gender: "Kadın", openaiVoice: "nova",    desc: "Enerjik ve Neşeli ⚡" },
  { id: "ayda",   label: "Ayda",   gender: "Kadın", openaiVoice: "shimmer", desc: "Parlak ve Net ✨" },
  { id: "umay",   label: "Umay",   gender: "Kadın", openaiVoice: "alloy",   desc: "Dengeli ve Akıcı 💧" },

  // ERKEKLER
  { id: "sencer", label: "Sencer", gender: "Erkek", openaiVoice: "echo",    desc: "Sıcak ve Yankılı 🔥" },
  { id: "toygar", label: "Toygar", gender: "Erkek", openaiVoice: "fable",   desc: "Anlatıcı ve Vurgulu 🎭" },
  { id: "sungur", label: "Sungur", gender: "Erkek", openaiVoice: "onyx",    desc: "Derin ve Karizmatik 🗿" }
];

const KEY = "italky_voice_pref";
// Başlangıçta kayıtlı sesi al, yoksa Dora yap
let selectedId = (localStorage.getItem(KEY) || "dora").trim();
let stagedId = selectedId; 

function apiBase() {
  return String(BASE_DOMAIN || "").replace(/\/+$/, "");
}

// SEÇİLİ SESİ GÜNCEL OLARAK GETİR (BUG FIX)
function getSelectedVoice() {
  // Localstorage'dan en güncel veriyi oku (Garanti olsun)
  const current = localStorage.getItem(KEY) || selectedId;
  return VOICES.find(v => v.id === current) || VOICES[0];
}

/* =========================================
   GÖRSEL DURUMLAR
   ========================================= */
const stage   = $("aiStage");
const status  = $("statusText");
const micBtn  = $("micToggle");

function setVisual(state) {
  stage?.classList.remove("listening", "speaking");
  micBtn?.classList.remove("active");
  status?.classList.remove("show");

  if (state === "listening") {
    stage?.classList.add("listening");
    micBtn?.classList.add("active");
    if(status) { status.textContent = "Dinliyorum..."; status.classList.add("show"); }
  } else if (state === "thinking") {
    micBtn?.classList.add("active");
    if(status) { status.textContent = "Düşünüyor..."; status.classList.add("show"); }
  } else if (state === "speaking") {
    stage?.classList.add("speaking");
    micBtn?.classList.add("active");
    if(status) { status.textContent = "Konuşuyor..."; status.classList.add("show"); }
  } else {
    if(status) { status.textContent = "Sohbet Başlat"; status.classList.add("show"); }
  }
}

/* =========================================
   SÜREKLİ SOHBET (LOOP)
   ========================================= */
let isConversationActive = false;
let recognition = null;
let currentAudio = null;

function toggleConversation() {
  if (isConversationActive) stopConversation();
  else startConversation();
}

function startConversation() {
  // Tarayıcı desteği kontrolü
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Tarayıcınız bu özelliği desteklemiyor."); return; }
  
  isConversationActive = true;
  startListening();
}

function stopConversation() {
  isConversationActive = false;
  if (recognition) { try { recognition.stop(); } catch(e){} recognition = null; }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.speechSynthesis.cancel();
  setVisual("idle");
}

function startListening() {
  if (!isConversationActive) return;
  
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "tr-TR";
  recognition.interimResults = false;
  recognition.continuous = false; // Tek cümle al, işle, cevap ver

  recognition.onstart = () => { 
    if (isConversationActive) setVisual("listening"); 
  };
  
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    if (text && isConversationActive) processUserSpeech(text);
  };

  recognition.onerror = (e) => {
    // Hata olsa bile (sessizlik vb.) döngüyü kırma, tekrar dene
    if (isConversationActive && e.error !== 'aborted') {
      setTimeout(startListening, 300);
    }
  };

  recognition.onend = () => {
    // Eğer konuşma bitti ve hala işleme geçmediysek (sessizlik) tekrar dinle
    if (isConversationActive && !stage.classList.contains("thinking") && !stage.classList.contains("speaking")) {
       // startListening(); // Bu bazen çakışma yapar, onresult/onerror halleder.
    }
  };

  try { recognition.start(); } catch(e){}
}

async function processUserSpeech(userText) {
  setVisual("thinking"); // Düşünme modu
  
  try {
    // 1. Chat API'ye gönder
    const chatRes = await fetch(`${apiBase()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: userText,
        max_tokens: 150 // Kısa cevap için token limiti
      })
    });
    
    const chatData = await chatRes.json();
    const aiReply = chatData.text || "Anlaşılamadı.";

    // 2. Seslendir
    await speakResponse(aiReply);

  } catch (err) {
    console.error(err);
    // Hata olursa loop'u kırma, tekrar dinlemeye geç
    if (isConversationActive) { 
      setVisual("idle"); 
      setTimeout(startListening, 500); 
    }
  }
}

async function speakResponse(text) {
  if (!isConversationActive) return;
  
  // SEÇİLİ SESİ BURADA ALIYORUZ (HER SEFERİNDE GÜNCEL)
  const v = getSelectedVoice();
  console.log("Konuşan Karakter:", v.label, v.openaiVoice); // Debug için

  setVisual("speaking");

  try {
    const res = await fetch(`${apiBase()}/api/tts_openai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: text, 
        voice: v.openaiVoice,
        speed: 1.1 // Biraz daha seri konuşsun
      })
    });
    const data = await res.json();

    if (data.audio_base64) {
      const audio = new Audio("data:audio/mp3;base64," + data.audio_base64);
      currentAudio = audio;
      
      audio.onended = () => {
        currentAudio = null;
        // Konuşma bittiği an DİNLEMEYE geç (LOOP)
        if (isConversationActive) startListening();
        else setVisual("idle");
      };
      
      await audio.play();
    } else {
      if (isConversationActive) startListening();
    }
  } catch (e) {
    console.error("Ses Hatası", e);
    if (isConversationActive) startListening();
  }
}

/* =========================================
   MODAL & DEMO
   ========================================= */
const modal = $("voiceModal");
const listContainer = $("voiceListContainer");

function openModal() { modal?.classList.add("show"); renderVoiceList(); }
function closeModal() { modal?.classList.remove("show"); }

function renderVoiceList() {
  if (!listContainer) return;
  listContainer.innerHTML = "";

  VOICES.forEach(v => {
    const isSelected = (v.id === stagedId);
    const row = document.createElement("div");
    row.className = `voice-item ${isSelected ? "selected" : ""}`;
    row.innerHTML = `
      <div class="v-left">
        <button class="play-btn" type="button">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="v-details">
          <div class="v-name">${v.label}</div>
          <div class="v-lang">${v.gender} • ${v.desc}</div>
        </div>
      </div>
      ${isSelected ? '<div style="color:#6366f1">✓</div>' : ''}
    `;

    // Seçim (Sadece stagedId değişir, kaydet diyene kadar bekle)
    row.addEventListener("click", (e) => {
      if (e.target.closest(".play-btn")) return;
      stagedId = v.id;
      renderVoiceList();
    });

    // Demo Dinle (Gerçek Ses)
    const btn = row.querySelector(".play-btn");
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      btn.style.opacity = "0.5"; // Yükleniyor efekti
      
      // Demo cümlesi
      const demoText = `Merhaba, ben ${v.label}. Seninle konuşmak çok keyifli olacak!`;
      
      try {
        const res = await fetch(`${apiBase()}/api/tts_openai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: demoText, voice: v.openaiVoice })
        });
        const d = await res.json();
        if(d.audio_base64) {
           const a = new Audio("data:audio/mp3;base64," + d.audio_base64);
           await a.play();
        }
      } catch(err) { alert("Demo sesi alınamadı."); }
      
      btn.style.opacity = "1";
    });

    listContainer.appendChild(row);
  });
}

/* =========================================
   BAŞLATMA
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  $("btnBack")?.addEventListener("click", () => location.href="/pages/home.html");
  $("btnSettings")?.addEventListener("click", openModal);
  $("closeVoiceModal")?.addEventListener("click", closeModal);
  
  // KAYDET BUTONU (Kritik Nokta)
  $("saveVoiceBtn")?.addEventListener("click", () => {
    selectedId = stagedId; 
    localStorage.setItem(KEY, selectedId); // Tarayıcıya kaydet
    closeModal();
    // Eğer o an konuşma aktifse, bir sonraki cümlede yeni ses devreye girer
  });

  micBtn?.addEventListener("click", toggleConversation);
  setVisual("idle");

  if (!localStorage.getItem(KEY)) setTimeout(openModal, 600);
});
