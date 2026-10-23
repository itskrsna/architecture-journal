# Architecture Journal

An automated pipeline that turns one real experience note a day into a reviewed, published
tech article.

You log what happened at work. A GitHub Action builds a draft article around that note and
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
- [Entry page setup](#entry-page-setup)
- [Operating the pipeline](#operating-the-pipeline)
- [Troubleshooting](#troubleshooting)

## Daily workflow

1. **Log an entry.** Open the entry page (`https://itskrsna.github.io/architecture-journal/`,
   see [Entry page setup](#entry-page-setup)) on your phone or any browser, type what
   happened, and press **Save**. Make it real and unpolished: a decision, an incident, a
   surprising number, a debate with a teammate. Saving commits a dated bullet to
   `config/experience-log.md` on `main`, which starts the pipeline. You can also edit that
   file by hand under `## Unused`, starting the bullet with today's date, `YYYY-MM-DD: ...`
   (UTC).
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
stops: no topic is consumed, no PR is opened. This is deliberate. Drafts built
without real specifics come out generic, and a same-day entry is what fixes that.

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

**Drafting.** `draft-article.yml` checks the gate, picks the pillar that has gone longest
without an article, chooses a topic, grounds the piece in an experience entry, writes
800–1400 words in the voice defined in `config/profile.md`, runs style and originality
checks, then pushes the branch and opens the PR. Commits use the `architecture-journal-bot`
identity.

**Reviewing.** `handle-review.yml` runs `scripts/handle-pr-close.ts`. On merge it publishes
the draft through `scripts/devto-publish.ts` and moves the file from `drafts/` to
`published/`. On close it records the rejection and your comment in `topics-queue.json`.

**Why a relay workflow?** The drafting step can't be started by a plain `push` trigger, so a
small push-triggered workflow dispatches it instead.

**Cost.** Drafting runs under an existing subscription, with no separate per-token billing.
Git and PR operations use the job's own `GITHUB_TOKEN`.

## Repository layout

| Path | Purpose |
| --- | --- |
| `config/experience-log.md` | **Your daily input.** `## Unused` holds new entries; `## Referenced` holds the ones already used |
| `config/profile.md` | Voice and style rules, tech pillars, banned phrases, style checks, tag defaults, draft file format |
| `config/topics-queue.json` | Topic backlog per pillar plus used and rejected history. Auto-managed; edit the `queue` arrays to steer topics |
| `docs/` | The entry page (static, served by GitHub Pages) used to log entries from any device |
| `drafts/` | Articles awaiting review. Each lives on its own `draft/*` branch until merged |
| `published/` | Approved articles |
| `scripts/devto-publish.ts` | Publishes an approved draft to dev.to |
| `scripts/handle-pr-close.ts` | Reconciles the topic queue when a PR merges or closes |
| `.github/workflows/` | The three workflows above |

Draft files are named `drafts/<YYYY-MM-DD>-<kebab-slug>.md`, on a branch named
`draft/<same-id>`. Do not change this pattern without updating `HEAD_REF` parsing in
`scripts/handle-pr-close.ts`.

## Setup

1. **Repository secrets** (Settings → Secrets and variables → Actions → Secrets):
   - The drafting credential, under the secret name used in `draft-article.yml`.
   - `DEVTO_API_KEY`: your dev.to API key.
2. **Repository variable** `DEVTO_LIVE`: leave `false` at first. Merges then publish as
   **private dev.to drafts** so you can check quality. Set it to `true` to publish publicly.
3. **Local development** (only if you change the scripts):

   ```bash
   npm install
   npm run typecheck
   ```


## Entry page setup

The page in `docs/` commits entries straight to `main` through the GitHub API, so it needs
a token that is stored only in your browser.

1. **Enable Pages:** repo → Settings → Pages → Source *Deploy from a branch* → Branch `main`,
   folder `/docs`.
2. **Create a token:** GitHub → Settings → Developer settings → Fine-grained tokens. Limit
   it to this repository only, permission **Contents: Read and write**, with an expiry you
   are comfortable renewing.
3. **Open the page** on each device, paste the token under *GitHub token*, and save your
   first entry. Use *Add to Home Screen* on your phone for one-tap access.

Anyone can open the page, but without your token they cannot write anything.

## Operating the pipeline

- **Steer topics:** edit the `queue` arrays in `config/topics-queue.json`. They also refill
  automatically when a pillar runs low.
- **Run a draft manually:** Actions → *Draft daily article* → *Run workflow*. It still
  respects the same-day entry gate.
- **Pause everything:** disable the `draft-article.yml` workflow in the Actions tab.
- **Go live:** set the `DEVTO_LIVE` variable to `true`.
- **Rotate the drafting credential:** regenerate it, then update the secret named in
  `draft-article.yml`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| No PR appeared | No bullet dated today (UTC) under `## Unused`. Otherwise check the *Draft daily article* run in the Actions tab |
| PR appeared but isn't on dev.to after merging | Check the *Handle article review decision* run in the Actions tab |
| dev.to link returns 404 | You are signed in to the wrong dev.to account, or `DEVTO_LIVE` is still `false` and the post is a private draft only you can see |
| An extra, instantly skipped draft run after a merge | Expected. Merging brings the entry-move diff into `main`; the gate exits immediately |
| Entry pushed but nothing drafted | The commit must reach `main` with a today-dated bullet. Check the *Trigger daily article draft* run |
