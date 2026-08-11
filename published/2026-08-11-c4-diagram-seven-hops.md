---
devto_url: "https://dev.to/webruster/my-container-diagram-had-three-boxes-the-actual-pipeline-had-seven-hops-40ee-temp-slug-6655088"
published_date: "2026-08-11"
title: "My container diagram had three boxes. The actual pipeline had seven hops."
pillar: architecture
tags: [architecture, softwaredesign, systemdesign]
review_id: 2026-08-11-c4-diagram-seven-hops
date: 2026-08-11
---

Three boxes. That's what our C4 container diagram showed for the EPCIS batch upload flow in ALSC. Upload API. Processing Service. Notification Service. Clean. Presentable. Wrong in the way that actually costs you time during an incident.

Here's what one upload really does. A user drops an EPCIS batch file in the browser. That request lands on a Node.js Function. The Function writes the file to blob storage and drops a message on Service Bus. A .NET Function picks that up, does its work, and hands off to a Hangfire background job. The Hangfire job does more processing and puts more messages back on Service Bus for the next stage. Count them: browser request, Node Function, blob write, Service Bus message, .NET Function, Hangfire job, another Service Bus hop. Seven independent executions for one click. Three boxes on the diagram.

Nobody drew that. Nobody was going to, either. Not because the team was lazy. Because C4's container level was never built to answer "what actually runs, in what order, for this one business action." It answers a different question: what are the deployable units, and how do they relate to each other structurally. That's a fine question. It's just not the question you need answered at 2am when a batch upload fails somewhere in the middle of seven hops and nobody can say which one.

I want to be fair to C4 here, because the framework gets blamed for a gap it never claimed to fill. Dynamic diagrams exist precisely for this: sequence-style views of a specific runtime scenario, layered on top of the static container view. That's the textbook answer. In practice, on this project, we never drew one until an incident forced the question. I'd guess most teams doing async, queue-heavy work are in the same position. The container diagram gets maintained because it's the artifact everyone points to in design reviews. The dynamic view, the one that would have actually shown the seven hops, doesn't get the same attention because nothing forces it. Until something breaks.

And when something breaks, the cost of not having it is specific and boring: a support ticket references a failed batch, and resolving it means pulling in whichever four teams own a piece of that chain, each one grepping their own logs around a rough timestamp, hoping the clocks are close enough to correlate a batch ID by eye. That's not a hypothetical. That's what used to happen here before we fixed it.

The fix was distributed tracing with OpenTelemetry, and the part worth writing down isn't "we added tracing," it's the specific hop that made it necessary rather than nice-to-have. Hangfire's Redis-backed queue does not carry request context by default. A job dequeued by the Hangfire server has no idea which upload triggered it unless that link gets made explicit, in code, on purpose, by whoever wires the enqueue call. Every other hop in the chain (HTTP call, Service Bus message) has some natural place to smuggle a correlation ID through. Hangfire's queue doesn't hand you that for free. It's the kind of gap that only shows up once you actually try to trace something end to end, which is exactly why it never showed up on the container diagram either.

Once the trace ID actually propagates across all seven hops, the same incident resolves differently. Instead of four people grepping four log stores against a guessed time window, you pull one trace ID, open Application Map, and read the path the request actually took. What used to burn half a day now takes the time it takes to type an ID into a search box.

Worth saying plainly, though: turning on distributed tracing everywhere, always, is not free, and I'd push back on any advice that pretends otherwise. Trace volume maps directly to Application Insights ingestion cost. Blanket always-on tracing across every service, every environment, every request, is a line item, not a checkbox. We ended up building the ability to switch tracing on for a specific service only when investigating something, without a redeploy, rather than leaving it running everywhere by default. That's a governance decision as much as a technical one, and it belongs in the same conversation as the tracing rollout itself, not bolted on after finance asks about the Application Insights bill.

So here's the actual claim, not the softened version: a C4 container diagram that stops at "these are our services and how they call each other" is systematically going to undercount the real failure surface the moment you introduce a queue, and queues are exactly where async architectures live. Three boxes versus seven runtime hops isn't a rounding error — it's the difference between a diagram that looks complete and one that would have actually helped during the incident that eventually forced us to build tracing anyway.

If I were redoing the design review for this system today, I'd make one change to how we document it: no container diagram for an async pipeline gets signed off without a companion flow diagram showing at least one real end-to-end scenario, hop by hop, including the ones that don't carry context automatically. Not every scenario. One. The one that actually matters — usually the longest chain, or the one with the least obvious hop, like a Redis-backed queue that quietly drops your correlation ID on the floor unless you catch it.

The diagram wasn't wrong because it lied about anything on it. It was wrong because it stopped one layer too early, right where the actual failure surface starts. Draw the hops. The boxes were never the hard part.
