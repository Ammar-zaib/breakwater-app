"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

/** Starts (or resumes) a Stripe Checkout subscription flow for the signed-in
 *  user's own account. Creates a Stripe customer the first time and saves
 *  its id, so every later webhook for this user resolves by
 *  stripeCustomerId — no guessing, no race with the webhook arriving before
 *  the customer row would exist. */
export async function createCheckoutSessionAction(): Promise<never> {
  if (!billingConfigured()) throw new Error("Billing isn't configured on this deployment.");
  const user = await requireUser();
  const stripe = getStripe();

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { breakwaterUserId: user.id },
    });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${baseUrl()}/dashboard/settings?billing=success`,
    cancel_url: `${baseUrl()}/dashboard/settings?billing=canceled`,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe didn't return a Checkout URL.");

  await logAudit({
    ownerId: user.id,
    actor: { id: user.id, email: user.email },
    action: "billing.checkout_start",
  });

  redirect(session.url);
}

/** Opens Stripe's own hosted billing portal — manage payment method, view
 *  invoices, cancel — rather than Breakwater reimplementing any of that. */
export async function createBillingPortalSessionAction(): Promise<never> {
  if (!billingConfigured()) throw new Error("Billing isn't configured on this deployment.");
  const user = await requireUser();
  if (!user.stripeCustomerId) throw new Error("No billing account yet — subscribe first.");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl()}/dashboard/settings`,
  });

  redirect(session.url);
}
