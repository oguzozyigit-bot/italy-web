// FILE: /js/auth.js
import { supabase } from "./supabase_client.js";

// Sabitler: Projenin ana domainini kullanmak en güvenli yoldur.
const HOME_URL = "https://italky.ai/pages/home.html";
const LOGIN_URL = "https://italky.ai/pages/login.html";

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
 * NAC ID üret / sakla
 * - Web: localStorage UUID (tarayıcı temizlenirse sıfırlanır)
 * - APK: ileride native bridge ile gerçek cihaz id gelecek (buraya entegre edeceğiz)
 */
function getOrCreateNacId(){
  try{
    const key = "NAC_ID";
    const existing = localStorage.getItem(key);
    if(existing && existing.length >= 6) return existing;

    const id = (globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.floor(Math.random()*1e9)}`);
    localStorage.setItem(key, id);
    return id;
  }catch{
    // localStorage kapalıysa fallback
    return `web-${Date.now()}-${Math.floor(Math.random()*1e9)}`;
  }
}

/**
 * Cihazı kilitle (aynı telefonda ikinci kullanıcıyı engeller)
 * SQL'de public.lock_device(p_nac_id text) fonksiyonu olmalı.
 */
async function lockDeviceOrThrow(){
  const nacId = getOrCreateNacId();
  const { error } = await supabase.rpc("lock_device", { p_nac_id: nacId });
  if(error) throw error;
  return nacId;
}

/**
 * profiles satırı yoksa oluşturmaya çalış (tokens=400)
 * Not: RLS insert kapalıysa bu insert hata verebilir.
 */
async function ensureProfileRow(user){
  // 1) var mı?
  const { data: existing, error: e1 } = await supabase
    .from("profiles")
    .select("id, tokens, full_name, email, avatar_url, created_at, last_login_at")
    .eq("id", user.id)
    .maybeSingle();

  if(e1) {
    // select policy yoksa da burada patlar; ama normalde kendi kaydını okuyabilmeli
    console.warn("profiles select error:", e1.message);
    return { profile: null, wallet: 0 };
  }

  if(existing){
    // last_login_at güncelle (kolon varsa)
    try{
      await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
    }catch(_e){}
    return { profile: existing, wallet: Number(existing.tokens ?? 0) };
  }

  // 2) yoksa insert dene
  const payload = {
    id: user.id,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    email: user.email || "",
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
    tokens: 400,
    last_login_at: new Date().toISOString()
  };

  const { data: created, error: e2 } = await supabase
    .from("profiles")
    .insert(payload)
    .select("id, tokens, full_name, email, avatar_url, created_at, last_login_at")
    .single();

  if(e2){
    // RLS insert kapalıysa burada hata verir.
    console.warn("profiles insert blocked:", e2.message);
    return { profile: null, wallet: 0 };
  }

  return { profile: created, wallet: Number(created.tokens ?? 0) };
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
 *
 * callback({ user, wallet })
 */
export async function startAuthState(callback) {
  const handleAuth = async (session) => {
    const user = session?.user || null;
    let wallet = 0;

    if (user) {
      // 1) Cihaz kilidi (NAC ID) - başka hesaba bağlıysa burada düşer
      try{
        await lockDeviceOrThrow();
      }catch(e){
        console.warn("Device lock failed:", e?.message || e);

        // Kullanıcıyı dışarı at (aynı cihaz başka hesaba bağlı)
        try{ await supabase.auth.signOut(); }catch(_e){}

        // UI tarafı güvenli olsun
        callback({ user: null, wallet: 0 });

        // Sayfa korumalıysa login'e gönder
        // (ui_guard da yönlendirebilir ama biz de güvenceye alıyoruz)
        if(location.pathname !== "/pages/login.html"){
          location.replace(LOGIN_URL);
        }
        return;
      }

      // 2) Profil + tokens çek (yoksa oluşturmaya dene)
      try {
        const res = await ensureProfileRow(user);
        wallet = res.wallet || 0;
      } catch (e) {
        console.error("Cüzdan verisi işlenemedi:", e);
        wallet = 0;
      }
    }

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
