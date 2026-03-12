import { createClient } from "@supabase/supabase-js";

const url = typeof import.meta.env.VITE_SUPABASE_URL === "string" ? import.meta.env.VITE_SUPABASE_URL.trim() : "";
const anonKey = typeof import.meta.env.VITE_SUPABASE_ANON_KEY === "string" ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim() : "";

let client = null;
export function getSupabase() {
  if (!url || !anonKey) return null;
  if (!client) {
    try {
      client = createClient(url, anonKey);
    } catch (e) {
      console.error("[TaskBrain] Supabase client init failed:", e);
      return null;
    }
  }
  return client;
}
