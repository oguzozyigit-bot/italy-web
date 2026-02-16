// FILE: /js/profile_page.js
import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

function toast(msg){
  const t = $("toast");
  if(!t) return;
  t.textContent = String(msg||"");
  t.classList.add("show");
  clearTimeout(window.__to);
  window.__to = setTimeout(()=>t.classList.remove("show"), 1800);
}

function fmtDT(iso){
  if(!iso) return "—";
  try{
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit"
    });
  }catch{ return "—"; }
}

function minutesToHM(mins){
  const m = Math.max(0, Number(mins)||0);
  const h = Math.floor(m/60);
  const r = m%60;
  if(h<=0) return `${r} dk`;
  if(r===0) return `${h} saat`;
  return `${h} saat ${r} dk`;
}

async function requireSession(){
  const { data:{ session }, error } = await supabase.auth.getSession();
  if(error) console.warn(error);
  if(!session){
    location.replace("/pages/login.html");
    return null;
  }
  return session;
}

/* ✅ Üyelik no üretimi (1 harf + 7 rakam; ardışık 3’lü yok; 000 yok) */
function randLetter(){
  const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return A[Math.floor(Math.random()*A.length)];
}
function randDigits7(){
  let s=""; for(let i=0;i<7;i++) s += String(Math.floor(Math.random()*10));
  return s;
}
function digitsOk(d){
  for(let i=0;i<=d.length-3;i++){
    const a=+d[i], b=+d[i+1], c=+d[i+2];
    if(a+1===b && b+1===c) return false;
    if(a-1===b && b-1===c) return false;
    if(a===b && b===c) return false;
  }
  return true;
}
function genMemberNo(){
  for(let k=0;k<300;k++){
    const L=randLetter(), D=randDigits7();
    if(digitsOk(D)) return `${L}${D}`;
  }
  return `${randLetter()}${randDigits7()}`;
}

function lineRow(label, value){
  const div = document.createElement("div");
  div.className="line";
  div.innerHTML = `<div class="k">${label}</div><div class="v">${value}</div>`;
  return div;
}

async function ensureProfileRow(user){
  // 1) önce try ensure_profile (varsa)
  try{
    const { data, error } = await supabase.rpc("ensure_profile");
    if(!error && data) return data;
  }catch{}

  // 2) yoksa direct select
  const { data: p, error: e } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if(e){
    console.warn("profiles select error:", e);
    throw e;
  }

  if(p) return p;

  // 3) insert (ilk kayıt)
  const insert = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    tokens: 400,
    levels: {},
    study_minutes: {},
    offline_langs: []
  };

  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert(insert)
    .select()
    .single();

  if(insErr){
    console.warn("profiles insert error:", insErr);
    throw insErr;
  }
  return created;
}

async function ensureMemberNo(profile, userId){
  if(profile?.member_no) return profile.member_no;

  // RPC varsa dene, ama patlatmasın
  try{
    const { data, error } = await supabase.rpc("ensure_member_no");
    if(!error && data) return data;
  }catch{}

  // RPC yoksa: JS üret + update
  const newNo = genMemberNo();
  try{
    const { data, error } = await supabase
      .from("profiles")
      .update({ member_no: newNo })
      .eq("id", userId)
      .select("member_no")
      .single();
    if(!error && data?.member_no) return data.member_no;
  }catch(e){
    console.warn("member_no update error:", e);
  }

  return newNo; // en azından UI’da göster
}

async function updateLastLogin(userId){
  try{
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);
  }catch{}
}

function renderLevels(profile, reqMap){
  const list = $("levelsList");
  const empty = $("levelsEmptyNote");
  if(!list || !empty) return;

  list.innerHTML = "";

  const levels = (profile?.levels && typeof profile.levels === "object") ? profile.levels : {};
  const study  = (profile?.study_minutes && typeof profile.study_minutes === "object") ? profile.study_minutes : {};

  const TEACHER_LABELS = [
    { id:"dora",   label:"İngilizce" },
    { id:"ayda",   label:"Almanca" },
    { id:"jale",   label:"Fransızca" },
    { id:"ozan",   label:"İspanyolca" },
    { id:"sencer", label:"İtalyanca" },
    { id:"sungur", label:"Rusça" },
    { id:"huma",   label:"Japonca" },
    { id:"umay",   label:"Çince" }
  ];

  let hasAny = false;

  for(const t of TEACHER_LABELS){
    const lv = levels[t.id];
    if(!lv) continue;

    hasAny = true;
    const studiedMin = Number(study?.[t.id] || 0);
    const needMin = Number(reqMap?.[lv] ?? 0);
    const remainMin = Math.max(0, needMin - studiedMin);

    const right = `${lv} • ${minutesToHM(studiedMin)} • Kalan: ${minutesToHM(remainMin)}`;
    list.appendChild(lineRow(t.label, right));
  }

  if(!hasAny){
    empty.style.display="block";
    $("goLevel")?.addEventListener("click", ()=>location.href="/pages/teacher_select.html");
  }else{
    empty.style.display="none";
  }
}

function renderOffline(profile){
  const list = $("offlineList");
  const empty = $("offlineEmptyNote");
  if(!list || !empty) return;

  list.innerHTML="";
  const packs = Array.isArray(profile?.offline_langs) ? profile.offline_langs : [];

  if(packs.length === 0){
    empty.style.display="block";
    return;
  }
  empty.style.display="none";
  packs.forEach(p=>list.appendChild(lineRow(String(p), "Hazır")));
}

async function loadLevelRequirements(){
  try{
    const { data, error } = await supabase
      .from("level_requirements")
      .select("level, minutes_required");
    if(error) throw error;

    const map = {};
    (data||[]).forEach(r=>map[r.level]=Number(r.minutes_required||0));
    return map;
  }catch{
    // tablo yoksa bile profil çalışsın
    return { A0:0, A1:360, A2:600, B1:960, B2:1440, C1:0 };
  }
}

function nukeAuthStorage(){
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k) continue;
      if(k.startsWith("sb-") && k.includes("auth-token")) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch{}
}

async function safeLogout(){
  try{
    await supabase.auth.signOut({ scope:"global" });
  }catch(e){
    console.warn("signOut error:", e);
  }

  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
  try{ localStorage.removeItem("NAC_ID"); }catch{}
  nukeAuthStorage();

  location.replace("/pages/login.html");
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast("Kopyalandı");
  }catch{
    toast("Kopyalanamadı");
  }
}

function openNameModal(force=false){
  const modal = $("nameModal");
  if(!modal) return;
  modal.classList.add("show");
  modal.dataset.force = force ? "1" : "0";
  setTimeout(()=>$("nameInput")?.focus(), 50);
}
function closeNameModal(){
  const modal = $("nameModal");
  if(!modal) return;
  if(modal.dataset.force === "1") return;
  modal.classList.remove("show");
}

async function updateStudentName(userId, newName){
  const clean = String(newName||"").trim().slice(0,32);
  if(clean.length < 3) throw new Error("Ad en az 3 karakter olmalı.");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: clean })
    .eq("id", userId);

  if(error) throw error;

  // cache update
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const cached = raw ? JSON.parse(raw) : {};
    cached.name = clean;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    localStorage.setItem("italky_student_name", clean);
  }catch{}

  return clean;
}

export async function initProfilePage({ setHeaderTokens } = {}){
  try{
    const session = await requireSession();
    if(!session) return;

    const user = session.user;

    // ✅ profile satırını garanti et
    const profile = await ensureProfileRow(user);

    // last login update (sessiz)
    updateLastLogin(user.id);

    // requirements
    const reqMap = await loadLevelRequirements();

    // basic UI
    $("pEmail").textContent = profile.email || user.email || "—";

    const name = String(profile.full_name || "").trim();
    $("pName").textContent = name || "—";

    // name enforce
    if(name.length < 3){
      $("nameInput").value = "";
      openNameModal(true);
      toast("Lütfen adınızı girin");
    }

    // member no
    const memberNo = await ensureMemberNo(profile, user.id);
    $("memberNo").textContent = memberNo || "—";
    $("copyMemberBtn")?.addEventListener("click", ()=>copyText(memberNo));

    // dates
    $("createdAt").textContent = fmtDT(profile.created_at);
    $("lastLogin").textContent = fmtDT(profile.last_login_at);

    // wallet
    const tokens = Number(profile.tokens ?? 0);
    $("tokenVal").textContent = String(tokens);
    if(typeof setHeaderTokens === "function") setHeaderTokens(tokens);

    // lists
    renderLevels(profile, reqMap);
    renderOffline(profile);

    // buttons
    $("logoutBtn")?.addEventListener("click", safeLogout);
    $("offlineDownloadBtn")?.addEventListener("click", ()=>location.href="/pages/offline.html");
    $("buyTokensBtn")?.addEventListener("click", ()=>toast("Jeton yükleme yakında (Google Play)."));

    $("deleteBtn")?.addEventListener("click", async ()=>{
      const ok = confirm("Hesap silme talebi oluşturulsun mu? 30 gün içinde giriş yaparsanız iptal edilir.");
      if(!ok) return;
      try{
        await supabase.rpc("request_account_deletion");
        location.href="/pages/delete_requested.html";
      }catch(e){
        console.warn(e);
        toast("Silme talebi kaydedilemedi");
      }
    });

    // name edit
    $("editNameBtn")?.addEventListener("click", ()=>{
      $("nameInput").value = (String($("pName")?.textContent || "").trim());
      openNameModal(false);
    });

    $("cancelNameBtn")?.addEventListener("click", closeNameModal);

    $("saveNameBtn")?.addEventListener("click", async ()=>{
      try{
        const saved = await updateStudentName(user.id, $("nameInput").value);
        $("pName").textContent = saved;

        // header update
        const headerName = document.getElementById("userName");
        if(headerName) headerName.textContent = saved;

        const modal = $("nameModal");
        if(modal){ modal.dataset.force="0"; modal.classList.remove("show"); }
        toast("İsim kaydedildi");
      }catch(e){
        toast(e?.message || "Kaydedilemedi");
      }
    });

    $("nameModal")?.addEventListener("click",(ev)=>{
      if(ev.target?.id === "nameModal") closeNameModal();
    });

  }catch(e){
    console.error("Profile init error:", e);
    toast("Profil yüklenemedi");
  }
}
