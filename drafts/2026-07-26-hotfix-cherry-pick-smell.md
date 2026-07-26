---
title: "Cherry-picking your hotfix twice is the real pipeline smell"
pillar: devops_cloud
tags: [devops, cloud]
review_id: 2026-07-26-hotfix-cherry-pick-smell
date: 2026-07-26
---

We had a gitflow pipeline that looked clean on paper: develop feeds a release branch, the same build artifact promotes through dev, qa, sit, uat, and prod, and once prod is green we tag the commit on main. Textbook. Then a production bug showed up on a Tuesday afternoon, and the diagram stopped mattering.

The standard gitflow answer is to branch a hotfix off the tag, PR it back into release, run it through the pipeline, and once it's proven in UAT, merge to main and cherry-pick the same commit back into develop. We built exactly that. It works. Until you ask the question nobody wants to answer out loud: release still has whatever was mid-flight when you cut the last tag. Untested code. Feature work three sprints deep in QA, sitting on the same branch you're now supposed to route your hotfix through.

So the real question we ended up arguing about wasn't "how do we release a hotfix." It was "do we trust the release branch enough to put a hotfix through it." Most of the time, the honest answer is no.

**The gate everyone obsesses over is the wrong one**

Five environments, five sign-offs, a change ticket for each one: that's the smell people point at first when a pipeline feels slow. It's real. It's just not the dangerous one. A slow gate costs you time. A gate you route around because you didn't trust your own process costs you an incident.

Here's what we landed on after the argument: release the hotfix directly from the hotfix branch, not through release. On Azure, that means deploying to the UAT slot, smoke-testing against production data shape, then toggling the slot. Same infrastructure, same config, none of release's baggage riding along. Once it's live, cherry-pick the commit into both develop and main, retag, and let the normal pipeline catch up on its own schedule whenever it gets there.

That's a smaller number of gates (one real test in the slot, one human sign-off) that actually mean something, instead of five theatrical ones inherited from a process built for planned releases, not for a Tuesday-afternoon incident.

**Cherry-picking backward is the part that actually breaks**

Cherry-picking isn't free. It's a manual merge decision, done twice, under time pressure, by whoever's on call. Miss a file, resolve a conflict wrong, and you've silently reintroduced the bug three weeks later when release finally catches up to main. We've had this happen. Not often. Twice in about eighteen months. Both times the root cause was identical: the hotfix touched a file that had also changed on develop, and the person doing the cherry-pick trusted the diff instead of running the test suite against the merged result.

The fix wasn't "be more careful." Telling people to be careful under incident pressure doesn't work. The fix was making the cherry-pick a PR like any other, gated by the same CI as a normal merge, instead of a git command someone runs from their laptop at 6pm. One automated check catches what a tired engineer won't.

**The trade-off nobody states plainly**

Deploying straight from a hotfix branch means shipping less-tested code than your normal pipeline would allow. That's the actual cost, and it's worth saying plainly instead of dressing it up. If your org's risk appetite says every production deploy needs the full five-stage gauntlet, this approach is wrong for you. Don't adopt it because it sounds efficient. Adopt it because you've decided the trade-off is acceptable for a defined, narrow class of change.

But when the choice is "wait six hours for a full pipeline run while the bug keeps costing money" versus "deploy a scoped, reviewed, slot-tested fix in twenty minutes," speed usually wins the math. We're not skipping testing. We're skipping the parts of testing that exist to catch problems unrelated to the fix: the ones baked into whatever else happens to be sitting on release that particular week.

**What I'd tell a team setting this up today**

Don't design your hotfix path as a stripped-down version of your normal release path. Design it as its own thing: its own artifact, its own single meaningful gate, its own explicit rule for re-entering the trunk.

Ours is three rules. Hotfix branches from the last production tag, never from release. It deploys through slot swap, never through the shared release pipeline. It re-enters develop and main through a real PR with CI attached, not a raw cherry-pick run from someone's terminal.

Three rules. They fit on a sticky note. The gitflow diagram we started with had no room for any of them, because it assumed every deploy was a planned one, and incidents don't wait for the plan to catch up.

If your next incident retro says "we need more approval gates," check first whether the actual failure was a rushed cherry-pick nobody tested. In our case, it always was — and no amount of extra sign-off in the normal pipeline would have caught it, because the bug never went through the normal pipeline at all.
