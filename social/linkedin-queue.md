# LinkedIn queue

Paste each teaser into LinkedIn's post box (the link becomes the preview card), then tick the box.
Entries are appended by `scripts/linkedin-backfill.ts`; existing entries are never rewritten.


<!-- review_id: 2026-07-25-adr-what-belongs -->
## [X] What actually belongs in an architecture decision record (and what doesn't)

https://dev.to/webruster/what-actually-belongs-in-an-architecture-decision-record-and-what-doesnt-1ke6

```text
Most architecture decision records fail for the opposite reason people assume. The problem usually isn't that teams skip writing them. It's that the ones they do write are stuffed with the wrong content, and the one thing a reader actually needs (why this option and not the others) is buried on page three under a changelog of API endpoints.

#architecture #softwaredesign #systemdesign
```

<!-- review_id: 2026-07-26-hotfix-cherry-pick-smell -->
## [X] Cherry-picking your hotfix twice is the real pipeline smell

https://dev.to/webruster/cherry-picking-your-hotfix-twice-is-the-real-pipeline-smell-1i6h

```text
We had a gitflow pipeline that looked clean on paper: develop feeds a release branch, the same build artifact promotes through dev, qa, sit, uat, and prod, and once prod is green we tag the commit on main. Textbook. Then a production bug showed up on a Tuesday afternoon, and the diagram stopped mattering.

#devops #cloud
```

<!-- review_id: 2026-07-27-subscription-per-environment-question -->
## [X] Subscription-per-environment was never the real question

https://dev.to/webruster/subscription-per-environment-was-never-the-real-question-3che

```text
Every landing zone conversation eventually lands on the same fork: subscription-per-team or subscription-per-environment. Pick one, defend it in the design review, move on. I used to think that fork was the decision. It isn't. It's a proxy for a question nobody actually asks, which is whether your environments are things you have or things you make.

#azure #cloud #architecture
```

<!-- review_id: 2026-07-29-net-core-production-ready -->
## [X] What a .NET Core service needs before it's actually production-ready

https://dev.to/webruster/what-a-net-core-service-needs-before-its-actually-production-ready-42k0

```text
Health checks. Structured logging. Retry policies with jitter. Everyone who writes a "production readiness checklist" for a .NET Core service reaches for the same list, and none of it is wrong. But it's the wrong list to reach for first if your services live inside a shared domain model.

#dotnet #csharp #webdev
```

<!-- review_id: 2026-07-30-design-review-naming-collision -->
## [X] The one design-review question that would have caught our APIM naming collision

https://dev.to/webruster/the-one-design-review-question-that-would-have-caught-our-apim-naming-collision-4eho

```text
"Property with the same name already exist." That's the whole error. No stack trace worth reading, no line number, just APIM refusing a PUT and a pipeline stuck red at 2pm.

#node #python #backend
```

<!-- review_id: 2026-08-11-c4-diagram-seven-hops -->
## [X] My container diagram had three boxes. The actual pipeline had seven hops.

https://dev.to/webruster/my-container-diagram-had-three-boxes-the-actual-pipeline-had-seven-hops-35k5

```text
Three boxes. That's what our C4 container diagram showed for the EPCIS batch upload flow in ALSC. Upload API. Processing Service. Notification Service. Clean. Presentable. Wrong in the way that actually costs you time during an incident.

#architecture #softwaredesign #systemdesign
```

<!-- review_id: 2026-08-16-dont-add-a-rule-kind-until-twice -->
## [ ] Don't add a new rule kind until you've written the same check twice

https://dev.to/webruster/dont-add-a-new-rule-kind-until-youve-written-the-same-check-twice-3jjj-temp-slug-992129

```text
Someone asked me last week to stop users typing backticks into a product-name field. Fine. Then someone asked for the same thing on a host-address field, then a description field. Three tickets, same shape, three weeks apart. That's the moment a form-validation ask stops being a bug fix and starts being a design question: do I bolt a fourth one-off regex onto a fourth page, or do I finally admit this is a pattern and give it a name?

#architecture #softwaredesign #systemdesign
```

<!-- review_id: 2026-10-23-queue-depth-lies-in-multi-tenant-saas -->
## [ ] Queue depth lies when one Service Bus queue serves every customer

https://dev.to/webruster/queue-depth-lies-when-one-service-bus-queue-serves-every-customer-11hk-temp-slug-4352121

```text
Here's the design question that keeps coming back on our SaaS platform: one queue, shared by every customer, sitting between the cloud product and whatever the customer runs on-prem. Is that one queue enough? Scalable enough, reliable enough? I think the answer is yes for a surprisingly long time. What I don't think survives is the dashboard most teams put on top of it.

#devops #cloud #architecture
```
