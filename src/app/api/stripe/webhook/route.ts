import { stripeClient } from "@/lib/stripe";
import { requiredEnv, serviceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Signatur fehlt." }, { status: 400 });
  try {
    const stripe = stripeClient();
    const secret = requiredEnv("STRIPE_WEBHOOK_SECRET");
    let event;
    try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
    catch (error) {
      console.error("Stripe webhook signature validation failed", error instanceof Error ? error.message : "Unknown error");
      return Response.json({ error: "Ungültiger Webhook." }, { status: 400 });
    }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const eventObject = event.data.object;
      if (eventObject.object !== "subscription") throw new Error("Unexpected Stripe event object.");
      // Retrieve the current state, not the potentially out-of-order event snapshot.
      const subscription = await stripe.subscriptions.retrieve(eventObject.id);
      const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const service = serviceClient();
      const { data: mapped, error: lookupError } = await service.from("subscriptions").select("*").eq("stripe_customer_id", customer).maybeSingle();
      if (lookupError) throw lookupError;
      if (!mapped) throw new Error("Unmapped Stripe customer.");
      if (mapped.stripe_subscription_id && mapped.stripe_subscription_id !== subscription.id && !["canceled", "incomplete_expired"].includes(mapped.status)) {
        throw new Error("Multiple subscriptions for one company require manual reconciliation.");
      }
      const { error } = await service.from("subscriptions").update({
        stripe_subscription_id: subscription.id, status: subscription.status,
        ...(["canceled", "incomplete_expired"].includes(subscription.status) ? { checkout_lease: null, checkout_lease_until: null } : {}),
      }).eq("company_id", mapped.company_id);
      if (error) throw error;
    }
    return Response.json({ received: true });
  } catch (e) { return apiError(e); }
}
