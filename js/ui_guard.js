i// FILE: /js/ui_guard.js
import { startAuthState } from "/js/auth.js";

/**
 * protectedPage=true: user yoksa index'e at (login artık index.html)
 * public: user yoksa kalabilir
 *
 * FIX:
 * - auth state ilk anda null gelebilir
 * - hemen redirect etmek yerine grace period bekle
 * - redirect döngüsünü engelle (1 kez)
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

    redirectTimer = setTimeout(()=>{
      if(hasUserEver) return;

      // ✅ redirect loop kill-switch
      if(sessionStorage.getItem("GUARD_REDIRECTED") === "1") return;
      sessionStorage.setItem("GUARD_REDIRECTED", "1");

      // ✅ login artık index.html
      location.replace("/index.html");
    }, 900); // 600 yerine 900ms daha güvenli
  }

  startAuthState(({ user, wallet: bal }) => {
    if(!user){
      scheduleRedirectIfNeeded();
      return;
    }

    hasUserEver = true;
    if(redirectTimer){
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }

    // ✅ login olunca loop flag sıfırlansın
    try{ sessionStorage.removeItem("GUARD_REDIRECTED"); }catch{}

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
