// FILE: /js/auth.js
import { supabase } from "/js/supabase_client.js";
import { STORAGE_KEY } from "/js/config.js";

function toStdUser(u){
  if(!u) return null;
  const md = u.user_metadata || {};
  return {
    name: md.full_name || md.name || u.email,
    email: u.email,
    picture: md.avatar_url || ""
  };
}

export async function ensureAuthAndCacheUser(){
  const { data: { session } } = await supabase.auth.getSession();

  if(!session?.user) return null;

  const std = toStdUser(session.user);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(std));

  // profile + welcome token
  await supabase.rpc("ensure_profile_and_welcome", {
    p_full_name: std.name,
    p_email: std.email,
    p_avatar_url: std.picture
  });

  // wallet çek
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .maybeSingle();

  if(wallet){
    localStorage.setItem("italky_wallet", JSON.stringify({
      balance: wallet.balance
    }));
  }

  return session.user;
}

export async function loginWithGoogle(){
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/pages/home.html`
    }
  });
}

export async function logoutEverywhere(){
  await supabase.auth.signOut();
  localStorage.clear();
}
