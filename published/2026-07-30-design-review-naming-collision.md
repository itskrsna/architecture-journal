---
devto_url: "https://dev.to/webruster/the-one-design-review-question-that-would-have-caught-our-apim-naming-collision-2onl-temp-slug-3272562"
published_date: "2026-07-31"
title: "The one design-review question that would have caught our APIM naming collision"
pillar: node_python
tags: [node, python, backend]
review_id: 2026-07-30-design-review-naming-collision
date: 2026-07-30
---

"Property with the same name already exist." That's the whole error. No stack trace worth reading, no line number, just APIM refusing a PUT and a pipeline stuck red at 2pm.

The instinct was to blame the script. It's always the instinct. Somebody had touched the apiops publisher config two days earlier, so that got the first look, and it was clean. The real cause was quieter and, honestly, more interesting than a script bug: Azure API Management named values carry two separate identifiers, and almost nobody designs around the fact that only one of them is actually enforced.

There's `id`: whatever apiops derives from the artifact folder name during extraction. And there's `name`, a display property living inside that resource, which APIM enforces must be unique across the *entire service*, independent of `id`. Two axes, one enforced, one not. Somewhere in one environment, a named value already existed with `name: key1`. It had been created manually through the portal months earlier, sitting under a completely different `id` than the one our publisher was trying to write. APIM saw the collision on `name` and rejected the write. From the pipeline's point of view, this looked exactly like corruption. It wasn't corruption. It was two people, at two different times, both being reasonable, and the platform not telling either of them about the other.

I've now seen this shape of bug in three different systems this year, and every time it traces back to the same design-review gap.

## The question nobody asks

When a design doc introduces a resource, reviewers reach for the obvious questions. Does it scale? What's the failure mode? Who owns it in prod? Fine questions, all of them, and none of them would have caught this.

The question that would have caught it is smaller and gets skipped almost every time: **does this resource have more than one identifier, and if so, which one is actually unique, and at what scope?**

Most engineers assume "the ID is unique" and stop there. But plenty of platforms (APIM named values being one, but far from the only one) split identity into a system-assigned key and a human-facing name, and enforce uniqueness on the one you weren't watching. Git branch names inside a protected-branch rule. DNS record names inside a zone. Feature-flag keys versus their internal flag IDs. Environment variable names across shared app-service slots. Same pattern every time: one field is globally unique, the other is scoped or arbitrary, and the design doc almost never says which is which.

That gap survives review because it doesn't fail during review. It fails three weeks later, in a different environment, when someone who's never read the design doc creates something through a portal instead of a pipeline. By then nobody's connecting the failure back to a design decision at all. It just looks like an ops incident.

## What actually would have helped

Not more process. A one-line addition to the design doc template: for every resource with a compound identity, state explicitly which field is unique, at what scope, and what happens on collision.

That's it. It's a sentence, sometimes two. But writing that sentence forces the author to actually go check — which means they find out, before shipping, that `name` is global and `id` is local, instead of finding out from a failed pipeline run with a cryptic 409.

I'd also push back on the instinct to "fix" this by locking down the portal so nobody can create named values manually again. We talked about it. It's the wrong fix. Manual creation isn't the bug. Undocumented shared-identity scope is. Lock the portal and you've removed one path to the collision while leaving the actual landmine in place for the next person who imports a named value some other way, or renames a folder that changes the derived `id`. Governance theater instead of a fix.

What we actually did: added an idempotency check to the publisher step. Look up by `name` before attempting the PUT. If a named value with that name exists under a different `id`, fail loudly with the actual conflicting `id` in the error, not APIM's generic message. Twenty minutes of work. It would have turned a 45-minute production debugging session into a five-second, self-explanatory pipeline failure.

## Why this belongs in a Node/Python conversation, not just an Azure one

It's tempting to file this under "Azure quirks" and move on. Don't. The exact same failure mode shows up constantly in backend services outside Azure entirely. A Python service that treats a Stripe customer ID and an internal user ID as interchangeable until a webhook arrives out of order. A Node service that keys a cache on a slug that's supposed to be unique but is only enforced unique per-tenant, not globally, until two tenants pick the same slug and one silently overwrites the other's cache entry.

Compound identity is one of the most common shapes a design doc's blind spot takes, across every stack I've worked in. It's not an Azure problem wearing an Azure name. It's a resource-modeling problem that happens to have surfaced there this time.

If you review backend design docs, yours or someone else's, this is worth adding as a fixed line item, not something you trust yourself to remember to ask ad hoc under deadline pressure. "What's unique, and at what scope, for every identifier this resource exposes." One question. It would have saved us a debugging session, and it's cheap enough to ask on every doc, not just the ones that feel risky.
