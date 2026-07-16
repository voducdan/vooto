// GitHub contents + git data API client for committing two JSON state files
// atomically. Retries on non-fast-forward (concurrent clicks).

interface GhCtx {
  token: string;
  repo: string;   // "owner/name"
  branch: string;
}

const GH = "https://api.github.com";

function ghHeaders(ctx: GhCtx): HeadersInit {
  return {
    "authorization": `Bearer ${ctx.token}`,
    "user-agent": "vocab-webhook",
    "accept": "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
}

async function ghJson<T>(ctx: GhCtx, url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...ghHeaders(ctx), ...(init?.headers ?? {}) } });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub ${init?.method ?? "GET"} ${url} → ${r.status}: ${text}`);
  }
  return (await r.json()) as T;
}

export interface RepoState {
  reviews: Record<string, unknown>;
  pending: Record<string, string>;
  baseCommitSha: string;
}

interface RefObj { object: { sha: string } }
interface CommitObj { tree: { sha: string } }
interface ContentObj { content: string }

async function readJsonAt(ctx: GhCtx, path: string, ref: string): Promise<Record<string, unknown>> {
  const url = `${GH}/repos/${ctx.repo}/contents/${path}?ref=${ref}`;
  const data = await ghJson<ContentObj>(ctx, url);
  // content is base64 with newlines; atob handles standard base64
  const raw = atob(data.content.replace(/\n/g, ""));
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function loadState(token: string, repo: string, branch: string): Promise<RepoState> {
  const ctx = { token, repo, branch };
  const ref = await ghJson<RefObj>(ctx, `${GH}/repos/${repo}/git/refs/heads/${branch}`);
  const baseCommitSha = ref.object.sha;
  const [reviews, pending] = await Promise.all([
    readJsonAt(ctx, "state/reviews.json", baseCommitSha),
    readJsonAt(ctx, "state/pending.json", baseCommitSha),
  ]);
  return { reviews, pending: pending as Record<string, string>, baseCommitSha };
}

// Stable JSON.stringify with sorted keys, 2-space indent, trailing newline.
// Matches bot/run.py's _save_json output so diffs stay minimal.
export function stableJson(obj: Record<string, unknown>): string {
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(sortKeys(obj), null, 2) + "\n";
}

interface TreeObj { sha: string }
interface CreateCommitResp { sha: string }

async function commitOnce(
  ctx: GhCtx,
  baseCommitSha: string,
  reviews: Record<string, unknown>,
  pending: Record<string, string>,
  message: string,
): Promise<void> {
  const baseCommit = await ghJson<CommitObj>(ctx, `${GH}/repos/${ctx.repo}/git/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  const tree = await ghJson<TreeObj>(ctx, `${GH}/repos/${ctx.repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [
        { path: "state/reviews.json", mode: "100644", type: "blob", content: stableJson(reviews) },
        { path: "state/pending.json", mode: "100644", type: "blob", content: stableJson(pending) },
      ],
    }),
  });

  const commit = await ghJson<CreateCommitResp>(ctx, `${GH}/repos/${ctx.repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
  });

  // Update ref (fast-forward only). If 422, ref moved → caller retries.
  const r = await fetch(`${GH}/repos/${ctx.repo}/git/refs/heads/${ctx.branch}`, {
    method: "PATCH",
    headers: ghHeaders(ctx),
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`ref update ${r.status}: ${text}`);
  }
}

// Read a text file at a ref, returning null if it doesn't exist (404).
async function readTextMaybe(ctx: GhCtx, path: string, ref: string): Promise<string | null> {
  const url = `${GH}/repos/${ctx.repo}/contents/${encodeURI(path)}?ref=${ref}`;
  const r = await fetch(url, { headers: ghHeaders(ctx) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${url} → ${r.status}: ${await r.text()}`);
  const data = (await r.json()) as ContentObj;
  return atob(data.content.replace(/\n/g, ""));
}

// Read a single repo file at branch HEAD, or null if it doesn't exist.
export async function readRepoFile(
  token: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string | null> {
  const ctx = { token, repo, branch };
  const ref = await ghJson<RefObj>(ctx, `${GH}/repos/${repo}/git/refs/heads/${branch}`);
  return readTextMaybe(ctx, path, ref.object.sha);
}

async function commitFilesOnce(
  ctx: GhCtx,
  baseCommitSha: string,
  files: Record<string, string>,
  message: string,
): Promise<void> {
  const baseCommit = await ghJson<CommitObj>(ctx, `${GH}/repos/${ctx.repo}/git/commits/${baseCommitSha}`);
  const tree = await ghJson<TreeObj>(ctx, `${GH}/repos/${ctx.repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({
        path,
        mode: "100644",
        type: "blob",
        content,
      })),
    }),
  });
  const commit = await ghJson<CreateCommitResp>(ctx, `${GH}/repos/${ctx.repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
  });
  const r = await fetch(`${GH}/repos/${ctx.repo}/git/refs/heads/${ctx.branch}`, {
    method: "PATCH",
    headers: ghHeaders(ctx),
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!r.ok) throw new Error(`ref update ${r.status}: ${await r.text()}`);
}

// Read the given paths (missing → null), pass them to `mutate`, and commit the
// returned files atomically. `mutate` returns null to abort with no commit.
// Retries on non-fast-forward like commitMutation.
export type FilesMutator = (
  files: Record<string, string | null>,
) => Record<string, string> | null;

export async function commitFiles(
  token: string,
  repo: string,
  branch: string,
  paths: string[],
  message: string,
  mutate: FilesMutator,
  attempts = 4,
): Promise<boolean> {
  const ctx = { token, repo, branch };
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ref = await ghJson<RefObj>(ctx, `${GH}/repos/${repo}/git/refs/heads/${branch}`);
      const baseCommitSha = ref.object.sha;
      const current: Record<string, string | null> = {};
      await Promise.all(
        paths.map(async (p) => { current[p] = await readTextMaybe(ctx, p, baseCommitSha); }),
      );
      const next = mutate(current);
      if (next === null) return false;
      await commitFilesOnce(ctx, baseCommitSha, next, message);
      return true;
    } catch (e) {
      lastErr = e;
      const msg = String(e);
      if (msg.includes("422") || msg.includes("409")) {
        await new Promise((r) => setTimeout(r, 150 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("commitFiles: out of retries");
}

export type Mutator = (s: RepoState) => { reviews: Record<string, unknown>; pending: Record<string, string> };

// Apply `mutate` to current state and commit. Retries up to `attempts` times if
// the ref has advanced between read and write (another click landed concurrently).
export async function commitMutation(
  token: string,
  repo: string,
  branch: string,
  message: string,
  mutate: Mutator,
  attempts = 4,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const state = await loadState(token, repo, branch);
      const next = mutate(state);
      await commitOnce({ token, repo, branch }, state.baseCommitSha, next.reviews, next.pending, message);
      return;
    } catch (e) {
      lastErr = e;
      const msg = String(e);
      // Non-fast-forward / SHA mismatch → re-read and retry.
      if (msg.includes("422") || msg.includes("409")) {
        await new Promise((r) => setTimeout(r, 150 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("commitMutation: out of retries");
}
