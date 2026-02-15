// FILE: /js/supabase_client.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://rkbwcmeqdwuewqeokfas.supabase.co";

/**
 * ✅ BURAYA MUTLAKA ANON KEY GELECEK
 * Supabase Dashboard -> Project Settings -> API -> "anon public"
 * sb_publishable değil, sb_anon ile başlayan key.
 */
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
