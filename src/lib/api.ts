import "server-only";
import { ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";
import { serverClient, requiredEnv } from "./supabase/server";
import type { Role } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function authenticated() {
  const db = await serverClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Bitte anmelden.");
  const { data: level, error: levelError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (levelError || level?.currentLevel !== "aal2") throw new HttpError(403, "Authenticator-2FA erforderlich.");
  return { db, user: data.user };
}

export async function requireMember(company: string, roles: Role[] = ["admin"]) {
  const auth = await authenticated();
  const { data, error } = await auth.db.from("company_members").select("*")
    .eq("company_id", company).eq("user_id", auth.user.id).maybeSingle();
  if (error) throw error;
  if (!data || !roles.includes(data.role)) throw new HttpError(403, "Keine Berechtigung für diese Firma.");
  return { ...auth, member: data };
}

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(requiredEnv("APP_URL")).origin) {
    throw new HttpError(403, "Ungültiger Anfrageursprung.");
  }
}

export function apiError(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  console.error("API request failed", error);
  return Response.json({ error: "Die Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen oder den Administrator kontaktieren." }, { status: 500 });
}
