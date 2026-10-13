export type AccessState = "complimentary" | "active" | "trial" | "locked";

type AccessInput = {
  complimentary: boolean; status: string; stripe_subscription_id: string | null; trial_ends_at: string;
};

// Mirrors public.company_access in the database, which enforces the lock.
export function accessState(sub: AccessInput | undefined, now = new Date()): AccessState {
  if (!sub) return "locked";
  if (sub.complimentary) return "complimentary";
  if (sub.stripe_subscription_id && ["active", "trialing", "past_due"].includes(sub.status)) return "active";
  const trialRunning = new Date(sub.trial_ends_at).getTime() > now.getTime();
  if (trialRunning && (!sub.stripe_subscription_id || ["incomplete", "incomplete_expired"].includes(sub.status))) return "trial";
  return "locked";
}

export function trialDaysLeft(sub: Pick<AccessInput, "trial_ends_at">, now = new Date()) {
  return Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86_400_000));
}
