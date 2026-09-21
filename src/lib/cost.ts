/**
 * Directional cost estimate for a scan's Anthropic API call — NOT a
 * billing-accurate figure. Rates are a hardcoded snapshot of Anthropic's
 * per-million-token pricing at the time this was written and will drift as
 * pricing changes; https://docs.claude.com/en/docs/about-claude/pricing is
 * the source of truth. This exists so an account can see roughly what its
 * own scanning is costing on its own API key, not to reconcile an invoice.
 */

const RATE_PER_MILLION_USD: Record<"opus" | "sonnet" | "haiku", { input: number; output: number }> = {
  opus: { input: 15, output: 75 },
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.8, output: 4 },
};

function rateFor(model: string) {
  const m = model.toLowerCase();
  if (m.includes("opus")) return RATE_PER_MILLION_USD.opus;
  if (m.includes("haiku")) return RATE_PER_MILLION_USD.haiku;
  return RATE_PER_MILLION_USD.sonnet; // default/fallback for sonnet and any unrecognized model
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = rateFor(model);
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}
