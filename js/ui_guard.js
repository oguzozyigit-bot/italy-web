// FILE: /js/ui_guard.js
import { startAuthState } from "/js/auth.js";

/**
 * protectedPage=true: user yoksa login'e at
 * public: user yoksa kalabilir
 *
 * ✅ FIX:
 * - auth state ilk anda null gelebilir (özellikle webview/refresh)
 * - hemen redirect etmek yerine kısa bir "grace period" bekliyoruz.
 */
export function bootPage({
  protectedPage = false,
  header = { nameId: "userName", picId: "userPic" },
  wallet = { elId: null }
} = {}){

  const nameEl = header?.nameId ? document.getElementById(header.nameId) : null;
  const picEl  = header?.picId  ? document.getElementById(header.picId)  : null;
  const walletEl = wallet?.elId ? document.getElementById(wallet.elId) : null;

  if(nameEl) nameEl.textContent = "…";

  let hasUserEver = false;
  let redirectTimer = null;

  function scheduleRedirectIfNeeded(){
    if(!protectedPage) return;
    if(redirectTimer) return;

    // ✅ 600ms grace period
    redirectTimer = setTimeout(()=>{
      if(!hasUserEver){
        location.replace("/pages/login.html");
      }
    }, 600);
  }

  startAuthState(({ user, wallet: bal }) => {
    if(!user){
      scheduleRedirectIfNeeded();
      return;
    }

    // ✅ user geldiyse redirect iptal
    hasUserEver = true;
    if(redirectTimer){
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }

    if(nameEl){
      nameEl.textContent =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        "Kullanıcı";
    }

    if(picEl){
      const url = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
      if(url) picEl.src = url;
    }

    if(walletEl && typeof bal === "number"){
      walletEl.textContent = String(bal);
    }
  });
}
