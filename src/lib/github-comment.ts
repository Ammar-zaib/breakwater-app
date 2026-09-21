/**
 * Posting a comment on a pull request — kept separate from both
 * src/lib/github.ts (pure reads) and src/lib/github-write.ts (the ONLY
 * place that writes repo *content*: branches, files, opening PRs). A PR
 * comment never touches repo content and can't be merged, so it doesn't
 * carry the same risk as those writes — but it IS the one thing in
 * Breakwater that gets posted automatically, without a per-finding click,
 * when PR-triggered scanning is running (see src/app/api/webhooks/github).
 *
 * That's a deliberate, narrow exception to "scans only ever read": it only
 * happens on a repo where an admin explicitly flipped on PR-triggered
 * scanning (repos.prScanEnabled) via togglePrScan in actions.ts. No repo
 * gets PR comments unless someone with admin access turned it on for that
 * specific repo.
 */

const GITHUB_API = "https://api.github.com";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "breakwater-app",
  };
}

/** Posts an issue-style comment on a PR (GitHub treats PRs as issues for commenting). */
export async function commentOnPullRequest(
  accessToken: string,
  fullName: string,
  prNumber: number,
  body: string
): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { ...headers(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error commenting on PR: ${res.status} ${await res.text()}`);
  }
}
