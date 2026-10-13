import { z } from "zod";
import { apiError, sameOrigin } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/server";
import { inviteOrFindUser } from "@/lib/invitations";

const input = z.object({
  company: z.string().trim().min(1, "Bitte Firmenname angeben.").max(120),
  name: z.string().trim().min(1, "Bitte Namen angeben.").max(120),
  email: z.email("Bitte gültige E-Mail angeben."),
});

const reply = () => Response.json({
  message: "Fast geschafft: Wir haben dir eine E-Mail gesendet. Über den Link bestätigst du deine Adresse, legst dein Passwort fest und richtest den Authenticator ein.",
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const data = input.parse(await request.json());
    const invitation = await inviteOrFindUser(data.email);
    // Existing accounts get the same reply so the form cannot be used to probe for registered emails.
    if (!invitation.invited) return reply();
    const { error } = await serviceClient().rpc("signup_company", {
      p_name: data.company, p_user: invitation.id, p_admin_name: data.name,
    });
    if (error) throw error;
    return reply();
  } catch (e) { return apiError(e); }
}
