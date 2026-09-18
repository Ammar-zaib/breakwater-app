/**
 * Sourced from OpenAI's own documentation
 * (developers.openai.com/api/docs/deprecations, developers.openai.com/api/docs/changelog)
 * and OpenAI's official blog posts, as of this writing. Keep this file the
 * single source of truth for what the scan prompt is allowed to claim about
 * OpenAI — never let the model invent facts beyond what's written here.
 */
export const OPENAI_BRIEFING = `
Reference briefing on how OpenAI versions its API (treat as ground truth; do not contradict it):
- OpenAI does not use URL path versioning (no /v1/ -> /v2/ jump) or a version header. Versioning is effectively model-based: you pin a dated model snapshot (e.g. gpt-4o-2024-08-06) rather than an API version. A request that uses an undated model alias instead of a pinned dated snapshot can silently start behaving differently whenever OpenAI repoints that alias.
- OpenAI's official deprecations page states real notice windows: GA models get at least 6 months notice, specialized variants (chat/codex/deep-research) get at least 3 months, and preview-tagged models can be deprecated with as little as 2 weeks notice — OpenAI explicitly says preview models are "not recommended for production" for this reason. Code that calls a preview-tagged model in a production path is a real, elevated risk.
- A confirmed real deprecation: the original function-calling format (functions / function_call parameters) was superseded by tools / tool_choice starting mid-2023. Code still using the old functions/function_call parameter names is on a deprecated path.
- A confirmed real deprecation: 28 older Completions-API models (davinci, curie, ada, babbage, and early GPT-3 snapshots) were shut down January 4, 2024, following the June 2023 GPT-4 API general-availability announcement. Code calling the legacy /v1/completions endpoint with one of those model names is calling something that no longer exists.
- The Assistants API was announced deprecated August 26, 2025 with a shutdown date of August 26, 2026, in favor of the Responses and Conversations APIs — code still built against the Assistants API is on a path with a real, dated end-of-life.
- General pattern: a hardcoded, undated model name, or reliance on a legacy/superseded endpoint or parameter shape, is the most common way an OpenAI integration breaks with no warning other than the deprecations page.
`.trim();

export const OPENAI_SEARCH_TERMS = [
  "new OpenAI(",
  "openai.chat.completions",
  "OPENAI_API_KEY",
  "from 'openai'",
  "require('openai')",
];
