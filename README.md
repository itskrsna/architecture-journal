# Architecture Journal

An automated pipeline that turns one real experience note a day into a reviewed, published
tech article.

You log what happened at work. A GitHub Action drafts an article grounded in that note and
opens a pull request. You review it. Merging publishes it to [dev.to](https://dev.to);
closing the PR rejects it. Nothing goes live without you.

```text
 log an entry ──► commit to main ──► draft workflow ──► PR opened ──► you review
 (phone / web)    (experience-log)   (writes article)   (draft/<id>)        │
                                                                  merge ────┴──── close
                                                                    │               │
                                                              publish to dev.to   log rejection
                                                                                  (feeds future drafts)
```

## Contents

- [Daily workflow](#daily-workflow)
- [How it works](#how-it-works)
- [Repository layout](#repository-layout)
- [Setup](#setup)
- [Operating the pipeline](#operating-the-pipeline)
- [Troubleshooting](#troubleshooting)

## Daily workflow

1. **Log an entry.** Add a bullet to `config/experience-log.md` under `## Unused`, starting
   with today's date, `YYYY-MM-DD: ...` (UTC). Edit the file on github.com, in the GitHub
   mobile app, or locally and push. Make it real and unpolished: a decision, an incident, a
   surprising number, a debate with a teammate. Pushing to `main` starts the pipeline.
2. **Wait for the PR.** The commit triggers drafting. A few minutes later a pull request
   appears from the branch `draft/<date>-<slug>`, containing the article and its metadata
   (pillar, tags, word count).
3. **Review it.** Use the GitHub web UI, the mobile app or the email notification.
   - **Merge** to publish the article to dev.to within a minute or two.
   - **Close without merging** to reject it. Add a comment explaining why if you want future
     drafts to avoid the same miss. It is logged automatically.
4. **Check the result** on dev.to, or in the PR comment, which carries the URL.

### The one rule: no entry today, no article today

The drafting job first looks in `## Unused` for a bullet dated today. If there is none, it
stops: no topic is consumed, no PR is opened. This is deliberate. Early drafts written
without real specifics read as generic AI output, and a same-day entry is what fixes that.

The gate only decides *whether* a draft happens. Once it passes, the job picks the best
fit from **all** unused entries, today's or older. You never delete entries. Used ones move
to `## Referenced` on their own.

## How it works

Three GitHub Actions workflows do all the work. Nothing runs on your machine.

| Stage | Workflow | Trigger |
| --- | --- | --- |
| Relay | `triggerdraftarticle.yml` | Push to `main` touching `config/experience-log.md` (skipped for merges of `draft/*` PRs) |
| Draft | `draft-article.yml` | Dispatched by the relay, or run manually from the Actions tab |
| Publish / reject | `handle-review.yml` | A pull request is closed |

**Drafting.** `draft-article.yml` runs [`claude-code-action`](https://github.com/anthropics/claude-code-action)
with the full drafting prompt inlined. It checks the gate, picks the pillar that has gone
longest without an article, chooses a topic, grounds the piece in an experience entry,
drafts 800–1400 words in the voice defined in `config/profile.md`, runs a banned-phrase
pass, an AI-detector self-check and a web-search originality spot-check, then pushes the
branch and opens the PR. Commits use the `architecture-journal-bot` identity, and the
action is configured to add no tool attribution to commits or PR bodies.

**Reviewing.** `handle-review.yml` runs `scripts/handle-pr-close.ts`. On merge it publishes
the draft through `scripts/devto-publish.ts` and moves the file from `drafts/` to
`published/`. On close it records the rejection and your comment in `topics-queue.json`.

**Why a relay workflow?** `claude-code-action` refuses a plain `push` trigger, so a small
push-triggered workflow dispatches the drafting workflow instead.

**Cost.** Claude Code authenticates with a subscription OAuth token, so usage draws from
your existing plan with no separate per-token billing. Git and PR operations use the job's
own `GITHUB_TOKEN`. See [`CLAUDE.md`](CLAUDE.md) for the full authentication story and the
history of how drafting got here.

## Repository layout

| Path | Purpose |
| --- | --- |
| `config/experience-log.md` | **Your daily input.** `## Unused` holds new entries; `## Referenced` holds the ones already used |
| `config/profile.md` | Voice and style rules, tech pillars, banned phrases, anti-AI-detector rules, tag defaults, draft file format |
| `config/topics-queue.json` | Topic backlog per pillar plus used and rejected history. Auto-managed; edit the `queue` arrays to steer topics |
| `drafts/` | Articles awaiting review. Each lives on its own `draft/*` branch until merged |
| `published/` | Approved articles |
| `scripts/devto-publish.ts` | Publishes an approved draft to dev.to |
| `scripts/handle-pr-close.ts` | Reconciles the topic queue when a PR merges or closes |
| `.github/workflows/` | The three workflows above |
| `CLAUDE.md` | Technical decision record for future maintainers |

Draft files are named `drafts/<YYYY-MM-DD>-<kebab-slug>.md`, on a branch named
`draft/<same-id>`. Do not change this pattern without updating `HEAD_REF` parsing in
`scripts/handle-pr-close.ts`.

## Setup

1. **Repository secrets** (Settings → Secrets and variables → Actions → Secrets):
   - `CLAUDE_CODE_OAUTH_TOKEN`: run `claude setup-token` locally and paste the result.
   - `DEVTO_API_KEY`: your dev.to API key.
2. **Repository variable** `DEVTO_LIVE`: leave `false` at first. Merges then publish as
   **private dev.to drafts** so you can check quality. Set it to `true` to publish publicly.
3. **Local development** (only if you change the scripts):

   ```bash
   npm install
   npm run typecheck
   ```


## Operating the pipeline

- **Steer topics:** edit the `queue` arrays in `config/topics-queue.json`. They also refill
  automatically when a pillar runs low.
- **Run a draft manually:** Actions → *Draft daily article* → *Run workflow*. It still
  respects the same-day entry gate.
- **Pause everything:** disable the `draft-article.yml` workflow in the Actions tab.
- **Go live:** set the `DEVTO_LIVE` variable to `true`.
- **Rotate the Claude token:** re-run `claude setup-token`, then update
  `CLAUDE_CODE_OAUTH_TOKEN`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| No PR appeared | No bullet dated today (UTC) under `## Unused`. Otherwise check the *Draft daily article* run in the Actions tab |
| PR appeared but isn't on dev.to after merging | Check the *Handle article review decision* run in the Actions tab |
| dev.to link returns 404 | You are signed in to the wrong dev.to account, or `DEVTO_LIVE` is still `false` and the post is a private draft only you can see |
| An extra, instantly skipped draft run after a merge | Expected. Merging brings the entry-move diff into `main`; the gate exits immediately |
| Entry pushed but nothing drafted | The commit must reach `main` with a today-dated bullet. Check the *Trigger daily article draft* run |
