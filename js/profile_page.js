// FILE: /js/profile_page.js
import { supabase } from "/js/supabase_client.js";

const $ = (id)=>document.getElementById(id);

// Senin tablonda level kolonları şimdilik yok.
// İleride ekleyince buraya eklersin.
const LEVEL_FIELDS = [
  // { field: "level_en", label: "English" },
  // { field: "level_de", label: "Deutsch" },
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

// 1 harf + 7 rakam (yan yana ardışık rakam yok)
function generateMemberNo(){
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter = letters[Math.floor(Math.random()*letters.length)];
  const digits = [];
  while(digits.length < 7){
    const d = Math.floor(Math.random()*10);
    if(digits.length){
      const prev = digits[digits.length-1];
      if(d === prev) continue;
      if(Math.abs(d - prev) === 1) continue; // ardışık yok
    }
    digits.push(d);
  }
  return `${letter}${digits.join("")}`;
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

async function requireSession(){
  const { data, error } = await supabase.auth.getSession();
  if(error) throw error;
  const session = data?.session;
  if(!session){
    location.replace("/pages/login.html");
    return null;
  }
  return session;
}

async function ensureProfile(){
  // Öncelik: RPC varsa onu kullan (en güvenlisi)
  const { data: p1, error: e1 } = await supabase.rpc("ensure_profile");
  if(!e1 && p1) return p1;

  // RPC yoksa fallback: select
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) throw new Error("No user");

  const { data: p2, error: e2 } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if(e2) throw e2;
  if(p2) {
    // last_login güncelle
    try{ await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", user.id); }catch(_e){}
    return p2;
  }

  // Son fallback: insert dene (RLS izin vermezse patlar)
  const payload = {
    id: user.id,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    email: user.email || "",
    avatar_url: user.user_metadata?.picture || "",
    tokens: 400,
    last_login_at: new Date().toISOString()
  };

  const { data: p3, error: e3 } = await supabase
    .from("profiles")
    .insert(payload)
    .select("*")
    .single();

  if(e3) throw e3;
  return p3;
}

async function ensureMemberNoIfMissing(profile){
  if(profile.member_no) return profile.member_no;

  const candidate = generateMemberNo();
  const { data, error } = await supabase
    .from("profiles")
    .update({ member_no: candidate })
    .eq("id", profile.id)
    .select("member_no")
    .single();

  if(error) throw error;
  return data?.member_no || candidate;
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

async function buyTokens(){
  alert("Jeton satın alma web sürümünde kapalı. APK’da Google Play üzerinden açılacak.");
}

async function logout(){
  await supabase.auth.signOut();
  location.replace("/pages/login.html");
}

async function deleteAccountFlow(){
  const ok1 = confirm("Hesabınızı KALICI olarak silmek istediğinize emin misiniz?");
  if(!ok1) return;
  const ok2 = confirm("Son kez: Bu işlem geri alınamaz. Devam edilsin mi?");
  if(!ok2) return;

  // Kalıcı silme admin ister -> Edge Function gerekir
  try{
    const { error } = await supabase.functions.invoke("delete_account");
    if(error) throw error;
    alert("Hesap silme işlemi başlatıldı.");
    location.replace("/pages/login.html");
  }catch(e){
    alert("Kalıcı silme şu an aktif değil. Edge Function 'delete_account' kurulmalı.\n\nDetay: " + (e?.message || e));
  }
}

export async function initProfilePage({ setHeaderTokens } = {}){
  const session = await requireSession();
  if(!session) return;

  const user = session.user;

  const profile = await ensureProfile();
  const memberNo = await ensureMemberNoIfMissing(profile);

  // Profili taze çek (member_no yazıldıysa görünsün)
  const { data: fresh, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if(error) throw error;

  // UI bind
  $("pId").textContent = fresh.id || user.id;
  $("pName").textContent = fresh.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "Kullanıcı";
  $("pEmail").textContent = fresh.email || user.email || "—";

  $("memberBadge").textContent = `Üyelik: ${memberNo}`;

  const tokens = Number(fresh.tokens ?? 0);
  $("tokenVal").textContent = String(tokens);
  if(typeof setHeaderTokens === "function") setHeaderTokens(tokens);

  $("createdAtVal").textContent = fmtDateTime(fresh.created_at);
  $("lastLoginVal").textContent = fmtDateTime(fresh.last_login_at);

  renderLevels(fresh);
  renderOffline(fresh);

  // actions
  $("buyTokensBtn").addEventListener("click", buyTokens);
  $("goTeacherSelectBtn").addEventListener("click", ()=>location.href="/pages/teacher_select.html");
  $("offlineDownloadBtn").addEventListener("click", ()=>location.href="/pages/offline.html");
  $("logoutBtn").addEventListener("click", logout);
  $("deleteBtn").addEventListener("click", deleteAccountFlow);
}
