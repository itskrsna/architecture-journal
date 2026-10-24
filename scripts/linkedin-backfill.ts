// Adds a paste-ready LinkedIn teaser to social/linkedin-queue.md for every published article that
// has no entry in the queue yet, whether or not it also has a LinkedIn API draft (those aren't
// browsable in one place on LinkedIn, so the queue is the single list). Nothing is sent to
// LinkedIn: the owner copies each teaser into LinkedIn's composer and ticks the box.
//
// Existing queue entries are never rewritten (ticked boxes and hand edits survive); only new
// entries are appended. The link is the article's public dev.to URL if it has been made public
// (resolved from dev.to by title), else the stored devto_url, which for an article published
// while DEVTO_LIVE=false is a private "temp-slug" URL that changes once the article goes public —
// those entries are flagged.
//
// Env: DEVTO_API_KEY. Optional: DRY_RUN=true (print, don't write).

import fs from 'fs';
import path from 'path';
import { buildCommentary, readArticle } from './linkedin';

const PUBLISHED_DIR = path.join(__dirname, '..', 'published');
const QUEUE_PATH = path.join(__dirname, '..', 'social', 'linkedin-queue.md');
const dryRun = process.env.DRY_RUN === 'true';

const QUEUE_HEADER = `# LinkedIn queue

Paste each teaser into LinkedIn's post box (the link becomes the preview card), then tick the box.
Entries are appended by \`scripts/linkedin-backfill.ts\`; existing entries are never rewritten.

`;

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
  const existing = fs.existsSync(QUEUE_PATH) ? fs.readFileSync(QUEUE_PATH, 'utf8') : '';

  const pending = fs
    .readdirSync(PUBLISHED_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({ file: f, reviewId: f.replace(/\.md$/, ''), ...readArticle(path.join(PUBLISHED_DIR, f)) }))
    .filter((a) => !existing.includes(`<!-- review_id: ${a.reviewId} -->`));

  if (pending.length === 0) {
    console.log('Nothing to add: every article is already in the queue.');
    return;
  }

  const live = await livePublishedUrls();
  const entries = pending.map((a) => {
    const title = String(a.data.title);
    const publicUrl = live.get(title.trim());
    const url = publicUrl || String(a.data.devto_url || '');
    const note = publicUrl ? '' : '\n> ⚠ Not public on dev.to yet — this link is a private draft URL and will change when you publish it. Re-check before posting.\n';
    const teaser = buildCommentary(a.data, a.body, { escape: false });
    return `<!-- review_id: ${a.reviewId} -->\n## [ ] ${title}\n\n${url}\n${note}\n\`\`\`text\n${teaser}\n\`\`\`\n`;
  });

  console.log(`Adding ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}:`);
  pending.forEach((a) => console.log(`  ${a.file}`));
  if (dryRun) {
    console.log('DRY_RUN: queue file not written.');
    return;
  }

  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, (existing || QUEUE_HEADER) + '\n' + entries.join('\n'));
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
