/**
 * The ONLY place in Breakwater that writes to a user's GitHub repository.
 * Every function here is called from exactly one path: a user clicking
 * "Open fix PR" on one specific finding (see src/app/actions.ts ->
 * openFixPR). Nothing here runs automatically on a scan — scans only ever
 * read. Keep it that way; the product's whole trust story depends on it.
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

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`GitHub API error (${what}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** SHA of the tip commit on a branch. */
async function getBranchHeadSha(token: string, fullName: string, branch: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: headers(token),
  });
  const data = await json<{ object: { sha: string } }>(res, "get branch ref");
  return data.object.sha;
}

/** Creates a new branch pointing at `fromSha`. Returns the branch name actually used
 *  (adds a numeric suffix if the preferred name already exists, rather than failing). */
async function createBranch(
  token: string,
  fullName: string,
  preferredName: string,
  fromSha: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const name = attempt === 0 ? preferredName : `${preferredName}-${attempt}`;
    const res = await fetch(`${GITHUB_API}/repos/${fullName}/git/refs`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }),
    });
    if (res.ok) return name;
    if (res.status !== 422) {
      throw new Error(`GitHub API error (create branch): ${res.status} ${await res.text()}`);
    }
    // 422 almost always means the ref already exists — try the next suffix.
  }
  throw new Error("Couldn't find an available branch name after 5 attempts.");
}

/** Current sha + decoded content of a file on a given branch (needed to update it). */
async function getFile(
  token: string,
  fullName: string,
  path: string,
  branch: string
): Promise<{ sha: string; content: string }> {
  const res = await fetch(
    `${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
    { headers: headers(token) }
  );
  const data = await json<{ sha: string; content: string; encoding: string }>(res, "get file");
  if (data.encoding !== "base64") throw new Error(`Unexpected encoding for ${path}: ${data.encoding}`);
  return { sha: data.sha, content: Buffer.from(data.content, "base64").toString("utf8") };
}

async function updateFile(
  token: string,
  fullName: string,
  path: string,
  newContent: string,
  message: string,
  branch: string,
  sha: string
): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(newContent, "utf8").toString("base64"),
      sha,
      branch,
    }),
  });
  await json(res, "update file");
}

async function openPullRequest(
  token: string,
  fullName: string,
  opts: { title: string; body: string; head: string; base: string }
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/pulls`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await json<{ html_url: string }>(res, "open pull request");
  return data.html_url;
}

/**
 * End-to-end: branch off the repo's default branch, write the corrected
 * file content, and open a PR. Returns the PR URL. Throws on any failure —
 * the caller is responsible for recording that as the finding's error state.
 */
export async function openFixPullRequest(params: {
  token: string;
  fullName: string;
  defaultBranch: string;
  filePath: string;
  newContent: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}): Promise<string> {
  const baseSha = await getBranchHeadSha(params.token, params.fullName, params.defaultBranch);
  const branch = await createBranch(params.token, params.fullName, params.branchName, baseSha);
  const current = await getFile(params.token, params.fullName, params.filePath, branch);
  await updateFile(
    params.token,
    params.fullName,
    params.filePath,
    params.newContent,
    params.commitMessage,
    branch,
    current.sha
  );
  return openPullRequest(params.token, params.fullName, {
    title: params.prTitle,
    body: params.prBody,
    head: branch,
    base: params.defaultBranch,
  });
}
