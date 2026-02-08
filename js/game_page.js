import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);
function toast(msg){
  const t=$("toast"); t.textContent=msg; t.style.display="block";
  clearTimeout(window.__to);
  window.__to=setTimeout(()=>t.style.display="none",1800);
}

function getUser(){ return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); }
function termsKey(e){ return `italky_terms_accepted_at::${String(e).toLowerCase()}`; }
function ensureLogged(){
  const u=getUser();
  if(!u?.email||!localStorage.getItem(termsKey(u.email))) location.replace("/index.html");
  return u;
}
function isPro(u){
  return ["PRO","PREMIUM","PLUS"].includes(String(u.plan||"").toUpperCase());
}

/* ===== DAILY TOKEN SYSTEM ===== */
const DAILY_FREE_TOKENS = 25;

function today(){
  const d=new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function uid(u){ return (u.user_id||u.id||u.email).toLowerCase(); }
function key(u){ return `italky_game_tokens::${uid(u)}::${today()}`; }
function initKey(u){ return `italky_game_tokens_init::${uid(u)}::${today()}`; }

function ensureDaily(u){
  if(isPro(u)) return;
  if(localStorage.getItem(initKey(u))) return;
  localStorage.setItem(key(u),DAILY_FREE_TOKENS);
  localStorage.setItem(initKey(u),"1");
}
function getTokens(u){ return isPro(u)?9999:Number(localStorage.getItem(key(u))||0); }
function setTokens(u,n){ if(!isPro(u)) localStorage.setItem(key(u),Math.max(0,n)); }
function spend(u){
  if(isPro(u)) return true;
  const t=getTokens(u); if(t<=0) return false;
  setTokens(u,t-1); return true;
}
function paint(u){
  $("dailyChip").textContent=isPro(u)?"♾️ Limitsiz":`🎟️ Hak: ${getTokens(u)}`;
  $("planChip").textContent=isPro(u)?"PRO":"FREE";
}

/* ===== 8 OYUN (SENİN İSİMLERİN) ===== */
const GAMES = [
  { name:"Audio Spy",      icon:"📡", desc:"Ses takibi",       url:"/pages/spy.html" },
  { name:"Sentence",       icon:"🧩", desc:"Cümle kur",        url:"/pages/sentence.html" },
  { name:"Neural",         icon:"🧠", desc:"Hızlı seçim",      url:"/pages/neural.html" },
  { name:"Meteor",         icon:"☄️", desc:"Refleks",          url:"/pages/meteor.html" },
  { name:"Hangman",        icon:"🛰️", desc:"Kelime tahmin",    url:"/pages/hangman.html" },
  { name:"Glitch",         icon:"⚡", desc:"Doğruyu yakala",   url:"/pages/glitch.html" },
  { name:"Gap",            icon:"🔤", desc:"Boşluk doldur",    url:"/pages/gap.html" },
  { name:"Duo Battle",     icon:"🥊", desc:"AI düellosu",      url:"/pages/duo.html" },
];

function render(u){
  const g=$("gameGrid"); g.innerHTML="";
  GAMES.forEach(x=>{
    const c=document.createElement("div"); c.className="card";
    c.innerHTML=`<div class="icon">${x.icon}</div>
      <div class="name">${x.name}</div>
      <div class="desc">${x.desc}</div>`;
    c.onclick=()=>{
      if(!spend(u)){ toast("Hakkın bitti"); paint(u); return; }
      paint(u); location.href=x.url;
    };
    g.appendChild(c);
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  const u=ensureLogged();
  ensureDaily(u);
  paint(u); render(u);

  $("earnBtn").onclick=()=>{
    if(isPro(u)) return toast("PRO limitsiz");
    setTokens(u,getTokens(u)+1);
    paint(u); toast("+1 hak");
  };
  $("startBtn").onclick=()=>{ $("gameGrid").firstChild?.click(); };
  $("backBtn").onclick=()=>location.href="/pages/home.html";
});
