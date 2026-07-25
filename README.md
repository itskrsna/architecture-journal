# Architecture Journal — Automated Article Pipeline

Drafts one tech article a day, grounded in your real experience, opens a GitHub PR for your
review, and publishes whatever you approve to dev.to. Nothing goes live without you merging
the PR yourself.

## Your daily job

1. **Add a dated bullet to `config/experience-log.md`** under `## Unused`, starting with
   today's date (`2026-07-26: ...`). This is required — **no entry dated today means no
   article gets drafted that day, on purpose.** Jot down anything real: a decision, an
   incident, a number that surprised you, a debate you had. Don't polish it.
2. **Each day at 6:00 AM IST**, a Claude Code cloud routine reads that entry, drafts an
   article grounded in it, and opens a PR on GitHub.
3. **Review the PR** — from GitHub's web UI, mobile app, or email notification, from
   anywhere:
   - **Merge it** → publishes to dev.to automatically within a minute or two.
   - **Close it without merging** → rejects it. Leave a comment explaining why if you want
     future drafts to avoid the same miss — it gets logged automatically.
4. Check dev.to for the result (or the PR comment, which includes the live URL).

## Where things live

- Repo: https://github.com/itskrsna/architecture-journal
- Daily routine: https://claude.ai/code/routines/trig_01JS86HJCYYUFuB7T9UEvqGP
  (cron `30 0 * * *` UTC = 6:00 AM IST — change the schedule there)
- dev.to account: **webruster**

## Key files

| File | Purpose |
|---|---|
| `config/profile.md` | Voice/style rules, tech pillars, banned-phrase list, anti-AI-detector rules, dev.to tag defaults, draft file format |
| `config/experience-log.md` | **Your daily input.** Add real notes here — this is what keeps articles from reading as generic AI output |
| `config/topics-queue.json` | Rotating topic backlog per pillar + used/rejected history — auto-managed, edit directly if you want to steer it |
| `scripts/devto-publish.ts` | Publishes an approved draft to dev.to |
| `scripts/handle-pr-close.ts` | Reconciles `topics-queue.json` when a PR merges or closes |
| `.github/workflows/handle-review.yml` | Fires on PR close; runs the publish/reject reconciliation |

## Going fully live

Merges currently publish to dev.to as **private drafts** (`DEVTO_LIVE=false`), so you can
sanity-check quality before anything is public. Once you trust it:
repo → **Settings → Secrets and variables → Actions → Variables** → set `DEVTO_LIVE` to
`true`.

## Common tasks

- **Change the draft time**: edit the cron on the routine's page (link above).
- **Add/steer topics**: edit `config/topics-queue.json`'s `queue` arrays directly, or just
  let the routine auto-replenish when a pillar runs low.
- **Pause everything**: disable the routine at the link above (routines can only be disabled
  or updated via the web UI, not deleted via API).
- **Rotate the GitHub token**: the routine authenticates via a fine-grained PAT (scoped to
  only this repo) embedded in its own stored prompt — see `CLAUDE.md` for why. To rotate it,
  generate a new one (GitHub → Settings → Developer settings → Personal access tokens →
  Fine-grained tokens) and ask Claude to update the routine with it.

## Troubleshooting

- **No PR showed up**: check `config/experience-log.md` has a bullet dated *today* — if not,
  that's why (the hard gate). Also check the routine actually ran, on its claude.ai page.
- **Merged but nothing published**: check the repo's **Actions** tab for the "Handle article
  review decision" workflow run and its logs.
- **dev.to link 404s**: you're logged into the wrong dev.to account in your browser (should
  be **webruster**), or `DEVTO_LIVE` is still `false` so it's a private draft only you can see.
