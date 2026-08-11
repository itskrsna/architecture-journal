// Usage: npx tsx scripts/draft-article.ts
//
// The GitHub Actions replacement for the Claude Code cloud routine described in CLAUDE.md.
// Runs entirely inside a normal Actions job (see .github/workflows/draft-article.yml), calling
// the Anthropic API directly instead of going through Claude Code — so it needs no GitHub
// connector and pushes/opens its PR with the job's own GITHUB_TOKEN, not a routine-embedded PAT.
//
// Reads config/profile.md, config/topics-queue.json, and config/experience-log.md; enforces the
// same-day experience-log gate; picks a pillar deterministically (longest since last used) and
// asks the model to pick the best-fitting topic + grounding entry from that pillar's queue and
// the Unused log; drafts, self-reviews, and originality-checks the article over a small
// multi-turn conversation; then writes the draft file and config updates. Git add/commit/push
// and `gh pr create` are left to the workflow YAML, driven by this script's GITHUB_OUTPUT.
//
// Required env var: ANTHROPIC_API_KEY.

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.join(__dirname, '..');
const PROFILE_PATH = path.join(ROOT, 'config', 'profile.md');
const QUEUE_PATH = path.join(ROOT, 'config', 'topics-queue.json');
const LOG_PATH = path.join(ROOT, 'config', 'experience-log.md');
const DRAFTS_DIR = path.join(ROOT, 'drafts');
const PUBLISHED_DIR = path.join(ROOT, 'published');

const PILLARS = ['architecture', 'devops_cloud', 'azure', 'dotnet', 'node_python'] as const;
type Pillar = (typeof PILLARS)[number];

const PILLAR_TAGS: Record<Pillar, string[]> = {
  architecture: ['architecture', 'softwaredesign', 'systemdesign'],
  devops_cloud: ['devops', 'cloud', 'kubernetes'],
  azure: ['azure', 'cloud', 'architecture'],
  dotnet: ['dotnet', 'csharp', 'webdev'],
  node_python: ['node', 'python', 'backend'],
};

const MODEL = 'claude-opus-5';
const client = new Anthropic();

interface TopicsQueue {
  _readme?: string;
  queue: Record<string, string[]>;
  used: Array<{ review_id: string; title: string; pillar?: string; published_date?: string }>;
  rejected: Array<{ review_id: string; title: string; pillar?: string }>;
}

interface LogEntry {
  date: string;
  text: string;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/-+$/, '');
}

// ---- experience-log.md parsing ----
// Entries are lines starting "YYYY-MM-DD: ..." (possibly followed by more lines) inside the
// "## Unused" section, up to the next "## " heading. Parsing this in code (rather than asking
// the model to track which entries are already spoken for) is what prevents the "already-used
// grounding entry reused" failure mode a previous drafting run hit.
function parseSection(raw: string, heading: string): { body: string; start: number; end: number } {
  const headingRe = new RegExp(`^## ${heading}\\s*$`, 'm');
  const match = headingRe.exec(raw);
  if (!match) throw new Error(`Could not find "## ${heading}" section in experience-log.md`);
  const start = match.index + match[0].length;
  const nextHeading = /^## /m.exec(raw.slice(start));
  const end = nextHeading ? start + nextHeading.index! : raw.length;
  return { body: raw.slice(start, end), start, end };
}

function parseEntries(sectionBody: string): LogEntry[] {
  const dateLineRe = /^(\d{4}-\d{2}-\d{2}):/gm;
  const starts: Array<{ index: number; date: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = dateLineRe.exec(sectionBody)) !== null) {
    starts.push({ index: m.index, date: m[1] });
  }
  const entries: LogEntry[] = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i].index;
    const to = i + 1 < starts.length ? starts[i + 1].index : sectionBody.length;
    entries.push({ date: starts[i].date, text: sectionBody.slice(from, to).trim() });
  }
  return entries;
}

function gateCheck(unusedEntries: LogEntry[]): boolean {
  const today = todayUTC();
  return unusedEntries.some((e) => e.date === today);
}

// ---- pillar rotation ----
function pickPillar(queue: TopicsQueue): Pillar {
  const lastUsed: Record<string, string | null> = {};
  for (const p of PILLARS) lastUsed[p] = null;
  for (const entry of queue.used) {
    const p = entry.pillar;
    if (!p || !(PILLARS as readonly string[]).includes(p)) continue;
    const d = entry.published_date || '';
    if (!lastUsed[p] || d > (lastUsed[p] as string)) lastUsed[p] = d;
  }
  const sorted = [...PILLARS].sort((a, b) => {
    const da = lastUsed[a];
    const db = lastUsed[b];
    if (da === null && db === null) return PILLARS.indexOf(a) - PILLARS.indexOf(b);
    if (da === null) return -1;
    if (db === null) return 1;
    if (da !== db) return da < db ? -1 : 1;
    return PILLARS.indexOf(a) - PILLARS.indexOf(b);
  });
  return sorted[0] as Pillar;
}

// ---- Anthropic calls ----
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    topic: { type: 'string', description: 'Exact string copied from the candidate topics list' },
    grounding_entry_date: {
      type: 'string',
      description: 'The YYYY-MM-DD date prefix of the chosen experience-log entry',
    },
    rationale: { type: 'string' },
  },
  required: ['topic', 'grounding_entry_date', 'rationale'],
  additionalProperties: false,
} as const;

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string', description: 'Full Markdown article body, 800-1400 words' },
  },
  required: ['title', 'body'],
  additionalProperties: false,
} as const;

const REPLENISH_SCHEMA = {
  type: 'object',
  properties: {
    topics: { type: 'array', items: { type: 'string' } },
  },
  required: ['topics'],
  additionalProperties: false,
} as const;

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function checkStopReason(response: Anthropic.Message, label: string): void {
  if (response.stop_reason === 'refusal') {
    throw new Error(`Anthropic API refused the "${label}" request (stop_reason: refusal).`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`"${label}" hit max_tokens before finishing — raise max_tokens and retry.`);
  }
}

async function main(): Promise<void> {
  const profileMd = fs.readFileSync(PROFILE_PATH, 'utf8');
  const queue: TopicsQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  queue.used = queue.used || [];
  queue.rejected = queue.rejected || [];
  const logRaw = fs.readFileSync(LOG_PATH, 'utf8');

  const unusedSection = parseSection(logRaw, 'Unused');
  const unusedEntries = parseEntries(unusedSection.body).filter(
    (e) => !/^\*\(example/.test(e.text) // skip the placeholder example bullet
  );

  if (!gateCheck(unusedEntries)) {
    console.log(`Skipped — no experience-log.md entry dated ${todayUTC()} under Unused.`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `drafted=false\n`);
    }
    return;
  }

  const pillar = pickPillar(queue);
  const candidateTopics = queue.queue[pillar] || [];
  if (candidateTopics.length === 0) {
    throw new Error(`Pillar "${pillar}" has no topics left in the queue.`);
  }

  const allKnownTitles = [
    ...Object.values(queue.queue).flat(),
    ...queue.used.map((e) => e.title),
    ...queue.rejected.map((e) => e.title),
  ];

  const system = [
    {
      type: 'text' as const,
      text:
        'You are drafting one entry in a personal, practitioner-voice technical blog for a ' +
        "Cloud/Solutions Architect. Follow the author profile below exactly — its voice/style " +
        'rules, its anti-AI-detector rules, and its banned-phrase list are non-negotiable. Never ' +
        'reflexively hedge; take a clear side; every article needs at least one concrete, ' +
        'falsifiable claim (a number, a named pattern, a real trade-off).\n\n' +
        '--- AUTHOR PROFILE (config/profile.md) ---\n' +
        profileMd,
      cache_control: { type: 'ephemeral' as const },
    },
  ];

  const messages: Anthropic.MessageParam[] = [];

  // 1. Plan: pick the best topic in this pillar's queue + the best-fitting Unused grounding entry.
  messages.push({
    role: 'user',
    content:
      `Pillar for today: ${pillar}\n\n` +
      `Candidate topics (pick exactly one, verbatim):\n` +
      candidateTopics.map((t) => `- ${t}`).join('\n') +
      `\n\nCandidate grounding entries from experience-log.md's Unused section (pick exactly one, ` +
      `by date — prefer today's date on a close tie, but don't force a weaker fit just because ` +
      `it's newer):\n\n` +
      unusedEntries.map((e) => `[${e.date}]\n${e.text}`).join('\n\n---\n\n') +
      `\n\nAlso consider profile.md's "Concrete experience to draw on" section above for anything ` +
      `additionally relevant, but you must still pick one entry from the list above as the primary ` +
      `grounding (by date).`,
  });
  const planResp = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
    system,
    messages,
  });
  checkStopReason(planResp, 'plan');
  const plan = JSON.parse(textOf(planResp.content)) as {
    topic: string;
    grounding_entry_date: string;
    rationale: string;
  };
  messages.push({ role: 'assistant', content: planResp.content });

  const groundingEntry = unusedEntries.find((e) => e.date === plan.grounding_entry_date);
  if (!groundingEntry) {
    throw new Error(
      `Model picked grounding_entry_date "${plan.grounding_entry_date}" which doesn't match any Unused entry.`
    );
  }
  if (!candidateTopics.includes(plan.topic)) {
    throw new Error(`Model picked topic "${plan.topic}" which isn't in the ${pillar} queue.`);
  }
  console.log(`Pillar: ${pillar}`);
  console.log(`Topic: ${plan.topic}`);
  console.log(`Grounding entry: ${groundingEntry.date}`);
  console.log(`Rationale: ${plan.rationale}`);

  // 2. Draft.
  messages.push({
    role: 'user',
    content:
      `Now draft the article. Topic: "${plan.topic}". Ground it specifically in the ` +
      `${groundingEntry.date} experience-log entry you picked — build the article's core ` +
      `argument around the real texture it gives you, don't just mention it in passing. ` +
      `800-1400 words. Return title + body via the JSON schema.`,
  });
  const draftResp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
    system,
    messages,
  });
  checkStopReason(draftResp, 'draft');
  const draft = JSON.parse(textOf(draftResp.content)) as { title: string; body: string };
  messages.push({ role: 'assistant', content: draftResp.content });

  // 3. Banned-phrase self-review pass.
  messages.push({
    role: 'user',
    content:
      'Self-review pass: re-read your draft specifically hunting for anything on the ' +
      'banned-phrase list or generic AI-sounding filler. Rewrite those spots. Reply with ONLY ' +
      'the complete revised article body as plain Markdown — no JSON, no commentary, no code fences.',
  });
  const reviewResp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'high' },
    system,
    messages,
  });
  checkStopReason(reviewResp, 'banned-phrase review');
  let body = textOf(reviewResp.content).trim();
  messages.push({ role: 'assistant', content: reviewResp.content });

  // 4. AI-detector self-check pass (separate from the banned-phrase pass).
  messages.push({
    role: 'user',
    content:
      'This is a separate pass. Re-read the draft again, this time hunting specifically for ' +
      'detector-bait patterns: uniform sentence rhythm, generic paragraph transitions, ' +
      'mechanically clean structure, over-balanced arguments. Rewrite for burstiness and a ' +
      'distinct point of view wherever you find these. Reply with ONLY the complete revised ' +
      'article body as plain Markdown.',
  });
  const detectorResp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'high' },
    system,
    messages,
  });
  checkStopReason(detectorResp, 'AI-detector self-check');
  body = textOf(detectorResp.content).trim();
  messages.push({ role: 'assistant', content: detectorResp.content });

  // 5. Originality spot-check via the web_search server tool.
  messages.push({
    role: 'user',
    content:
      'Pick the 2-3 most distinctive sentences from the final draft above. For each, use ' +
      'web_search on the exact phrase to check it does not return a verbatim match elsewhere ' +
      'online. If one does, rewrite just that sentence to be original while preserving its ' +
      'meaning. Reply with ONLY the complete final article body as plain Markdown (after any ' +
      'rewrites) — no commentary about what you searched.',
  });
  let searchResp = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'high' },
    system,
    messages,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
  });
  // Server-tool turns can pause after 10 internal iterations; resume by re-sending as-is.
  let resumeGuard = 0;
  while (searchResp.stop_reason === 'pause_turn' && resumeGuard < 3) {
    messages.push({ role: 'assistant', content: searchResp.content });
    searchResp = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'high' },
      system,
      messages,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    });
    resumeGuard++;
  }
  checkStopReason(searchResp, 'originality spot-check');
  body = textOf(searchResp.content).trim();

  const wordCount = body.split(/\s+/).filter(Boolean).length;
  console.log(`Final word count: ${wordCount}`);
  if (wordCount < 700 || wordCount > 1500) {
    console.warn(`Word count ${wordCount} is outside the 800-1400 target range — filing anyway.`);
  }

  // ---- Replenish the pillar's queue if it's about to run low ----
  const remainingAfterPop = candidateTopics.filter((t) => t !== plan.topic);
  let newTopics: string[] = [];
  if (remainingAfterPop.length < 3) {
    const replenishResp = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REPLENISH_SCHEMA } },
      system: [system[0]],
      messages: [
        {
          role: 'user',
          content:
            `The "${pillar}" pillar's topic queue is about to drop below 3 items. Generate ` +
            `exactly 5 new candidate topics for this pillar, in the same spirit as its existing ` +
            `topics, that do not repeat (even loosely) any title in this list:\n\n` +
            allKnownTitles.map((t) => `- ${t}`).join('\n'),
        },
      ],
    });
    checkStopReason(replenishResp, 'replenish');
    const replenished = JSON.parse(textOf(replenishResp.content)) as { topics: string[] };
    newTopics = replenished.topics
      .filter((t) => !allKnownTitles.some((known) => known.toLowerCase() === t.toLowerCase()))
      .slice(0, 5);
    console.log(`Replenished ${pillar} queue with ${newTopics.length} new topics.`);
  }

  // ---- File it ----
  const today = todayUTC();
  const baseSlug = slugify(draft.title);
  let reviewId = `${today}-${baseSlug}`;
  const existingIds = new Set([
    ...queue.used.map((e) => e.review_id),
    ...queue.rejected.map((e) => e.review_id),
    ...(fs.existsSync(DRAFTS_DIR) ? fs.readdirSync(DRAFTS_DIR).map((f) => f.replace(/\.md$/, '')) : []),
    ...(fs.existsSync(PUBLISHED_DIR)
      ? fs.readdirSync(PUBLISHED_DIR).map((f) => f.replace(/\.md$/, ''))
      : []),
  ]);
  let suffix = 2;
  while (existingIds.has(reviewId)) {
    reviewId = `${today}-${baseSlug}-${suffix}`;
    suffix++;
  }

  const tags = PILLAR_TAGS[pillar];
  const frontMatter =
    `---\n` +
    `title: ${JSON.stringify(draft.title)}\n` +
    `pillar: ${pillar}\n` +
    `tags: [${tags.join(', ')}]\n` +
    `review_id: ${reviewId}\n` +
    `date: ${today}\n` +
    `---\n\n`;

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const draftPath = path.join(DRAFTS_DIR, `${reviewId}.md`);
  fs.writeFileSync(draftPath, frontMatter + body + '\n');

  // ---- Update topics-queue.json (pop the chosen topic + append any replenished ones) ----
  queue.queue[pillar] = remainingAfterPop.concat(newTopics);
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');

  // ---- Move the grounding entry from Unused to Referenced ----
  const entryStartInLog = unusedSection.start + unusedSection.body.indexOf(groundingEntry.text);
  const entryEndInLog = entryStartInLog + groundingEntry.text.length;
  const logWithoutEntry =
    logRaw.slice(0, entryStartInLog).replace(/\n+$/, '\n') + logRaw.slice(entryEndInLog);

  const referencedSection = parseSection(logWithoutEntry, 'Referenced');
  const before = logWithoutEntry.slice(0, referencedSection.end).replace(/\s+$/, '');
  const after = logWithoutEntry.slice(referencedSection.end);
  const newLog = `${before}\n\n${groundingEntry.text} — used in ${reviewId}\n${after}`;
  fs.writeFileSync(LOG_PATH, newLog);

  console.log(`Filed drafts/${reviewId}.md (${wordCount} words).`);

  if (process.env.GITHUB_OUTPUT) {
    const out = process.env.GITHUB_OUTPUT;
    fs.appendFileSync(out, `drafted=true\n`);
    fs.appendFileSync(out, `review_id=${reviewId}\n`);
    fs.appendFileSync(out, `title=${draft.title}\n`);
    fs.appendFileSync(out, `pillar=${pillar}\n`);
    fs.appendFileSync(out, `tags=${tags.join(', ')}\n`);
    fs.appendFileSync(out, `word_count=${wordCount}\n`);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
