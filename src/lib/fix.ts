import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Vendor } from "@/db/schema";
import { VENDOR_BRIEFINGS } from "@/lib/vendors";

const FixSchema = z.object({
  newFileContent: z.string(),
  commitMessage: z.string(),
  prTitle: z.string(),
  prBody: z.string(),
});

export type GeneratedFix = z.infer<typeof FixSchema>;

const RULES = `
Rules:
- Change ONLY what's needed to resolve the finding described below. Do not reformat, rewrite, or "clean up" unrelated code.
- Preserve the file's existing style, imports, and structure exactly except for the fix itself.
- newFileContent must be the COMPLETE file with the fix applied, not a diff or a snippet — it will be committed as-is.
- commitMessage: one line, imperative mood, under 72 characters.
- prTitle: short, specific, under 70 characters.
- prBody: 2-4 sentences in markdown explaining what was wrong and what changed. Mention this was opened by Breakwater at the user's request.
Respond with ONLY minified JSON, no markdown fences, matching exactly this shape:
{"newFileContent":string,"commitMessage":string,"prTitle":string,"prBody":string}
`.trim();

/**
 * Asks Claude to produce a corrected version of one file for one specific
 * finding. Only ever called from the "Open fix PR" action — never during a
 * routine scan — and the result is shown to the user as a normal PR they
 * can review and close/merge themselves like any other.
 */
export async function generateFix(
  anthropicApiKey: string,
  vendor: Vendor,
  finding: { title: string; explanation: string; evidence: string; recommendation: string; filePath: string },
  fileContent: string
): Promise<GeneratedFix> {
  const client = new Anthropic({ apiKey: anthropicApiKey });

  const prompt = [
    VENDOR_BRIEFINGS[vendor],
    "",
    RULES,
    "",
    `Finding to fix in ${finding.filePath}:`,
    `Title: ${finding.title}`,
    `Explanation: ${finding.explanation}`,
    `Evidence: ${finding.evidence}`,
    `Recommendation: ${finding.recommendation}`,
    "",
    `----- FILE: ${finding.filePath} -----`,
    fileContent,
  ].join("\n");

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  const parsed = extractJson(raw);
  const result = FixSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model fix response didn't match the expected shape: ${result.error.message}`);
  }
  return result.data;
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("No JSON object found in model response.");
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}
