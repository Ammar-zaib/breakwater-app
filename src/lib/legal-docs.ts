import { readFile } from "fs/promises";
import path from "path";
import { marked } from "marked";

/**
 * Renders the repo-root LEGAL_*.md files as HTML for the public /terms and
 * /privacy pages. Each markdown file starts with a note aimed at whoever is
 * setting this app up (a caveat that these are templates, not legal advice,
 * written by an AI assistant) — that note is for you, not for an end
 * customer reading the live page, so it's stripped here by cutting
 * everything before the first top-level heading rather than duplicated.
 *
 * The rendered page will still contain [bracketed placeholders] until you
 * fill them in — see the top of the source .md file for what needs a real
 * value before this is customer-ready.
 *
 * Deliberately two separate functions with a literal filename in each
 * `readFile` call, rather than one function taking a filename parameter —
 * Next's build tracer can only scope a filesystem-tracing to specific
 * files when it can see the literal path at the call site; a dynamic
 * parameter there makes it conservatively trace (and bundle) the entire
 * project into the server output instead.
 */
function stripCaveatBanner(raw: string): string {
  const headingIndex = raw.indexOf("\n# ");
  return headingIndex >= 0 ? raw.slice(headingIndex + 1) : raw;
}

export async function renderTermsOfServiceHtml(): Promise<string> {
  const raw = await readFile(path.join(process.cwd(), "LEGAL_TERMS_OF_SERVICE.md"), "utf8");
  return marked.parse(stripCaveatBanner(raw), { async: false }) as string;
}

export async function renderPrivacyPolicyHtml(): Promise<string> {
  const raw = await readFile(path.join(process.cwd(), "LEGAL_PRIVACY_POLICY.md"), "utf8");
  return marked.parse(stripCaveatBanner(raw), { async: false }) as string;
}
