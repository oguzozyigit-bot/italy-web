// FILE: italky-web/js/teacher_page.js
// FINAL v23.0 (15 MIN LESSON + 24H COOLDOWN + EXAM EVERY 7 LESSONS)
// Kurallar:
// - 15 dk dolmadan çıkarsa ders bitmiş sayılmaz, kaldığı yerden devam eder.
// - 15 dk tamamlanırsa ders tamamlanır, yeni ders 24 saat sonra açılır.
// - Her 7 dersin sonunda sınav (sınav geçilmeden yeni ders başlamaz).

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

/* --- TIME --- */
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/* --- HELPER: Normalize --- */
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
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
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
      u.rate = 0.9;
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

/* --- LESSON DATA --- */
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
  de: [ { tr:"elma", t:"apfel", em:"🍎" }, { tr:"su", t:"wasser", em:"💧" }, { tr:"ekmek", t:"brot", em:"🍞" }, { tr:"menü", t:"speisekarte", em:"📜" }, { tr:"fiyat", t:"preis", em:"🏷️" }, { tr:"evet", t:"ja", em:"✅" }, { tr:"hayır", t:"nein", em:"❌" }, { tr:"merhaba", t:"hallo", em:"👋" }, { tr:"güle güle", t:"tschüss", em:"👋" }, { tr:"teşekkürler", t:"danke", em:"🙏" }, { tr:"lütfen", t:"bitte", em:"🤝" }, { tr:"affedersiniz", t:"entschuldigung", em:"🙋" }, { tr:"anlamıyorum", t:"ich verstehe nicht", em:"🤷" }, { tr:"yardım", t:"hilfe", em:"🆘" }, { tr:"tuvalet", t:"toilette", em:"🚻" }, { tr:"hesap", t:"die rechnung", em:"🧾" }, { tr:"çok güzel", t:"sehr gut", em:"🌟" }, { tr:"sıcak", t:"heiß", em:"🔥" }, { tr:"soğuk", t:"kalt", em:"❄️" }, { tr:"bugün", t:"heute", em:"📅" } ],
  fr: [ { tr:"elma", t:"pomme", em:"🍎" }, { tr:"su", t:"eau", em:"💧" }, { tr:"ekmek", t:"pain", em:"🍞" }, { tr:"menü", t:"menu", em:"📜" }, { tr:"fiyat", t:"prix", em:"🏷️" }, { tr:"evet", t:"oui", em:"✅" }, { tr:"hayır", t:"non", em:"❌" }, { tr:"merhaba", t:"bonjour", em:"👋" }, { tr:"güle güle", t:"au revoir", em:"👋" }, { tr:"teşekkürler", t:"merci", em:"🙏" }, { tr:"lütfen", t:"s'il vous plaît", em:"🤝" }, { tr:"affedersiniz", t:"excusez-moi", em:"🙋" }, { tr:"anlamıyorum", t:"je ne comprends pas", em:"🤷" }, { tr:"yardım", t:"aide", em:"🆘" }, { tr:"tuvalet", t:"toilettes", em:"🚻" }, {ümle, t:"l'addition", em:"🧾" }, { tr:"çok güzel", t:"très bien", em:"🌟" }, { tr:"sıcak", t:"chaud", em:"🔥" }, { tr:"soğuk", t:"froid", em:"❄️" }, { tr:"bugün", t:"aujourd'hui", em:"📅" } ],
  it: [ { tr:"elma", t:"mela", em:"🍎" }, { tr:"su", t:"acqua", em:"💧" }, { tr:"ekmek", t:"pane", em:"🍞" }, { tr:"menü", t:"menu", em:"📜" }, { tr:"fiyat", t:"prezzo", em:"🏷️" }, { tr:"evet", t:"sì", em:"✅" }, { tr:"hayır", t:"no", em:"❌" }, { tr:"merhaba", t:"ciao", em:"👋" }, { tr:"güle güle", t:"arrivederci", em:"👋" }, { tr:"teşekkürler", t:"grazie", em:"🙏" }, { tr:"lütfen", t:"per favore", em:"🤝" }, { tr:"affedersiniz", t:"scusi", em:"🙋" }, { tr:"anlamıyorum", t:"non capisco", em:"🤷" }, { tr:"yardım", t:"aiuto", em:"🆘" }, { tr:"tuvalet", t:"bagno", em:"🚻" }, { tr:"hesap", t:"il conto", em:"🧾" }, { tr:"çok güzel", t:"molto bene", em:"🌟" }, { tr:"sıcak", t:"caldo", em:"🔥" }, { tr:"soğuk", t:"freddo", em:"❄️" }, { tr:"bugün", t:"oggi", em:"📅" } ],
  es: [ { tr:"elma", t:"manzana", em:"🍎" }, { tr:"su", t:"agua", em:"💧" }, { tr:"ekmek", t:"pan", em:"🍞" }, { tr:"menü", t:"menú", em:"📜" }, { tr:"fiyat", t:"precio", em:"🏷️" }, { tr:"evet", t:"sí", em:"✅" }, { tr:"hayır", t:"no", em:"❌" }, { tr:"merhaba", t:"hola", em:"👋" }, { tr:"güle güle", t:"adiós", em:"👋" }, { tr:"teşekkürler", t:"gracias", em:"🙏" }, { tr:"lütfen", t:"por favor", em:"🤝" }, { tr:"affedersiniz", t:"perdón", em:"🙋" }, { tr:"anlamıyorum", t:"no entiendo", em:"🤷" }, { tr:"yardım", t:"ayuda", em:"🆘" }, { tr:"tuvalet", t:"baño", em:"🚻" }, { tr:"hesap", t:"la cuenta", em:"🧾" }, { tr:"çok güzel", t:"muy bien", em:"🌟" }, { tr:"sıcak", t:"caliente", em:"🔥" }, { tr:"soğuk", t:"frío", em:"❄️" }, { tr:"bugün", t:"hoy", em:"📅" } ]
};

// İleride LESSON2..LESSON7 ekleyince buraya koyacaksın:
const LESSONS = [
  LESSON1,
  // LESSON2,
  // LESSON3,
  // ...
];

/* --- STORAGE --- */
const PROGRESS_KEY = `italky_teacher_progress_${lang}_v1`; // genel ilerleme
function loadJson(key, fb = null) {
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return fb; }
}
function saveJson(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* --- PROGRESS STATE (ders/gün/sınav kilidi) --- */
function loadProgress() {
  const now = Date.now();
  const p = loadJson(PROGRESS_KEY, null) || {};
  return {
    lessonNo: Number.isInteger(p.lessonNo) && p.lessonNo >= 1 ? p.lessonNo : 1,
    lessonsCompleted: Number.isInteger(p.lessonsCompleted) && p.lessonsCompleted >= 0 ? p.lessonsCompleted : 0,

    // aktif dersin start zamanı (15 dk sayacı buradan)
    activeStartTime: typeof p.activeStartTime === "number" ? p.activeStartTime : 0,

    // ders tamamlandıysa (15 dk doldu)
    lastCompletedAt: typeof p.lastCompletedAt === "number" ? p.lastCompletedAt : 0,

    // yeni ders açılma zamanı (24h kilit)
    nextLessonAt: typeof p.nextLessonAt === "number" ? p.nextLessonAt : 0,

    // 7 ders sonunda sınav gereksinimi
    examRequired: !!p.examRequired,
    examPassedCount: Number.isInteger(p.examPassedCount) && p.examPassedCount >= 0 ? p.examPassedCount : 0,
  };
}
function saveProgress(P) {
  saveJson(PROGRESS_KEY, P);
}

const P = loadProgress();

/* --- PER-LESSON STORE (kelime ilerlemesi) --- */
function getLessonStoreKey(lessonNo) {
  return `italky_teacher_${lang}_lesson_${lessonNo}_v1`;
}

/* --- LESSON DURATION --- */
const LESSON_DURATION_MS = 15 * 60 * 1000;

function isLockedBy24h() {
  const now = Date.now();
  return P.nextLessonAt && now < P.nextLessonAt;
}

function isLockedByExam() {
  // sınav zorunluysa ve henüz geçilmemişse, yeni ders başlatma engeli
  return !!P.examRequired;
}

/* --- CURRENT LESSON DATA --- */
function getLessonData(lessonNo) {
  // Ders sayısı azsa en azından 1. dersi döndür (fallback)
  const idx = Math.max(0, Math.min((lessonNo - 1), LESSONS.length - 1));
  const pack = LESSONS[idx] || LESSON1;
  return pack[lang] || pack.en || LESSON1.en;
}

/* --- LESSON STATE (kelime/pos) --- */
function loadLessonState(lessonNo) {
  const key = getLessonStoreKey(lessonNo);
  const x = loadJson(key, {}) || {};
  const now = Date.now();

  // aktifStartTime yoksa ve ders kilitli değilse başlat
  if (!P.activeStartTime && !isLockedBy24h() && !isLockedByExam()) {
    P.activeStartTime = now;
    saveProgress(P);
  }

  return {
    pos: Number.isInteger(x.pos) ? x.pos : 0,
    learned: x.learned || {},
    skipped: x.skipped || {},
    exam: x.exam || { pending: false, waiting: false, failCount: 0, q: [], qi: 0, score: 0 },
    // startTime ders bazlı DEĞİL, global P.activeStartTime
    speaking: false,
    listening: false,
    bound: false
  };
}

function saveLessonState(lessonNo, S) {
  const key = getLessonStoreKey(lessonNo);
  saveJson(key, {
    pos: S.pos,
    learned: S.learned,
    skipped: S.skipped,
    exam: S.exam
  });
}

let S = loadLessonState(P.lessonNo);

/* --- UI HELPERS --- */
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function remainingLessonTime() {
  if (!P.activeStartTime) return LESSON_DURATION_MS;
  const elapsed = Date.now() - P.activeStartTime;
  const remain = LESSON_DURATION_MS - elapsed;
  return remain > 0 ? remain : 0;
}

function remainingLockTime() {
  const now = Date.now();
  if (!P.nextLessonAt || now >= P.nextLessonAt) return 0;
  return P.nextLessonAt - now;
}

function setMeaningText(item) {
  const em = item.em ? `${item.em} ` : "";
  $("wTr").textContent = `Türkçesi: ${em}${item.tr}`;
}

function lesson() { return getLessonData(P.lessonNo); }
function total() { return lesson().length; }
function cur() { return lesson()[S.pos]; }
function learnedCount() { return Object.keys(S.learned).length; }

function setLockedUI(msg) {
  $("modeInfo").textContent = "Kilitli";
  $("lessonInfo").textContent = msg || "Bekle";
  $("teacherStatus").textContent = "⏳";
  $("studentTop").textContent = msg || "Bekle...";
  $("resultMsg").textContent = "—";
  $("resultMsg").className = "status";
  $("scoreTop").textContent = "—";
}

function updateUI() {
  $("langPill").textContent = LANG_LABEL[lang] || "Teacher";

  // Öncelik: sınav kilidi
  if (isLockedByExam()) {
    $("wTarget").textContent = "EXAM";
    $("repeatTxt").textContent = "EXAM";
    $("wTr").textContent = "Türkçesi: Sınav zorunlu";
    setLockedUI("7 ders bitti. Sınavı geçmeden yeni ders yok.");
    return;
  }

  // 24 saat kilidi
  if (isLockedBy24h()) {
    const r = remainingLockTime();
    $("wTarget").textContent = "LOCK";
    $("repeatTxt").textContent = "LOCK";
    $("wTr").textContent = "Türkçesi: 24 saat bekleme";
    setLockedUI(`Yeni ders ${formatTime(r)} sonra açılır.`);
    return;
  }

  // normal ders
  const item = cur();
  $("wTarget").textContent = item.t;
  $("repeatTxt").textContent = item.t;
  setMeaningText(item);

  const done = learnedCount();
  $("lessonInfo").textContent = `${P.lessonNo}. Ders • ${done}/${total()}`;
  $("modeInfo").textContent = (S.exam?.pending ? "Sınav" : "Ders");
  $("progBar").style.width = `${Math.round((done / total()) * 100)}%`;

  $("heardBox").textContent = "Söylediğin burada görünecek…";
  $("resultMsg").textContent = "—";
  $("resultMsg").className = "status";
  $("scoreTop").textContent = "—";
  $("teacherStatus").textContent = "—";
  $("studentTop").textContent = "Mikrofona bas ve söyle.";
}

/* --- TIMER BADGE (15 dk) + LOCK BADGE (opsiyonel) --- */
let timerInterval = null;

function startTimer() {
  const el = $("timerBadge");
  if (!el) return;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    // Ders kilitliyse farklı göster
    if (isLockedByExam()) {
      el.style.color = "#f59e0b";
      el.textContent = "EXAM";
      return;
    }
    if (isLockedBy24h()) {
      const r = remainingLockTime();
      el.style.color = "#f59e0b";
      el.textContent = `⏳ ${formatTime(r)}`;
      return;
    }

    const r = remainingLessonTime();
    el.style.color = (r <= 0) ? "#ef4444" : "";
    el.textContent = (r <= 0) ? "0:00" : formatTime(r);

    // 15 dk dolduysa ders tamamlanma koşulu, ama ders "tamamlama" aksiyonu:
    // - Kullanıcı sayfada kalsa bile, bu ders artık "bitmeye hazır". Biz bunu
    // otomatik tamamlamıyoruz; kelime turu devam edebilir ama “dersi bitirdin” sayabiliriz.
    // Bu yüzden sadece bilgilendirme toast’u (1 kere).
    if (r <= 0 && !window.__lessonTimeDoneToast) {
      window.__lessonTimeDoneToast = true;
      toast("15 dk doldu ✅ Dersi bitirebilirsin.");
    }
  }, 1000);
}

/* --- LESSON COMPLETE (15dk) --- */
function completeLessonIfEligible() {
  // sınav/24h kilidi varken zaten yapma
  if (isLockedByExam() || isLockedBy24h()) return false;

  const r = remainingLessonTime();
  if (r > 0) return false;

  // Ders tamamlandı:
  const now = Date.now();
  P.lessonsCompleted += 1;
  P.lastCompletedAt = now;

  // 7 ders tamamlandıysa sınav zorunlu
  if (P.lessonsCompleted % 7 === 0) {
    P.examRequired = true;
  }

  // Yeni ders 24 saat sonra (sınav zorunlu olsa bile bu kilit dursun)
  P.nextLessonAt = now + DAY;

  // Ders numarasını artır
  P.lessonNo += 1;

  // aktif startTime reset (yeni ders başladığında tekrar atanacak)
  P.activeStartTime = 0;

  saveProgress(P);

  // Bir sonraki dersin state’ini başlatma (kilit varken başlamasın)
  S = loadLessonState(P.lessonNo);
  updateUI();

  return true;
}

/* --- CONFETTI / CHECK --- */
async function showCongrats() {
  const el = $("bigCheck");
  if (!el) return;
  el.classList.add("show");
  await new Promise(r => setTimeout(r, 2000));
  el.classList.remove("show");
}

/* --- TEACHER SPEAK --- */
async function teacherSpeak() {
  if (isLockedByExam()) { toast("Önce sınav."); return; }
  if (isLockedBy24h()) { toast("Yeni ders kilitli."); return; }

  if (S.speaking) return;
  S.speaking = true;
  $("teacherStatus").textContent = "🔊";
  await speakOnce(cur().t, lang);
  $("teacherStatus").textContent = "—";
  S.speaking = false;
}

/* =========================
   EXAM SYSTEM (Every 7 lessons)
   ========================= */

// Exam config
const EXAM_Q = 10;
const EXAM_PASS = 8;

function buildExamQuestions() {
  // Sınav havuzu: en azından mevcut ders havuzundan seçiyoruz
  const pool = [...Array(total()).keys()];
  const q = [];
  while (pool.length && q.length < EXAM_Q) {
    const k = Math.floor(Math.random() * pool.length);
    q.push(pool.splice(k, 1)[0]);
  }
  return q;
}

function startExam(reset) {
  if (!P.examRequired) {
    toast("Sınav zorunlu değil.");
    return;
  }
  if (reset) {
    S.exam.q = buildExamQuestions();
    S.exam.qi = 0;
    S.exam.score = 0;
  }
  S.exam.waiting = false;
  S.exam.pending = true;
  saveLessonState(P.lessonNo, S);
  showExamQuestion();
}

function showExamQuestion() {
  if (!S.exam?.pending) return;

  const qi = S.exam.qi || 0;
  const idx = S.exam.q?.[qi];

  // güvenlik
  if (typeof idx !== "number") {
    // q yoksa yeniden başlat
    startExam(true);
    return;
  }

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

  saveLessonState(P.lessonNo, S);
}

async function finishExam() {
  const score = S.exam.score || 0;

  if (score >= EXAM_PASS) {
    alert("🎉 Tebrikler! Sınavı geçtin.");
    // sınav kilidini kaldır
    P.examRequired = false;
    P.examPassedCount += 1;
    saveProgress(P);

    // Sınav state sıfırla
    S.exam = { pending: false, waiting: false, failCount: 0, q: [], qi: 0, score: 0 };
    saveLessonState(P.lessonNo, S);

    updateUI();
    toast("Sınav geçti ✅");
    return;
  }

  S.exam.failCount = (S.exam.failCount || 0) + 1;
  saveLessonState(P.lessonNo, S);

  if (S.exam.failCount >= 3) {
    alert("Üzgünüm… 3 kez kaldın. Dersi tekrar edip sonra tekrar dene.");
    // sınav modunu kapat ama examRequired kalır → yeni ders yok
    S.exam = { pending: false, waiting: true, failCount: 0, q: [], qi: 0, score: 0 };
    saveLessonState(P.lessonNo, S);
    updateUI();
    return;
  }

  const again = confirm("Sınavı geçemedin. Tekrar denemek ister misin?");
  if (again) startExam(true);
  else {
    S.exam.pending = false;
    S.exam.waiting = true;
    saveLessonState(P.lessonNo, S);
    toast("Sınav beklemede.");
    updateUI();
  }
}

async function handleExamAnswer(heard) {
  const qi = S.exam.qi || 0;
  const idx = S.exam.q?.[qi];
  const expected = (typeof idx === "number") ? lesson()[idx].t : cur().t;

  const sc = similarity(expected, heard);
  $("scoreTop").textContent = `Skor: ${Math.round(sc * 100)}%`;

  if (sc >= 0.85 && heard.length >= 2) {
    S.exam.score++;
    $("resultMsg").textContent = "Doğru ✅";
    $("resultMsg").className = "status ok";
  } else {
    $("resultMsg").textContent = "Yanlış ❌";
    $("resultMsg").className = "status bad";
  }

  S.exam.qi = qi + 1;
  saveLessonState(P.lessonNo, S);

  if (S.exam.qi >= EXAM_Q) {
    await finishExam();
    return;
  }

  showExamQuestion();
}

/* --- NEXT WORD PICK --- */
function pickNextIndex() {
  for (let i = 0; i < total(); i++) {
    if (!S.learned[i] && !S.skipped[i]) return i;
  }
  for (let i = 0; i < total(); i++) {
    if (!S.learned[i] && S.skipped[i]) return i;
  }
  return null;
}

/* --- STRICT CHECK --- */
function strictPassed(target, heard) {
  const sc = similarity(target, heard);

  // kısa kelimeler kesin
  if (target.length <= 4) {
    return target === heard;
  }

  // uzun kelime: %85 + ilk harf
  return (sc >= 0.85 && target[0] === heard[0]);
}

/* --- LISTEN --- */
async function startListen() {
  // kilit kontrolleri
  if (isLockedByExam()) {
    // eğer sınav beklemede/pending ise sınava sok
    if (S.exam?.waiting) {
      const ok = confirm("Sınav bekliyor. Başlayalım mı?");
      if (ok) startExam(true);
      else toast("Sınav beklemede.");
    } else if (S.exam?.pending) {
      // zaten sınav modunda
    } else {
      // sınav zorunlu ama state yoksa aç
      startExam(true);
    }
    return;
  }

  if (isLockedBy24h()) {
    toast("Yeni ders 24 saat kilitli.");
    return;
  }

  if (S.listening || S.speaking) return;

  const rec = makeRecognizer(lang);
  if (!rec) { toast("Bu cihaz konuşmayı desteklemiyor."); return; }

  S.listening = true;
  $("btnMic")?.classList.add("listening");
  $("studentTop").textContent = "Dinliyorum…";

  rec.onresult = async (e) => {
    const heardRaw = e.results?.[0]?.[0]?.transcript || "";
    const heard = norm(heardRaw);

    $("heardBox").textContent = heard ? `Söyledin: "${heardRaw}"` : "Duyamadım…";

    S.listening = false;
    $("btnMic")?.classList.remove("listening");
    $("studentTop").textContent = "Mikrofona bas ve söyle.";

    if (!heard) { toast("Ses gelmedi."); return; }

    // sınav modundaysa
    if (S.exam?.pending) {
      await handleExamAnswer(heard);
      return;
    }

    const target = norm(cur().t);
    const sc = similarity(target, heard);
    $("scoreTop").textContent = `Eşleşme: ${Math.round(sc * 100)}%`;

    const passed = strictPassed(target, heard);

    if (passed) {
      $("resultMsg").textContent = "Doğru ✅";
      $("resultMsg").className = "status ok";

      await showCongrats();

      S.learned[S.pos] = true;
      delete S.skipped[S.pos];
      saveLessonState(P.lessonNo, S);

      const next = pickNextIndex();
      if (next === null) {
        // Kelime bitti: Ders bitirme kontrolü (15dk dolduysa tamamla)
        const completed = completeLessonIfEligible();
        if (completed) {
          toast("Ders tamamlandı ✅ Yeni ders 24 saat sonra.");
          updateUI();
          return;
        } else {
          // 15 dk dolmadıysa: ders bitmiş sayılmaz, devam modunda
          toast("15 dk dolmadan ders bitmez. Devam!");
          // rastgele dolaştır
          S.pos = Math.floor(Math.random() * total());
          saveLessonState(P.lessonNo, S);
          updateUI();
          await teacherSpeak();
          return;
        }
      }

      S.pos = next;
      saveLessonState(P.lessonNo, S);
      updateUI();
      await teacherSpeak();
    } else {
      $("resultMsg").textContent = `Olmadı ❌ (Beklenen: ${target})`;
      $("resultMsg").className = "status bad";
      toast("Tekrar dene.");
      setTimeout(() => teacherSpeak(), 900);
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

/* --- SKIP --- */
function skip() {
  if (isLockedByExam()) { toast("Önce sınav."); return; }
  if (isLockedBy24h()) { toast("Yeni ders kilitli."); return; }

  if (S.exam?.pending) { toast("Sınavda atlama yok."); return; }

  S.skipped[S.pos] = true;
  saveLessonState(P.lessonNo, S);

  const next = pickNextIndex();
  if (next === null) {
    // 15 dk dolduysa ders tamamla, değilse devam
    if (completeLessonIfEligible()) {
      toast("Ders tamamlandı ✅ Yeni ders 24 saat sonra.");
      updateUI();
      return;
    }
    toast("Atlanacak kelime kalmadı. 15 dk dolmadan ders bitmez.");
    return;
  }

  S.pos = next;
  saveLessonState(P.lessonNo, S);
  updateUI();
  teacherSpeak();
}

/* --- BIND --- */
function bindOnce() {
  if (S.bound) return;
  S.bound = true;

  $("backBtn")?.addEventListener("click", () => {
    // 15 dk dolmadan çıkarsa ders tamamlanmış sayılmayacak.
    // Ama ilerleme kaybolmasın: P.activeStartTime ve lesson state zaten saklı.
    // Sadece uyarı verelim:
    if (!isLockedBy24h() && !isLockedByExam()) {
      const r = remainingLessonTime();
      if (r > 0 && !S.exam?.pending) {
        const conf = confirm(`Henüz 15 dakika dolmadı (${formatTime(r)} kaldı). Çıkarsan ders bitmiş sayılmayacak ama kaldığın yerden devam edeceksin. Emin misin?`);
        if (!conf) return;
      } else if (r <= 0) {
        // 15 dk doldu: çıkmadan önce dersi tamamlamayı dene (otomatik)
        const done = completeLessonIfEligible();
        if (done) toast("Ders tamamlandı ✅");
      }
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

  // Eğer sayfa kapatılırsa state zaten yazılıyor; ekstra güvenlik:
  window.addEventListener("beforeunload", () => {
    saveLessonState(P.lessonNo, S);
    saveProgress(P);
  });
}

/* --- INIT --- */
document.addEventListener("DOMContentLoaded", async () => {
  bindOnce();

  // Eğer 24h kilidi bitti ve examRequired yoksa yeni dersi başlatırken startTime ata
  if (!isLockedBy24h() && !isLockedByExam() && !P.activeStartTime) {
    P.activeStartTime = Date.now();
    saveProgress(P);
  }

  // Eğer sınav zorunluysa UI’yi sınav moduna hazırla
  if (isLockedByExam()) {
    // sınav state yoksa beklemeye al
    if (!S.exam) S.exam = { pending: false, waiting: true, failCount: 0, q: [], qi: 0, score: 0 };
    if (!S.exam.pending && !S.exam.waiting) S.exam.waiting = true;
    saveLessonState(P.lessonNo, S);
  }

  updateUI();
  startTimer();

  // Kilitliyse konuşma yok
  if (isLockedByExam()) {
    // sınav prompt
    const ok = confirm("7 ders tamamlandı. Sınav zorunlu. Başlayalım mı?");
    if (ok) startExam(true);
    else toast("Sınav beklemede.");
    return;
  }

  if (isLockedBy24h()) {
    toast("Yeni ders kilitli. 24 saat sonra görüşürüz 😄");
    return;
  }

  // Sınav aktifse devam
  if (S.exam?.pending) {
    showExamQuestion();
    return;
  }
  if (S.exam?.waiting) {
    // ders modunda beklemesin; sınav beklemede ise prompt ver
    const ok = confirm("Sınav bekliyor. Devam edelim mi?");
    if (ok) startExam(true);
    else toast("Sınav beklemede.");
    return;
  }

  await teacherSpeak();
});
