// Invoked by .github/workflows/handle-review.yml whenever a review PR closes
// (merged or rejected). Reconciles config/topics-queue.json's "pending" entry for that
// PR, and — if merged — publishes the draft to dev.to and stages the drafts/ -> published/
// move. This script only edits the working tree / topics-queue.json; the workflow YAML
// handles git add/commit/push and the PR comment, using this script's stdout (JSON) to
// decide what to do next.
//
// Required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER, PR_MERGED
// ("true"/"false"), HEAD_REF (the PR's branch name, e.g. "draft/2026-07-26-c4-pitfalls").
// Optional: DEVTO_LIVE ("true" to publish live, default false = dev.to draft only).

import fs from 'fs';
import path from 'path';
import { publishToDevto } from './devto-publish';

interface PendingEntry {
  review_id: string;
  title?: string;
  pillar?: string;
  [key: string]: unknown;
}

interface UsedEntry extends PendingEntry {
  url: string;
  published_date: string;
}

interface RejectedEntry extends PendingEntry {
  feedback: string | null;
  closed_date: string;
}

interface TopicsQueue {
  _readme?: string;
  queue: Record<string, string[]>;
  pending: PendingEntry[];
  used: UsedEntry[];
  rejected: RejectedEntry[];
}

const QUEUE_PATH = path.join(__dirname, '..', 'config', 'topics-queue.json');

async function githubApi<T>(url: string): Promise<T> {
  const res = await fetch(`https://api.github.com${url}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${url}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function main(): Promise<void> {
  const merged = process.env.PR_MERGED === 'true';
  const headRef = process.env.HEAD_REF || '';
  const reviewId = headRef.replace(/^draft\//, '');
  const live = process.env.DEVTO_LIVE === 'true';

  if (!reviewId) {
    throw new Error(`Could not derive review_id from HEAD_REF="${headRef}"`);
  }

  const queue: TopicsQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  queue.pending = queue.pending || [];
  queue.used = queue.used || [];
  queue.rejected = queue.rejected || [];

  const idx = queue.pending.findIndex((p) => p.review_id === reviewId);
  const pendingEntry: PendingEntry = idx >= 0 ? queue.pending[idx] : { review_id: reviewId };
  if (idx >= 0) queue.pending.splice(idx, 1);

  const result: { reviewId: string; merged: boolean; url?: string; feedback?: string } = {
    reviewId,
    merged,
  };

  if (merged) {
    const draftPath = path.join(__dirname, '..', 'drafts', `${reviewId}.md`);
    if (!fs.existsSync(draftPath)) {
      throw new Error(`Merged PR but drafts/${reviewId}.md not found in working tree.`);
    }

    const { url } = await publishToDevto(draftPath, { live });

    const publishedDir = path.join(__dirname, '..', 'published');
    fs.mkdirSync(publishedDir, { recursive: true });
    const publishedPath = path.join(publishedDir, `${reviewId}.md`);
    const publishedDate = new Date().toISOString().slice(0, 10);
    let raw = fs.readFileSync(draftPath, 'utf8');
    raw = raw.replace(
      /^---\n/,
      `---\ndevto_url: "${url}"\npublished_date: "${publishedDate}"\n`
    );
    fs.writeFileSync(publishedPath, raw);
    fs.unlinkSync(draftPath);

    queue.used.push({ ...pendingEntry, review_id: reviewId, url, published_date: publishedDate });
    result.url = url;
  } else {
    const prNumber = process.env.PR_NUMBER;
    const repo = process.env.GITHUB_REPOSITORY;
    let feedback = '';
    try {
      const comments = await githubApi<Array<{ body: string }>>(
        `/repos/${repo}/issues/${prNumber}/comments`
      );
      feedback = comments.map((c) => c.body).join('\n---\n');
    } catch (err) {
      feedback = `(could not fetch PR comments: ${(err as Error).message})`;
    }

    queue.rejected.push({
      ...pendingEntry,
      review_id: reviewId,
      feedback: feedback || null,
      closed_date: new Date().toISOString().slice(0, 10),
    });
    result.feedback = feedback;
  }

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `merged=${merged}\n`);
    if (result.url) fs.appendFileSync(process.env.GITHUB_OUTPUT, `devto_url=${result.url}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
