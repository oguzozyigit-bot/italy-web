// FILE: /js/auth.js
import { supabase } from "./supabase_client.js";

const HOME_PATH = "/pages/home.html";
const container = document.getElementById("googleBtnContainer");
const toastEl = document.getElementById("toast");

function toast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>toastEl.classList.remove("show"), 2200);
}

function showError(msg){
  if(!container) return;
  container.innerHTML = `
    <div style="width:100%; max-width:320px; padding:10px 12px; border-radius:10px;
                border:1px solid rgba(255,107,107,0.35); background:rgba(255,107,107,0.10);
                color:#ffd1d1; font-size:12px; font-weight:900; text-align:center;">
      ${msg}
    </div>
  `;
}

function renderGoogleButton(){
  if(!container) return;
  container.innerHTML = `
    <button id="googleBtn" type="button"
      style="width:100%; max-width:320px; height:44px; border-radius:10px;
             border:1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06);
             color:#fff; font-size:15px; font-weight:900; cursor:pointer;">
      Google ile Giriş Yap
    </button>
  `;
}

async function redirectIfLoggedIn(){
  const { data, error } = await supabase.auth.getSession();
  if(error){
    console.error("getSession error:", error);
    // session hatası varsa yine de giriş butonunu göster
    return false;
  }
  if(data?.session){
    window.location.replace(HOME_PATH);
    return true;
  }
  return false;
}

async function startGoogleLogin(){
  const btn = document.getElementById("googleBtn");
  if(btn){
    btn.disabled = true;
    btn.style.opacity = "0.75";
  }

  try{
    // ✅ Redirect’i sabitle: HOME’a dönsün
    const redirectTo = `${window.location.origin}${HOME_PATH}`;

    toast("Google yönlendiriliyor...");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if(error){
      console.error("signInWithOAuth error:", error);
      showError(`Google giriş başlatılamadı: ${error.message || error}`);
      if(btn){ btn.disabled = false; btn.style.opacity = "1"; }
      return;
    }

    // Normalde burada redirect olur.
    console.log("OAuth started:", data);
  }catch(e){
    console.error("OAuth crash:", e);
    showError("Google giriş başlatılamadı. (Console hatasına bak)");
    if(btn){ btn.disabled = false; btn.style.opacity = "1"; }
  }
}

function listenAuth(){
  supabase.auth.onAuthStateChange((event, session)=>{
    console.log("Auth event:", event);
    if(session){
      window.location.replace(HOME_PATH);
    }
  });
}

async function boot(){
  try{
    const already = await redirectIfLoggedIn();
    if(already) return;

    renderGoogleButton();
    listenAuth();

    const btn = document.getElementById("googleBtn");
    if(btn) btn.onclick = startGoogleLogin;

  }catch(e){
    console.error("boot error:", e);
    showError("Sistem yüklenemedi. (auth.js)");
  }
}

boot();
