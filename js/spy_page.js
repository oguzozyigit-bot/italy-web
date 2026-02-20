import { mountShell } from "./ui_shell.js";
import { loadLangPool, createUsedSet, pick } from "./langpool.js";

// UI Shell Başlatma
try {
    mountShell({ scroll: "none" });
} catch (e) {
    console.warn("UI Shell yüklenemedi, oyun devam ediyor...");
}

const $ = (id) => document.getElementById(id);

const LANGMAP = { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT" };

// Oyun Durumu
let lang = "en";
let muted = false;
let totalScore = 0;
let setScore = 0;
let momentum = 1.0;
let lives = 3;
let combo = 0;
let poolItems = [];
let currentItem = null;
let cooldown = false;
let setCounter = 0;
let speaking = false;

// Yardımcı Fonksiyonlar
function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
}

function norm(s) {
    return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* =========================
   SES SİSTEMİ (TTS)
========================= */
function stopSpeak() {
    speaking = false;
    window.speechSynthesis?.cancel();
}

function speak(txt, onDone) {
    if (muted || !txt) return onDone?.();
    stopSpeak();
    speaking = true;

    const u = new SpeechSynthesisUtterance(txt);
    u.lang = LANGMAP[lang] || "en-US";
    u.rate = 0.9;
    
    u.onend = () => { speaking = false; onDone?.(); };
    u.onerror = () => { speaking = false; onDone?.(); };
    
    window.speechSynthesis.speak(u);
}

/* =========================
   OYUN MANTIĞI
========================= */
async function initSet(resetStats = false) {
    if (resetStats) {
        totalScore = 0;
        lives = 3;
        momentum = 1.0;
        combo = 0;
    }
    setCounter = 0;
    setScore = 0;
    cooldown = false;

    try {
        // langpool.js'den veriyi çek
        const data = await loadLangPool(lang);
        
        // ÖNEMLİ: Veri yapısı -> data.items olmalı
        const USED_KEY = `audio_spy_used_${lang}`;
        const { used, save } = createUsedSet(USED_KEY);

        // Havuzdan 12 kelime seç
        const picked = pick(data, 12, used, save);

        if (!picked || picked.length < 4) {
            toast("Yetersiz veri! Havuz sıfırlanıyor...");
            localStorage.removeItem(USED_KEY);
            return initSet(resetStats);
        }

        poolItems = picked;
        updateUI();
        nextSignal();
    } catch (err) {
        console.error("Yükleme hatası:", err);
        toast("Sinyal bağlantısı koptu!");
    }
}

function nextSignal() {
    if (setCounter >= 8 || lives <= 0) {
        finishSet(lives <= 0);
        return;
    }

    const item = poolItems[setCounter];
    // Söyleyeceği metin: Önce cümle, yoksa kelime
    currentItem = {
        say: item.sentence || item.w,
        ans: item.tr,
        w: item.w
    };

    buildOptions(currentItem.ans);
    setListenLabel("idle");
}

function buildOptions(correct) {
    let opts = [correct];
    // Yanlış şıkları mevcut setten rastgele al
    const others = poolItems
        .filter(x => norm(x.tr) !== norm(correct))
        .map(x => x.tr);
    
    // Karıştır ve 3 tane seç
    const shuffledOthers = others.sort(() => 0.5 - Math.random()).slice(0, 3);
    opts = [...opts, ...shuffledOthers].sort(() => 0.5 - Math.random());

    const area = $("optionsArea");
    area.innerHTML = "";
    opts.forEach(v => {
        const d = document.createElement("div");
        d.className = "opt";
        d.textContent = v;
        d.onclick = () => handleChoice(d, v);
        area.appendChild(d);
    });
}

function handleChoice(el, val) {
    if (cooldown || !currentItem) return;
    cooldown = true;

    const isCorrect = norm(val) === norm(currentItem.ans);
    
    if (isCorrect) {
        el.classList.add("correct");
        const gain = Math.round(100 * momentum);
        totalScore += gain;
        setScore += gain;
        momentum = Math.min(1.6, momentum + 0.1);
        combo++;
        if (combo % 2 === 0 && lives < 3) {
            lives++;
            toast("SİSTEM ONARILDI +1 ❤️");
        }
    } else {
        el.classList.add("wrong");
        lives--;
        combo = 0;
        momentum = 1.0;
        // Doğru şıkkı göster
        Array.from($("optionsArea").children).forEach(opt => {
            if (norm(opt.textContent) === norm(currentItem.ans)) opt.classList.add("correct");
        });
    }

    updateUI();

    // Kısa bir beklemeden sonra yeni kelimeye geç
    setTimeout(() => {
        setCounter++;
        cooldown = false;
        nextSignal();
    }, 1200);
}

/* =========================
   UI GÜNCELLEME
========================= */
function updateUI() {
    $("scoreDisp").textContent = totalScore;
    $("momDisp").textContent = `x${momentum.toFixed(2)} MOMENTUM`;
    $("livesDisp").textContent = "❤️".repeat(lives) + "💀".repeat(Math.max(0, 3 - lives));
    
    const pb = localStorage.getItem(`audio_spy_pb_${lang}`) || 0;
    $("pbDisp").innerHTML = `PB: <b>${pb}</b>`;
}

function setListenLabel(state) {
    const btn = $("listenBtn");
    const radar = $("radar");
    if (state === "playing") {
        btn.textContent = "⏳ SİNYAL ÇÖZÜLÜYOR...";
        btn.disabled = true;
        radar.classList.add("playing");
    } else {
        btn.textContent = "▶ SİNYALİ DİNLE";
        btn.disabled = false;
        radar.classList.remove("playing");
    }
}

function finishSet(died) {
    const pb = localStorage.getItem(`audio_spy_pb_${lang}`) || 0;
    if (totalScore > pb) localStorage.setItem(`audio_spy_pb_${lang}`, totalScore);

    $("endModal").classList.add("show");
    $("endTitle").textContent = died ? "BAĞLANTI KESİLDİ" : "SEKTÖR TAMAMLANDI";
    $("endTitle").style.color = died ? "var(--danger)" : "var(--radar)";
    $("endStats").innerHTML = `TOPLAM SKOR: <b>${totalScore}</b><br>MOMENTUM: <b>x${momentum.toFixed(2)}</b>`;
    $("continueBtn").style.display = died ? "none" : "block";
}

/* =========================
   OLAYLAR (EVENTS)
========================= */
$("listenBtn").onclick = () => {
    if (speaking || !currentItem) return;
    setListenLabel("playing");
    speak(currentItem.say, () => setListenLabel("idle"));
};

$("startBtn").onclick = () => {
    $("startModal").classList.remove("show");
    initSet(true);
};

$("continueBtn").onclick = () => {
    $("endModal").classList.remove("show");
    initSet(false);
};

$("backBtn").onclick = () => location.reload();

document.querySelectorAll(".langBtn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".langBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        lang = btn.dataset.lang;
        updateUI();
    };
});

$("soundBtn").onclick = () => {
    muted = !muted;
    $("soundIco").textContent = muted ? "🔇" : "🔊";
};

// Başlangıç Ayarları
window.onload = () => {
    updateUI();
};
