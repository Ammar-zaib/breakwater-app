/**
 * Thin wrapper over the GitHub REST API using a user's OAuth access token
 * (stored on their `account` row by the Auth.js Drizzle adapter). No SDK
 * dependency needed — the REST API is simple enough to call directly with
 * fetch.
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

export type GitHubRepo = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
};

/** Repos the authenticated user owns or collaborates on, most recently pushed first. */
export async function listUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${GITHUB_API}/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator`,
    { headers: headers(accessToken) }
  );
  if (!res.ok) {
    throw new Error(`GitHub API error listing repos: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Finds files in a repo whose content plausibly touches the given vendor's
 * SDK, using GitHub's code search, then fetches their contents. Returns at
 * most `maxFiles` files, truncated to `maxBytesPerFile` each, to keep the
 * scan prompt small and cheap.
 */
export async function fetchVendorRelevantFiles(
  accessToken: string,
  fullName: string,
  vendorSearchTerms: string[],
  opts: { maxFiles?: number; maxBytesPerFile?: number } = {}
): Promise<{ path: string; content: string }[]> {
  const maxFiles = opts.maxFiles ?? 6;
  const maxBytesPerFile = opts.maxBytesPerFile ?? 6000;

  const foundPaths = new Set<string>();
  for (const term of vendorSearchTerms) {
    const q = encodeURIComponent(`${term} repo:${fullName}`);
    const res = await fetch(`${GITHUB_API}/search/code?q=${q}&per_page=10`, {
      headers: headers(accessToken),
    });
    // Code search requires the repo to be indexed; a 422/403 here (rate
    // limits, empty repo) shouldn't kill the whole scan. Logged (not
    // swallowed silently) so a scan that comes back with zero files has a
    // trace in the server logs explaining whether that's because nothing
    // matched or because the search request itself failed.
    if (!res.ok) {
      console.error(
        `[github.fetchVendorRelevantFiles] search/code failed for term "${term}" on ${fullName}: ${res.status} ${await res.text()}`
      );
      continue;
    }
    const data = (await res.json()) as { items?: { path: string }[] };
    console.log(
      `[github.fetchVendorRelevantFiles] term "${term}" on ${fullName}: ${data.items?.length ?? 0} result(s)`
    );
    for (const item of data.items ?? []) {
      foundPaths.add(item.path);
      if (foundPaths.size >= maxFiles) break;
    }
    if (foundPaths.size >= maxFiles) break;
  }

  const files: { path: string; content: string }[] = [];
  for (const path of foundPaths) {
    const content = await fetchFileContent(accessToken, fullName, path);
    if (content) {
      files.push({ path, content: content.slice(0, maxBytesPerFile) });
    }
  }
  return files;
}

export async function fetchFileContent(
  accessToken: string,
  fullName: string,
  path: string,
  ref?: string
): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(path)}${
    ref ? `?ref=${encodeURIComponent(ref)}` : ""
  }`;
  const res = await fetch(url, { headers: headers(accessToken) });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}

export type PullRequestFile = {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
};

/** Files changed by a pull request (paths + change status), most-changed first per GitHub's default ordering. */
export async function fetchPullRequestFiles(
  accessToken: string,
  fullName: string,
  prNumber: number
): Promise<PullRequestFile[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/pulls/${prNumber}/files?per_page=100`, {
    headers: headers(accessToken),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error listing PR files: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Registers a webhook on the repo for pull_request events, pointed at
 * Breakwater's webhook endpoint. Only called from togglePrScan when a repo
 * admin explicitly enables PR-triggered scanning — never automatically.
 * Returns the webhook's id (needed later to remove it if the user disables
 * the feature or disconnects the repo).
 */
export async function createRepoWebhook(
  accessToken: string,
  fullName: string,
  webhookUrl: string,
  secret: string
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/hooks`, {
    method: "POST",
    headers: { ...headers(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["pull_request"],
      config: { url: webhookUrl, content_type: "json", secret, insecure_ssl: "0" },
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error creating webhook: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: number };
  return String(data.id);
}

/** Whether a branch exists on the repo — used to validate a user-entered branch name before watching it. */
export async function branchExists(accessToken: string, fullName: string, branch: string): Promise<boolean> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/branches/${encodeURIComponent(branch)}`, {
    headers: headers(accessToken),
  });
  return res.ok;
}

const SOURCE_FILE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".php", ".java", ".cs",
];

/**
 * File paths on a branch, filtered to common source-file extensions and
 * capped, for scanning a branch GitHub's code-search API can't reach
 * (search only indexes the default branch). Uses the git trees API with
 * recursive=1 — one request for the whole tree rather than walking
 * directories one at a time.
 */
export async function fetchBranchFilePaths(
  accessToken: string,
  fullName: string,
  branch: string,
  maxPaths = 300
): Promise<string[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
    headers: headers(accessToken),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error listing branch tree: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { tree?: { path: string; type: string }[]; truncated?: boolean };
  return (data.tree ?? [])
    .filter((entry) => entry.type === "blob" && SOURCE_FILE_EXTENSIONS.some((ext) => entry.path.endsWith(ext)))
    .slice(0, maxPaths)
    .map((entry) => entry.path);
}

/** Removes a previously-registered webhook. Safe to call even if it's already gone. */
export async function deleteRepoWebhook(accessToken: string, fullName: string, webhookId: string): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/hooks/${webhookId}`, {
    method: "DELETE",
    headers: headers(accessToken),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub API error deleting webhook: ${res.status} ${await res.text()}`);
  }
}
