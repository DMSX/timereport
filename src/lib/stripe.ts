import "server-only";
import Stripe from "stripe";
import { requiredEnv } from "./supabase/server";

export function stripeClient() {
  return new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
}
