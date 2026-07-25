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
reports that it skipped. This is deliberate: it forces you to actually engage that day, rather
than the routine falling back to generic filler.

That gate only decides *whether* today's run happens — it doesn't restrict *which* entry gets
used. Once unlocked, the routine considers everything still sitting in `## Unused`, today's or
older, and picks whichever single entry best fits that day's topic. So: **you never need to
delete anything yourself.** Log as much as you want on any given day — extras that don't get
picked simply wait their turn and get used whenever they're the best fit, then move to
`## Referenced` automatically. Nothing goes stale, nothing needs manual cleanup.

## Unused

- *(example — delete once you've added real ones: "2026-07-20: Spent a sprint arguing with a
  teammate over whether a new reporting service should be its own bounded context or bolted
  onto the existing orders service. We split it out; six months later glad we did because the
  reporting side needed a completely different scaling profile.")*

2026-07-26: created branching strategy and  multiple azure environments on the fly so the building product can be be fast phased

2026-07-27: nuget package implementation of domain projects and pushing to private artifactory and using custom dependent bot to bump the version and releasing to the microservice repos

2026-07-28: gitflow release strategy: i have built pipeline and from develop to release on this build pipeline runs and with same artifact we will release to different environment, (dev,qa,sit,uat,prod)  and after succesfull deployment of release we tag the particular release after merginng from release to main, now any issue comes in the production, we raise branch from tag as hot fix and creates pr to Release and deploy to the UAT slot as hot fix after testing we will toggle the slot, we are cherry picking the hotfix and merging into the develop and to the main branch and updating the tag, the point here is that how to release the hotfix from release branch?
release have untested code so we release directly from hotfix branch itself and we have some more scenarios where we documented the approach
## Referenced

*(entries land here once a draft has used them, e.g. "2026-07-20: ... — used in
2026-07-26-bounded-context-when")*
