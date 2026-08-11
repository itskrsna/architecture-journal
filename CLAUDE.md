# CLAUDE.md

Context for any future Claude Code session working in this repo. For the user-facing "how do
I use this" guide, see `README.md` instead — this file is the technical/decision record.

## What this is

An automated daily tech-article pipeline for the repo owner (Cloud/Solutions Architect —
Azure, .NET Core, Node.js/Python, DevOps). Drafts one article a day grounded in a real
experience note the owner logs, opens a GitHub PR for review, publishes approved ones to
dev.to. Built in a single extended Claude Code session on 2026-07-25.

## Execution architecture

Both halves now run as plain **GitHub Actions workflows** — no Claude Code involvement at
runtime, and no GitHub connector of any kind:

1. **Drafting + opening the PR**: `.github/workflows/draft-article.yml`, on a daily
   `schedule` (plus `workflow_dispatch` for manual runs). It runs `scripts/draft-article.ts`,
   which calls the Anthropic API directly (`@anthropic-ai/sdk`, model `claude-opus-5`) to plan,
   draft, and self-review the article, then writes the config updates and draft file. The
   workflow step after it does the git add/commit/push and `gh pr create`, using the job's own
   `GITHUB_TOKEN` (granted `contents: write` + `pull-requests: write` at the workflow level).
2. **Reacting to the PR closing** (publish on merge, log feedback on reject):
   `.github/workflows/handle-review.yml`, triggered on `pull_request: closed`
   (`scripts/devto-publish.ts`, `scripts/handle-pr-close.ts`) — unchanged.

Requires one repo secret: `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions).
This is a **separate Anthropic Console account/billing relationship from any Claude
subscription** — pay-as-you-go per token, roughly $0.30–0.80 per drafting run at
`claude-opus-5` / `effort: high` (see the cost note in Known trade-offs below). Drop to
`effort: medium` in `draft-article.ts` if that's too much for a personal project.

### History — why this used to be split across two systems

Until 2026-08, drafting ran as a **Claude Code cloud routine** (trigger id
`trig_01JS86HJCYYUFuB7T9UEvqGP`) instead of an Action, because GitHub connection for Claude
Code cloud routines turned out to be gated behind org-admin approval on the owner's Team
account, with no self-serve option — so the routine authenticated via a **fine-grained GitHub
PAT embedded directly in its own stored prompt** instead of the normal `sources:
git_repository` OAuth mechanism. That PAT-based `git push` worked for about a week (see
`topics-queue.json`'s early `used` entries), then stopped: a proxy change on Claude Code's
side started requiring cloud sessions to authenticate GitHub access through a linked
connector regardless of any embedded credential, and this workspace never had one. Moving
drafting into a GitHub Action sidesteps the whole problem — Actions already has native,
unrestricted repo access via `GITHUB_TOKEN` — at the cost of the direct Anthropic API spend
above, which the owner had originally declined but reconsidered once the routine broke.
**The old routine should be disabled** (it can't push anyway, but leaving it enabled risks a
duplicate/conflicting draft if GitHub connectors ever become available on this account) —
disable or delete it via the Claude Code web UI or the `schedule` skill.

## The hard gate (deliberate, not a bug)

`draft-article.ts`'s first step checks `config/experience-log.md`'s `## Unused` section for a
bullet dated with the current date. If none exists, it stops immediately — no topic popped
from `topics-queue.json`, no draft, no PR, just a "Skipped" log line. This exists because the
first real draft scored 81% on an AI-detection tool; the root cause was generic prose from
having no real specifics to ground the article in. Forcing a same-day experience-log entry is
the fix. Do not remove this gate without addressing that root cause some other way.

## Conventions

- Draft files: `drafts/<review_id>.md`, where `review_id` = `<YYYY-MM-DD>-<kebab-slug>`.
  Branch name is always `draft/<review_id>`; the workflow derives `review_id` by stripping
  the `draft/` prefix from the branch name, so don't change this pattern without updating
  `handle-pr-close.ts`'s `HEAD_REF` parsing.
- Front-matter schema (`title`, `pillar`, `tags`, `review_id`, `date`) is documented in
  `profile.md`'s "Draft file format" section and parsed by `gray-matter` in
  `scripts/devto-publish.ts`. Keep the two in sync if either changes.
- Automated commits (from both Actions workflows) use a bot identity
  (`architecture-journal-bot` / `articles-bot@users.noreply.github.com`), not the repo owner's
  personal identity.
- **This repo's local git identity is intentionally `imwebruster@gmail.com`**, not whatever
  the machine's global git config says (which is a work address) — set as a repo-local
  override. Do not let a global config leak back in; check `git config user.email` (no
  `--global`) before committing here if anything looks off.
- `topics-queue.json`'s `used`/`rejected` arrays are populated only by
  `scripts/handle-pr-close.ts` (on PR merge/close), never by `draft-article.ts` directly — it
  only ever pops from `queue` and appends to `experience-log.md`'s `Referenced` section.
  Rejected-PR metadata is fetched from the GitHub Contents API at the PR's head SHA (not from
  the working tree), because a rejected draft's file never reaches `main`.

## Known trade-offs / things to revisit

- **Anthropic API cost**: `draft-article.ts` runs ~4-5 `claude-opus-5` calls per drafting run
  (plan → draft → banned-phrase pass → detector pass → originality check), each at
  `effort: high` with thinking on by default. Rough estimate ~$0.30-0.80/day, ~$10-25/month —
  billed to whatever payment method is on the Anthropic Console account tied to
  `ANTHROPIC_API_KEY`, separate from any Claude subscription. Drop `effort` to `medium` in the
  script if this needs to be cheaper.
- `DEVTO_LIVE` (Actions repo variable) is `false` — merges currently publish as **private**
  dev.to drafts, not public. Flip to `true` once satisfied with quality.
- No paid plagiarism/AI-detection API is used, by the owner's choice — originality relies on
  grounding in `experience-log.md`, a banned-phrase self-review, a dedicated AI-detector
  self-check pass, and a lightweight web-search spot-check on distinctive sentences.
- Hashnode/Substack/Medium/LinkedIn are explicitly out of scope for automation (API access is
  either paid+gated, nonexistent, or closed — see the plan history for the research behind
  this). dev.to is the sole automated target.
