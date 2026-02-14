// FILE: /js/profile_page.js
import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

const LEVEL_FIELDS = [
  { field: "level_jack",  label: "English • Jack" },
  { field: "level_heidi", label: "Deutsch • Heidi" },
  { field: "level_diego", label: "Español • Diego" },
];

function fmtDateTime(iso){
  if(!iso) return "—";
  try{
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }catch{ return "—"; }
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function pill(title, desc, right){
  const div = document.createElement("div");
  div.className = "pill";
  div.innerHTML = `
    <div>
      <div class="t">${escapeHtml(title)}</div>
      <div class="d">${escapeHtml(desc || "")}</div>
    </div>
    <div class="r">${escapeHtml(right || "")}</div>
  `;
  return div;
}

async function requireSessionOrRedirect(){
  const { data, error } = await supabase.auth.getSession();
  if(error) throw error;
  if(!data?.session){
    location.replace("/pages/login.html");
    return null;
  }
  return data.session;
}

async function fetchProfileEnsured(userId){
  const { data: p, error: e } = await supabase.rpc("ensure_profile");
  if(!e && p) return p;

  const { data: p2, error: e2 } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if(e2) throw e2;
  return p2;
}

function renderLevels(profile){
  const list = $("levelsList");
  const empty = $("levelsEmptyNote");
  list.innerHTML = "";

  const items = LEVEL_FIELDS
    .map(x => ({ ...x, value: profile?.[x.field] ?? null }))
    .filter(x => x.value);

  if(items.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  for(const it of items){
    list.appendChild(pill(it.label, "Seviye tespit sonucu", String(it.value)));
  }
}

function renderOffline(profile){
  const list = $("offlineList");
  const empty = $("offlineEmptyNote");
  list.innerHTML = "";

  const langs = Array.isArray(profile?.offline_langs) ? profile.offline_langs : [];
  if(langs.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  for(const x of langs){
    list.appendChild(pill(String(x), "Offline paket indirildi", "Hazır"));
  }
}

function nukeSupabaseAuthStorage(){
  try{
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k) continue;
      // Supabase v2 token anahtarı genelde: sb-<projectref>-auth-token
      if(k.startsWith("sb-") && k.includes("auth-token")) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch(_e){}
}

async function safeLogoutHard(){
  // 1) Supabase signOut (global)
  try{
    await supabase.auth.signOut({ scope: "global" });
  }catch(_e){
    // devam
  }

  // 2) bizim cache + NAC
  try{ localStorage.removeItem(STORAGE_KEY); }catch(_e){}
  try{ localStorage.removeItem("NAC_ID"); }catch(_e){}

  // 3) Supabase auth token’ı da sök
  nukeSupabaseAuthStorage();

  // 4) login
  location.href = "/pages/login.html";
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

export async function initProfilePage({ setHeaderTokens } = {}){
  const session = await requireSessionOrRedirect();
  if(!session) return;

  const user = session.user;
  const profile = await fetchProfileEnsured(user.id);

  $("pId").textContent = profile?.id || user.id;
  $("pName").textContent = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "Kullanıcı";
  $("pEmail").textContent = profile?.email || user.email || "—";
  $("memberBadge").textContent = `Üyelik: ${profile?.member_no || "—"}`;

  $("createdAtVal").textContent = fmtDateTime(profile?.created_at);
  $("lastLoginVal").textContent = fmtDateTime(profile?.last_login_at);

  const tokens = Number(profile?.tokens ?? 0);
  $("tokenVal").textContent = String(tokens);
  if(typeof setHeaderTokens === "function") setHeaderTokens(tokens);

  renderLevels(profile);
  renderOffline(profile);

  $("buyTokensBtn")?.addEventListener("click", buyTokens);
  $("goTeacherSelectBtn")?.addEventListener("click", ()=>location.href="/pages/teacher_select.html");
  $("offlineDownloadBtn")?.addEventListener("click", ()=>location.href="/pages/offline.html");
  $("logoutBtn")?.addEventListener("click", safeLogoutHard);
  $("deleteBtn")?.addEventListener("click", deleteAccountFlow);
}
