import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * Stripe webhook receiver — keeps `users.subscriptionStatus` in sync with
 * what Stripe actually thinks is going on (a Checkout completing, a renewal
 * failing, a cancellation), rather than trusting only the redirect back
 * from Checkout, which a user can just... not follow. Signature-verified
 * the same way the GitHub webhook handler is: reject anything that isn't
 * provably from Stripe before touching the database.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/stripe] STRIPE_WEBHOOK_SECRET is not set — refusing to process webhooks.");
    return NextResponse.json({ error: "Webhook not configured on this server." }, { status: 500 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    console.error("[webhooks/stripe] signature verification failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const periodEnd = subscription.items.data[0]?.current_period_end;

      await db
        .update(users)
        .set({
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        })
        .where(eq(users.stripeCustomerId, customerId));
      break;
    }
    default:
      // Everything else (invoice events, payment_method events, etc.) is
      // intentionally ignored — subscription status is the only thing this
      // app currently tracks.
      break;
  }

  return NextResponse.json({ received: true });
}
