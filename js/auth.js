// FILE: /js/auth.js
import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

/* =========================================================
   🔐 DOMAIN SABİT (redirect hatası bitirildi)
========================================================= */
const CANONICAL_ORIGIN = "https://italky.ai";
const HOME_REL   = "/pages/home.html";
const LOGIN_REL  = "/pages/login.html";
const CALLBACK_ABS = `${CANONICAL_ORIGIN}/pages/auth_callback.html`;

/* =========================================================
   🔐 SINGLE SESSION KEY
========================================================= */
const ACTIVE_SESSION_LOCAL_KEY = "ITALKY_ACTIVE_SESSION_KEY";
let __singleWatcherStarted = false;

/* =========================================================
   📱 NAC ID (Cihaz kilidi)
========================================================= */
function getOrCreateNacId(){
  const key = "NAC_ID";
  try{
    const existing = localStorage.getItem(key);
    if(existing && existing.length >= 6) return existing;

    const id = (crypto?.randomUUID?.() || `web-${Date.now()}-${Math.floor(Math.random()*1e9)}`);
    localStorage.setItem(key, id);
    return id;
  }catch{
    return `web-${Date.now()}-${Math.floor(Math.random()*1e9)}`;
  }
}

async function lockThisDevice(){
  const nacId = getOrCreateNacId();
  const { error } = await supabase.rpc("lock_device", { p_nac_id: nacId });
  if(error) throw error;
  return nacId;
}

/* =========================================================
   🧠 CACHE
========================================================= */
function buildCache(user, profile){
  return {
    id: profile?.id || user?.id || null,
    email: profile?.email || user?.email || "",
    name:
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "Kullanıcı",
    picture:
      profile?.avatar_url ||
      user?.user_metadata?.picture ||
      user?.user_metadata?.avatar_url ||
      "",
    tokens: Number(profile?.tokens ?? 0),
    member_no: profile?.member_no || null,
    offline_langs: Array.isArray(profile?.offline_langs) ? profile.offline_langs : [],
  };
}

export function readCachedUser(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

export function clearCachedUser(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch{}
}

function nukeSupabaseLocal(){
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith("sb-")) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }catch{}
}

/* =========================================================
   🔑 ACTIVE SESSION
========================================================= */
function newSessionKey(){
  return (crypto?.randomUUID?.() || `sess-${Date.now()}-${Math.floor(Math.random()*1e9)}`);
}

async function claimActiveSessionIfNeeded(userId){
  let myKey = localStorage.getItem(ACTIVE_SESSION_LOCAL_KEY) || "";
  myKey = myKey.trim();

  if(myKey) return myKey;

  myKey = newSessionKey();

  const { error } = await supabase
    .from("profiles")
    .update({
      active_session_key: myKey,
      active_session_updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if(error) throw error;

  localStorage.setItem(ACTIVE_SESSION_LOCAL_KEY, myKey);
  return myKey;
}

function startSingleSessionWatcher(userId){
  if(__singleWatcherStarted) return;
  __singleWatcherStarted = true;

  setInterval(async ()=>{
    try{
      if(location.pathname === LOGIN_REL) return;

      const myKey = (localStorage.getItem(ACTIVE_SESSION_LOCAL_KEY) || "").trim();
      if(!myKey) return;

      const { data } = await supabase
        .from("profiles")
        .select("active_session_key")
        .eq("id", userId)
        .single();

      const liveKey = String(data?.active_session_key || "").trim();

      if(liveKey && liveKey !== myKey){
        await supabase.auth.signOut({ scope:"global" });
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVE_SESSION_LOCAL_KEY);
        nukeSupabaseLocal();

        alert("Hesabınız başka bir cihazda açıldığı için bu oturum kapatıldı.");
        location.replace(LOGIN_REL);
      }
    }catch{}
  }, 5000);
}

/* =========================================================
   🛠 ENSURE PROFILE
========================================================= */
export async function ensureAuthAndCacheUser(){
  const { data:{ session }, error } = await supabase.auth.getSession();
  if(error) throw error;
  if(!session?.user) return null;

  const user = session.user;

  await lockThisDevice();

  let profile = null;

  try{
    const { data } = await supabase.rpc("ensure_profile");
    profile = data;
  }catch{
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  await claimActiveSessionIfNeeded(user.id);

  const cached = buildCache(user, profile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));

  return cached;
}

/* =========================================================
   🚀 GOOGLE LOGIN (STABLE)
========================================================= */
export async function loginWithGoogle(){

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: CALLBACK_ABS,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if(error) throw error;
}

/* =========================================================
   🔓 LOGOUT
========================================================= */
export async function safeLogout(){
  await supabase.auth.signOut({ scope:"global" });
  clearCachedUser();
  localStorage.removeItem(ACTIVE_SESSION_LOCAL_KEY);
  nukeSupabaseLocal();
  location.replace(LOGIN_REL);
}

/* =========================================================
   🧭 AUTH STATE WATCHER
========================================================= */
export async function startAuthState(callback) {

  const handleAuth = async (session) => {
    const user = session?.user || null;

    if(user){
      try{
        const cached = await ensureAuthAndCacheUser();
        const wallet = Number(cached?.tokens ?? 0);

        startSingleSessionWatcher(user.id);

        callback({ user, wallet });
        return;
      }catch{
        callback({ user:null, wallet:0 });
        location.replace(LOGIN_REL);
        return;
      }
    }

    callback({ user:null, wallet:0 });
  };

  const { data:{ session } } = await supabase.auth.getSession();
  await handleAuth(session);

  supabase.auth.onAuthStateChange(async (_event, session2)=>{
    await handleAuth(session2);
  });
}
