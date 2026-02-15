// FILE: /js/supabase_client.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://rkbwcmeqdwuewqeokfas.supabase.co";
const SUPABASE_ANON_KEY = "BURAYA_SUPABASE_ANON_KEY"; // ✅ sb_anon_... (publishable değil)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
