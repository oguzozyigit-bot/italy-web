// FILE: /js/onboarding.js
// ✅ SAFE VERSION: Element yoksa asla hata vermez.
// ✅ Bu dosya sadece sayfada #ch-onboarding varsa çalışır.
// ✅ "Cannot set properties of null (setting 'onclick')" hatasını kesin bitirir.

(function () {
  "use strict";

  try {
    // Sayfada onboarding container yoksa hiç çalıştırma
    const root = document.getElementById("ch-onboarding");
    if (!root) return;

    // Yardımcılar
    const $ = (id) => document.getElementById(id);
    const on = (el, evt, fn, opts) => {
      if (!el) return;
      try { el.addEventListener(evt, fn, opts || false); } catch {}
    };

    // (Varsa) kapatma butonu
    const closeBtn = $("ch-close");
    on(closeBtn, "click", (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      try { root.remove(); } catch {}
      // Analytics varsa patlatma
      try { window.Analytics?.fireEvent?.("close_devmode_popup"); } catch {}
      try { window.analytics?.fireEvent?.("close_devmode_popup"); } catch {}
    });

    // (Varsa) "extensions" butonu — element yoksa hiç dokunma
    const extBtn = $("ch-extension-manager");
    on(extBtn, "click", async (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      try {
        await navigator.clipboard.writeText("chrome://extensions/");
      } catch {}
    });

    // Eğer eski dosyada başka “onclick” atamaları vardıysa ve id’leri farklıysa
    // burada da güvenli şekilde bağlanır.
    // (İstersen listeyi genişletirsin.)
    const legacyBtns = [
      "devModeBtn",
      "devModeBannerBtn",
      "devModeHelpBtn",
      "ch-help",
    ];

    legacyBtns.forEach((id) => {
      const el = $(id);
      on(el, "click", (e) => {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        // no-op (pasif)
      });
    });

  } catch {
    // no-op: asla hata fırlatma
  }
})();
