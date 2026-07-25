# CLAUDE.md

Context for any future Claude Code session working in this repo. For the user-facing "how do
I use this" guide, see `README.md` instead — this file is the technical/decision record.

## What this is

An automated daily tech-article pipeline for the repo owner (Cloud/Solutions Architect —
Azure, .NET Core, Node.js/Python, DevOps). Drafts one article a day grounded in a real
experience note the owner logs, opens a GitHub PR for review, publishes approved ones to
dev.to. Built in a single extended Claude Code session on 2026-07-25.

## Execution architecture (important — split across two systems)

1. **Drafting + opening the PR** runs as a **Claude Code cloud routine** (`RemoteTrigger`,
   trigger id `trig_01JS86HJCYYUFuB7T9UEvqGP`), not as code in this repo. Its full prompt is
   stored server-side as part of the routine config, not in any file here — **to change
   drafting behavior, update the routine via the `RemoteTrigger` tool or the `schedule` skill,
   not by editing a script in this repo.** Fetch its current config with
   `RemoteTrigger({action: "get", trigger_id: "trig_01JS86HJCYYUFuB7T9UEvqGP"})` before editing
   it blind.
2. **Reacting to the PR closing** (publish on merge, log feedback on reject) runs as a
   **GitHub Actions workflow** (`.github/workflows/handle-review.yml`), triggered on
   `pull_request: closed`. This part *is* real code in this repo
   (`scripts/devto-publish.ts`, `scripts/handle-pr-close.ts`).

This split exists because: (a) GitHub connection for Claude Code cloud routines turned out to
be gated behind org-admin approval on the owner's Team account, with no self-serve option and
no admin willing/available to grant it — so the routine authenticates via a **fine-grained
GitHub PAT embedded directly in its own stored prompt** instead of the normal `sources:
git_repository` OAuth mechanism (which would have required that gated connection). The PAT is
scoped to only this repo (Contents + Pull requests, read/write) to minimize blast radius —
this was a deliberate, user-approved trade-off against a proper secrets vault, not an
oversight. (b) The owner explicitly declined to pay for direct Anthropic API access, which
ruled out doing the drafting step as a GitHub Action too — hence the split rather than
everything living in Actions.

## The hard gate (deliberate, not a bug)

The routine's step 0 checks `config/experience-log.md`'s `## Unused` section for a bullet
dated with the current date. If none exists, it stops immediately — no topic popped from
`topics-queue.json`, no draft, no PR, just a "skipped" report. This exists because the first
real draft scored 81% on an AI-detection tool; the root cause was the routine falling back to
generic prose when it had no real specifics to ground the article in. Forcing a same-day
experience-log entry is the fix. Do not remove this gate without addressing that root cause
some other way.

## Conventions

- Draft files: `drafts/<review_id>.md`, where `review_id` = `<YYYY-MM-DD>-<kebab-slug>`.
  Branch name is always `draft/<review_id>`; the workflow derives `review_id` by stripping
  the `draft/` prefix from the branch name, so don't change this pattern without updating
  `handle-pr-close.ts`'s `HEAD_REF` parsing.
- Front-matter schema (`title`, `pillar`, `tags`, `review_id`, `date`) is documented in
  `profile.md`'s "Draft file format" section and parsed by `gray-matter` in
  `scripts/devto-publish.ts`. Keep the two in sync if either changes.
- Automated commits (both from the routine and from the Actions workflow) use a bot identity
  (`architecture-journal-bot` / `articles-bot@users.noreply.github.com`), not the repo owner's
  personal identity.
- **This repo's local git identity is intentionally `imwebruster@gmail.com`**, not whatever
  the machine's global git config says (which is a work address) — set as a repo-local
  override. Do not let a global config leak back in; check `git config user.email` (no
  `--global`) before committing here if anything looks off.
- `topics-queue.json`'s `used`/`rejected` arrays are populated only by
  `scripts/handle-pr-close.ts` (on PR merge/close), never by the drafting routine directly —
  the routine only ever pops from `queue` and appends to `experience-log.md`'s `Referenced`
  section. Rejected-PR metadata is fetched from the GitHub Contents API at the PR's head SHA
  (not from the working tree), because a rejected draft's file never reaches `main`.

## Known trade-offs / things to revisit

- `DEVTO_LIVE` (Actions repo variable) is `false` — merges currently publish as **private**
  dev.to drafts, not public. Flip to `true` once satisfied with quality.
- No paid plagiarism/AI-detection API is used, by the owner's choice — originality relies on
  grounding in `experience-log.md`, a banned-phrase self-review, a dedicated AI-detector
  self-check pass, and a lightweight web-search spot-check on distinctive sentences.
- Hashnode/Substack/Medium/LinkedIn are explicitly out of scope for automation (API access is
  either paid+gated, nonexistent, or closed — see the plan history for the research behind
  this). dev.to is the sole automated target.
