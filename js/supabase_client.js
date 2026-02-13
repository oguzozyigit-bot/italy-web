// FILE: /js/supabase_client.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const SUPABASE_URL = "https://dzeemgfwzwkalryjthps.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZEtcwHtn_P2wB_cRX9OrKg_Z5R6PyXl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
