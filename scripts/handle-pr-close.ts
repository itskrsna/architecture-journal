// Invoked by .github/workflows/handle-review.yml whenever a review PR closes
// (merged or rejected). Reconciles config/topics-queue.json, and — if merged — publishes
// the draft to dev.to and stages the drafts/ -> published/ move. This script only edits
// the working tree / topics-queue.json; the workflow YAML handles git add/commit/push and
// the PR comment, using this script's stdout (JSON) to decide what to do next.
//
// Merged case: the draft file is already in the working tree (checkout of main post-merge),
// so title/pillar/tags come straight from its front-matter.
// Rejected case: the file never reached main (it only ever existed on the now-dead branch),
// so its content is fetched from the GitHub Contents API at the PR's head commit SHA, which
// stays reachable via the PR's own ref even after the branch is deleted.
//
// Required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER, PR_MERGED
// ("true"/"false"), HEAD_REF (branch name, e.g. "draft/2026-07-26-c4-pitfalls"), HEAD_SHA
// (the PR's head commit SHA). Optional: DEVTO_LIVE ("true" to publish live, default false).

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { publishToDevto } from './devto-publish';

interface TopicEntry {
  review_id: string;
  title: string;
  pillar?: string;
  [key: string]: unknown;
}

interface UsedEntry extends TopicEntry {
  url: string;
  published_date: string;
}

interface RejectedEntry extends TopicEntry {
  feedback: string | null;
  closed_date: string;
}

interface TopicsQueue {
  _readme?: string;
  queue: Record<string, string[]>;
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

function removeFromQueue(queue: TopicsQueue, title: string): void {
  for (const pillar of Object.keys(queue.queue)) {
    const i = queue.queue[pillar].indexOf(title);
    if (i >= 0) {
      queue.queue[pillar].splice(i, 1);
      return;
    }
  }
}

async function main(): Promise<void> {
  const merged = process.env.PR_MERGED === 'true';
  const headRef = process.env.HEAD_REF || '';
  const headSha = process.env.HEAD_SHA || '';
  const reviewId = headRef.replace(/^draft\//, '');
  const live = process.env.DEVTO_LIVE === 'true';
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;

  if (!reviewId) {
    throw new Error(`Could not derive review_id from HEAD_REF="${headRef}"`);
  }

  const queue: TopicsQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  queue.used = queue.used || [];
  queue.rejected = queue.rejected || [];

  const result: { reviewId: string; merged: boolean; url?: string; feedback?: string } = {
    reviewId,
    merged,
  };

  if (merged) {
    const draftPath = path.join(__dirname, '..', 'drafts', `${reviewId}.md`);
    if (!fs.existsSync(draftPath)) {
      throw new Error(`Merged PR but drafts/${reviewId}.md not found in working tree.`);
    }

    const { data } = matter(fs.readFileSync(draftPath, 'utf8'));
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

    queue.used.push({
      review_id: reviewId,
      title: data.title,
      pillar: data.pillar,
      url,
      published_date: publishedDate,
    });
    result.url = url;
  } else {
    if (!headSha) {
      throw new Error('HEAD_SHA is required to read a rejected draft\'s content.');
    }

    const draftRelPath = `drafts/${reviewId}.md`;
    const { content: base64Content } = await githubApi<{ content: string }>(
      `/repos/${repo}/contents/${draftRelPath}?ref=${headSha}`
    );
    const raw = Buffer.from(base64Content, 'base64').toString('utf8');
    const { data } = matter(raw);

    let feedback = '';
    try {
      const comments = await githubApi<Array<{ body: string }>>(
        `/repos/${repo}/issues/${prNumber}/comments`
      );
      feedback = comments.map((c) => c.body).join('\n---\n');
    } catch (err) {
      feedback = `(could not fetch PR comments: ${(err as Error).message})`;
    }

    if (data.title) removeFromQueue(queue, data.title);

    queue.rejected.push({
      review_id: reviewId,
      title: data.title,
      pillar: data.pillar,
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
