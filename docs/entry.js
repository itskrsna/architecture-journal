// Logic for the experience-log page: read config/experience-log.md through the GitHub Contents
// API, insert a dated bullet under "## Unused", and commit it to main. A commit made with a
// user token fires the push-triggered workflow, so saving here starts the drafting flow.
// Dates are UTC because the drafting gate checks `date -u`.

export const REPO = 'itskrsna/architecture-journal';
export const BRANCH = 'main';
const FILE = 'config/experience-log.md';

export function insertEntry(src, text, date = new Date().toISOString().slice(0, 10)) {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) throw new Error('Entry is empty');
  const bullet = `- ${date}: ${clean.split('\n').map((l) => l.trimEnd()).join('\n  ')}`;
  const md = src.replace(/\r\n/g, '\n');
  const unusedIdx = md.indexOf('\n## Unused');
  const refIdx = md.indexOf('\n## Referenced');
  if (unusedIdx === -1 || refIdx === -1 || refIdx < unusedIdx) {
    throw new Error('experience-log.md must contain "## Unused" then "## Referenced"');
  }
  const before = md.slice(0, refIdx).replace(/\s+$/, '');
  return { content: `${before}\n\n${bullet}\n${md.slice(refIdx)}`, bullet };
}

const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const toB64 = (s) => {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
};

export async function saveEntry(token, text) {
  const api = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' };
  // One retry: the bot also commits to main, so the file's sha can go stale between GET and PUT.
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await fetch(`${api}?ref=${BRANCH}`, { headers, cache: 'no-store' });
    if (cur.status === 401 || cur.status === 403) throw new Error('Token rejected or lacks Contents write access');
    if (!cur.ok) throw new Error(`GitHub read failed (${cur.status})`);
    const file = await cur.json();
    const { content, bullet } = insertEntry(fromB64(file.content), text);
    const put = await fetch(api, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Experience log: ${bullet.slice(2, 62).replace(/\n/g, ' ')}`,
        content: toB64(content),
        sha: file.sha,
        branch: BRANCH,
      }),
    });
    if (put.ok) return (await put.json()).commit.sha.slice(0, 7);
    if (put.status !== 409 && put.status !== 422) throw new Error(`GitHub write failed (${put.status})`);
  }
  throw new Error('Conflict while saving, try again');
}
