// FILE: /js/game_page.js
import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);
function safeJson(s, fb={}){ try{ return JSON.parse(s||""); }catch{ return fb; } }

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
function getUser(){ return safeJson(localStorage.getItem(STORAGE_KEY), {}); }
function ensureLogged(){
  const u = getUser();
  if(!u?.email){ location.replace("/index.html"); return null; }
  if(!localStorage.getItem(termsKey(u.email))){ location.replace("/index.html"); return null; }
  return u;
}

function isPro(u){
  const p = String(u?.plan || "").toUpperCase().trim();
  return p === "PRO" || p === "PREMIUM" || p === "PLUS";
}

function paintHeader(u){
  const full = (u.fullname || u.name || u.display_name || u.email || "—").trim();
  $("userName").textContent = full;
  $("userPlan").textContent = String(u.plan || "FREE").toUpperCase();
  $("planChip").textContent = String(u.plan || "FREE").toUpperCase();

  const avatarBtn = $("avatarBtn");
  const fallback = $("avatarFallback");
  const pic = String(u.picture || u.avatar || u.avatar_url || "").trim();
  if(pic){
    avatarBtn.innerHTML = `<img src="${pic}" alt="avatar" referrerpolicy="no-referrer">`;
  }else{
    fallback.textContent = (full && full[0]) ? full[0].toUpperCase() : "•";
  }
  avatarBtn.addEventListener("click", ()=> location.href="/pages/profile.html");

  $("logoHome").addEventListener("click", ()=> location.href="/pages/home.html");
  $("backBtn").addEventListener("click", ()=>{
    if(history.length>1) history.back();
    else location.href="/pages/home.html";
  });
}

/* ===== Daily “entry token” system (web placeholder for ads) =====
   - FREE: needs tokens to enter a game
   - PRO: unlimited
*/
function isoDateLocal(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function tokenKey(u){
  return `italky_game_tokens::${String(u.user_id||u.id||u.email).toLowerCase().trim()}::${isoDateLocal()}`;
}
function getTokens(u){
  if(isPro(u)) return 9999;
  const v = Number(localStorage.getItem(tokenKey(u)) || "0");
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}
function setTokens(u, n){
  if(isPro(u)) return;
  localStorage.setItem(tokenKey(u), String(Math.max(0, Math.floor(n))));
}
function addTokens(u, add){
  if(isPro(u)) return 9999;
  const next = getTokens(u) + Math.max(0, Math.floor(add));
  setTokens(u, next);
  return next;
}
function spendToken(u){
  if(isPro(u)) return true;
  const t = getTokens(u);
  if(t <= 0) return false;
  setTokens(u, t-1);
  return true;
}
function paintTokens(u){
  $("dailyChip").textContent = isPro(u) ? "♾️ Limitsiz" : `🎟️ Hak: ${getTokens(u)}`;
}

/* ===== Games list (edit paths as you wish) ===== */
const GAMES = [
  { id:"hangman", name:"Neon Hangman", icon:"🛰️", desc:"Kelime tahmin — hız + öğrenme", url:"/pages/hangman.html", ready:false },
  { id:"sentence", name:"Sentence Master", icon:"🧩", desc:"Cümle kur — hızlı pratik", url:"/pages/sentence_master.html", ready:false },
  { id:"meteor", name:"Meteor Defense", icon:"☄️", desc:"Refleks + kelime", url:"/pages/meteor.html", ready:false },
  { id:"glitch", name:"Glitch Hunter", icon:"⚡", desc:"Doğru kelimeyi yakala", url:"/pages/glitch.html", ready:false },
  { id:"gap", name:"Gap Master", icon:"🧠", desc:"Boşluk doldurma", url:"/pages/gap_master.html", ready:false },
  { id:"life", name:"Life Alchemist", icon:"🧪", desc:"Seçimler + dil", url:"/pages/life_alchemist.html", ready:false },
];

function renderGrid(u){
  const grid = $("gameGrid");
  grid.innerHTML = "";

  GAMES.forEach(g=>{
    const card = document.createElement("div");
    card.className = "card";

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = g.icon;

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = g.name;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = g.desc;

    const meta = document.createElement("div");
    meta.className = "metaRow";

    const tag1 = document.createElement("div");
    tag1.className = "tag " + (g.ready ? "ready" : "lock");
    tag1.textContent = g.ready ? "HAZIR" : "YAKINDA";

    const tag2 = document.createElement("div");
    tag2.className = "tag";
    tag2.textContent = isPro(u) ? "PRO" : "FREE";

    meta.appendChild(tag1);
    meta.appendChild(tag2);

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(meta);

    card.addEventListener("click", ()=>{
      if(!g.ready){
        toast("Bu oyun sayfasını bağlayınca HAZIR olacak.");
        return;
      }
      if(isPro(u)){
        location.href = g.url;
        return;
      }
      if(!spendToken(u)){
        toast("Hakkın bitti. Hak kazan butonuna bas.");
        paintTokens(u);
        return;
      }
      paintTokens(u);
      location.href = g.url;
    });

    grid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  const u = ensureLogged();
  if(!u) return;

  paintHeader(u);
  paintTokens(u);
  renderGrid(u);

  $("earnBtn").addEventListener("click", ()=>{
    if(isPro(u)){
      toast("PRO: hak derdi yok 😄");
      return;
    }
    // Web’de reklam yok; placeholder: 1 hak ver
    addTokens(u, 1);
    paintTokens(u);
    toast("✅ +1 hak eklendi (reklam yerine test).");
  });

  $("startBtn").addEventListener("click", ()=>{
    const firstReady = GAMES.find(x=>x.ready);
    if(!firstReady){
      toast("Önce bir oyun sayfasını bağlayalım (hazır URL ver).");
      return;
    }
    if(isPro(u)) { location.href = firstReady.url; return; }
    if(!spendToken(u)){ toast("Hakkın yok. Hak kazan."); return; }
    paintTokens(u);
    location.href = firstReady.url;
  });
});
