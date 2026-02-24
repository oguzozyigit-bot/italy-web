// FILE: /js/profile_page.js
import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";
import { shortDisplayName } from "/js/ui_shell.js";

const $ = (id)=>document.getElementById(id);

function safeText(id, val){
  const el = $(id);
  if(el) el.textContent = (val ?? "");
}
function safeShow(id, on){
  const el = $(id);
  if(el) el.style.display = on ? "block" : "none";
}
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
    return d.toLocaleString("tr-TR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
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

/* ✅ hitap adı türetme */
export function deriveStudentCallName(fullName){
  const s = String(fullName || "").trim().replace(/\s+/g," ");
  if(!s) return "Student";
  const parts = s.split(" ");
  if(parts.length === 1) return parts[0];
  if(parts.length === 2) return parts[0];
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1);

  if(last.toLowerCase() === "özyiğit" || last.toLowerCase() === "ozyigit"){
    return rest.join(" ");
  }
  return rest.join(" ");
}

/* member_no generator (aynı) */
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

function nukeAuthStorage(){
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k) continue;
      if(k.startsWith("sb-")) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch{}
}

async function safeLogout(){
  try{ await supabase.auth.signOut(); }catch(e){ console.warn(e); }
  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
  try{ localStorage.removeItem("NAC_ID"); }catch{}
  nukeAuthStorage();
  location.replace("/pages/login.html");
}

async function copyText(text){
  try{ await navigator.clipboard.writeText(text); toast("Kopyalandı"); }
  catch{ toast("Kopyalanamadı"); }
}

async function ensureProfile(user){
  const { data: p, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,tokens,member_no,created_at,last_login_at,levels,offline_langs,study_minutes,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if(error) throw error;
  if(p) return p;

  const metaName = (user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  const metaPic  = (user.user_metadata?.picture || user.user_metadata?.avatar_url || "").trim();

  const insert = {
    id:user.id,
    email:user.email,
    full_name: metaName,
    avatar_url: metaPic || null,
    tokens:400,
    levels:{},
    offline_langs:[],
    study_minutes:{}
  };

  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert(insert)
    .select()
    .single();

  if(insErr) throw insErr;
  return created;
}

async function ensureFullNameFromGoogle(userId, user, currentFullName){
  const cur = String(currentFullName || "").trim();
  const metaName = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  if(cur.length >= 3) return cur;
  if(metaName.length < 3) return cur;

  try{
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: metaName.slice(0,64) })
      .eq("id", userId)
      .select("full_name")
      .single();
    if(!error && data?.full_name) return data.full_name;
  }catch{}
  return metaName.slice(0,64);
}

async function ensureAvatarFromGoogle(userId, user, current){
  const cur = String(current||"").trim();
  const metaPic = String(user.user_metadata?.picture || user.user_metadata?.avatar_url || "").trim();
  if(cur) return cur;
  if(!metaPic) return "";

  try{
    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: metaPic })
      .eq("id", userId)
      .select("avatar_url")
      .single();
    if(!error && data?.avatar_url) return data.avatar_url;
  }catch{}
  return metaPic;
}

async function ensureMemberNo(userId, current){
  if(current) return current;

  const newNo = genMemberNo();
  try{
    const { data, error } = await supabase
      .from("profiles")
      .update({ member_no: newNo })
      .eq("id", userId)
      .select("member_no")
      .single();
    if(!error && data?.member_no) return data.member_no;
  }catch{}
  return newNo;
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
    return { A0:0, A1:360, A2:600, B1:960, B2:1440, C1:0 };
  }
}

function renderLevels(profile, reqMap){
  const list = $("levelsList");
  if(list) list.innerHTML = "";

  const levels = (profile?.levels && typeof profile.levels === "object") ? profile.levels : {};
  const study  = (profile?.study_minutes && typeof profile.study_minutes === "object") ? profile.study_minutes : {};

  const TEACHERS = [
    ["dora","İngilizce"],["ayda","Almanca"],["jale","Fransızca"],["ozan","İspanyolca"],
    ["sencer","İtalyanca"],["sungur","Rusça"],["huma","Japonca"],["umay","Çince"]
  ];

  let hasAny=false;
  for(const [id,label] of TEACHERS){
    const lv = levels[id];
    if(!lv) continue;
    hasAny=true;

    const studiedMin = Number(study?.[id] || 0);
    const needMin = Number(reqMap?.[lv] ?? 0);
    const remainMin = Math.max(0, needMin - studiedMin);

    const right = `${lv} • ${minutesToHM(studiedMin)} • Kalan: ${minutesToHM(remainMin)}`;
    if(list) list.appendChild(lineRow(label, right));
  }

  safeShow("levelsEmptyNote", !hasAny);
  const go = $("goLevel");
  if(go) go.onclick = ()=>location.href="/pages/teacher_select.html";
}

function renderOffline(profile){
  const list = $("offlineList");
  if(list) list.innerHTML = "";

  const packs = Array.isArray(profile?.offline_langs) ? profile.offline_langs : [];
  safeShow("offlineEmptyNote", packs.length === 0);

  if(list && packs.length){
    packs.forEach(p=>list.appendChild(lineRow(String(p), "Hazır")));
  }
}

/* ✅ cache güncelle (header için) */
function updateShellCache({ full_name, avatar_url, tokens }){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = raw ? JSON.parse(raw) : {};
    const display_name = shortDisplayName(full_name);
    const picture = avatar_url || base.picture || base.avatar || base.avatar_url || "";

    const next = {
      ...base,
      full_name,
      display_name,
      name: display_name,
      picture,
      tokens: (tokens != null ? tokens : base.tokens)
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }catch{}
}

export async function initProfilePage({ setHeaderTokens } = {}){
  try{
    const { data:{ session } } = await supabase.auth.getSession();
    if(!session){
      location.replace("/pages/login.html");
      return;
    }

    const user = session.user;

    let profile = await ensureProfile(user);

    // full_name + avatar google’dan
    profile.full_name = await ensureFullNameFromGoogle(user.id, user, profile.full_name);
    profile.avatar_url = await ensureAvatarFromGoogle(user.id, user, profile.avatar_url);

    // last_login_at
    try{
      await supabase.from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", user.id);
    }catch{}

    profile.member_no = await ensureMemberNo(user.id, profile.member_no);

    const reqMap = await loadLevelRequirements();

    safeText("pEmail", profile.email || user.email || "—");
    safeText("pName", profile.full_name || "—");
    safeText("memberNo", profile.member_no || "—");
    safeText("createdAt", fmtDT(profile.created_at));
    safeText("lastLogin", fmtDT(profile.last_login_at));

    const tokens = Number(profile.tokens ?? 0);
    safeText("tokenVal", String(tokens));
    if(typeof setHeaderTokens === "function") setHeaderTokens(tokens);

    // ✅ header cache update: kısa isim + avatar + tokens
    updateShellCache({ full_name: profile.full_name, avatar_url: profile.avatar_url, tokens });

    renderLevels(profile, reqMap);
    renderOffline(profile);

    $("copyMemberBtn")?.addEventListener("click", ()=>copyText(profile.member_no || ""));
    $("offlineDownloadBtn")?.addEventListener("click", ()=>location.href="/pages/offline.html");
    $("buyTokensBtn")?.addEventListener("click", ()=>toast("Jeton yükleme yakında (Google Play)."));
    $("logoutBtn")?.addEventListener("click", safeLogout);

    $("deleteBtn")?.addEventListener("click", async ()=>{
      const ok = confirm("Hesap silme talebi oluşturulsun mu?");
      if(!ok) return;
      try{
        await supabase.rpc("request_account_deletion");
        location.href="/pages/delete_requested.html";
      }catch(e){
        console.warn(e);
        toast("Silme talebi kaydedilemedi");
      }
    });

  }catch(e){
    console.error(e);
    toast("Profil yüklenemedi");
  }
}
