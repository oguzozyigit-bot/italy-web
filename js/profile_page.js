// FILE: /js/profile_page.js
import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

const TEACHER_LABELS = [
  { id:"dora",   label:"İngilizce" },
  { id:"ayda",   label:"Almanca" },
  { id:"jale",   label:"Fransızca" },
  { id:"ozan",   label:"İspanyolca" },
  { id:"sencer", label:"İtalyanca" },
  { id:"sungur", label:"Rusça" },
  { id:"huma",   label:"Japonca" },
  { id:"umay",   label:"Çince" },
];

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = String(msg||"");
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1800);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function lineRow(label, value){
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = `
    <div class="k">${escapeHtml(label)}</div>
    <div class="v">${escapeHtml(value)}</div>
  `;
  return div;
}

/* ✅ Üyelik no: 1 harf + 7 rakam; ardışık üçlü yok; üçlü tekrar yok */
function randLetter(){
  const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return A[Math.floor(Math.random()*A.length)];
}
function randDigits7(){
  let s="";
  for(let i=0;i<7;i++) s += String(Math.floor(Math.random()*10));
  return s;
}
function digitsOk(d){
  for(let i=0;i<=d.length-3;i++){
    const a=Number(d[i]), b=Number(d[i+1]), c=Number(d[i+2]);
    if(a+1===b && b+1===c) return false; // 123
    if(a-1===b && b-1===c) return false; // 321
    if(a===b && b===c) return false;      // 000
  }
  return true;
}
function genMemberNo(){
  for(let tries=0; tries<200; tries++){
    const L = randLetter();
    const D = randDigits7();
    if(!digitsOk(D)) continue;
    return `${L}${D}`;
  }
  return `${randLetter()}${randDigits7()}`;
}

async function requireSessionOrRedirect(){
  const { data, error } = await supabase.auth.getSession();
  if(error) throw error;
  if(!data?.session){
    location.replace("/index.html");
    return null;
  }
  return data.session;
}

async function fetchProfile(userId){
  // varsa ensure_profile RPC
  try{
    const { data: p, error: e } = await supabase.rpc("ensure_profile");
    if(!e && p) return p;
  }catch{}

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if(error) throw error;
  return data;
}

async function ensureMemberNo(profile){
  if(profile?.member_no) return profile.member_no;

  const newNo = genMemberNo();
  const { data, error } = await supabase
    .from("profiles")
    .update({ member_no: newNo })
    .eq("id", profile.id)
    .select("member_no")
    .single();

  if(error) throw error;
  return data.member_no;
}

function renderLevels(profile){
  const list = $("levelsList");
  const empty = $("levelsEmptyNote");
  list.innerHTML = "";

  // ✅ Yeni sistem: profile.levels veya profile.languages gibi bir alanın varsa kullan.
  // Senin DB’de şu an field’lar yoksa: localStorage italky_profile fallback.
  let pairs = [];

  // 1) DB: profile.levels = { dora:"A1", ayda:"A0" } gibi
  if(profile && profile.levels && typeof profile.levels === "object"){
    for(const t of TEACHER_LABELS){
      const v = profile.levels[t.id];
      if(v) pairs.push([t.label, v]);
    }
  }

  // 2) Local fallback: italky_profile.languages
  if(pairs.length === 0){
    try{
      const lp = JSON.parse(localStorage.getItem("italky_profile") || "{}");
      const langs = lp.languages || {};
      for(const t of TEACHER_LABELS){
        const st = langs[t.id];
        if(st && st.level) pairs.push([t.label, st.level]);
      }
    }catch{}
  }

  // 3) Legacy fallback: italky_level
  if(pairs.length === 0){
    const legacy = (localStorage.getItem("italky_level") || "").trim();
    if(legacy){
      pairs.push(["Seçili Dil", legacy]);
    }
  }

  if(pairs.length === 0){
    empty.style.display = "block";
    empty.onclick = ()=>location.href="/pages/teacher_select.html";
    return;
  }

  empty.style.display = "none";
  empty.onclick = null;

  for(const [lang, lvl] of pairs){
    list.appendChild(lineRow(`${lang}`, `${lvl}`));
  }
}

function renderOffline(profile){
  const list = $("offlineList");
  const empty = $("offlineEmptyNote");
  list.innerHTML = "";

  // DB: offline_langs array
  let packs = Array.isArray(profile?.offline_langs) ? profile.offline_langs : [];

  // fallback: localStorage italky_offline_langs
  if(packs.length === 0){
    try{
      const raw = localStorage.getItem("italky_offline_langs");
      if(raw) packs = JSON.parse(raw);
    }catch{}
  }

  if(!packs || packs.length === 0){
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  packs.forEach(x=>{
    list.appendChild(lineRow(String(x), "Hazır"));
  });
}

function nukeSupabaseAuthStorage(){
  try{
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k) continue;
      if(k.startsWith("sb-") && k.includes("auth-token")) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch(_e){}
}

async function safeLogoutHard(){
  try{ await supabase.auth.signOut({ scope:"global" }); }catch(_e){}
  try{ localStorage.removeItem(STORAGE_KEY); }catch(_e){}
  nukeSupabaseAuthStorage();
  location.href = "/index.html";
}

async function buyTokens(){
  alert("Jeton satın alma web sürümünde kapalı. APK sürümünde Google Play ile açılacak.");
}

async function deleteAccountFlow(){
  const ok1 = confirm("Hesabınızı KALICI olarak silmek istediğinize emin misiniz?");
  if(!ok1) return;
  const ok2 = confirm("Son kez: Bu işlem geri alınamaz. Devam edilsin mi?");
  if(!ok2) return;

  try{
    const { error } = await supabase.functions.invoke("delete_account");
    if(error) throw error;
    alert("Hesap silme işlemi başlatıldı.");
    await safeLogoutHard();
  }catch(e){
    alert("Kalıcı silme şu an aktif değil. Edge Function 'delete_account' kurulmalı.\n\nDetay: " + (e?.message || e));
  }
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast("Kopyalandı");
    return;
  }catch{}
  // fallback
  try{
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Kopyalandı");
  }catch{
    toast("Kopyalanamadı");
  }
}

export async function initProfilePage({ setHeaderTokens } = {}){
  const session = await requireSessionOrRedirect();
  if(!session) return;

  const user = session.user;
  const profile = await fetchProfile(user.id);

  // 1) Ad Soyad / Mail
  $("pName").textContent =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "Kullanıcı";

  $("pEmail").textContent =
    profile?.email ||
    user.email ||
    "—";

  // 2) Üyelik No (yoksa üret)
  const memberNo = await ensureMemberNo(profile);
  $("memberNo").textContent = memberNo || "—";

  $("copyMemberBtn")?.addEventListener("click", ()=>copyText(memberNo));

  // 3) Jeton
  const tokens = Number(profile?.tokens ?? 0);
  $("tokenVal").textContent = String(tokens);
  if(typeof setHeaderTokens === "function") setHeaderTokens(tokens);

  // 4) Seviye
  renderLevels(profile);

  // 5) Offline
  renderOffline(profile);

  // Buttons
  $("buyTokensBtn")?.addEventListener("click", buyTokens);
  $("offlineDownloadBtn")?.addEventListener("click", ()=>location.href="/pages/offline.html");
  $("logoutBtn")?.addEventListener("click", safeLogoutHard);
  $("deleteBtn")?.addEventListener("click", deleteAccountFlow);
}
