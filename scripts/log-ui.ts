// Local form for the daily experience-log entry: `npm run log`, write, Save.
// Save = insert bullet, pull --rebase, commit, push. The push to main touching
// config/experience-log.md is what triggers trigger-draft-article.yml, so nothing else to do.

import http from 'http';
import { execFileSync } from 'child_process';
import { addEntry } from './add-entry';

const PORT = 4173;
const ROOT = require('path').join(__dirname, '..');

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const PAGE = `<!doctype html><meta charset="utf-8"><title>Experience log</title>
<style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:0 16px}
textarea{width:100%;height:240px;font:inherit;padding:8px;box-sizing:border-box}
button{font:inherit;padding:8px 20px;margin-top:8px;cursor:pointer}
#out{margin-top:16px;white-space:pre-wrap}</style>
<h2>Today's experience-log entry</h2>
<textarea id="t" autofocus placeholder="What happened today? Decision, incident, debate, surprising number..."></textarea><br>
<button id="b">Save &amp; push</button><div id="out"></div>
<script>
b.onclick=async()=>{b.disabled=true;out.textContent='Saving...';
const r=await fetch('/save',{method:'POST',body:t.value});
const j=await r.json();out.textContent=r.ok?'Committed '+j.commit+' and pushed. Drafting workflow will start shortly.':'Error: '+j.error;
if(r.ok)t.value='';b.disabled=false};
</script>`;

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/save') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          git('pull', '--rebase', '--autostash');
          const bullet = addEntry(body);
          git('add', 'config/experience-log.md');
          git('commit', '-m', `Experience log: ${bullet.slice(2, 62).replace(/\n/g, ' ')}`);
          git('push');
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ commit: git('rev-parse', '--short', 'HEAD') }));
        } catch (e) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: (e as Error).message }));
        }
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
  })
  // Loopback only: this endpoint commits and pushes.
  .listen(PORT, '127.0.0.1', () => console.log(`Open http://localhost:${PORT}`));
