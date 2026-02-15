import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

/* ------------------------- HELPERS ------------------------- */

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

/* ------------------ PROFILE GUARANTEE ------------------ */

// Eğer ensure_profile RPC yoksa fallback ile oluşturur
async function getOrCreateProfile(user){
  try{
    const { data, error } = await supabase.rpc("ensure_profile");
    if(!error && data) return data;
  }catch{}

  // direct select
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if(error) throw error;

  if(data) return data;

  // profil yoksa oluştur (400 jeton hediyesi)
  const insert = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || "Kullanıcı",
    tokens: 400,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString()
  };

  const { data: created, error: insErr } = await supabase
    .from("profiles")
    .insert(insert)
    .select()
    .single();

  if(insErr) throw insErr;

  return created;
}

/* ------------------ MEMBER NO ------------------ */

function randLetter(){
  const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return A[Math.floor(Math.random()*A.length)];
}
function randDigits7(){
  let s="";
  for(let i=0;i<7;i++) s += String(Math.floor(Math.random()*10));
  return s;
}
function genMemberNo(){
  return `${randLetter()}${randDigits7()}`;
}

async function ensureMemberNo(profile){
  if(profile.member_no) return profile.member_no;

  const newNo = genMemberNo();
  const { data } = await supabase
    .from("profiles")
    .update({ member_no: newNo })
    .eq("id", profile.id)
    .select("member_no")
    .single();

  return data?.member_no || newNo;
}

/* ------------------ LOGOUT ------------------ */

function nukeAuthStorage(){
  try{
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith("sb-") && k.includes("auth-token")){
        keys.push(k);
      }
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch{}
}

async function safeLogout(){
  try{ await supabase.auth.signOut({ scope:"global" }); }catch{}
  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
  try{ localStorage.removeItem("NAC_ID"); }catch{}
  nukeAuthStorage();
  location.href="/pages/login.html";
}

/* ------------------ INIT ------------------ */

export async function initProfilePage({ setHeaderTokens } = {}){

  const { data:{ session } } = await supabase.auth.getSession();
  if(!session){
    location.href="/pages/login.html";
    return;
  }

  const user = session.user;
  const profile = await getOrCreateProfile(user);

  /* ---------- UI BIND ---------- */

  $("pName").textContent =
    profile.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "Kullanıcı";

  $("pEmail").textContent = profile.email || user.email || "—";

  const memberNo = await ensureMemberNo(profile);
  $("memberNo").textContent = memberNo;

  $("createdAt").textContent = fmtDT(profile.created_at);
  $("lastLogin").textContent = fmtDT(profile.last_login_at);

  const tokens = Number(profile.tokens ?? 0);
  $("tokenVal").textContent = tokens;

  if(typeof setHeaderTokens === "function"){
    setHeaderTokens(tokens);
  }

  /* ---------- EVENTS ---------- */

  $("logoutBtn")?.addEventListener("click", safeLogout);

  $("buyTokensBtn")?.addEventListener("click", ()=>{
    toast("Jeton satın alma yakında aktif.");
  });

  $("levelsEmptyNote")?.addEventListener("click", ()=>{
    location.href="/pages/teacher_select.html";
  });

  $("offlineDownloadBtn")?.addEventListener("click", ()=>{
    location.href="/pages/offline.html";
  });

  $("deleteBtn")?.addEventListener("click", async ()=>{
    const ok = confirm("Silme talebi oluşturulsun mu? 30 gün içinde giriş yaparsanız iptal edilir.");
    if(!ok) return;

    const { error } = await supabase.rpc("request_account_deletion");
    if(error){
      alert(error.message);
      return;
    }
    location.href="/pages/delete_requested.html";
  });

}
