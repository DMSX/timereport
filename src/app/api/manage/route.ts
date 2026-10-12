import { z } from "zod";
import { apiError, authenticated, HttpError, requireMember, sameOrigin } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/server";
import { inviteOrFindUser } from "@/lib/invitations";

const uuid = z.uuid();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), company: uuid, email: z.email(), name: z.string().trim().min(1).max(120), role: z.enum(["employee", "hr", "admin"]) }),
  z.object({ action: z.literal("createCompany"), name: z.string().trim().min(1).max(120), email: z.email(), adminName: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal("complimentary"), company: uuid, enabled: z.boolean() }),
]);

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = input.parse(await request.json());
    const auth = await authenticated();
    const service = serviceClient();
    if (data.action === "invite") {
      await requireMember(data.company);
      const invitation = await inviteOrFindUser(data.email);
      const { error: memberError } = await service.from("company_members").insert({
        company_id: data.company, user_id: invitation.id, display_name: data.name, role: data.role,
      });
      if (memberError) throw memberError;
      return Response.json({ message: invitation.invited ? "Einladung versendet. Bitte Arbeitsmodell und Projekte zuweisen." : "Bestehender Benutzer zur Firma hinzugefügt. Bitte Arbeitsmodell und Projekte zuweisen." });
    }
    const { data: operator, error: operatorError } = await auth.db.from("operators").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (operatorError) throw operatorError;
    if (!operator) throw new HttpError(403, "Nur der SaaS-Betreiber darf Firmen freischalten.");
    if (data.action === "complimentary") {
      const { data: updated, error } = await service.from("subscriptions").update({ complimentary: data.enabled })
        .eq("company_id", data.company).select("company_id").maybeSingle();
      if (error) throw error;
      if (!updated) throw new HttpError(404, "Firma oder Abostatus nicht gefunden.");
      return Response.json({ message: data.enabled ? "Firma kostenfrei freigeschaltet. Bestehende Stripe-Abos müssen separat gekündigt werden." : "Kostenfreie Freischaltung aufgehoben." });
    }
    const invitation = await inviteOrFindUser(data.email);
    const { error: provisionError } = await service.rpc("provision_company", {
      p_name: data.name, p_user: invitation.id, p_admin_name: data.adminName,
    });
    if (provisionError) throw provisionError;
    return Response.json({ message: invitation.invited ? "Firma angelegt und Admin eingeladen." : "Firma angelegt und bestehender Benutzer als Admin zugewiesen." });
  } catch (e) { return apiError(e); }
}
