/* FILE: /js/ui_shell.js */
import { STORAGE_KEY } from "/js/config.js";

/* ===============================
   HOME HEADER/FOOTER (BİREBİR)
================================ */
const HOME_HEADER_HTML = `
<header class="premium-header" id="italkyHeader">
  <div class="brand-group" id="brandHome" style="cursor:pointer;">
    <h1><span>italky</span><span class="ai">AI</span></h1>
    <div class="brand-slogan">BE FREE</div>
  </div>

  <div class="user-info" id="profileBtn" title="Profil">
    <div class="uMeta">
      <div class="uName" id="userName">Kullanıcı</div>
      <div class="uJeton">Jeton: <span id="headerJeton">—</span></div>
    </div>
    <div class="avatar"><img src="" id="userPic" alt=""></div>
  </div>
</header>
`;

const HOME_FOOTER_HTML = `
<footer class="premium-footer" id="italkyFooter">
  <nav class="footer-nav">
    <a href="/pages/about.html">Hakkımızda</a>
    <a href="/pages/faq.html">SSS</a>
    <a href="/pages/privacy.html">Gizlilik</a>
    <a href="/pages/contact.html">İletişim</a>
  </nav>
  <div class="signature">italkyAI @ italkyAcademy By Ozyigit's • 2026</div>
</footer>
`;

/* ===============================
   SHELL CSS (HOME ile uyumlu)
   ✅ footer absolute (home gibi)
   ✅ replaceChildren yok → tıklama/scroll bozulmaz
   ✅ dış domain yok (CSP-safe)
================================ */
const SHELL_CSS = `
:root{
  --ai-gradient: linear-gradient(135deg, #a5b4fc 0%, #6366f1 50%, #ec4899 100%);
  --bg-void: #02000f;
  --footerH: 0px;
}

*{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; outline:none; }

html, body{
  margin:0; padding:0;
  width:100%;
  height:100%;
  background: var(--bg-void) !important;
  font-family:'Outfit', sans-serif;
  overflow:hidden;
  color:#fff;
}

/* 🟣 Nebula background (CSP-safe) */
.italky-bg{
  position: fixed; inset: 0;
  pointer-events:none;
  z-index: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.38) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.28) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(30, 0, 60, 1) 0%, #02000f 100%);
  filter: blur(60px);
}
.italky-noise{
  position: fixed; inset:0;
  pointer-events:none;
  z-index: 1;
  opacity: 0.05;
  background-image:
    radial-gradient(circle at 10% 20%, rgba(255,255,255,0.25) 0 1px, transparent 2px),
    radial-gradient(circle at 70% 80%, rgba(255,255,255,0.18) 0 1px, transparent 2px),
    radial-gradient(circle at 40% 50%, rgba(255,255,255,0.14) 0 1px, transparent 2px);
  background-size: 140px 140px, 180px 180px, 220px 220px;
}

/* HOME frame */
.app-viewport{
  position:relative;
  z-index: 5;
  width:100%;
  max-width:430px;
  height:100dvh;
  margin:0 auto;
  display:flex;
  flex-direction:column;
  background: rgba(10, 10, 30, 0.4);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-left: 1px solid rgba(255,255,255,0.1);
  border-right: 1px solid rgba(255,255,255,0.1);
  overflow:hidden;
}

/* HEADER (HOME birebir) */
.premium-header{
  padding: calc(45px + env(safe-area-inset-top)) 18px 15px;
  display:flex; align-items:flex-start; justify-content:space-between;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.2);
  flex: 0 0 auto;
}
.brand-group h1{
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  margin: 0;
  font-weight: 700;
  line-height: 1;
  display:flex;
  gap:2px;
}
.brand-group h1 .ai{
  background: var(--ai-gradient);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
}
.brand-slogan{
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  margin-top: 5px;
}

.user-info{ display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
.uMeta{ display:flex; flex-direction:column; align-items:flex-end; }
.uName{ font-weight:900; font-size:13px; max-width: 160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.uJeton{ font-size:10px; font-weight:900; color:#a5b4fc; }
.avatar{
  width:36px; height:36px;
  border-radius:50%;
  border: 1.5px solid #6366f1;
  overflow:hidden;
  background: rgba(255,255,255,0.1);
}
.avatar img{ width:100%; height:100%; object-fit:cover; display:block; }

/* MAIN: içerik buraya taşınır */
.shellMain{
  flex:1;
  min-height:0;
  overflow-y:auto;
  -webkit-overflow-scrolling: touch;
  padding: 0;
  /* footer kadar alt boşluk */
  padding-bottom: calc(var(--footerH) + 8px);
}
.shellMain::-webkit-scrollbar{ display:none; }

/* FOOTER (HOME birebir, absolute) */
.premium-footer{
  position:absolute;
  left:0; right:0; bottom:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 10px 10px calc(10px + env(safe-area-inset-bottom));
  box-sizing:border-box;
  z-index: 50;
}
.footer-nav{
  display:flex;
  gap:20px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  justify-content:center;
  line-height: 1;
}
.footer-nav a{
  font-size:10px;
  font-weight:900;
  color: rgba(255,255,255,0.4);
  text-decoration:none;
  text-transform: uppercase;
}
.signature{
  font-size:11px;
  font-weight:900;
  background: linear-gradient(to right, #fff, #6366f1, #fff);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  opacity: 0.7;
  text-align:center;
}
`;

/* ===============================
   HELPERS
================================ */
function injectShellStyle(){
  if(document.getElementById("italkyShellStyle")) return;
  const st = document.createElement("style");
  st.id = "italkyShellStyle";
  st.textContent = SHELL_CSS;
  document.head.appendChild(st);
}

export function shortDisplayName(fullName){
  const s = String(fullName || "").trim().replace(/\s+/g," ");
  if(!s) return "Kullanıcı";
  const parts = s.split(" ").filter(Boolean);
  if(parts.length === 1) return parts[0];
  const last = parts[parts.length-1];
  const first = parts.slice(0,-1).join(" ");
  const initial = last?.[0] ? (last[0].toUpperCase() + ".") : "";
  return `${first} ${initial}`.trim();
}

function safeSetText(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = (val ?? "");
}

function safeSetImg(id, src){
  const el = document.getElementById(id);
  if(el && src){
    el.src = src;
    el.referrerPolicy = "no-referrer";
  }
}

export function setHeaderTokens(n){
  safeSetText("headerJeton", (n == null ? "—" : String(n)));
}

export function hydrateFromCache(){
  safeSetText("headerJeton","—");
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const u = JSON.parse(raw);

    const nm = u?.display_name || u?.name || u?.full_name || u?.email || "";
    safeSetText("userName", shortDisplayName(nm));

    const pic = u?.picture || u?.avatar || u?.avatar_url || "";
    if(pic) safeSetImg("userPic", pic);

    if(u?.tokens != null) safeSetText("headerJeton", String(u.tokens));
  }catch{}
}

function syncFooterHeight(){
  try{
    const footer = document.getElementById("italkyFooter");
    if(!footer) return;
    const h = Math.round(footer.getBoundingClientRect().height || 0);
    if(h > 0) document.documentElement.style.setProperty("--footerH", h + "px");
  }catch{}
}

/* ===============================
   MOUNT (replaceChildren YOK!)
================================ */
export function mountShell(options = {}){
  injectShellStyle();

  // beyaz flash fix
  try{
    document.documentElement.style.backgroundColor = "#02000f";
    document.body.style.backgroundColor = "#02000f";
  }catch{}

  // zaten kuruluysa
  if(document.getElementById("italkyAppShell")){
    const main = document.getElementById("shellMain");
    if(main){
      main.style.overflowY = (options?.scroll === "none") ? "hidden" : "auto";
    }
    hydrateFromCache();
    syncFooterHeight();
    return;
  }

  const content = document.getElementById("pageContent");
  if(!content) return;

  // background layers
  const bg = document.createElement("div");
  bg.className = "italky-bg";
  const noise = document.createElement("div");
  noise.className = "italky-noise";

  // shell
  const shell = document.createElement("div");
  shell.className = "app-viewport";
  shell.id = "italkyAppShell";
  shell.innerHTML = HOME_HEADER_HTML + `<main class="shellMain" id="shellMain"></main>` + HOME_FOOTER_HTML;

  const main = shell.querySelector("#shellMain");
  main.appendChild(content);
  main.style.overflowY = (options?.scroll === "none") ? "hidden" : "auto";

  // ✅ body’yi sıfırlama YOK → tıklama/scroll bozulmaz
  document.body.prepend(bg, noise, shell);

  document.getElementById("brandHome")?.addEventListener("click", ()=>location.href="/pages/home.html");
  document.getElementById("profileBtn")?.addEventListener("click", ()=>location.href="/pages/profile.html");

  hydrateFromCache();
  syncFooterHeight();

  // footer ölç (dinamik cihazlar)
  const footer = document.getElementById("italkyFooter");
  if(footer){
    const ro = new ResizeObserver(()=>syncFooterHeight());
    ro.observe(footer);
  }
  window.addEventListener("resize", syncFooterHeight);
  window.addEventListener("load", ()=>{
    syncFooterHeight();
    setTimeout(syncFooterHeight, 120);
    setTimeout(syncFooterHeight, 260);
  });
}
