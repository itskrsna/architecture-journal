// Cloudflare Worker: serves the entry form and commits entries to config/experience-log.md
// through the GitHub Contents API. A commit made with a user token fires the push-triggered
// workflow, so saving here starts the drafting flow.
// Secrets: GITHUB_TOKEN (fine-grained, this repo, Contents read/write) and PASSPHRASE.
// The token never reaches the browser; the browser only sends the passphrase.

const FILE = 'config/experience-log.md';

// Dates are UTC because the drafting gate checks `date -u`.
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

async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function save(env, text) {
  const api = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${FILE}`;
  const headers = {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'experience-log-worker',
  };
  // One retry: the bot also commits to main, so the file's sha can go stale between GET and PUT.
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await fetch(`${api}?ref=${env.GITHUB_BRANCH}`, { headers });
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
        branch: env.GITHUB_BRANCH,
      }),
    });
    if (put.ok) return (await put.json()).commit.sha.slice(0, 7);
    if (put.status !== 409 && put.status !== 422) throw new Error(`GitHub write failed (${put.status})`);
  }
  throw new Error('Conflict while saving, try again');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/api/save') {
      if (!(await safeEqual(req.headers.get('x-passphrase') || '', env.PASSPHRASE))) {
        return Response.json({ error: 'Wrong passphrase' }, { status: 401 });
      }
      try {
        const { text } = await req.json();
        return Response.json({ commit: await save(env, String(text ?? '')) });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    }
    if (url.pathname === '/manifest.json') {
      return Response.json({ name: 'Experience Log', short_name: 'Log', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#0b5fff' });
    }
    return new Response(PAGE, { headers: { 'content-type': 'text/html;charset=utf-8', 'x-robots-tag': 'noindex' } });
  },
};

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><link rel="manifest" href="/manifest.json"><title>Experience Log</title>
<style>
:root{color-scheme:light dark}
body{font:17px system-ui;margin:0 auto;padding:16px;max-width:640px}
textarea,input{width:100%;box-sizing:border-box;font:inherit;padding:10px;border-radius:8px;border:1px solid #888}
textarea{height:45vh;margin:8px 0}
button{font:inherit;width:100%;padding:14px;border:0;border-radius:8px;background:#0b5fff;color:#fff}
button:disabled{opacity:.5}#out{margin-top:12px;white-space:pre-wrap}
details{margin-top:16px;font-size:15px}
</style></head><body>
<h2>Today's experience</h2>
<textarea id="t" placeholder="What happened? A decision, incident, debate, surprising number..."></textarea>
<button id="b">Save</button><div id="out"></div>
<details id="d"><summary>Passphrase</summary>
<p>Saved only in this browser after your first successful save.</p>
<input id="p" type="password" autocomplete="current-password"></details>
<script>
const $=id=>document.getElementById(id);
try{$('p').value=localStorage.getItem('pp')||''}catch{}
if(!$('p').value)$('d').open=true;
$('b').onclick=async()=>{
  if(!$('p').value){$('d').open=true;$('out').textContent='Enter your passphrase first.';return}
  $('b').disabled=true;$('out').textContent='Saving...';
  try{
    const r=await fetch('/api/save',{method:'POST',headers:{'x-passphrase':$('p').value},body:JSON.stringify({text:$('t').value})});
    const j=await r.json();
    if(r.ok){try{localStorage.setItem('pp',$('p').value)}catch{}
      $('out').textContent='Saved (commit '+j.commit+'). Drafting starts shortly.';$('t').value=''}
    else $('out').textContent='Error: '+j.error;
  }catch(e){$('out').textContent='Error: '+e.message}
  $('b').disabled=false};
</script></body></html>`;
