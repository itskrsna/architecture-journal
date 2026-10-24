// One-time (and every ~60 days) helper: runs LinkedIn's 3-legged OAuth flow on localhost and
// prints the access token + your author URN to paste into the repo secrets.
//
// Prereqs: a LinkedIn developer app with the "Share on LinkedIn" and "Sign In with LinkedIn
// using OpenID Connect" products, and http://localhost:3000/callback listed under the app's
// Authorized redirect URLs.
//
// Credentials come from scripts/.env.social (gitignored) or the environment. The token is written
// to scripts/.linkedin-token (gitignored) rather than printed, so it never lands in a log.
//
// Usage: npx tsx scripts/linkedin-auth.ts

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env.social') });

const clientId = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = 'http://localhost:3000/callback';

if (!clientId || !clientSecret) {
  console.error('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET first.');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl =
  'https://www.linkedin.com/oauth/v2/authorization?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile w_member_social',
  });

async function exchange(code: string): Promise<void> {
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(token)}`);
  }

  const infoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const info = (await infoRes.json()) as { sub?: string };
  if (!infoRes.ok || !info.sub) {
    throw new Error(`userinfo failed: ${JSON.stringify(info)}`);
  }

  const days = Math.round((token.expires_in || 0) / 86400);
  const tokenFile = path.join(__dirname, '.linkedin-token');
  fs.writeFileSync(
    tokenFile,
    `LINKEDIN_ACCESS_TOKEN=${token.access_token}\nLINKEDIN_AUTHOR_URN=urn:li:person:${info.sub}\n`
  );
  console.log(`\nSaved token + URN to ${tokenFile}`);
  console.log('Add both values from that file as GitHub repo secrets, then delete the file.');
  console.log(`\nToken lifetime: ~${days} days. Re-run this before it expires.`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:3000');
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('state') !== state) {
    res.writeHead(400).end('Missing code or state mismatch.');
    return;
  }
  res.end('Done — you can close this tab and return to the terminal.');
  exchange(code)
    .catch((err: Error) => console.error(err.message))
    .finally(() => server.close());
});

server.listen(3000, () => {
  console.log('Open this URL in your browser and approve access:\n');
  console.log(authUrl);
});
