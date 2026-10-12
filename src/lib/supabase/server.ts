import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "../types";
import { secureSupabaseUrl } from "./url";

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Serverkonfiguration fehlt: ${name}`);
  return value;
}

export async function serverClient() {
  const store = await cookies();
  return createServerClient<Database>(
    secureSupabaseUrl(requiredEnv("NEXT_PUBLIC_SUPABASE_URL")),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => store.set(name, value, options)),
    } },
  );
}

export function serviceClient() {
  return createClient<Database>(secureSupabaseUrl(requiredEnv("NEXT_PUBLIC_SUPABASE_URL")), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
