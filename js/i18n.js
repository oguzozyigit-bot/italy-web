// FILE: /js/i18n.js
// Simple i18n for italky (TR/EN/DE/IT/FR)

const SITE_LANG_KEY = "italky_site_lang_v1";
export const SUPPORTED_SITE_LANGS = ["tr","en","de","it","fr"];

// ✅ MIGRATION: eski key'leri v1'e taşı (tek sefer)
(function migrateSiteLang(){
  try{
    const v1 = localStorage.getItem(SITE_LANG_KEY);
    if(v1) return;

    const legacyKeys = ["italky_site_lang", "italky_site_lang_v2"];
    for(const k of legacyKeys){
      const val = (localStorage.getItem(k) || "").trim().toLowerCase();
      if(val){
        localStorage.setItem(SITE_LANG_KEY, val);
        return;
      }
    }
  }catch{}
})();

const DICT = {
  tr: {
    // TITLES
    home_title: "italkyAI • Ana Menü",
    profile_title: "italkyAI • Profil",
    about_title: "Hakkımızda",
    faq_title: "SSS",
    privacy_title: "Gizlilik",
    contact_title: "İletişim",

    // HOME
    home_face_to_face: "Yüz Yüze",
    home_live_translate: "Canlı çeviri",
    home_text_translate: "Metinden",
    home_text_translate_sub: "Yazıdan çeviri",
    home_photo_translate: "Fotoğraf",
    home_overlay_translate: "Üstüne çevir",
    home_document_translate: "Belge",
    home_pdf_camera: "PDF / Kamera",
    home_chat_ai: "Sohbet AI",
    home_assistant: "Asistanın",
    home_talk_ai: "Konuşkan",
    home_voice_ai: "Sesli AI",
    home_teacher: "Dil Öğretmeni",
    home_pronounce_lessons: "Telaffuz ve ders",
    home_learn_fun: "Eğlenerek Öğren",
    home_games_quiz: "Oyun ve yarışma",

    // NAV
    nav_about: "Hakkında",
    nav_faq: "SSS",
    nav_privacy: "Gizlilik",
    nav_contact: "İletişim",

    // PROFILE
    profile_upgrade: "Üyelik Yükselt",
    profile_site_lang: "Site Dili",
    profile_site_lang_desc: "Şimdilik 5 dil",
    profile_upgrade_desc: "Premium özellikler",
    profile_secure_logout: "Güvenli Çıkış",
    profile_secure_logout_desc: "Oturumu kapat",
    profile_delete: "Hesabımı Sil",
    profile_delete_desc: "Geri alınamaz",
    profile_upgrade_btn: "Yükselt",
    profile_logout_btn: "Çıkış",
    profile_delete_btn: "Sil",
    profile_upgrade_toast: "Üyelik yükseltme yakında",
    profile_lang_saved: "Site dili kaydedildi",
    profile_delete_confirm: "Hesabını silmek istediğine emin misin?\nBu işlem geri alınamaz.",
    profile_deleted_local: "Hesap verileri cihazdan silindi.",

    // PAGES
    page_back: "Geri",
    about_body: "italkyAI; çeviri, konuşma ve dil öğrenimini tek yerde birleştiren bir dil platformudur.",
    faq_body: "Sık sorulan sorular yakında burada olacak.",
    privacy_body: "Gizlilik politikası yakında burada olacak.",
    contact_body: "Bize ulaşmak için:",
    contact_email_label: "E-posta",

    // EXTRA (profilde kullandıklarımız)
    remaining_tokens: "Kalan Token",
    buy_tokens: "Token Satın Al",
    offline_packs: "Offline Paketler",
    download_language: "Dil İndir",
    are_you_sure: "Emin misiniz?",
    cannot_undo: "Bu işlem geri alınamaz.",
    cancel: "Vazgeç",
    yes_delete: "Evet, Sil",
    key_copied: "KEY kopyalandı",
    profile_copy_key: "KOPYALA",
    profile_token_wallet: "Token Cüzdan",
    profile_token_desc: "Ders ve paketler token ile çalışır",
    profile_offline_desc: "İndirilen diller",
    profile_gift: "Hediye",
    profile_gift_10: "İlk giriş: 10",
  },

  en: {
    home_title: "italkyAI • Home",
    profile_title: "italkyAI • Profile",
    about_title: "About",
    faq_title: "FAQ",
    privacy_title: "Privacy",
    contact_title: "Contact",

    home_face_to_face: "Face to Face",
    home_live_translate: "Live translation",
    home_text_translate: "Text",
    home_text_translate_sub: "Translate text",
    home_photo_translate: "Photo",
    home_overlay_translate: "On-image",
    home_document_translate: "Document",
    home_pdf_camera: "PDF / Camera",
    home_chat_ai: "Chat AI",
    home_assistant: "Your assistant",
    home_talk_ai: "Talk AI",
    home_voice_ai: "Voice AI",
    home_teacher: "Language Teacher",
    home_pronounce_lessons: "Pronunciation & lessons",
    home_learn_fun: "Learn by Playing",
    home_games_quiz: "Games & quiz",

    nav_about: "About",
    nav_faq: "FAQ",
    nav_privacy: "Privacy",
    nav_contact: "Contact",

    profile_upgrade: "Upgrade",
    profile_site_lang: "Site Language",
    profile_site_lang_desc: "5 languages for now",
    profile_upgrade_desc: "Premium features",
    profile_secure_logout: "Secure Logout",
    profile_secure_logout_desc: "Sign out",
    profile_delete: "Delete Account",
    profile_delete_desc: "Cannot be undone",
    profile_upgrade_btn: "Upgrade",
    profile_logout_btn: "Logout",
    profile_delete_btn: "Delete",
    profile_upgrade_toast: "Upgrade is coming soon",
    profile_lang_saved: "Language saved",
    profile_delete_confirm: "Are you sure you want to delete your account?\nThis cannot be undone.",
    profile_deleted_local: "Account data removed from this device.",

    page_back: "Back",
    about_body: "italkyAI is a language platform that combines translation, speaking, and learning in one place.",
    faq_body: "Frequently asked questions will appear here soon.",
    privacy_body: "Privacy policy will appear here soon.",
    contact_body: "Contact us at:",
    contact_email_label: "Email",

    remaining_tokens: "Remaining Tokens",
    buy_tokens: "Buy Tokens",
    offline_packs: "Offline Packs",
    download_language: "Download Language",
    are_you_sure: "Are you sure?",
    cannot_undo: "This action cannot be undone.",
    cancel: "Cancel",
    yes_delete: "Yes, Delete",
    key_copied: "KEY copied",
    profile_copy_key: "COPY",
    profile_token_wallet: "Token Wallet",
    profile_token_desc: "Lessons and packs use tokens",
    profile_offline_desc: "Downloaded languages",
    profile_gift: "Gift",
    profile_gift_10: "First login: 10",
  },

  de: {
    home_title: "italkyAI • Start",
    profile_title: "italkyAI • Profil",
    about_title: "Über",
    faq_title: "FAQ",
    privacy_title: "Datenschutz",
    contact_title: "Kontakt",

    home_face_to_face: "Gegenüber",
    home_live_translate: "Live-Übersetzung",
    home_text_translate: "Text",
    home_text_translate_sub: "Text übersetzen",
    home_photo_translate: "Foto",
    home_overlay_translate: "Auf dem Bild",
    home_document_translate: "Dokument",
    home_pdf_camera: "PDF / Kamera",
    home_chat_ai: "Chat KI",
    home_assistant: "Dein Assistent",
    home_talk_ai: "Sprech-KI",
    home_voice_ai: "Sprach-KI",
    home_teacher: "Sprachlehrer",
    home_pronounce_lessons: "Aussprache & Lektionen",
    home_learn_fun: "Spielend lernen",
    home_games_quiz: "Spiele & Quiz",

    nav_about: "Über",
    nav_faq: "FAQ",
    nav_privacy: "Datenschutz",
    nav_contact: "Kontakt",

    profile_upgrade: "Upgrade",
    profile_site_lang: "Seitensprache",
    profile_site_lang_desc: "Derzeit 5 Sprachen",
    profile_upgrade_desc: "Premium-Funktionen",
    profile_secure_logout: "Sicher abmelden",
    profile_secure_logout_desc: "Abmelden",
    profile_delete: "Konto löschen",
    profile_delete_desc: "Nicht rückgängig",
    profile_upgrade_btn: "Upgrade",
    profile_logout_btn: "Abmelden",
    profile_delete_btn: "Löschen",
    profile_upgrade_toast: "Upgrade kommt bald",
    profile_lang_saved: "Sprache gespeichert",
    profile_delete_confirm: "Möchtest du dein Konto wirklich löschen?\nDas kann nicht rückgängig gemacht werden.",
    profile_deleted_local: "Kontodaten wurden vom Gerät entfernt.",

    page_back: "Zurück",
    about_body: "italkyAI ist eine Sprachplattform für Übersetzung, Sprechen und Lernen an einem Ort.",
    faq_body: "Häufige Fragen erscheinen bald hier.",
    privacy_body: "Datenschutzerklärung erscheint bald hier.",
    contact_body: "Kontakt:",
    contact_email_label: "E-Mail",

    remaining_tokens: "Verbleibende Token",
    buy_tokens: "Token kaufen",
    offline_packs: "Offline-Pakete",
    download_language: "Sprache herunterladen",
    are_you_sure: "Sind Sie sicher?",
    cannot_undo: "Diese Aktion kann nicht rückgängig gemacht werden.",
    cancel: "Abbrechen",
    yes_delete: "Ja, löschen",
    key_copied: "KEY kopiert",
    profile_copy_key: "KOPIEREN",
    profile_token_wallet: "Token-Wallet",
    profile_token_desc: "Lektionen und Pakete nutzen Token",
    profile_offline_desc: "Heruntergeladene Sprachen",
    profile_gift: "Geschenk",
    profile_gift_10: "Erster Login: 10",
  },

  it: {
    home_title: "italkyAI • Home",
    profile_title: "italkyAI • Profilo",
    about_title: "Info",
    faq_title: "FAQ",
    privacy_title: "Privacy",
    contact_title: "Contatti",

    home_face_to_face: "Faccia a faccia",
    home_live_translate: "Traduzione live",
    home_text_translate: "Testo",
    home_text_translate_sub: "Traduci testo",
    home_photo_translate: "Foto",
    home_overlay_translate: "Sull’immagine",
    home_document_translate: "Documento",
    home_pdf_camera: "PDF / Camera",
    home_chat_ai: "Chat AI",
    home_assistant: "Il tuo assistente",
    home_talk_ai: "Talk AI",
    home_voice_ai: "Voice AI",
    home_teacher: "Insegnante",
    home_pronounce_lessons: "Pronuncia & lezioni",
    home_learn_fun: "Impara giocando",
    home_games_quiz: "Giochi & quiz",

    nav_about: "Info",
    nav_faq: "FAQ",
    nav_privacy: "Privacy",
    nav_contact: "Contatti",

    profile_upgrade: "Upgrade",
    profile_site_lang: "Lingua del sito",
    profile_site_lang_desc: "Per ora 5 lingue",
    profile_upgrade_desc: "Funzioni premium",
    profile_secure_logout: "Logout sicuro",
    profile_secure_logout_desc: "Esci",
    profile_delete: "Elimina account",
    profile_delete_desc: "Irreversibile",
    profile_upgrade_btn: "Upgrade",
    profile_logout_btn: "Esci",
    profile_delete_btn: "Elimina",
    profile_upgrade_toast: "Upgrade in arrivo",
    profile_lang_saved: "Lingua salvata",
    profile_delete_confirm: "Sei sicuro di voler eliminare l’account?\nOperazione irreversibile.",
    profile_deleted_local: "Dati dell’account rimossi dal dispositivo.",

    page_back: "Indietro",
    about_body: "italkyAI è una piattaforma linguistica che unisce traduzione, conversazione e studio.",
    faq_body: "Le domande frequenti appariranno qui presto.",
    privacy_body: "La privacy policy apparirà qui presto.",
    contact_body: "Contattaci a:",
    contact_email_label: "Email",

    remaining_tokens: "Token rimanenti",
    buy_tokens: "Acquista token",
    offline_packs: "Pacchetti offline",
    download_language: "Scarica lingua",
    are_you_sure: "Sei sicuro?",
    cannot_undo: "Questa azione è irreversibile.",
    cancel: "Annulla",
    yes_delete: "Sì, elimina",
    key_copied: "KEY copiato",
    profile_copy_key: "COPIA",
    profile_token_wallet: "Portafoglio Token",
    profile_token_desc: "Lezioni e pacchetti usano token",
    profile_offline_desc: "Lingue scaricate",
    profile_gift: "Regalo",
    profile_gift_10: "Primo accesso: 10",
  },

  fr: {
    home_title: "italkyAI • Accueil",
    profile_title: "italkyAI • Profil",
    about_title: "À propos",
    faq_title: "FAQ",
    privacy_title: "Confidentialité",
    contact_title: "Contact",

    home_face_to_face: "Face à face",
    home_live_translate: "Traduction en direct",
    home_text_translate: "Texte",
    home_text_translate_sub: "Traduire du texte",
    home_photo_translate: "Photo",
    home_overlay_translate: "Sur l’image",
    home_document_translate: "Document",
    home_pdf_camera: "PDF / Caméra",
    home_chat_ai: "Chat IA",
    home_assistant: "Votre assistant",
    home_talk_ai: "Talk IA",
    home_voice_ai: "Voix IA",
    home_teacher: "Professeur",
    home_pronounce_lessons: "Prononciation & leçons",
    home_learn_fun: "Apprendre en jouant",
    home_games_quiz: "Jeux & quiz",

    nav_about: "À propos",
    nav_faq: "FAQ",
    nav_privacy: "Confidentialité",
    nav_contact: "Contact",

    profile_upgrade: "Améliorer",
    profile_site_lang: "Langue du site",
    profile_site_lang_desc: "5 langues pour l’instant",
    profile_upgrade_desc: "Fonctionnalités premium",
    profile_secure_logout: "Déconnexion sécurisée",
    profile_secure_logout_desc: "Se déconnecter",
    profile_delete: "Supprimer le compte",
    profile_delete_desc: "Irréversible",
    profile_upgrade_btn: "Améliorer",
    profile_logout_btn: "Déconnexion",
    profile_delete_btn: "Supprimer",
    profile_upgrade_toast: "L’upgrade arrive bientôt",
    profile_lang_saved: "Langue enregistrée",
    profile_delete_confirm: "Voulez-vous vraiment supprimer le compte ?\nIrréversible.",
    profile_deleted_local: "Données du compte supprimées de l’appareil.",

    page_back: "Retour",
    about_body: "italkyAI est une plateforme linguistique qui réunit traduction, conversation et apprentissage.",
    faq_body: "Les questions fréquentes apparaîtront bientôt ici.",
    privacy_body: "La politique de confidentialité apparaîtra bientôt ici.",
    contact_body: "Contactez-nous :",
    contact_email_label: "E-mail",

    remaining_tokens: "Tokens restants",
    buy_tokens: "Acheter des tokens",
    offline_packs: "Packs hors ligne",
    download_language: "Télécharger la langue",
    are_you_sure: "Êtes-vous sûr ?",
    cannot_undo: "Cette action est irréversible.",
    cancel: "Annuler",
    yes_delete: "Oui, supprimer",
    key_copied: "KEY copié",
    profile_copy_key: "COPIER",
    profile_token_wallet: "Portefeuille Token",
    profile_token_desc: "Leçons et packs utilisent des tokens",
    profile_offline_desc: "Langues téléchargées",
    profile_gift: "Cadeau",
    profile_gift_10: "Première connexion : 10",
  },
};

export function getSiteLang(){
  const v = (localStorage.getItem(SITE_LANG_KEY) || "tr").trim().toLowerCase();
  return SUPPORTED_SITE_LANGS.includes(v) ? v : "tr";
}

export function setSiteLang(lang){
  const v = String(lang||"tr").trim().toLowerCase();
  const safe = SUPPORTED_SITE_LANGS.includes(v) ? v : "tr";
  localStorage.setItem(SITE_LANG_KEY, safe);
  try{ document.documentElement.lang = safe; }catch{}
  return safe;
}

export function t(key){
  const lang = getSiteLang();
  return (DICT[lang] && DICT[lang][key]) || (DICT.tr[key] || key);
}

export function applyI18n(root = document){
  const lang = getSiteLang();
  try{ document.documentElement.lang = lang; }catch{}

  root.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.getAttribute("data-i18n");
    if(key) el.textContent = t(key);
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const key = el.getAttribute("data-i18n-placeholder");
    if(key) el.setAttribute("placeholder", t(key));
  });
}
