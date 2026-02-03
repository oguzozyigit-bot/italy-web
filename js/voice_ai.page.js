// FILE: italky-web/js/voice_ai_page.js
import { BASE_DOMAIN } from "/js/config.js";

const $ = id => document.getElementById(id);

const VOICES = [
  "Jale","Hüma","Selden","Ayşem",
  "Ozan","Oğuz","Barış","Emrah"
];

let selected = localStorage.getItem("italky_voice") || "Ozan";

function demoText(name){
  return `Italky AI'ye hoş geldiniz. Ben ${name}. 
Benimle hem eğlenip, hem öğrenip, hem de dünyayı özgürce gezebilirsiniz.
Hadi beni seç. Ben ${name}.`;
}

/* ===== VOICE MODAL ===== */
window.openModal = ()=>{
  $("modal").classList.add("show");
  renderVoices();
};

function renderVoices(){
  const box = $("voiceList");
  box.innerHTML = "";
  VOICES.forEach(name=>{
    const row = document.createElement("div");
    row.className = "voice" + (name===selected?" sel":"");
    row.innerHTML = `
      <div>${name}</div>
      <button>▶</button>
    `;

    row.onclick = ()=>{
      document.querySelectorAll(".voice").forEach(x=>x.classList.remove("sel"));
      row.classList.add("sel");
      selected = name;
      localStorage.setItem("italky_voice", name);
    };

    row.querySelector("button").onclick = e=>{
      e.stopPropagation();
      speak(demoText(name));
    };

    box.appendChild(row);
  });
}

/* ===== SPEAK ===== */
async function speak(text){
  const r = await fetch(`${BASE_DOMAIN}/api/tts_openai`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      text,
      name:selected
    })
  });
  const j = await r.json();
  const audio = new Audio(`data:audio/mp3;base64,${j.audio_base64}`);
  audio.play();
}

/* ===== MIC ===== */
let listening=false;
$("mic").addEventListener("pointerdown", async ()=>{
  listening = !listening;
  const stage = $("stage");
  const mic = $("mic");
  const status = $("status");

  if(listening){
    mic.classList.add("listening");
    stage.className="stage listening";
    status.textContent="Dinliyorum…";
  }else{
    mic.classList.remove("listening");
    stage.className="stage speaking";
    status.textContent="Konuşuyorum…";
    speak(`Merhaba. Ben ${selected}.`);
    setTimeout(()=>{
      stage.className="stage";
      status.textContent="Hazır";
    },4000);
  }
});
