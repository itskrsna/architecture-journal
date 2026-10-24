// Drips already-published articles to LinkedIn as DRAFT posts, one per run, oldest first. Run on
// a schedule by .github/workflows/linkedin-backfill.yml (a couple of times a week).
//
// An article is eligible if its published/ file has no linkedin_posted stamp. The link in the
// draft is the article's current public dev.to URL if it has been made public (resolved from
// dev.to by title), else the stored devto_url — which, for an article published while
// DEVTO_LIVE=false, is a private "temp-slug" URL that changes once the article goes public, so
// check the link before publishing the LinkedIn draft.
//
// Env: DEVTO_API_KEY, LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN. Optional: DRY_RUN=true (print,
// don't post), COOLDOWN_HOURS (default 36: skip if anything was posted to LinkedIn that recently),
// BACKFILL_ALL=true (draft every unposted article in one run, ignoring the cooldown — safe
// because drafts publish nothing).

import fs from 'fs';
import path from 'path';
import { buildCommentary, markPosted, postToLinkedIn, readArticle } from './linkedin';

const PUBLISHED_DIR = path.join(__dirname, '..', 'published');
const dryRun = process.env.DRY_RUN === 'true';
const all = process.env.BACKFILL_ALL === 'true';
const cooldownMs = Number(process.env.COOLDOWN_HOURS || 36) * 3600 * 1000;

async function livePublishedUrls(): Promise<Map<string, string>> {
  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) throw new Error('DEVTO_API_KEY environment variable is not set.');
  const res = await fetch('https://dev.to/api/articles/me/published?per_page=1000', {
    headers: { 'api-key': apiKey },
  });
  if (!res.ok) throw new Error(`dev.to API error (${res.status}): ${await res.text()}`);
  const items = (await res.json()) as Array<{ title: string; url: string }>;
  return new Map(items.map((a) => [a.title.trim(), a.url]));
}

async function main(): Promise<void> {
  const files = fs
    .readdirSync(PUBLISHED_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const articles = files.map((f) => {
    const filePath = path.join(PUBLISHED_DIR, f);
    return { file: f, filePath, ...readArticle(filePath) };
  });

  const lastPosted = Math.max(
    0,
    ...articles.map((a) => Date.parse(String(a.data.linkedin_posted || '')) || 0)
  );
  if (!all && Date.now() - lastPosted < cooldownMs) {
    console.log('Posted to LinkedIn recently; skipping this run.');
    return;
  }

  const live = await livePublishedUrls();
  const pending = articles.filter((a) => !a.data.linkedin_posted);
  const batch = all ? pending : pending.slice(0, 1);
  if (batch.length === 0) {
    console.log('Nothing eligible: every article already has a LinkedIn draft.');
    return;
  }

  for (const next of batch) {
    const title = String(next.data.title);
    const url = live.get(title.trim()) || String(next.data.devto_url || '');
    if (!url) throw new Error(`${next.file} has no devto_url and is not public on dev.to.`);
    const commentary = buildCommentary(next.data, next.body);
    console.log(`Candidate: ${next.file}
${url}
---
${commentary}
---`);

    if (dryRun) continue;

    const id = await postToLinkedIn({ commentary, url, title });
    // Stamp right away so a failure on a later article doesn't cause duplicates on re-run.
    fs.writeFileSync(next.filePath, markPosted(next.raw, new Date().toISOString()));
    console.log(`Created LinkedIn draft for ${next.file} → ${id}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (dryRun) console.log('DRY_RUN: nothing posted.');
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
