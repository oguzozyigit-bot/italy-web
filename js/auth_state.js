// FILE: /js/auth_state.js
import { supabase } from "/js/supabase_client.js";

/**
 * Login sayfası: buton render + click
 */
export async function redirectIfLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

export function initAuth() {
  const container = document.getElementById("googleBtnContainer");
  if (!container) return;

  container.innerHTML = `
    <button id="google-login-btn" type="button" style="
      width: 100%; max-width: 320px; height: 46px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.14); background: rgba(0,0,0,0.35);
      color: #fff; font-size: 15px; font-weight: 900; display:flex;
      align-items:center; justify-content:center; gap:10px; cursor:pointer;">
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" />
      Google ile Devam Et
    </button>
  `;

  document.getElementById("google-login-btn")?.addEventListener("click", async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/pages/home.html" }
    });
    if (error) alert("Google Login Hata: " + error.message);
  });
}

/**
 * Tek doğruluk kaynağı: user + wallet
 * callback: ({ user, wallet, event })
 */
export function startAuthState(onChange) {
  const emit = async (session, event) => {
    if (!session?.user) {
      onChange?.({ user: null, wallet: null, event });
      return;
    }

    const user = session.user;

    // İlk giriş / restore: profile + wallet garanti
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      try {
        await supabase.rpc("ensure_profile_and_welcome", {
          p_full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
          p_email: user.email || "",
          p_avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || ""
        });
      } catch (e) {
        console.error("[auth_state] ensure_profile_and_welcome error:", e);
      }
    }

    let balance = 0;
    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("balance")
        .maybeSingle();
      if (!error && data && typeof data.balance === "number") balance = data.balance;
    } catch (e) {
      console.error("[auth_state] wallets fetch error:", e);
    }

    onChange?.({ user, wallet: balance, event });
  };

  // İlk session
  supabase.auth.getSession()
    .then(({ data }) => emit(data?.session, "INITIAL_SESSION"))
    .catch((e) => console.error("[auth_state] getSession error:", e));

  // Sonraki eventler
  supabase.auth.onAuthStateChange((event, session) => {
    emit(session, event);
  });
}
