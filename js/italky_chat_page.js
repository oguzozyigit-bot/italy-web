import { BASE_DOMAIN, STORAGE_KEY } from "/js/config.js";

const $ = id => document.getElementById(id);

const chatEl = $("chat");
const msgEl = $("msg");
const micBtn = $("mic");

const user = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
const CHAT_KEY = `italky_chat_ui_${user.email || "guest"}`;

function add(role,text){
  const d=document.createElement("div");
  d.className=`bubble ${role}`;
  d.textContent=text;
  chatEl.appendChild(d);
  chatEl.scrollTop=chatEl.scrollHeight;
}

function saveHist(){
  localStorage.setItem(CHAT_KEY, chatEl.innerHTML);
}
function loadHist(){
  const h=localStorage.getItem(CHAT_KEY);
  if(h) chatEl.innerHTML=h;
}

async function send(text){
  if(!text) return;
  add("user",text);
  msgEl.value="";
  saveHist();

  add("bot","…");

  const res = await fetch(`${BASE_DOMAIN}/api/chat`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      user_id:user.email,
      text
    })
  });

  const data = await res.json();
  chatEl.lastChild.remove();
  add("bot",data.text || "Cevap alınamadı");
  saveHist();
}

$("send").onclick = ()=> send(msgEl.value.trim());

msgEl.addEventListener("keydown",e=>{
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    send(msgEl.value.trim());
  }
});

$("clearChat").onclick = ()=>{
  chatEl.innerHTML="";
  add("meta","Sohbet temizlendi. Seni hatırlıyorum.");
  saveHist();
};

/* 🎤 STT */
let rec;
micBtn.onclick = ()=>{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return alert("STT yok");

  if(rec){
    rec.stop();
    return;
  }

  rec = new SR();
  rec.lang="tr-TR";
  micBtn.classList.add("listening");

  rec.onresult = e=>{
    const t = e.results[0][0].transcript;
    rec.stop();
    send(t);
  };
  rec.onend = ()=>{
    micBtn.classList.remove("listening");
    rec=null;
  };
  rec.start();
};

$("logoHome").onclick = ()=> location.href="/pages/home.html";

loadHist();
if(!chatEl.children.length){
  add("meta","italkyAI yazılı bilgi alanıdır. Mikrofon konuşmanı yazıya çevirir.");
}
