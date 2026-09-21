import { getCurrentUser } from "@/lib/current-user";
import { listApiKeys } from "@/app/actions";
import { createCheckoutSessionAction, createBillingPortalSessionAction } from "@/app/billing-actions";
import { billingConfigured, describeSubscriptionStatus } from "@/lib/stripe";
import { PageHeader, Card } from "@/components/ui";
import {
  AnthropicKeyForm,
  AlertEmailForm,
  TestAlertButton,
  ApiKeysManager,
  WebhookSettingsForm,
  DigestPreferenceToggle,
} from "@/components/settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const apiKeyRows = await listApiKeys();
  const showBilling = billingConfigured();
  const isSubscribed = user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";

  return (
    <div>
      <PageHeader title="Settings" description="Your API key, alert destinations, and account." />
      <div className="p-8 space-y-6 max-w-2xl">
        {showBilling ? (
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-1">Billing</h2>
            <p className="text-sm text-ink-dim mb-3">
              Status: <span className="font-medium text-ink">{describeSubscriptionStatus(user.subscriptionStatus)}</span>
              {user.subscriptionCurrentPeriodEnd
                ? ` · renews ${new Date(user.subscriptionCurrentPeriodEnd).toLocaleDateString()}`
                : ""}
            </p>
            {isSubscribed ? (
              <form action={createBillingPortalSessionAction}>
                <button
                  type="submit"
                  className="text-sm font-semibold border border-line rounded-lg px-4 py-2 hover:bg-surface-2 transition-colors"
                >
                  Manage billing
                </button>
              </form>
            ) : (
              <form action={createCheckoutSessionAction}>
                <button
                  type="submit"
                  className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  Subscribe
                </button>
              </form>
            )}
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">Claude API key</h2>
          <AnthropicKeyForm hasKey={!!user.anthropicApiKeyEncrypted} />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">Alert email</h2>
          <AlertEmailForm currentEmail={user.alertEmail || user.email || ""} />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">Webhook, Slack, Teams &amp; PagerDuty alerts</h2>
          <p className="text-sm text-ink-dim mb-3">
            Get the same alert Breakwater emails you, POSTed as JSON, dropped into a Slack or Teams channel, or
            paged through PagerDuty (high-risk findings only, to avoid alert fatigue).
          </p>
          <WebhookSettingsForm
            webhookUrl={user.webhookUrl || ""}
            slackWebhookUrl={user.slackWebhookUrl || ""}
            teamsWebhookUrl={user.teamsWebhookUrl || ""}
            pagerDutyIntegrationKey={user.pagerDutyIntegrationKey || ""}
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">Weekly digest</h2>
          <p className="text-sm text-ink-dim mb-3">
            A once-a-week email summarizing your account&apos;s risk posture — separate from the real-time alerts
            above.
          </p>
          <DigestPreferenceToggle initialEnabled={user.weeklyDigestEnabled} />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">Test your alerts</h2>
          <p className="text-sm text-ink-dim mb-3">
            Sends a sample alert through every channel you&apos;ve configured, so you can confirm delivery works
            end to end.
          </p>
          <TestAlertButton />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">API keys</h2>
          <ApiKeysManager initialKeys={apiKeyRows} />
        </Card>
      </div>
    </div>
  );
}
