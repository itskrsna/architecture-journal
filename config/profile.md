# Author Profile & Voice Guide

This file is what every daily draft is grounded in. The more specific and current you keep
it, the less generic the output sounds. Update it any time your focus shifts — the pipeline
reads it fresh every run.

## Role & responsibilities

- **Title / role**: Cloud Architect / Solutions Architect
- **Core responsibilities** *(fill in specifics — team size, what you own end to end, what
  decisions land on your desk)*:
  -
  -
- **Organization context** *(industry, team structure, scale — no need for confidential
  details, just enough to ground examples)*:
  -

## Tech pillars (topic rotation draws from these)

1. **Solutions/Software Architecture** — C4 model, system design, architecture decision
   records, trade-off analysis, design review practices
2. **DevOps / Cloud infrastructure** — CI/CD, IaC, containers/orchestration, observability
3. **Azure** — landing zones, well-architected framework, service selection trade-offs,
   cost/governance
4. **.NET Core** — API design, performance, modernization from .NET Framework, minimal APIs
5. **Node.js / Python backend** — API patterns, integration architecture, cross-stack
   comparisons relevant to polyglot environments

*(Edit this list any time your focus shifts — the topic queue in `topics-queue.json` is
organized around these same 5 pillars.)*

## Concrete experience to draw on

Stable, curated background — the kind of thing that doesn't change week to week. For a
**running feed of fresh, raw material you add to continuously**, see `experience-log.md` in
this same folder instead; that's the one to update whenever something happens, not this file.

- *(example: "Led a landing-zone redesign for a multi-team org where the original
  subscription-per-team model broke down at ~40 teams — what we changed and why")*
-
-

## Writing samples (for voice/rhythm calibration only)

Paste 1–3 short samples of your own real writing here (an email, a Slack message, a design
doc excerpt — a few sentences to a paragraph each). These are read only to calibrate sentence
rhythm and voice, never quoted or reused as content.

- *(none yet — add some when you have them; drafts will keep using the style rules below in
  the meantime)*

## Voice & style rules

- Write in first person, practitioner tone — like explaining a decision to a peer architect,
  not narrating a textbook.
- Open with a concrete situation or claim, never a scene-setting generality.
- Every article should contain at least one specific, falsifiable claim or example (a number,
  a named pattern, a real trade-off) — not just balanced-on-both-sides generalities.
- It is fine to have opinions and take a side. Hedging everything reads as AI-generated.
- Target length: 800–1,400 words. Long enough to say something real, short enough to respect
  a reader's time.
- Target audience: practicing engineers/architects who'd skip anything that reads like
  marketing copy.

### Anti-AI-detector rules (these matter as much as the banned-phrase list)

- **Sentence burstiness**: deliberately mix very short sentences (3-6 words) with longer,
  more complex ones. Don't let the whole draft settle into one medium-length rhythm —
  uniform sentence length is one of the strongest AI-detector signals.
- **Break the standard shape**: avoid the reflexive "intro paragraph → three neat points →
  conclusion paragraph" structure. Let the argument's own logic dictate structure, including
  uneven section lengths.
- Don't perfectly balance every argument. Real opinions have rough edges — commit to a
  position, note the one counterpoint that actually matters, move on.
- Paragraph lengths should vary noticeably — some one sentence, some six.
- Prefer one specific, textured example over three generic ones.

## Banned phrases / AI-cliché list

The self-review pass rejects and rewrites any draft containing these (or close variants):

- "In today's fast-paced world / rapidly evolving landscape"
- "Delve into" / "Dive deep into"
- "Unlock the power of" / "Harness the power of"
- "It's important to note that" / "It's worth noting that"
- "In conclusion" / "To sum up" as a section opener
- "Furthermore" / "Moreover" used as a default paragraph connector
- Opening with a rhetorical question ("Have you ever wondered...?")
- Three-adjective list openers ("robust, scalable, and efficient")
- Overuse of em-dashes as a substitute for real sentence structure
- Generic hedging that says nothing ("there are many factors to consider")

## Draft file format

Every draft saved to `drafts/YYYY-MM-DD-slug.md` must start with YAML front-matter, then the
article body in Markdown:

```
---
title: "Why your C4 diagrams stop at the container level"
pillar: architecture
tags: [architecture, systemdesign]
review_id: 2026-07-26-c4-pitfalls
date: 2026-07-26
---

Article body starts here...
```

`tags` — up to 4, pick from the pillar's default set below. `review_id` — matches the
branch name (`draft/<review_id>`) and the PR title, so the workflow can trace a merged/closed
PR back to its file. `scripts/devto-publish.js` reads this front-matter directly.

## Tags / dev.to defaults

Default tag set to consider per pillar (dev.to allows up to 4 tags per post):
- Architecture: `architecture`, `softwaredesign`, `systemdesign`
- DevOps/Cloud: `devops`, `cloud`, `kubernetes`
- Azure: `azure`, `cloud`, `architecture`
- .NET Core: `dotnet`, `csharp`, `webdev`
- Node.js/Python: `node`, `python`, `backend`
