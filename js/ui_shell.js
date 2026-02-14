// ✅ italkyAI Merkezi Arayüz Sistemi (Shell)
import { STORAGE_KEY } from "/js/config.js";
import { applyI18n } from "/js/i18n.js";

/* ✅ HOME HEADER (GÜNCEL JETON ALANI EKLENDİ) */
const HOME_HEADER_HTML = `
<header class="premium-header">
  <div class="brand-group" id="brandHome" title="Ana sayfa">
    <h1><span>italky</span><span class="ai">AI</span></h1>
    <div class="brand-slogan">BE FREE</div>
  </div>

  <div class="user-plain" id="profileBtn" title="Profil">
    <div class="user-meta-group">
      <div class="uName" id="userName">Kullanıcı</div>
      <div class="uJeton">Jeton: <span id="headerJeton">0</span> Adet</div>
    </div>
    <div class="avatar"><img src="" id="userPic" alt=""></div>
  </div>
</header>
`;

/* ✅ HOME FOOTER (SABİT) */
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

/* ✅ SHELL CSS (JETON TASARIMI DAHİL) */
const SHELL_CSS = `
:root{
  --bg-void:#02000f;
  --text-main:#fff;
  --footerH: 92px;
  --bar-bg: rgba(0,0,0,0.40);
}

*{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; outline:none; }
html,body{
  margin:0; padding:0; width:100%; height:100%;
  overflow:hidden; position:fixed;
  font-family:'Outfit', sans-serif;
  background-color: var(--bg-void);
  color: var(--text-main);
}

.app-shell{
  position:relative; z-index:10;
  width:100%; max-width:480px; height:100%;
  margin:0 auto;
  display:flex; flex-direction:column;
  background: rgba(10,10,30,0.40);
  backdrop-filter: blur(30px);
}

/* HEADER TASARIMI */
.premium-header{
  padding: calc(10px + env(safe-area-inset-top)) 18px 10px;
  display:flex; align-items:center; justify-content:space-between;
  background: var(--bar-bg);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(30px);
}

.user-meta-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: 10px;
}

.uName {
  font-weight: 900;
  font-size: 14px;
  color: #fff;
  white-space: nowrap;
}

/* ✅ JETON TEXT STİLİ */
.uJeton {
  font-size: 10px;
  font-weight: 800;
  color: #a5b4fc; /* Jeton rengi indigo */
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.avatar{
  width: 40px; height: 40px;
  border-radius: 999px;
  overflow:hidden;
  border: 2px solid rgba(99,102,241,0.65);
}
.avatar img{ width:100%; height:100%; object-fit:cover; display:block; }

.main-content{ flex:1; overflow-y:auto; padding-bottom: var(--footerH); scrollbar-width:none; }
.main-content::-webkit-scrollbar{ display:none; }

.premium-footer{
  position: fixed; bottom: 0; width: min(480px, 100%);
  height: var(--footerH);
  background: var(--bar-bg);
  border-top: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(30px);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
}
`;

function ensureStyleOnce(){
  if(document.getElementById("italkyShellStyle")) return;
  const st = document.createElement("style");
  st.id = "italkyShellStyle";
  st.textContent = SHELL_CSS;
  document.head.appendChild(st);
}

/* ---------------- VERİ DOLDURMA ---------------- */

async function fillUser(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const u = JSON.parse(raw);

    const elName = document.getElementById("userName");
    const elPic  = document.getElementById("userPic");
    if(elName) elName.textContent = u.name || "Kullanıcı";
    if(elPic && u.picture) elPic.src = u.picture;

    // ✅ Jeton miktarını header'a bas (BootPage bunu Supabase'den güncelleyecek)
    const elJeton = document.getElementById("headerJeton");
    if(elJeton && u.jeton) elJeton.textContent = u.jeton;
  }catch{}
}

/* ---------------- SHELL MONTAJI ---------------- */

export function mountShell(options = {}){
  const { enabled = true, header = true, footer = true } = options;
  if(!enabled) return;

  ensureStyleOnce();

  const content = document.getElementById("pageContent");
  if(!content) return;

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const headerHTML = header ? HOME_HEADER_HTML : "";
  const footerHTML = footer ? HOME_FOOTER_HTML : "";
  shell.innerHTML = headerHTML + `<main class="main-content"></main>` + footerHTML;

  const main = shell.querySelector(".main-content");
  main.appendChild(content);

  document.body.innerHTML = "";
  document.body.appendChild(shell);

  document.getElementById("brandHome")?.addEventListener("click", ()=>location.href="/pages/home.html");
  document.getElementById("profileBtn")?.addEventListener("click", ()=>location.href="/pages/profile.html");

  try{ applyI18n?.(document); }catch{}

  // ✅ Verileri yükle ve Supabase senkronizasyonunu başlat
  import("/js/auth.js").then(m => m.ensureAuthAndCacheUser?.())
    .finally(() => fillUser());
}
