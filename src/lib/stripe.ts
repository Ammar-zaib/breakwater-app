import Stripe from "stripe";

let cachedClient: Stripe | null = null;

/** Lazily constructed so importing this module never fails when billing
 *  isn't configured — only calling getStripe() without the env var does. */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  cachedClient = new Stripe(key);
  return cachedClient;
}

/** Whether billing is set up on this deployment at all — gates whether the
 *  Billing card shows up in Settings and whether the billing actions can be
 *  called. Self-hosted instances that don't want to charge anyone can just
 *  never set these and the feature is fully invisible. */
export function billingConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET);
}

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Human-readable label for Settings — kept out of the UI component so both
 *  the settings page and any future admin view can reuse it. */
export function describeSubscriptionStatus(status: string): string {
  switch (status as SubscriptionStatus) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due — payment failed, Stripe will retry";
    case "canceled":
      return "Canceled";
    case "incomplete":
    case "incomplete_expired":
      return "Checkout not completed";
    case "unpaid":
      return "Unpaid";
    case "paused":
      return "Paused";
    default:
      return "Not subscribed";
  }
}
