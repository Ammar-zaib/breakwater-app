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
  path: string
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(path)}`,
    { headers: headers(accessToken) }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== "base64") return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}
