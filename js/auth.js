import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

function toStdUser(u){
  const md = u.user_metadata || {};
  return {
    name: md.full_name || md.name || u.email || "Kullanıcı",
    email: u.email || "",
    picture: md.avatar_url || md.picture || ""
  };
}

export async function ensureAuthAndCacheUser(){
  const { data: { session } } = await supabase.auth.getSession();
  if(!session?.user) return null;

  const std = toStdUser(session.user);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(std));
  return std;
}

export async function loginWithGoogle(){
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/pages/home.html" }
  });
  if(error) alert(error.message);
}
