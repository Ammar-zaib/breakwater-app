/**
 * Netlify's equivalent of vercel.json's cron entry. Vercel Cron doesn't
 * exist on Netlify, so this Scheduled Function fires on the same daily
 * schedule and simply calls the app's own /api/cron/scan route — all the
 * real scan logic stays in that one route, shared with the "Scan now"
 * button and the first-scan-on-connect path (see src/lib/scan-runner.ts).
 *
 * This function's own execution budget is short, so it doesn't wait for
 * the whole scan to finish — it just kicks the request off and logs
 * whether it was accepted. The actual scanning runs in /api/cron/scan's
 * own Netlify Function, which has a longer budget.
 */
async function triggerDailyScan() {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error(
      "[scheduled-scan] Missing URL or CRON_SECRET env var — can't trigger /api/cron/scan."
    );
    return;
  }

  try {
    const res = await fetch(`${base}/api/cron/scan`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    console.log(`[scheduled-scan] /api/cron/scan responded ${res.status}`);
  } catch (err) {
    console.error("[scheduled-scan] Failed to reach /api/cron/scan:", err);
  }
}

export default triggerDailyScan;

export const config = {
  // Same time as the Vercel cron this replaces — 13:00 UTC daily.
  schedule: "0 13 * * *",
};
