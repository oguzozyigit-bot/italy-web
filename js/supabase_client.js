// FILE: /js/supabase_client.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://rkbwcmeqdwuewqeokfas.supabase.co", // YENİ PROJE URL
  "sb_publishable_Xh1B9xUhmHCV6A3ffgeIrg_yO6uTX0t", // YENİ PUBLISHABLE KEY
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
