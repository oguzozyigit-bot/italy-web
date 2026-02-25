// FILE: /js/games_menu.js
import { mountShell, setHeaderTokens } from "/js/ui_shell.js";
import { supabase } from "/js/supabase_client.js";
import { ensureAuthAndCacheUser } from "/js/auth.js";

const $ = (id)=>document.getElementById(id);

const DAY_MS = 24 * 60 * 60 * 1000;
let userId = null;
let tokensCache = null;
let busy = false;

/* ---------------- Toast ---------------- */
function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = String(msg || "");
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1800);
}

/* ---------------- Fade (white flash fix) ---------------- */
function fadeNavigate(url){
  let fade = document.getElementById("navFade");
  if(!fade){
    fade = document.createElement("div");
    fade.id = "navFade";
    fade.style.position = "fixed";
    fade.style.inset = "0";
    fade.style.background = "#02000f";
    fade.style.opacity = "0";
    fade.style.transition = "opacity .15s ease";
    fade.style.zIndex = "9999999";
    document.body.appendChild(fade);
  }

  fade.style.opacity = "1";

  setTimeout(()=>{
    try{ location.assign(url); }
    catch{ location.href = url; }
  }, 120);
}

/* ---------------- 24h PASS ---------------- */
function passKey(gameId){
  return `italky_24h_${gameId}_${userId}`;
}

function isPassActive(gameId){
  const raw = localStorage.getItem(passKey(gameId));
  const ts = Number(raw || 0);
  if(!ts) return false;
  return (Date.now() - ts) < DAY_MS;
}

function setPassNow(gameId){
  localStorage.setItem(passKey(gameId), String(Date.now()));
}

function setDot(gameId, on){
  const dot = document.querySelector(`.statusDot[data-dot="${gameId}"]`);
  if(!dot) return;
  dot.classList.toggle("on", !!on);
}

function refreshDots(){
  document.querySelectorAll(".game-module[data-game]").forEach(card=>{
    const g = card.getAttribute("data-game");
    if(!g) return;
    setDot(g, isPassActive(g));
  });
}

/* ---------------- TOKENS ---------------- */
async function loadTokens(){
  const { data, error } = await supabase
    .from("profiles")
    .select("tokens")
    .eq("id", userId)
    .single();

  if(error) throw error;
  return Number(data?.tokens ?? 0);
}

async function setTokens(newVal){
  const { error } = await supabase
    .from("profiles")
    .update({ tokens: newVal })
    .eq("id", userId);

  if(error) throw error;
}

/* ---------------- INIT ---------------- */
async function init(){
  mountShell({ scroll:"none" });

  const { data:{ session } } = await supabase.auth.getSession();
  if(!session?.user){
    location.href = "/pages/login.html";
    return;
  }

  userId = session.user.id;

  const cached = await ensureAuthAndCacheUser().catch(()=>null);
  if(cached?.tokens != null){
    setHeaderTokens(cached.tokens);
  }

  try{
    tokensCache = await loadTokens();
    $("tokenBadge").textContent = `Jeton: ${tokensCache}`;
    setHeaderTokens(tokensCache);
  }catch{
    $("tokenBadge").textContent = "Jeton: —";
  }

  refreshDots();

  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible"){
      refreshDots();
    }
  });

  setInterval(refreshDots, 30000);

  /* ---------------- GAME CLICK ---------------- */
  document.querySelectorAll(".game-module[data-game][data-url]").forEach(card=>{
    card.addEventListener("click", async ()=>{
      if(busy) return;
      busy = true;

      const gameId = card.getAttribute("data-game");
      const url = card.getAttribute("data-url");
      if(!gameId || !url){
        busy = false;
        return;
      }

      // 24h pass varsa direkt gir
      if(isPassActive(gameId)){
        refreshDots();
        fadeNavigate(url);
        busy = false;
        return;
      }

      try{
        if(tokensCache == null){
          tokensCache = await loadTokens();
        }

        if(tokensCache <= 0){
          toast("Devam etmek için jeton gerekli.");
          busy = false;
          return;
        }

        const newTokens = tokensCache - 1;
        await setTokens(newTokens);

        tokensCache = newTokens;
        $("tokenBadge").textContent = `Jeton: ${tokensCache}`;
        setHeaderTokens(tokensCache);

        setPassNow(gameId);
        setDot(gameId, true);

        toast("24 saatlik giriş hakkı aktif.");

        setTimeout(()=>fadeNavigate(url), 200);

      }catch(e){
        console.error(e);
        toast("Jeton düşülemedi.");
      }

      busy = false;
    });
  });
}

init();
