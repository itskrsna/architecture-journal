# Architecture Journal — Automated Article Pipeline 

Drafts one tech article a day, grounded in your real experience, opens a GitHub PR for your
review, and publishes whatever you approve to dev.to. Nothing goes live without you merging
the PR yourself.

## Your daily job

1. **Log today's entry** — no file editing needed: run `npm run log`, open
   http://localhost:4173, type, **Save & push** (inserts the dated bullet, commits, pushes).
   From phone/web instead: Actions tab → "Log experience entry" → Run workflow. Or, manually,
   **add a dated bullet to `config/experience-log.md`** under `## Unused`, starting with
   today's date (`2026-07-26: ...`). This is required — **no entry dated today means no
   article gets drafted that day, on purpose.** Jot down anything real: a decision, an
   incident, a number that surprised you, a debate you had. Don't polish it. Feel free to log
   more than one thing a day, or nothing on days you skip — extras just wait until they're
   the best fit for a future topic. **You never need to delete old entries**; once one gets
   used it's moved to `## Referenced` automatically.
2. **As soon as you push that entry**, a GitHub Action picks it up, drafts an article
   grounded in it (running Claude Code itself, under your Claude subscription — not a
   metered API key), and opens a PR on GitHub.
3. **Review the PR** — from GitHub's web UI, mobile app, or email notification, from
   anywhere:
   - **Merge it** → publishes to dev.to automatically within a minute or two.
   - **Close it without merging** → rejects it. Leave a comment explaining why if you want
     future drafts to avoid the same miss — it gets logged automatically.
4. Check dev.to for the result (or the PR comment, which includes the live URL).

## Where things live

- Repo: https://github.com/itskrsna/architecture-journal
- Daily drafting: `.github/workflows/draft-article.yml` (fires on push to
  `config/experience-log.md` — edit the file to change the trigger)
- dev.to account: **webruster**

## Key files

| File | Purpose |
|---|---|
| `config/profile.md` | Voice/style rules, tech pillars, banned-phrase list, anti-AI-detector rules, dev.to tag defaults, draft file format |
| `config/experience-log.md` | **Your daily input.** Add real notes here — this is what keeps articles from reading as generic AI output |
| `config/topics-queue.json` | Rotating topic backlog per pillar + used/rejected history — auto-managed, edit directly if you want to steer it |
| `scripts/devto-publish.ts` | Publishes an approved draft to dev.to |
| `scripts/handle-pr-close.ts` | Reconciles `topics-queue.json` when a PR merges or closes |
| `.github/workflows/draft-article.yml` | Fires on push to the experience log; runs Claude Code (via `claude-code-action`) to draft and open the review PR |
| `.github/workflows/handle-review.yml` | Fires on PR close; runs the publish/reject reconciliation |

## Going fully live

Merges currently publish to dev.to as **private drafts** (`DEVTO_LIVE=false`), so you can
sanity-check quality before anything is public. Once you trust it:
repo → **Settings → Secrets and variables → Actions → Variables** → set `DEVTO_LIVE` to
`true`.

## Common tasks

- **Add/steer topics**: edit `config/topics-queue.json`'s `queue` arrays directly, or just
  let the workflow auto-replenish when a pillar runs low.
- **Pause everything**: disable the `draft-article.yml` workflow from the repo's **Actions**
  tab (`workflow_dispatch` still lets you run it manually while paused).
- **Rotate the Claude Code OAuth token**: run `claude setup-token` again locally, then repo →
  **Settings → Secrets and variables → Actions → Secrets** → update
  `CLAUDE_CODE_OAUTH_TOKEN`. This draws from your Claude subscription's usage, not a metered
  API key — see `CLAUDE.md` for the full authentication story.

## Troubleshooting

- **No PR showed up**: check `config/experience-log.md` has a bullet dated *today* — if not,
  that's why (the hard gate). Also check the repo's **Actions** tab for the "Draft daily
  article" workflow run and its logs.
- **Merged but nothing published**: check the repo's **Actions** tab for the "Handle article
  review decision" workflow run and its logs.
- **dev.to link 404s**: you're logged into the wrong dev.to account in your browser (should
  be **webruster**), or `DEVTO_LIVE` is still `false` so it's a private draft only you can see.
