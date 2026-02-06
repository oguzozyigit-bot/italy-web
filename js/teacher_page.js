// FILE: italky-web/js/teacher_page.js
// FINAL v22.0 (15 MIN TIMER + STRICT MODE)

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(() => t.classList.remove("show"), 1800);
}

const LOCALES = { en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT", es: "es-ES" };
const LANG_LABEL = {
  en: "🇬🇧 İngilizce Öğren",
  de: "🇩🇪 Almanca Öğren",
  fr: "🇫🇷 Fransızca Öğren",
  it: "🇮🇹 İtalyanca Öğren",
  es: "🇪🇸 İspanyolca Öğren"
};

function getLang() {
  const u = new URL(location.href);
  const q = (u.searchParams.get("lang") || "en").toLowerCase().trim();
  return ["en", "de", "fr", "it", "es"].includes(q) ? q : "en";
}
const lang = getLang();

/* --- HELPER: String Normalize --- */
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ");
}

/* --- HELPER: Similarity (Levenshtein) --- */
function similarity(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  
  const dist = dp[m][n];
  return 1 - (dist / Math.max(m, n));
}

/* --- TTS & STT --- */
function speakOnce(word, langCode) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(false); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(word || ""));
      u.lang = LOCALES[langCode] || "en-US";
      u.rate = 0.9; // Biraz daha tane tane konuşsun
      u.pitch = 1.0;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
    } catch {
      resolve(false);
    }
  });
}

function makeRecognizer(langCode) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = LOCALES[langCode] || "en-US";
  rec.interimResults = false;
  rec.continuous = false;
  return rec;
}

/* --- DERS İÇERİĞİ (LESSON DATA) --- */
const LESSON1 = {
  en: [
    { tr: "elma", t: "apple", em: "🍎" }, { tr: "su", t: "water", em: "💧" }, { tr: "ekmek", t: "bread", em: "🍞" }, 
    { tr: "menü", t: "menu", em: "📜" }, { tr: "fiyat", t: "price", em: "🏷️" }, { tr: "evet", t: "yes", em: "✅" },
    { tr: "hayır", t: "no", em: "❌" }, { tr: "merhaba", t: "hello", em: "👋" }, { tr: "güle güle", t: "goodbye", em: "👋" },
    { tr: "teşekkürler", t: "thank you", em: "🙏" }, { tr: "lütfen", t: "please", em: "🤝" }, 
    { tr: "affedersiniz", t: "excuse me", em: "🙋" }, { tr: "anlamıyorum", t: "i don't understand", em: "🤷" },
    { tr: "yardım", t: "help", em: "🆘" }, { tr: "tuvalet", t: "toilet", em: "🚻" }, { tr: "hesap", t: "the bill", em: "🧾" },
    { tr: "çok güzel", t: "very good", em: "🌟" }, { tr: "sıcak", t: "hot", em: "🔥" }, { tr: "soğuk", t: "cold", em: "❄️" },
    { tr: "bugün", t: "today", em: "📅" }
  ],
  // ... Diğer diller buraya (Aynen korunacak) ...
  de: [ { tr:"elma", t:"apfel", em:"🍎" }, { tr:"su", t:"wasser", em:"💧" }, { tr:"ekmek", t:"brot", em:"🍞" }, { tr:"menü", t:"speisekarte", em:"📜" }, { tr:"fiyat", t:"preis", em:"🏷️" }, { tr:"evet", t:"ja", em:"✅" }, { tr:"hayır", t:"nein", em:"❌" }, { tr:"merhaba", t:"hallo", em:"👋" }, { tr:"güle güle", t:"tschüss", em:"👋" }, { tr:"teşekkürler", t:"danke", em:"🙏" }, { tr:"lütfen", t:"bitte", em:"🤝" }, { tr:"affedersiniz", t:"entschuldigung", em:"🙋" }, { tr:"anlamıyorum", t:"ich verstehe nicht", em:"🤷" }, { tr:"yardım", t:"hilfe", em:"🆘" }, { tr:"tuvalet", t:"toilette", em:"🚻" }, { tr:"hesap", t:"die rechnung", em:"🧾" }, { tr:"çok güzel", t:"sehr gut", em:"🌟" }, { tr:"sıcak", t:"heiß", em:"🔥" }, { tr:"soğuk", t:"kalt", em:"❄️" }, { tr:"bugün", t:"heute", em:"📅" } ],
  fr: [ { tr:"elma", t:"pomme", em:"🍎" }, { tr:"su", t:"eau", em:"💧" }, { tr:"ekmek", t:"pain", em:"🍞" }, { tr:"menü", t:"menu", em:"📜" }, { tr:"fiyat", t:"prix", em:"🏷️" }, { tr:"evet", t:"oui", em:"✅" }, { tr:"hayır", t:"non", em:"❌" }, { tr:"merhaba", t:"bonjour", em:"👋" }, { tr:"güle güle", t:"au revoir", em:"👋" }, { tr:"teşekkürler", t:"merci", em:"🙏" }, { tr:"lütfen", t:"s'il vous plaît", em:"🤝" }, { tr:"affedersiniz", t:"excusez-moi", em:"🙋" }, { tr:"anlamıyorum", t:"je ne comprends pas", em:"🤷" }, { tr:"yardım", t:"aide", em:"🆘" }, { tr:"tuvalet", t:"toilettes", em:"🚻" }, { tr:"hesap", t:"l'addition", em:"🧾" }, { tr:"çok güzel", t:"très bien", em:"🌟" }, { tr:"sıcak", t:"chaud", em:"🔥" }, { tr:"soğuk", t:"froid", em:"❄️" }, { tr:"bugün", t:"aujourd'hui", em:"📅" } ],
  it: [ { tr:"elma", t:"mela", em:"🍎" }, { tr:"su", t:"acqua", em:"💧" }, { tr:"ekmek", t:"pane", em:"🍞" }, { tr:"menü", t:"menu", em:"📜" }, { tr:"fiyat", t:"prezzo", em:"🏷️" }, { tr:"evet", t:"sì", em:"✅" }, { tr:"hayır", t:"no", em:"❌" }, { tr:"merhaba", t:"ciao", em:"👋" }, { tr:"güle güle", t:"arrivederci", em:"👋" }, { tr:"teşekkürler", t:"grazie", em:"🙏" }, { tr:"lütfen", t:"per favore", em:"🤝" }, { tr:"affedersiniz", t:"scusi", em:"🙋" }, { tr:"anlamıyorum", t:"non capisco", em:"🤷" }, { tr:"yardım", t:"aiuto", em:"🆘" }, { tr:"tuvalet", t:"bagno", em:"🚻" }, { tr:"hesap", t:"il conto", em:"🧾" }, { tr:"çok güzel", t:"molto bene", em:"🌟" }, { tr:"sıcak", t:"caldo", em:"🔥" }, { tr:"soğuk", t:"freddo", em:"❄️" }, { tr:"bugün", t:"oggi", em:"📅" } ],
  es: [ { tr:"elma", t:"manzana", em:"🍎" }, { tr:"su", t:"agua", em:"💧" }, { tr:"ekmek", t:"pan", em:"🍞" }, { tr:"menü", t:"menú", em:"📜" }, { tr:"fiyat", t:"precio", em:"🏷️" }, { tr:"evet", t:"sí", em:"✅" }, { tr:"hayır", t:"no", em:"❌" }, { tr:"merhaba", t:"hola", em:"👋" }, { tr:"güle güle", t:"adiós", em:"👋" }, { tr:"teşekkürler", t:"gracias", em:"🙏" }, { tr:"lütfen", t:"por favor", em:"🤝" }, { tr:"affedersiniz", t:"perdón", em:"🙋" }, { tr:"anlamıyorum", t:"no entiendo", em:"🤷" }, { tr:"yardım", t:"ayuda", em:"🆘" }, { tr:"tuvalet", t:"baño", em:"🚻" }, { tr:"hesap", t:"la cuenta", em:"🧾" }, { tr:"çok güzel", t:"muy bien", em:"🌟" }, { tr:"sıcak", t:"caliente", em:"🔥" }, { tr:"soğuk", t:"frío", em:"❄️" }, { tr:"bugün", t:"hoy", em:"📅" } ]
};

const STORE = `caynana_teacher_${lang}_v3`;
const LESSON_DURATION_MS = 15 * 60 * 1000; // 15 Dakika (Milisaniye)

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(STORE, JSON.stringify(s || {})); } catch { }
}

const S = (() => {
  const x = loadState();
  const now = Date.now();
  return {
    pos: Number.isInteger(x.pos) ? x.pos : 0,
    learned: x.learned || {},
    skipped: x.skipped || {},
    exam: x.exam || { pending: false, failCount: 0, q: [], qi: 0, score: 0 },
    // Oturum başlangıç zamanı yoksa şu anı ata
    startTime: x.startTime || now, 
    speaking: false,
    listening: false,
    bound: false
  };
})();

// Sayfa açıldığında start time'ı kaydet (eğer yoksa)
saveState(S);

/* --- ZAMAN YÖNETİMİ --- */
function getRemainingTime() {
  const elapsed = Date.now() - S.startTime;
  const remain = LESSON_DURATION_MS - elapsed;
  return remain > 0 ? remain : 0;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

let timerInterval = null;
function startTimer() {
  const el = $("timerBadge"); // HTML'de bu ID'li bir element olmalı
  if (!el) return;

  timerInterval = setInterval(() => {
    const r = getRemainingTime();
    el.textContent = formatTime(r);
    
    // Süre dolduğunda görsel uyarı
    if (r <= 0) {
      el.style.color = "#ef4444"; // Kırmızı
      el.textContent = "0:00 (Süre Bitti)";
    }
  }, 1000);
}

/* --- DERS MANTIĞI --- */
function lesson() { return LESSON1[lang] || LESSON1.en; }
function total() { return lesson().length; }
function cur() { return lesson()[S.pos]; }
function learnedCount() { return Object.keys(S.learned).length; }

const EXAM_GATE = 18;
const EXAM_Q = 10;
const EXAM_PASS = 8;

function pickNextIndex() {
  for (let i = 0; i < total(); i++) {
    if (!S.learned[i] && !S.skipped[i]) return i;
  }
  for (let i = 0; i < total(); i++) {
    if (!S.learned[i] && S.skipped[i]) return i;
  }
  return null;
}

function setMeaningText() {
  const item = cur();
  const em = item.em ? `${item.em} ` : "";
  $("wTr").textContent = `Türkçesi: ${em}${item.tr}`;
}

function updateUI() {
  $("langPill").textContent = LANG_LABEL[lang] || "Teacher";
  $("wTarget").textContent = cur().t;
  $("repeatTxt").textContent = cur().t;

  setMeaningText();

  const done = learnedCount();
  $("lessonInfo").textContent = `1. Ders • ${done}/20`;
  $("modeInfo").textContent = (S.exam?.pending ? "Sınav" : "Ders");
  $("progBar").style.width = `${Math.round((done / total()) * 100)}%`;

  $("heardBox").textContent = "Söylediğin burada görünecek…";
  $("resultMsg").textContent = "—";
  $("resultMsg").className = "status";
  $("scoreTop").textContent = "—";
  $("teacherStatus").textContent = "—";
  $("studentTop").textContent = "Mikrofona bas ve söyle.";
}

async function showCongrats() {
  const el = $("bigCheck");
  el.classList.add("show");
  await new Promise(r => setTimeout(r, 2000));
  el.classList.remove("show");
}

async function teacherSpeak() {
  if (S.speaking) return;
  S.speaking = true;
  $("teacherStatus").textContent = "🔊";
  await speakOnce(cur().t, lang);
  $("teacherStatus").textContent = "—";
  S.speaking = false;
}

/* --- SINAV & BİTİŞ --- */
function askExamReady() {
  // SÜRE KONTROLÜ
  const remain = getRemainingTime();
  if (remain > 0) {
    const minLeft = Math.ceil(remain / 60000);
    alert(`Dersin bitmesine daha ${minLeft} dakika var!\n\nKurallar gereği 15 dakikayı doldurmadan sınavı başlatamazsın başkanım. Pratiğe devam et.`);
    
    // Kelimeleri sıfırla, tekrar ettir (Loop)
    S.pos = 0;
    // Learned'leri sıfırlamıyoruz, sadece tur attırıyoruz
    // Basitlik için rastgele bir kelimeye atalım:
    S.pos = Math.floor(Math.random() * total());
    persist();
    updateUI();
    teacherSpeak();
    return;
  }

  const ok = confirm("Süre doldu ve kelimeleri bitirdin! Sınava hazır mısın? (Yes/No)");
  if (ok) {
    startExam(true);
  } else {
    S.exam.pending = true;
    persist();
    toast("Sınav beklemede.");
  }
}

function buildExamQuestions() {
  const pool = [...Array(total()).keys()];
  const q = [];
  while (pool.length && q.length < EXAM_Q) {
    const k = Math.floor(Math.random() * pool.length);
    q.push(pool.splice(k, 1)[0]);
  }
  return q;
}

function startExam(reset) {
  if (reset) {
    S.exam.q = buildExamQuestions();
    S.exam.qi = 0;
    S.exam.score = 0;
  }
  S.exam.pending = true;
  persist();
  showExamQuestion();
}

function showExamQuestion() {
  const qi = S.exam.qi || 0;
  const idx = S.exam.q[qi];
  const item = lesson()[idx];

  $("modeInfo").textContent = `Sınav ${qi + 1}/${EXAM_Q}`;
  $("lessonInfo").textContent = `Skor ${S.exam.score}/${EXAM_Q}`;

  $("wTarget").textContent = item.t;
  $("repeatTxt").textContent = item.t;

  const em = item.em ? `${item.em} ` : "";
  $("wTr").textContent = `Türkçesi: ${em}${item.tr}`;

  $("heardBox").textContent = "Söylediğin burada görünecek…";
  $("resultMsg").textContent = "Sınav: doğru söyle.";
  $("resultMsg").className = "status";
  $("scoreTop").textContent = "—";
  $("teacherStatus").textContent = "—";

  persist();
}

async function finishExam() {
  const score = S.exam.score || 0;

  if (score >= EXAM_PASS) {
    alert("🎉 Tebrikler! Bu dersten geçtin.");
    // Dersi tamamla ve session'ı temizle
    localStorage.setItem(`caynana_teacher_${lang}_lesson1_passed`, "1");
    localStorage.removeItem(STORE);
    location.reload();
    return;
  }

  S.exam.failCount = (S.exam.failCount || 0) + 1;
  persist();

  if (S.exam.failCount >= 3) {
    alert("Üzgünüm… Bu dersten kaldın. Baştan başlıyoruz.");
    S.pos = 0;
    S.learned = {};
    S.skipped = {};
    S.exam = { pending: false, failCount: 0, q: [], qi: 0, score: 0 };
    // Süreyi sıfırlama, devam etsin
    persist();
    updateUI();
    await teacherSpeak();
    return;
  }

  const again = confirm("Sınavı geçemedin. Tekrar denemek ister misin?");
  if (again) {
    startExam(true);
  } else {
    S.exam.pending = true;
    persist();
    toast("Sınav beklemede.");
  }
}

async function handleExamAnswer(heard) {
  const qi = S.exam.qi || 0;
  const idx = S.exam.q[qi];
  const expected = lesson()[idx].t;

  const sc = similarity(expected, heard);
  $("scoreTop").textContent = `Skor: ${Math.round(sc * 100)}%`;

  // Sınavda tolerans biraz daha yüksek olabilir ama kelime net olmalı
  if (sc >= 0.85 && heard.length >= 3) {
    S.exam.score++;
    $("resultMsg").textContent = "Doğru ✅";
    $("resultMsg").className = "status ok";
  } else {
    $("resultMsg").textContent = "Yanlış ❌";
    $("resultMsg").className = "status bad";
  }

  S.exam.qi = qi + 1;
  persist();

  if (S.exam.qi >= EXAM_Q) {
    await finishExam();
    return;
  }

  showExamQuestion();
}

function persist() {
  saveState({ 
    pos: S.pos, 
    learned: S.learned, 
    skipped: S.skipped, 
    exam: S.exam,
    startTime: S.startTime // Zamanı kaybetme
  });
}

/* --- ANA DİNLEME FONKSİYONU --- */
async function startListen() {
  if (S.listening || S.speaking) return;

  const rec = makeRecognizer(lang);
  if (!rec) {
    toast("Bu cihaz konuşmayı desteklemiyor.");
    return;
  }

  S.listening = true;
  $("btnMic")?.classList.add("listening");
  $("studentTop").textContent = "Dinliyorum…";

  rec.onresult = async (e) => {
    const heardRaw = e.results?.[0]?.[0]?.transcript || "";
    const heard = norm(heardRaw);
    const target = norm(cur().t);

    $("heardBox").textContent = heard ? `Söyledin: "${heardRaw}"` : "Duyamadım…";

    S.listening = false;
    $("btnMic")?.classList.remove("listening");
    $("studentTop").textContent = "Mikrofona bas ve söyle.";

    if (!heard) {
      toast("Ses gelmedi.");
      return;
    }

    // Sınav modundaysa
    if (S.exam?.pending) {
      await handleExamAnswer(heard);
      return;
    }

    // --- STRICT MODE VALIDATION ---
    const sc = similarity(target, heard);
    let passed = false;

    // 1. Kısa kelimeler (3 harf ve altı) KESİN EŞLEŞME ister
    if (target.length <= 4) {
      if (target === heard) passed = true;
      else passed = false;
    } 
    // 2. Uzun kelimelerde %85 benzerlik YETERLİ AMA Baş harf tutmalı
    else {
      if (sc >= 0.85 && target[0] === heard[0]) passed = true;
      else passed = false;
    }

    $("scoreTop").textContent = `Eşleşme: ${Math.round(sc * 100)}%`;

    if (passed) {
      $("resultMsg").textContent = "Doğru ✅";
      $("resultMsg").className = "status ok";

      await showCongrats();

      S.learned[S.pos] = true;
      delete S.skipped[S.pos];
      persist();

      const done = learnedCount();
      
      // Barajı geçtiyse
      if (done >= EXAM_GATE) {
        askExamReady();
        return;
      }

      const next = pickNextIndex();
      if (next === null) {
        askExamReady(); // Kelime bitti
        return;
      }

      S.pos = next;
      persist();
      updateUI();
      await teacherSpeak();

    } else {
      // Hata durumunda net geri bildirim
      $("resultMsg").textContent = `Olmadı ❌ (Beklenen: ${target})`;
      $("resultMsg").className = "status bad";
      toast("Tekrar dene.");
      
      // Yanlış yapınca hemen doğrusunu tekrar duysun
      setTimeout(() => teacherSpeak(), 1000); 
    }
  };

  rec.onerror = () => {
    S.listening = false;
    $("btnMic")?.classList.remove("listening");
    $("studentTop").textContent = "Mikrofona bas ve söyle.";
    toast("Mikrofon hatası.");
  };

  rec.onend = () => {
    if (S.listening) {
      S.listening = false;
      $("btnMic")?.classList.remove("listening");
      $("studentTop").textContent = "Mikrofona bas ve söyle.";
    }
  };

  try { rec.start(); }
  catch {
    S.listening = false;
    $("btnMic")?.classList.remove("listening");
    toast("Mikrofon başlatılamadı.");
  }
}

function skip() {
  if (S.exam?.pending) {
    toast("Sınavda atlama yok.");
    return;
  }
  S.skipped[S.pos] = true;
  persist();

  const next = pickNextIndex();
  if (next === null) {
    if (learnedCount() >= EXAM_GATE) askExamReady();
    else toast("Atlanacak kelime kalmadı.");
    return;
  }

  S.pos = next;
  persist();
  updateUI();
  teacherSpeak();
}

function bindOnce() {
  if (S.bound) return;
  S.bound = true;

  $("backBtn")?.addEventListener("click", () => {
    // Çıkış kontrolü
    const r = getRemainingTime();
    if (r > 0 && !S.exam?.pending) {
        const conf = confirm(`Henüz 15 dakika dolmadı (${formatTime(r)} kaldı). Çıkarsan ilerlemen kaybolabilir. Emin misin?`);
        if(!conf) return;
    }
    if (history.length > 1) history.back();
    else location.href = "/pages/teachers.html";
  });

  $("btnSpeak")?.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    teacherSpeak();
  });

  $("btnMic")?.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    startListen();
  });

  $("btnSkip")?.addEventListener("pointerdown", (e) => {
    e.preventDefault(); e.stopPropagation();
    skip();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindOnce();
  updateUI();
  startTimer(); // Sayacı başlat

  if (S.exam?.pending) {
    const ok = confirm("Sınav bekliyor. Devam edelim mi? (Yes/No)");
    if (ok) showExamQuestion();
    else toast("Sınav beklemede.");
    return;
  }

  await teacherSpeak();
});
