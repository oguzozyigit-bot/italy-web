// ✅ italkyAI Merkezi Arayüz Sistemi (Shell)
import { STORAGE_KEY } from "/js/config.js";
import { applyI18n } from "/js/i18n.js";

/* ✅ HOME'DAN ALINAN PREMIUM HEADER */
const HOME_HEADER_HTML = `
<header class="premium-header">
  <div class="brand-group" id="brandHome" title="Ana sayfa">
    <h1><span>italky</span><span class="ai">AI</span></h1>
    <div class="brand-slogan">BE FREE</div>
  </div>

  <div class="user-plain" id="profileBtn" title="Profil">
    <div class="user-meta-stack">
      <div class="uName" id="userName">Kullanıcı</div>
      <div class="uJeton">Jeton: <span id="headerJeton">0</span> Adet</div>
    </div>
    <div class="avatar"><img src="" id="userPic" alt=""></div>
  </div>
</header>
`;

/* ✅ HOME'DAN ALINAN PREMIUM FOOTER */
const HOME_FOOTER_HTML = `
<footer class="premium-footer">
  <nav class="footer-nav">
    <a href="/pages/about.html">Hakkımızda</a>
    <a href="/pages/faq.html">SSS</a>
    <a href="/pages/privacy.html">Gizlilik</a>
    <a href="/pages/contact.html">İletişim</a>
  </nav>
  <div class="prestige-signature">italkyAI By Ozyigit’s 2026</div>
</footer>
`;

/* ✅ HOME'DAKİ TÜM CSS TASARIMI BURAYA TAŞINDI */
const SHELL_CSS = `
:root{
  --bg-void:#02000f;
  --text-main:#fff;
  --text-muted: rgba(255,255,255,0.65);
  --footerH: 92px;
  --bar-bg: rgba(0,0,0,0.18);
  --edgePad: 14px;
}

*{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; outline:none; }
html,body{
  margin:0; padding:0; width:100%; height:100%;
  overflow:hidden; position:fixed;
  font-family:'Outfit', sans-serif;
  background-color: var(--bg-void);
}

/* Nebula ve Yıldız Arka Planı */
.nebula-bg{
  position:absolute; inset:-10%; width:120%; height:120%;
  background:
    radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.38) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.28) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(30, 0, 60, 1) 0%, #02000f 100%);
  filter: blur(60px);
  z-index:0;
  animation: nebulaPulse 15s infinite alternate ease-in-out;
  pointer-events:none;
}
@keyframes nebulaPulse{ from{ transform: scale(1); } to{ transform: scale(1.1); } }

.stars-field{
  position:absolute; inset:0;
  background:url("https://www.transparenttextures.com/patterns/stardust.png");
  opacity:0.38; z-index:1; pointer-events:none;
}

.app-shell{
  position:relative; z-index:10;
  width:100%; max-width:480px; height:100%;
  margin:0 auto;
  display:flex; flex-direction:column;
  background: rgba(10,10,30,0.40);
  backdrop-filter: blur(30px);
}

/* Header Tasarımı */
.premium-header{
  padding: calc(10px + env(safe-area-inset-top)) 18px 10px;
  display:flex; align-items:flex-start; justify-content:space-between;
  background: var(--bar-bg);
  border-bottom-left-radius: 22px; border-bottom-right-radius: 22px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(30px);
}

.user-meta-stack {
  display: flex; flex-direction: column; align-items: flex-end;
  margin-top: 2px; margin-right: 10px;
}

.uName { font-weight: 1000; font-size: 14px; color: rgba(255,255,255,0.92); }

/* ✅ JETON TEXT TASARIMI */
.uJeton {
  font-size: 11px; font-weight: 800; color: #a5b4fc;
  text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px;
}

.avatar{
  width: 40px; height: 40px; border-radius: 999px; overflow:hidden;
  border: 2px solid rgba(99,102,241,0.65); background: rgba(255,255,255,0.10);
}
.avatar img{ width:100%; height:100%; object-fit:cover; }

.main-content{ flex:1; overflow-y:auto; padding: var(--edgePad) 20px 110px; scrollbar-width:none; }
.main-content::-webkit-scrollbar{ display:none; }

/* Footer Tasarımı */
.premium-footer{
  position: fixed; bottom: 0; width: min(480px, 100%);
  height: var(--footerH);
  background: var(--bar-bg);
  border-top-left-radius: 22px; border-top-right-radius: 22px;
  border-top: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(30px);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 8px;
}

.brand-group h1{ font-family:'Space Grotesk'; font-size: 30px; font-weight:700; display:flex; gap:2px; margin:0;}
.brand-group h1 .ai{ background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
`;

function ensureStyleOnce(){
  if(document.getElementById("italkyShellStyle")) return;
  const st = document.createElement("style");
  st.id = "italkyShellStyle";
  st.textContent = SHELL_CSS;
  document.head.appendChild(st);
}

async function fillUser(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const u = JSON.parse(raw);
    const elName = document.getElementById("userName");
    const elPic  = document.getElementById("userPic");
    const elJeton = document.getElementById("headerJeton");
    if(elName) elName.textContent = u.name || "Kullanıcı";
    if(elPic && u.picture) elPic.src = u.picture;
    if(elJeton) elJeton.textContent = u.tokens || 0; // Supabase'deki tokens alanından beslenir
  }catch{}
}

export function mountShell(options = {}){
  const { enabled = true, header = true, footer = true } = options;
  if(!enabled) return;

  ensureStyleOnce();

  const content = document.getElementById("pageContent");
  if(!content) return;

  // Nebula ve Yıldızları ekle
  if(!document.querySelector(".nebula-bg")){
    const n = document.createElement("div"); n.className = "nebula-bg";
    const s = document.createElement("div"); s.className = "stars-field";
    document.body.appendChild(n); document.body.appendChild(s);
  }

  const shell = document.createElement("div");
  shell.className = "app-shell";
  shell.innerHTML = (header ? HOME_HEADER_HTML : "") + `<main class="main-content"></main>` + (footer ? HOME_FOOTER_HTML : "");

  const main = shell.querySelector(".main-content");
  main.appendChild(content);

  // Body'yi temizle ve shell'i bas
  const keep = Array.from(document.body.children).filter(el => el.className === "nebula-bg" || el.className === "stars-field");
  document.body.innerHTML = "";
  keep.forEach(el => document.body.appendChild(el));
  document.body.appendChild(shell);

  document.getElementById("brandHome")?.addEventListener("click", ()=>location.href="/pages/home.html");
  document.getElementById("profileBtn")?.addEventListener("click", ()=>location.href="/pages/profile.html");

  import("/js/auth.js").then(m => m.ensureAuthAndCacheUser?.()).finally(() => fillUser());
}
