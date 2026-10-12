import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";
import { secureSupabaseUrl } from "./url";

export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase ist noch nicht konfiguriert.");
  return createBrowserClient<Database>(secureSupabaseUrl(url), key);
}
