# Entry app (Cloudflare Worker)

A phone-friendly form that commits an entry to `config/experience-log.md` on `main`, which
starts the pipeline. One Worker serves the page and the API. The GitHub token lives only as
a Cloudflare secret; the browser holds just a passphrase.

## One-time setup

1. Create a fine-grained GitHub token: Settings > Developer settings > Fine-grained tokens,
   repository access = only `architecture-journal`, permission **Contents: Read and write**.
2. `cd app && npx wrangler login`
3. `npx wrangler secret put GITHUB_TOKEN` (paste the token)
4. `npx wrangler secret put PASSPHRASE` (choose a long passphrase)
5. `npx wrangler deploy`, open the printed `*.workers.dev` URL, enter the passphrase once on
   each device, then Add to Home Screen.

Covered by Cloudflare's free tier. To change either secret, run the matching
`wrangler secret put` again.

## If `wrangler login` fails with `spawn EPERM`

The tool could not launch a browser. Either run `npx wrangler login --browser=false` and open
the printed URL by hand, or skip login: create an API token from the "Edit Cloudflare Workers"
template, set `CLOUDFLARE_API_TOKEN` in the shell, and run the same `wrangler` commands. If the
command line is blocked entirely, create the Worker in the Cloudflare dashboard, paste
`src/worker.mjs` into its code editor, and add `GITHUB_REPO`, `GITHUB_BRANCH` (plain variables)
and `GITHUB_TOKEN`, `PASSPHRASE` (secrets) under Settings > Variables and Secrets.
