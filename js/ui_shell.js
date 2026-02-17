/* FILE: /js/ui_shell.js */
import { STORAGE_KEY } from "/js/config.js";

/* ✅ ÜST BAR + JETON + PROFİL */
const HOME_HEADER_HTML = `
<header class="premium-header">
  <div class="brand-group" id="brandHome" title="Ana sayfa">
    <h1><span>italky</span><span class="ai">AI</span></h1>
    <div class="brand-slogan">BE FREE</div>
  </div>

  <div class="user-plain" id="profileBtn" title="Profil">
    <div class="uMeta">
      <div class="uName" id="userName">Kullanıcı</div>
      <div class="uJeton">Jeton: <span id="headerJeton">—</span></div>
    </div>
    <div class="avatar"><img src="" id="userPic" alt=""></div>
  </div>
</header>
`;

/* ✅ ALT BAR (PRESTİGE NAV) */
const HOME_FOOTER_HTML = `
<footer class="premium-footer">
  <nav class="footer-nav">
    <a href="/pages/about.html">Hakkımızda</a>
    <a href="/pages/faq.html">SSS</a>
    <a href="/pages/privacy.html">Gizlilik</a>
    <a href="/pages/contact.html">İletişim</a>
  </nav>
  <div class="prestige-signature">italkyAI @ italkyAcedemia By Ozyigit's</div>
</footer>
`;

/* ✅ SHELL CSS (NEBULA ENGINE) */
const SHELL_CSS = `
:root{
  --bg-void:#02000f;
  --text-main:#fff;
  --text-muted: rgba(255,255,255,0.65);
  --neon-glow: 0 0 20px rgba(99,102,241,0.45);
  --ease-premium: cubic-bezier(0.22, 1, 0.36, 1);
  --footerH: 92px;
  --bar-bg: rgba(0,0,0,0.18);
  --edgePad: 14px;
}

*{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; outline:none; }

html,body{
  margin:0; padding:0;
  width:100%; height:100dvh;
  overflow:hidden;
  position:relative;
  font-family:'Outfit', sans-serif;
  background-color: var(--bg-void) !important;
  color: var(--text-main);
  touch-action: manipulation;
}

/* 🌌 Nebula Arka Plan Efektleri */
.nebula-bg{
  position:fixed; inset:-10%; width:120%; height:120%;
  background:
    radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.38) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.28) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(30, 0, 60, 1) 0%, #02000f 100%);
  filter: blur(60px);
  z-index:0;
  animation: nebulaPulse 15s infinite alternate ease-in-out;
  pointer-events:none;
}
@keyframes nebulaPulse{
  from{ transform: scale(1) rotate(0deg); }
  to{ transform: scale(1.1) rotate(2deg); }
}
.stars-field{
  position:fixed; inset:0;
  background:url("https://www.transparenttextures.com/patterns/stardust.png");
  opacity:0.38;
  z-index:1;
  pointer-events:none;
}

/* 📱 Ana Shell Konteynırı */
.app-shell{
  position:relative; z-index:10;
  width:100%; max-width:480px;
  height:100dvh;
  margin:0 auto;
  display:flex; flex-direction:column;
  background: rgba(10,10,30,0.40);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
}

/* Header Tasarımı */
.premium-header{
  padding: calc(10px + env(safe-area-inset-top)) 18px 10px;
  display:flex; align-items:flex-start; justify-content:space-between;
  background: var(--bar-bg);
  border-bottom-left-radius: 22px; border-bottom-right-radius: 22px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.brand-group h1{
  font-family:'Space Grotesk', sans-serif; font-size: 30px; margin:0;
  font-weight:700; letter-spacing:-1px; line-height: 1; display:flex; gap:2px;
}
.brand-group h1 .ai{
  background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 50%, #ec4899 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
.brand-slogan{ font-size: 9px; font-weight: 900; letter-spacing: 3.6px; color: rgba(255,255,255,0.55); text-transform: uppercase; margin-top: 5px; }

.user-plain{ display:flex; align-items:center; gap:10px; cursor:pointer; }
.uMeta{ display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.uName{ font-weight: 1000; font-size: 14px; color: rgba(255,255,255,0.92); max-width: 150px; overflow:hidden; text-overflow:ellipsis; }
.uJeton{ font-size: 11px; font-weight: 900; color: rgba(165,180,252,0.92); letter-spacing: 1px; }
.avatar{ width: 40px; height: 40px; border-radius: 999px; overflow:hidden; border: 2px solid rgba(99,102,241,0.65); background: rgba(255,255,255,0.1); }
.avatar img{ width:100%; height:100%; object-fit:cover; }

/* İçerik Alanı */
.main-content{
  flex:1; overflow-y:auto; -webkit-overflow-scrolling: touch;
  padding: var(--edgePad) 20px calc(var(--footerH) + 20px);
  scrollbar-width:none; position:relative; z-index: 5;
}
.main-content::-webkit-scrollbar{ display:none; }

/* Footer Tasarımı */
.premium-footer{
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 0;
  width: min(480px, 100%); height: calc(var(--footerH) + env(safe-area-inset-bottom));
  z-index: 9999; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  border-top-left-radius: 22px; border-top-right-radius: 22px;
  background: var(--bar-bg); border-top: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
}
.footer-nav{ display:flex; gap: 22px; justify-content:center; }
.footer-nav a{ font-size: 11px; font-weight: 900; color: rgba(255,255,255,0.45); text-decoration:none; text-transform: uppercase; }
.prestige-signature{ font-size: 12px; font-weight: 900; letter-spacing: 1.5px; margin-top: 8px; background: linear-gradient(to right, #fff, #6366f1, #fff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; opacity: 0.8; }
`;

/* ✅ YARDIMCI FONKSİYONLAR */
function injectShellStyle(){
  if (document.getElementById("italkyShellStyle")) return;
  const st = document.createElement("style");
  st.id = "italkyShellStyle";
  st.textContent = SHELL_CSS;
  document.head.appendChild(st);
}

function safeSetText(id, val){
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "";
}

function safeSetImg(id, src){
  const el = document.getElementById(id);
  if (el && src) el.src = src;
}

export function hydrateFromCache(){
  safeSetText("headerJeton", "—");
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const u = JSON.parse(raw);
    if (u?.name) safeSetText("userName", u.name);
    if (u?.picture) safeSetImg("userPic", u.picture);
    if (u?.tokens != null) safeSetText("headerJeton", String(u.tokens));
  }catch{}
}

/* ✅ ANA MOUNT FONKSİYONU */
export function mountShell(options = {}){
  injectShellStyle();
  try{ document.body.style.background = "var(--bg-void)"; }catch{}

  // Eğer zaten shell içindeysek tekrar kurma, sadece içeriği güncelle
  if (document.getElementById("italkyAppShell")) {
    const main = document.getElementById("shellMain");
    if (main && options?.scroll === "none") {
      main.style.overflow = "hidden";
    } else if (main) {
      main.style.overflow = "auto";
    }
    hydrateFromCache();
    return;
  }

  const content = document.getElementById("pageContent");
  if(!content) return;

  // Katmanları Oluştur
  const nebula = document.createElement("div");
  nebula.className = "nebula-bg";
  const stars = document.createElement("div");
  stars.className = "stars-field";

  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.id = "italkyAppShell";
  shell.innerHTML = HOME_HEADER_HTML + `<main class="main-content" id="shellMain"></main>` + HOME_FOOTER_HTML;

  const main = shell.querySelector("#shellMain");
  main.appendChild(content);

  if (options?.scroll === "none") {
    main.style.overflow = "hidden";
  }

  // Body'yi temizle ve Shell'i bas
  document.body.replaceChildren(nebula, stars, shell);

  // Navigasyon Eventleri
  document.getElementById("brandHome")?.addEventListener("click", ()=>location.href="/pages/home.html");
  document.getElementById("profileBtn")?.addEventListener("click", ()=>location.href="/pages/profile.html");

  hydrateFromCache();
}

export function setHeaderTokens(n){
  safeSetText("headerJeton", (n == null ? "—" : String(n)));
}
