import "server-only";
import { HttpError } from "./api";
import { requiredEnv, serviceClient } from "./supabase/server";

export async function inviteOrFindUser(email: string) {
  const service = serviceClient();
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) return { id: existing.id, invited: false };
    if (data.users.length < 200) break;
  }
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${requiredEnv("APP_URL")}/login?setPassword=1`,
  });
  if (error) throw new HttpError(400, error.message);
  return { id: data.user.id, invited: true };
}
