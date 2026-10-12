import { serverClient } from "@/lib/supabase/server";
import { z } from "zod";
import { apiError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = z.enum(["invite", "recovery"]).parse(url.searchParams.get("type"));
    const token_hash = z.string().min(1).parse(url.searchParams.get("token_hash"));
    const db = await serverClient();
    const { error } = await db.auth.verifyOtp({ type, token_hash });
    if (error) return Response.json({ error: "Einladungslink ungültig oder abgelaufen. Bitte einen neuen Link anfordern." }, { status: 400 });
    return Response.redirect(new URL("/login?setPassword=1", url.origin), 303);
  } catch (e) { return apiError(e); }
}
