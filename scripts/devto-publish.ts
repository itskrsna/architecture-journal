// Usage: npx tsx scripts/devto-publish.ts <path-to-draft.md> [--live]
//
// Reads YAML front-matter (title, tags, pillar, review_id) + body from the draft file,
// posts it to dev.to. Defaults to published:false (lands as a dev.to draft) unless --live
// is passed, so the pipeline can be dry-run safely before going fully live.
// Also exported as a function so handle-pr-close.ts can reuse it directly.

import fs from 'fs';
import matter from 'gray-matter';

interface DraftFrontMatter {
  title?: string;
  pillar?: string;
  tags?: string[];
  review_id?: string;
  date?: string;
}

export interface PublishResult {
  url: string;
  id: number;
}

export async function publishToDevto(
  filePath: string,
  { live = false }: { live?: boolean } = {}
): Promise<PublishResult> {
  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) {
    throw new Error('DEVTO_API_KEY environment variable is not set.');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content: body } = matter(raw);
  const frontMatter = data as DraftFrontMatter;

  if (!frontMatter.title) {
    throw new Error(`Draft ${filePath} is missing a "title" in its front-matter.`);
  }

  const tags = Array.isArray(frontMatter.tags) ? frontMatter.tags.slice(0, 4) : [];

  const article = {
    title: frontMatter.title,
    body_markdown: body.trim(),
    published: live,
    tags,
  };

  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({ article }),
  });

  const json = (await res.json()) as { url: string; id: number };

  if (!res.ok) {
    throw new Error(`dev.to API error (${res.status}): ${JSON.stringify(json)}`);
  }

  return { url: json.url, id: json.id };
}

if (require.main === module) {
  const filePath = process.argv[2];
  const live = process.argv.includes('--live');

  if (!filePath) {
    console.error('Usage: npx tsx scripts/devto-publish.ts <path-to-draft.md> [--live]');
    process.exit(1);
  }

  publishToDevto(filePath, { live })
    .then(({ url }) => {
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
      }
      console.log(url);
    })
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
}
