---
title: "What a .NET Core service needs before it's actually production-ready"
pillar: dotnet
tags: [dotnet, csharp, webdev]
review_id: 2026-07-29-net-core-production-ready
date: 2026-07-29
---

Health checks. Structured logging. Retry policies with jitter. Everyone who writes a "production readiness checklist" for a .NET Core service reaches for the same list, and none of it is wrong. But it's the wrong list to reach for first if your services live inside a shared domain model.

I spent a chunk of this month wiring up something that's not on anyone's checklist: turning our domain projects into versioned NuGet packages, pushing them to a private Artifactory feed, and building a bot whose entire job is bumping the version number and rippling that bump out to every microservice repo that consumes it.

It sounds like plumbing. It is plumbing. But it's the plumbing that decides whether "production-ready" means anything across a fleet of services instead of just one.

Here's the problem it solves. Once you factor shared domain logic — entities, value objects, business rules that more than one service needs — out of a monolith and into a library, you've created a dependency graph you didn't have before. Every consuming service now has an opinion, implicit or not, about which version of that library it's running. Before we packaged it properly, that opinion was enforced by copy-paste and tribal memory. Nobody actually knew which service had which version of which rule.

NuGet fixes the packaging half of that. Artifactory gives you a private feed so the package doesn't leak outside the org and you get an audit trail of who pulled what, when. Neither of those pieces is interesting on its own. The interesting part, and the part that actually determines whether this approach helps you or quietly wrecks you, is the bot.

The bot watches the domain package repo. When a new version ships, it opens a PR against every downstream microservice repo, bumping the reference. That's the whole job. No cleverness, just a scripted dependency bump that used to be a manual chore somebody forgot to do half the time.

And here's where I'll disagree with the take you see in half the "microservices done right" posts: automating that bump is good, but only if you admit you've just built an internal Dependabot, and internal Dependabot needs the same discipline the external kind does — discipline most teams skip because "it's our own code, we'll catch it."

You won't catch it. Not reliably.

If the bot opens the PR and someone rubber-stamps merges on domain package bumps the way they rubber-stamp a patch bump on a logging library, you are one mislabeled semver bump away from a breaking change landing in a dozen-plus services on the same afternoon. A shared domain library isn't a leaf dependency. It's load-bearing. A major-version bump there deserves the same scrutiny as a schema migration, because functionally that's what it is.

So the real production-readiness question isn't "do we have a bot that bumps versions." It's "does every consuming service have a CI gate that runs its own integration suite against the new package version before that PR is mergeable — not after." We didn't have that gate on day one. We had the bot open the PR, a green build meaning "it compiles," and a merge button sitting right there. That's not readiness. That's speed dressed up as readiness.

Getting the gate right meant slowing the bot down on purpose. It still opens the PR immediately, but it no longer auto-merges past a minor version bump until the consuming service's full integration suite passes against the new package — not just its unit tests, the whole suite, including the slow ones nobody likes running. That one change moved the failure mode from silent breakage in production to a red CI check somebody has to look at. Not exciting. Correct.

There's a real trade-off here, and I won't pretend it away: this slows down how fast a domain fix reaches every service. In the old copy-paste world, a bug fix in a shared value object reached whichever service someone remembered to update, whenever they remembered — slow, but nobody's build broke overnight because of it. In the new world, the fix propagates fast to every service wired up to the bot, and any service where the fix collides with a local assumption finds out immediately, in CI, instead of three weeks later in an incident channel.

I'd take the second failure mode every time. Fast and visible beats slow and invisible. But the cost is real, and pretending otherwise is how these systems lose the team's trust the first time a bump breaks a build at 5pm on a Friday.

One more thing worth saying plainly: none of this replaces the usual checklist. A service still needs health checks, a sane retry policy, and logs that actually correlate across a request. What packaging and version-bump automation buys you is a production-readiness checklist that's true across the whole fleet, not just true for the one service you happened to test carefully. A service can pass every item on that list in isolation and still go down the moment a shared library changes underneath it in a way nobody flagged.

If you're building shared .NET domain libraries and haven't worked out who reviews a major version bump, what test suite has to pass before that bump merges, and who's accountable when the bot's PR breaks something two services downstream, you don't have a production-ready fleet. You have a production-ready service, once, and a bot quietly deciding when that stops being true.
