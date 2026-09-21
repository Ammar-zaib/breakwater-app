import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Vendor } from "@/db/schema";
import { VENDOR_BRIEFINGS } from "@/lib/vendors";

const FindingSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  title: z.string(),
  explanation: z.string(),
  evidence: z.string(),
  filePath: z.string().nullable().optional(),
  recommendation: z.string(),
});

const ReportSchema = z.object({
  overallRisk: z.enum(["high", "medium", "low"]),
  summary: z.string(),
  findings: z.array(FindingSchema),
});

export type ScanReport = z.infer<typeof ReportSchema>;

export type ScanUsage = { inputTokens: number; outputTokens: number; model: string };
export type ScanResult = { report: ScanReport; usage: ScanUsage };

const RULES = `
Rules:
- Only report a finding if it is actually evidenced by something present in the pasted code below. Never invent a vendor behavior that isn't in the briefing above.
- If the code pins an explicit API version and handles unknown event types gracefully, say so plainly — do not manufacture problems.
- Quote the exact offending line(s) from the pasted code as "evidence", verbatim, and include which file it came from in "filePath" using the file markers given.
Respond with ONLY minified JSON, no markdown fences, matching exactly this shape:
{"overallRisk":"high"|"medium"|"low","summary":string,"findings":[{"severity":"high"|"medium"|"low","title":string,"explanation":string,"evidence":string,"filePath":string|null,"recommendation":string}]}
`.trim();

/**
 * Runs one vendor-risk scan against a set of files and returns a validated
 * report. `anthropicApiKey` is the CUSTOMER's own key (see README) — this
 * product never bills API usage through a shared key.
 */
export async function runScan(
  anthropicApiKey: string,
  vendor: Vendor,
  files: { path: string; content: string }[]
): Promise<ScanResult> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  if (files.length === 0) {
    return {
      report: {
        overallRisk: "low",
        summary:
          "No files matching this vendor's SDK were found in the repository, so nothing was scanned.",
        findings: [],
      },
      usage: { inputTokens: 0, outputTokens: 0, model },
    };
  }

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const codeBlock = files
    .map((f) => `----- FILE: ${f.path} -----\n${f.content}`)
    .join("\n\n");

  const prompt = [
    VENDOR_BRIEFINGS[vendor],
    "",
    RULES,
    "",
    "Files to audit:",
    codeBlock,
  ].join("\n");

  const message = await client.messages.create({
    // Configurable because Anthropic model names change over time — check
    // https://docs.claude.com/en/docs/about-claude/models for the current
    // slug and set ANTHROPIC_MODEL if this default has aged out.
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  const parsed = extractJson(raw);
  const result = ReportSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Model response didn't match the expected report shape: ${result.error.message}`
    );
  }
  return {
    report: result.data,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model,
    },
  };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Fall back to slicing out the first {...} block, in case the model
    // wrapped the JSON in prose or a markdown fence despite instructions.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("No JSON object found in model response.");
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}
