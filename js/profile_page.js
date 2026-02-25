// FILE: /js/profile_page.js
// ✅ FIXED: profiles tablosunda "uuid" YOK → doğru kolon "id" (auth.users.id ile aynı)
// ✅ RLS kuralı da auth.uid() = profiles.id olmalı
// ✅ Profil ekranı: DB olmasa bile session'dan doldurur
// ✅ Güvenli çıkış %100 çalışır (signOut patlasa bile)

import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

const $ = (id)=>document.getElementById(id);

function safeText(id, val){
  const el = $(id);
  if(el) el.textContent = (val ?? "—");
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

/* ✅ İsim kısaltma: "Oğuz Ö." / "Huri Hüma Ö." / "Mustafa" */
export function shortDisplayName(fullName){
  const s = String(fullName || "").trim().replace(/\s+/g," ");
  if(!s) return "Kullanıcı";
  const parts = s.split(" ").filter(Boolean);
  if(parts.length === 1) return parts[0];
  if(parts.length === 2) return `${parts[0]} ${(parts[1][0]||"").toUpperCase()}.`;
  const last = parts[parts.length-1];
  const firsts = parts.slice(0,-1).join(" ");
  return `${firsts} ${(last[0]||"").toUpperCase()}.`;
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

/* ✅ ÇIKIŞ %100 */
async function safeLogoutHard(){
  try{ await supabase.auth.signOut(); }catch(e){ console.warn("[signOut]", e); }
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

/* member_no generator (fail-safe) */
function randLetter(){ const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ"; return A[Math.floor(Math.random()*A.length)]; }
function randDigits7(){ let s=""; for(let i=0;i<7;i++) s += String(Math.floor(Math.random()*10)); return s; }
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

/* ✅ Session’dan ekrana bas (DB olmasa bile) */
function paintFromSession(user){
  const full = String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Kullanıcı");
  safeText("pName", full);
  safeText("pEmail", user?.email || "—");

  // header (ui_shell)
  try{
    const hn = document.getElementById("userName");
    if(hn) hn.textContent = shortDisplayName(full || "Kullanıcı");

    const pic = String(user?.user_metadata?.picture || user?.user_metadata?.avatar_url || "");
    const hp = document.getElementById("userPic");
    if(hp && pic){
      hp.src = pic;
      hp.referrerPolicy = "no-referrer";
    }
  }catch{}
}

/* ✅ DB’den çek (DOĞRU: profiles.id = auth.users.id) */
async function tryLoadProfile(userId){
  try{
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,avatar_url,tokens,member_no,created_at,last_login_at,levels,offline_langs,study_minutes,role")
      .eq("id", userId)
      .maybeSingle();
    if(error) throw error;
    return data || null;
  }catch(e){
    console.warn("[profiles.select id]", e);
    return null;
  }
}

/* ✅ Yoksa oluştur (id zorunlu) */
async function tryInsertProfile(user){
  try{
    const metaName = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
    const metaPic  = String(user.user_metadata?.picture || user.user_metadata?.avatar_url || "").trim();

    const insert = {
      id: user.id,                  // ✅ en kritik satır
      email: user.email || null,
      full_name: metaName || null,
      avatar_url: metaPic || null,
      tokens: 0,
      levels: {},
      offline_langs: [],
      study_minutes: {}
    };

    const { data, error } = await supabase
      .from("profiles")
      .insert(insert)
      .select()
      .single();

    if(error) throw error;
    return data || null;
  }catch(e){
    console.warn("[profiles.insert]", e);
    return null;
  }
}

function renderOffline(profile){
  const list = $("offlineList");
  if(list) list.innerHTML = "";
  const packs = Array.isArray(profile?.offline_langs) ? profile.offline_langs : [];
  safeShow("offlineEmptyNote", packs.length === 0);

  if(list && packs.length){
    for(const p of packs){
      const row = document.createElement("div");
      row.className = "line";
      row.innerHTML = `<div class="k">${String(p)}</div><div class="v">Hazır</div>`;
      list.appendChild(row);
    }
  }
}

function renderLevels(profile){
  const list = $("levelsList");
  if(list) list.innerHTML = "";
  const levels = (profile?.levels && typeof profile.levels === "object") ? profile.levels : {};
  const hasAny = Object.keys(levels).length > 0;

  safeShow("levelsEmptyNote", !hasAny);
  const go = $("goLevel");
  if(go) go.onclick = ()=>location.href="/pages/teacher_select.html";
}

export async function initProfilePage({ setHeaderTokens } = {}){
  // ✅ Butonları en baştan bağla
  const logoutBtn = $("logoutBtn");
  if(logoutBtn) logoutBtn.onclick = safeLogoutHard;

  const offBtn = $("offlineDownloadBtn");
  if(offBtn) offBtn.onclick = ()=>location.href="/pages/offline.html";

  const buyBtn = $("buyTokensBtn");
  if(buyBtn) buyBtn.onclick = ()=>toast("Jeton yükleme yakında (Google Play).");

  // ✅ session
  const { data:{ session } } = await supabase.auth.getSession();
  if(!session?.user){
    location.replace("/pages/login.html");
    return;
  }

  const user = session.user;
  paintFromSession(user);

  // ✅ DB profile
  let profile = await tryLoadProfile(user.id);
  if(!profile){
    profile = await tryInsertProfile(user);
    if(!profile) profile = await tryLoadProfile(user.id);
  }

  // DB yoksa bile sayfa boş kalmasın
  if(!profile){
    safeText("memberNo", "—");
    safeText("createdAt", "—");
    safeText("lastLogin", "—");
    safeText("tokenVal", "0");
    if(typeof setHeaderTokens === "function") setHeaderTokens(0);
    renderLevels(null);
    renderOffline(null);
    toast("Profil verisi alınamadı. (profiles RLS: auth.uid() = id olmalı)");
    return;
  }

  // ✅ ekrana bas
  safeText("pEmail", profile.email || user.email || "—");
  safeText("pName", profile.full_name || (user.user_metadata?.full_name || user.user_metadata?.name) || (user.email||"—"));

  // member no yoksa üret ve id ile update et
  let memberNo = profile.member_no;
  if(!memberNo){
    memberNo = genMemberNo();
    try{
      await supabase.from("profiles").update({ member_no: memberNo }).eq("id", user.id);
    }catch(e){ console.warn("[member_no update]", e); }
  }
  safeText("memberNo", memberNo || "—");

  safeText("createdAt", fmtDT(profile.created_at));
  safeText("lastLogin", fmtDT(profile.last_login_at));

  const tokens = Number(profile.tokens ?? 0);
  safeText("tokenVal", String(tokens));
  if(typeof setHeaderTokens === "function") setHeaderTokens(tokens);

  // ✅ header kısaltma + avatar
  try{
    const hn = document.getElementById("userName");
    if(hn) hn.textContent = shortDisplayName(profile.full_name || user.email || "Kullanıcı");

    const pic = String(profile.avatar_url || user.user_metadata?.picture || user.user_metadata?.avatar_url || "");
    const hp = document.getElementById("userPic");
    if(hp && pic){
      hp.src = pic;
      hp.referrerPolicy = "no-referrer";
    }
  }catch{}

  // ✅ copy member no
  const copyBtn = $("copyMemberBtn");
  if(copyBtn) copyBtn.onclick = ()=>copyText(memberNo || "");

  renderLevels(profile);
  renderOffline(profile);

  // delete butonu
  const deleteBtn = $("deleteBtn");
  if(deleteBtn){
    deleteBtn.onclick = async ()=>{
      const ok = confirm("Hesap silme talebi oluşturulsun mu? 30 gün içinde giriş yaparsanız iptal edilir.");
      if(!ok) return;
      try{
        await supabase.rpc("request_account_deletion");
        location.href="/pages/delete_requested.html";
      }catch(e){
        console.warn(e);
        toast("Silme talebi kaydedilemedi");
      }
    };
  }
}
