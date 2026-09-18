import type { Vendor } from "@/db/schema";
import { STRIPE_BRIEFING, STRIPE_SEARCH_TERMS } from "./stripe";
import { TWILIO_BRIEFING, TWILIO_SEARCH_TERMS } from "./twilio";
import { OPENAI_BRIEFING, OPENAI_SEARCH_TERMS } from "./openai";
import { SHOPIFY_BRIEFING, SHOPIFY_SEARCH_TERMS } from "./shopify";
import { SLACK_BRIEFING, SLACK_SEARCH_TERMS } from "./slack";

/**
 * Every vendor Breakwater watches, in one place. Adding a vendor means: a
 * new file in this directory with a briefing sourced ONLY from that
 * vendor's own docs (see stripe.ts for the pattern), then three lines here.
 */
export const VENDOR_BRIEFINGS: Record<Vendor, string> = {
  stripe: STRIPE_BRIEFING,
  twilio: TWILIO_BRIEFING,
  openai: OPENAI_BRIEFING,
  shopify: SHOPIFY_BRIEFING,
  slack: SLACK_BRIEFING,
};

export const VENDOR_SEARCH_TERMS: Record<Vendor, string[]> = {
  stripe: STRIPE_SEARCH_TERMS,
  twilio: TWILIO_SEARCH_TERMS,
  openai: OPENAI_SEARCH_TERMS,
  shopify: SHOPIFY_SEARCH_TERMS,
  slack: SLACK_SEARCH_TERMS,
};

export const VENDOR_LABELS: Record<Vendor, string> = {
  stripe: "Stripe",
  twilio: "Twilio",
  openai: "OpenAI",
  shopify: "Shopify",
  slack: "Slack",
};
