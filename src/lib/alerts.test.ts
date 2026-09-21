import { describe, it, expect, vi, beforeEach } from "vitest";
import { fanOutAlert, type AlertPayload } from "./alerts";

const BASE_PAYLOAD: AlertPayload = {
  repoName: "acme/api",
  repoUrl: "https://github.com/acme/api",
  vendor: "stripe",
  overallRisk: "high",
  summary: "Test summary",
  findingsCount: 1,
  dashboardUrl: "https://breakwater.example.com/dashboard",
};

function mockOkFetch() {
  return vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("fanOutAlert", () => {
  it("only attempts channels that are configured", async () => {
    vi.stubGlobal("fetch", mockOkFetch());
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const results = await fanOutAlert(
      { to: null, webhookUrl: null, slackWebhookUrl: null },
      BASE_PAYLOAD,
      sendEmail
    );

    expect(results).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("attempts email, webhook, and slack when all three are configured", async () => {
    vi.stubGlobal("fetch", mockOkFetch());
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const results = await fanOutAlert(
      {
        to: "dev@example.com",
        webhookUrl: "https://hooks.example.com/x",
        slackWebhookUrl: "https://hooks.slack.com/services/x",
      },
      BASE_PAYLOAD,
      sendEmail
    );

    const channels = results.map((r) => r.channel).sort();
    expect(channels).toEqual(["email", "slack", "webhook"]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("fires PagerDuty when the risk is high and a key is configured", async () => {
    vi.stubGlobal("fetch", mockOkFetch());
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const results = await fanOutAlert(
      { to: null, webhookUrl: null, slackWebhookUrl: null, pagerDutyIntegrationKey: "pd-key" },
      { ...BASE_PAYLOAD, overallRisk: "high" },
      sendEmail
    );

    expect(results.map((r) => r.channel)).toContain("pagerduty");
  });

  it("does NOT fire PagerDuty for medium or low risk, even with a key configured", async () => {
    const fetchMock = mockOkFetch();
    vi.stubGlobal("fetch", fetchMock);
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const mediumResults = await fanOutAlert(
      { to: null, webhookUrl: null, slackWebhookUrl: null, pagerDutyIntegrationKey: "pd-key" },
      { ...BASE_PAYLOAD, overallRisk: "medium" },
      sendEmail
    );
    const lowResults = await fanOutAlert(
      { to: null, webhookUrl: null, slackWebhookUrl: null, pagerDutyIntegrationKey: "pd-key" },
      { ...BASE_PAYLOAD, overallRisk: "low" },
      sendEmail
    );

    expect(mediumResults.map((r) => r.channel)).not.toContain("pagerduty");
    expect(lowResults.map((r) => r.channel)).not.toContain("pagerduty");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a channel as failed, without throwing, when its delivery errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const results = await fanOutAlert(
      { to: null, webhookUrl: "https://hooks.example.com/x", slackWebhookUrl: null },
      BASE_PAYLOAD,
      sendEmail
    );

    expect(results).toEqual([expect.objectContaining({ channel: "webhook", ok: false })]);
  });

  it("keeps other channels succeeding when one channel fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        typeof url === "string" && url.includes("slack")
          ? Promise.resolve(new Response("boom", { status: 500 }))
          : Promise.resolve(new Response("ok", { status: 200 }))
      )
    );
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const results = await fanOutAlert(
      {
        to: null,
        webhookUrl: "https://hooks.example.com/x",
        slackWebhookUrl: "https://hooks.slack.com/services/x",
      },
      BASE_PAYLOAD,
      sendEmail
    );

    const webhookResult = results.find((r) => r.channel === "webhook");
    const slackResult = results.find((r) => r.channel === "slack");
    expect(webhookResult?.ok).toBe(true);
    expect(slackResult?.ok).toBe(false);
  });
});
