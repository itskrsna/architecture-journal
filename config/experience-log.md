# Experience Log

A running inbox of real, raw material — not a polished document. Add a bullet here any time
something happens that's worth an article someday: a decision you made, an incident, a debate
you had with a teammate, a number that surprised you, a pattern you noticed twice. Don't
polish it, don't tie it to a pillar, don't wait for the "right" moment — just capture it.

**How to add an entry**: edit this file directly on GitHub (the pencil "Edit this file" icon
on github.com, or the GitHub mobile app), or edit it locally if you're at your laptop. Add a
new bullet under `## Unused`, starting with today's date (`YYYY-MM-DD: ...`).

**Hard gate: no entry dated today = no article today.** The daily drafting routine checks
`## Unused` for a bullet dated with the current date before doing anything else. If none
exists, it skips the entire run — no topic popped from the queue, no draft, no PR — and just
reports that it skipped. This is deliberate: it forces every article to be grounded in
something you actually logged that day, rather than falling back to generic filler on days
you didn't add anything.

When a matching entry exists, the routine picks whichever of today's dated entries best fits
that day's pillar, grounds the article in it, and moves it to `## Referenced` with the
review_id it was used for.

## Unused

- *(example — delete once you've added real ones: "2026-07-20: Spent a sprint arguing with a
  teammate over whether a new reporting service should be its own bounded context or bolted
  onto the existing orders service. We split it out; six months later glad we did because the
  reporting side needed a completely different scaling profile.")*

## Referenced

*(entries land here once a draft has used them, e.g. "2026-07-20: ... — used in
2026-07-26-bounded-context-when")*
