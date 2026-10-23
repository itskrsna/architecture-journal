// Inserts a dated bullet at the end of config/experience-log.md's `## Unused` section.
// Shared by scripts/log-ui.ts (local form) and .github/workflows/log-entry.yml (web/phone form).
// Date is UTC on purpose: the drafting gate in draft-article.yml checks `date -u`.

import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(__dirname, '..', 'config', 'experience-log.md');

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addEntry(text: string, date: string = todayUtc()): string {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) throw new Error('Entry is empty');

  // Continuation lines are indented so the bullet stays one markdown item.
  const bullet = `- ${date}: ${clean.split('\n').map((l) => l.trimEnd()).join('\n  ')}`;

  const src = fs.readFileSync(LOG_PATH, 'utf8').replace(/\r\n/g, '\n');
  const unusedIdx = src.indexOf('\n## Unused');
  const refIdx = src.indexOf('\n## Referenced');
  if (unusedIdx === -1 || refIdx === -1 || refIdx < unusedIdx) {
    throw new Error('experience-log.md must contain "## Unused" followed by "## Referenced"');
  }

  const before = src.slice(0, refIdx).replace(/\s+$/, '');
  const after = src.slice(refIdx);
  fs.writeFileSync(LOG_PATH, `${before}\n\n${bullet}\n${after}`);
  return bullet;
}

if (require.main === module) {
  // Entry text comes from an env var (not argv) so workflow inputs can't inject shell syntax.
  const text = process.env.ENTRY_TEXT ?? '';
  console.log(addEntry(text));
}
