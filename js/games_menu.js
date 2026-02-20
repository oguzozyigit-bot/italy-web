// FILE: /js/games_menu.js
import { mountShell, setHeaderTokens } from "/js/ui_shell.js";
import { supabase } from "/js/supabase_client.js";
import { ensureAuthAndCacheUser } from "/js/auth.js";

const $ = (id)=>document.getElementById(id);

const DAY_MS = 24 * 60 * 60 * 1000;

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = String(msg || "");
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1800);
}

function passKey(gameId, userId){
  return `italky_24h_${String(gameId).trim()}_${String(userId).trim()}`;
}

function isPassActive(gameId, userId){
  const raw = localStorage.getItem(passKey(gameId, userId));
  const ts = Number(raw || 0);
  if(!ts) return false;
  return (Date.now() - ts) < DAY_MS;
}

function setPassNow(gameId, userId){
  localStorage.setItem(passKey(gameId, userId), String(Date.now()));
}

function setDot(gameId, on){
  const g = String(gameId || "").trim();
  if(!g) return;
  const dot = document.querySelector(`.statusDot[data-dot="${g}"]`);
  if(!dot) return;
  dot.classList.toggle("on", !!on);
}

function refreshDots(userId){
  document.querySelectorAll(".game-module[data-game]").forEach(card=>{
    const g = String(card.getAttribute("data-game") || "").trim();
    if(!g) return;
    setDot(g, isPassActive(g, userId));
  });
}

async function loadTokens(userId){
  const { data, error } = await supabase.from("profiles").select("tokens").eq("id", userId).single();
  if(error) throw error;
  return Number(data?.tokens ?? 0);
}

async function setTokens(userId, newVal){
  const { error } = await supabase.from("profiles").update({ tokens: newVal }).eq("id", userId);
  if(error) throw error;
}

async function init(){
  mountShell({ scroll:"none" });

  const { data:{ session } } = await supabase.auth.getSession();
  if(!session?.user){
    location.href = "/pages/login.html";
    return;
  }

  const cached = await ensureAuthAndCacheUser().catch(()=>null);
  if(cached?.tokens != null) setHeaderTokens(cached.tokens);

  const userId = session.user.id;

  let tokens = null;
  try{
    tokens = await loadTokens(userId);
    $("tokenBadge").textContent = `Jeton: ${tokens}`;
    setHeaderTokens(tokens);
  }catch{
    $("tokenBadge").textContent = "Jeton: —";
  }

  // ✅ ilk durum
  refreshDots(userId);

  // ✅ görünür olunca tekrar kontrol et (geri dönünce vs)
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible"){
      refreshDots(userId);
    }
  });

  // ✅ 30 sn’de bir refresh (sadece dot için)
  setInterval(()=>refreshDots(userId), 30000);

  // click handlers
  document.querySelectorAll(".game-module[data-game][data-url]").forEach(card=>{
    card.addEventListener("click", async ()=>{
      const gameId = String(card.getAttribute("data-game") || "").trim();
      const url = String(card.getAttribute("data-url") || "").trim();
      if(!gameId || !url) return;

      // pass varsa direkt gir
      if(isPassActive(gameId, userId)){
        refreshDots(userId);
        location.href = url;
        return;
      }

      // pass yoksa 1 jeton düş
      try{
        if(tokens == null) tokens = await loadTokens(userId);

        if(tokens <= 0){
          toast("Devam etmek için jeton gerekli.");
          return;
        }

        const newTokens = tokens - 1;
        await setTokens(userId, newTokens);
        tokens = newTokens;

        $("tokenBadge").textContent = `Jeton: ${tokens}`;
        setHeaderTokens(tokens);

        // ✅ pass yaz + dot YEŞİL yap
        setPassNow(gameId, userId);
        setDot(gameId, true);

        toast("24 saatlik giriş hakkı aktif.");
        setTimeout(()=>location.href = url, 250);

      }catch(e){
        console.error(e);
        toast("Jeton düşülemedi.");
      }
    });
  });
}

init();
