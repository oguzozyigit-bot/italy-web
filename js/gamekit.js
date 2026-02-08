// FILE: /js/gamekit.js
// Italky GameKit — daily token gate + end-of-game modal (no "başkanım" text)

import { STORAGE_KEY } from "/js/config.js";

const $ = (id) => document.getElementById(id);

function safeJson(s, fb = {}) { try { return JSON.parse(s || ""); } catch { return fb; } }

function getUser(){
  return safeJson(localStorage.getItem(STORAGE_KEY), {});
}

function isPro(u){
  const p = String(u?.plan || "").toUpperCase().trim();
  return p === "PRO" || p === "PREMIUM" || p === "PLUS";
}

function isoDateLocal(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function uid(u){
  return String(u.user_id || u.id || u.email || "guest").toLowerCase().trim();
}

function tokenKey(u){
  return `italky_game_tokens::${uid(u)}::${isoDateLocal()}`;
}
function tokenInitKey(u){
  return `italky_game_tokens_init::${uid(u)}::${isoDateLocal()}`;
}

export const GameKit = {
  DAILY_FREE_TOKENS: 25, // ✅ şimdilik 25 (sonra düşürürüz)

  ensureDailyTokens(){
    const u = getUser();
    if(isPro(u)) return;
    if(localStorage.getItem(tokenInitKey(u))) return;

    localStorage.setItem(tokenKey(u), String(this.DAILY_FREE_TOKENS));
    localStorage.setItem(tokenInitKey(u), "1");
  },

  getTokens(){
    const u = getUser();
    if(isPro(u)) return 9999;
    const v = Number(localStorage.getItem(tokenKey(u)) || "0");
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  },

  spendToken(){
    const u = getUser();
    if(isPro(u)) return true;
    const t = this.getTokens();
    if(t <= 0) return false;
    localStorage.setItem(tokenKey(u), String(t - 1));
    return true;
  },

  addToken(n = 1){
    const u = getUser();
    if(isPro(u)) return;
    const t = this.getTokens();
    localStorage.setItem(tokenKey(u), String(t + Math.max(1, Math.floor(n))));
  },

  // ✅ oyuna girerken çağır
  gateEnterOrRedirect({ onAllowed, onBlocked } = {}){
    this.ensureDailyTokens();
    const u = getUser();
    if(isPro(u)){
      onAllowed?.({ pro:true, tokens:9999 });
      return true;
    }
    const ok = this.spendToken();
    if(ok){
      onAllowed?.({ pro:false, tokens:this.getTokens() });
      return true;
    }
    onBlocked?.({ pro:false, tokens:0 });
    this.showEndModal({ title:"Hak bitti", subtitle:"Devam etmek için hak kazan veya PRO’ya geç.", canContinue:false });
    return false;
  },

  // ✅ oyun bittiğinde çağır
  showEndModal({
    title = "Oyun bitti",
    subtitle = "Devam etmek ister misin?",
    scoreText = "",
    canContinue = true,
    onContinue = null,
    onExit = null,
  } = {}){
    const u = getUser();
    this.ensureDailyTokens();

    // overlay root
    let ov = document.getElementById("italkyGameEnd");
    if(ov) ov.remove();

    ov = document.createElement("div");
    ov.id = "italkyGameEnd";
    ov.style.position = "fixed";
    ov.style.inset = "0";
    ov.style.zIndex = "99999";
    ov.style.background = "rgba(0,0,0,.78)";
    ov.style.display = "flex";
    ov.style.alignItems = "center";
    ov.style.justifyContent = "center";
    ov.style.padding = "18px";

    const card = document.createElement("div");
    card.style.width = "min(420px, calc(100vw - 36px))";
    card.style.borderRadius = "26px";
    card.style.border = "1px solid rgba(255,255,255,.14)";
    card.style.background = "rgba(8,8,20,.90)";
    card.style.backdropFilter = "blur(18px)";
    card.style.boxShadow = "0 40px 120px rgba(0,0,0,.75)";
    card.style.padding = "16px";

    const h = document.createElement("div");
    h.style.fontWeight = "1000";
    h.style.fontSize = "16px";
    h.style.marginBottom = "8px";
    h.textContent = title;

    const p = document.createElement("div");
    p.style.fontWeight = "800";
    p.style.fontSize = "12px";
    p.style.color = "rgba(255,255,255,.78)";
    p.style.lineHeight = "1.45";
    p.textContent = subtitle;

    const info = document.createElement("div");
    info.style.marginTop = "12px";
    info.style.padding = "10px 12px";
    info.style.borderRadius = "16px";
    info.style.border = "1px solid rgba(255,255,255,.10)";
    info.style.background = "rgba(255,255,255,.05)";
    info.style.fontWeight = "900";
    info.style.fontSize = "12px";
    const tokenLine = isPro(u) ? "♾️ PRO: limitsiz" : `🎟️ Kalan hak: ${this.getTokens()}`;
    info.textContent = scoreText ? `${scoreText} • ${tokenLine}` : tokenLine;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.marginTop = "14px";
    row.style.flexWrap = "wrap";

    const btnExit = document.createElement("button");
    btnExit.type = "button";
    btnExit.textContent = "Çık";
    btnExit.style.flex = "1";
    btnExit.style.height = "46px";
    btnExit.style.borderRadius = "16px";
    btnExit.style.border = "1px solid rgba(255,255,255,.14)";
    btnExit.style.cursor = "pointer";
    btnExit.style.fontWeight = "1000";
    btnExit.style.color = "#fff";
    btnExit.style.background = "rgba(255,255,255,.06)";
    btnExit.onclick = ()=>{
      ov.remove();
      onExit?.();
      location.href = "/pages/game.html";
    };

    const btnEarn = document.createElement("button");
    btnEarn.type = "button";
    btnEarn.textContent = "Hak Kazan";
    btnEarn.style.flex = "1";
    btnEarn.style.height = "46px";
    btnEarn.style.borderRadius = "16px";
    btnEarn.style.border = "none";
    btnEarn.style.cursor = "pointer";
    btnEarn.style.fontWeight = "1000";
    btnEarn.style.color = "#fff";
    btnEarn.style.background = "linear-gradient(135deg, #00f3ff, #bc13fe)";
    btnEarn.onclick = ()=>{
      // Şimdilik test: +1 hak (ileride reklam)
      this.addToken(1);
      // güncelle
      info.textContent = isPro(u) ? "♾️ PRO: limitsiz" : `🎟️ Kalan hak: ${this.getTokens()}`;
    };

    const btnPro = document.createElement("button");
    btnPro.type = "button";
    btnPro.textContent = "PRO’ya Geç";
    btnPro.style.flex = "1";
    btnPro.style.height = "46px";
    btnPro.style.borderRadius = "16px";
    btnPro.style.border = "none";
    btnPro.style.cursor = "pointer";
    btnPro.style.fontWeight = "1000";
    btnPro.style.color = "#fff";
    btnPro.style.background = "linear-gradient(135deg, #A5B4FC, #4F46E5)";
    btnPro.onclick = ()=>{
      // Web’de ödeme yok: uygulama içi
      alert("PRO aboneliği uygulama içinden yapılır.");
    };

    const btnContinue = document.createElement("button");
    btnContinue.type = "button";
    btnContinue.textContent = "Devam Et";
    btnContinue.style.flex = "1";
    btnContinue.style.height = "46px";
    btnContinue.style.borderRadius = "16px";
    btnContinue.style.border = "none";
    btnContinue.style.cursor = "pointer";
    btnContinue.style.fontWeight = "1000";
    btnContinue.style.color = "#fff";
    btnContinue.style.background = "linear-gradient(135deg, #A5B4FC, #4F46E5)";

    const doContinue = ()=>{
      // PRO: direkt devam
      if(isPro(u)){
        ov.remove();
        onContinue?.();
        return;
      }
      // FREE: hak varsa düşür ve devam et
      if(this.spendToken()){
        ov.remove();
        onContinue?.();
        return;
      }
      // hak yoksa
      canContinue = false;
      title = "Hak bitti";
      p.textContent = "Devam etmek için hak kazan veya PRO’ya geç.";
      btnContinue.disabled = true;
      btnContinue.style.opacity = ".55";
    };

    btnContinue.onclick = doContinue;

    // row build
    row.appendChild(btnExit);

    if(isPro(u)){
      row.appendChild(btnContinue);
    }else{
      if(canContinue){
        row.appendChild(btnContinue);
      }
      row.appendChild(btnEarn);
      row.appendChild(btnPro);
    }

    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(info);
    card.appendChild(row);
    ov.appendChild(card);

    ov.addEventListener("click",(e)=>{ if(e.target === ov) btnExit.click(); });

    document.body.appendChild(ov);
  }
};
