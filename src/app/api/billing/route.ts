import { z } from "zod";
import { apiError, HttpError, requireMember, sameOrigin } from "@/lib/api";
import { requiredEnv, serviceClient } from "@/lib/supabase/server";
import { stripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { company, action } = z.object({ company: z.uuid(), action: z.enum(["checkout", "portal"]) }).parse(await request.json());
    const { db } = await requireMember(company);
    const { data: sub, error } = await db.from("subscriptions").select("*").eq("company_id", company).single();
    if (error) throw error;
    const stripe = stripeClient();
    const base = requiredEnv("APP_URL");
    if (action === "portal") {
      if (!sub.stripe_customer_id) throw new HttpError(400, "Noch kein Stripe-Kundenkonto vorhanden.");
      const session = await stripe.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: base });
      return Response.json({ url: session.url });
    }
    if (sub.complimentary) throw new HttpError(400, "Diese Firma ist kostenfrei freigeschaltet.");
    if (sub.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(sub.status)) {
      throw new HttpError(409, "Ein Abo besteht bereits. Bitte das Kundenportal verwenden.");
    }
    const priceId = requiredEnv("STRIPE_PRICE_ID");
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "recurring" || price.recurring?.interval !== "month"
      || price.recurring.interval_count !== 1 || price.billing_scheme !== "per_unit" || price.unit_amount === null) {
      throw new Error("Stripe price must be an active monthly fixed price.");
    }
    const service = serviceClient();
    let customerId = sub.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { company_id: company } }, { idempotencyKey: `company:${company}` });
      customerId = customer.id;
      const { error: saveError } = await service.from("subscriptions").update({ stripe_customer_id: customerId }).eq("company_id", company);
      if (saveError) throw saveError;
    }
    const { data: leases, error: leaseError } = await service.rpc("claim_checkout", { p_company: company });
    if (leaseError) throw leaseError;
    const lease = leases?.[0];
    if (!lease) throw new Error("Checkout lease was not returned.");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", customer: customerId, client_reference_id: company,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { company_id: company } },
      expires_at: lease.expires_at,
      success_url: `${base}/?billing=success`, cancel_url: `${base}/?billing=canceled`,
    }, { idempotencyKey: `checkout:${company}:${lease.token}` });
    return Response.json({ url: session.url });
  } catch (e) { return apiError(e); }
}
