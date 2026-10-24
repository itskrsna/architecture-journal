// Shared LinkedIn helpers: build a teaser from a draft, post it (with the dev.to link as an
// article card) to the owner's personal profile, and stamp the file so it's never posted twice.
//
// Env: LINKEDIN_ACCESS_TOKEN (3-legged OAuth token, scope w_member_social; ~60-day lifetime,
// regenerate with scripts/linkedin-auth.ts), LINKEDIN_AUTHOR_URN (urn:li:person:<id>).
// Optional: LINKEDIN_VERSION (YYYYMM API version header, default below).
//
// Posts are created with lifecycleState DRAFT, never PUBLISHED: nothing goes out on LinkedIn
// until the owner publishes it by hand. Set LINKEDIN_LIFECYCLE_STATE=PUBLISHED to override.

import fs from 'fs';
import matter from 'gray-matter';

const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202506';
const LIFECYCLE_STATE = process.env.LINKEDIN_LIFECYCLE_STATE || 'DRAFT';
const MAX_TEASER_CHARS = 450;

// LinkedIn's "little text" format treats these as markup; unescaped they truncate the post.
function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

function firstParagraph(body: string): string {
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('!['));
  return (para || '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

// A `linkedin:` front-matter field wins if the draft provides one; otherwise the hook is the
// article's opening paragraph, which is already written to stand alone.
export function buildCommentary(frontMatter: Record<string, unknown>, body: string): string {
  const custom = typeof frontMatter.linkedin === 'string' ? frontMatter.linkedin.trim() : '';
  const hook = custom || truncateAtSentence(firstParagraph(body), MAX_TEASER_CHARS);
  const tags = Array.isArray(frontMatter.tags) ? (frontMatter.tags as string[]) : [];
  const hashtags = tags
    .slice(0, 3)
    .map((t) => `#${String(t).replace(/[^A-Za-z0-9]/g, '')}`)
    .filter((t) => t.length > 1)
    .join(' ');
  return [escapeCommentary(hook), hashtags].filter(Boolean).join('\n\n');
}

export async function postToLinkedIn(opts: {
  commentary: string;
  url: string;
  title: string;
}): Promise<string> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = process.env.LINKEDIN_AUTHOR_URN;
  if (!token || !author) {
    throw new Error('LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN must be set.');
  }

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'Linkedin-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      author,
      commentary: opts.commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: { article: { source: opts.url, title: opts.title } },
      lifecycleState: LIFECYCLE_STATE,
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok) {
    const hint =
      res.status === 401
        ? ' (token expired or revoked — run scripts/linkedin-auth.ts and update LINKEDIN_ACCESS_TOKEN)'
        : '';
    throw new Error(`LinkedIn API error ${res.status}${hint}: ${await res.text()}`);
  }
  return res.headers.get('x-restli-id') || '(created)';
}

export function readArticle(filePath: string): {
  data: Record<string, unknown>;
  body: string;
  raw: string;
} {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  return { data, body: content, raw };
}

export function markPosted(raw: string, iso: string): string {
  return raw.replace(/^---\n/, `---\nlinkedin_posted: "${iso}"\n`);
}
