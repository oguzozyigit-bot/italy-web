// FILE: /js/auth.js
import { supabase } from "./supabase_client.js";

// Sabitler: Projenin ana domainini kullanmak en güvenli yoldur.
const HOME_URL = "https://italky.ai/pages/home.html";
const box = document.getElementById("googleBtnContainer");
const toastEl = document.getElementById("toast");

/**
 * Bildirim (Toast) Gösterimi
 */
function toast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>toastEl.classList.remove("show"), 2200);
}

/**
 * Hata Mesajı Gösterimi
 */
function showError(msg){
  if(!box) return;
  box.innerHTML = `<p style="color:#ff6b6b;font-size:12px;font-weight:900;margin:0;text-align:center;">${msg}</p>`;
}

/**
 * Login Butonunu Render Et
 */
function renderBtn(){
  if(!box) return;
  box.innerHTML = `
    <button id="googleBtn" type="button"
      style="width:100%;max-width:320px;height:44px;border-radius:10px;
             border:1px solid rgba(255,255,255,0.12);
             background:rgba(255,255,255,0.06);
             color:#fff;font-size:15px;font-weight:900;cursor:pointer;">
      Google ile Giriş Yap
    </button>
  `;
}

/**
 * Sayfa Yüklendiğinde Çalışan Başlatıcı (Login Sayfası İçin)
 */
async function boot(){
  try{
    renderBtn();
    
    // Mevcut bir oturum varsa doğrudan ana sayfaya yönlendir
    const { data } = await supabase.auth.getSession();
    if(data?.session) {
       window.location.replace(HOME_URL);
       return;
    }

    const btn = document.getElementById("googleBtn");
    if(btn) {
      btn.onclick = async () => {
        try {
          toast("Google yönlendiriliyor...");
          
          // Google ile giriş başlat
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { 
              redirectTo: HOME_URL // Supabase Redirect URLs listesiyle tam eşleşmeli
            }
          });
          
          if(error) {
            console.error("Giriş hatası:", error.message);
            showError("Giriş hatası: " + error.message);
          }
        } catch (e) {
          showError("Bağlantı hatası oluştu.");
        }
      };
    }
  }catch(e){
    console.error("Boot error:", e);
    showError("Sistem yüklenemedi.");
  }
}

// Eğer sayfada login kutusu varsa başlatıcıyı çalıştır
if(box) boot();

/**
 * 🚩 ui_guard.js İçin Auth State Köprüsü
 * Bu fonksiyon export edilmek zorundadır.
 */
export async function startAuthState(callback) {
  const handleAuth = async (session) => {
    const user = session?.user || null;
    let wallet = 0;

    if (user) {
      try {
        // Cüzdan verisini (tokens) çekmeyi dene
        const { data, error } = await supabase
          .from("profiles")
          .select("tokens")
          .eq("id", user.id)
          .maybeSingle(); 

        if (error) {
          console.warn("Profil sütunu veya satırı bulunamadı:", error.message);
        }
        
        // Eğer veri geldiyse cüzdanı güncelle, gelmediyse 0 göster
        wallet = data?.tokens || 0;
      } catch (e) {
        console.error("Cüzdan verisi işlenemedi:", e);
      }
    }
    
    // ui_guard.js'e güncel durumu bildir
    callback({ user, wallet });
  };

  // İlk yüklemede durumu kontrol et
  const { data: { session } } = await supabase.auth.getSession();
  await handleAuth(session);

  // Oturum değişikliklerini (Login/Logout) dinle
  supabase.auth.onAuthStateChange(async (_event, session) => {
    await handleAuth(session);
  });
}
