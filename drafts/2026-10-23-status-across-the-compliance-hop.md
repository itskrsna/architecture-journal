---
title: "Operational excellence is the Well-Architected pillar that loses first, and file-transfer status shows why"
pillar: azure
tags: [azure, cloud, architecture]
review_id: 2026-10-23-status-across-the-compliance-hop
date: 2026-10-23
---

Someone on the team asked me this week whether we should swap our Service Bus trigger for an HTTP one, so a single request could tell us where a file is. The file leaves Azure, lands on-premises, and gets forwarded from there to a customer's site. Compliance says the report has to come from the on-prem machine, not from us in the cloud. Fair. But the question hid something more interesting than a trigger choice.

Ask which Well-Architected pillar gets cut first under deadline pressure and the honest answer is operational excellence. Nobody schedules it. Nobody demos it. Cost gets a dashboard, security gets a review gate, reliability gets a diagram with two regions on it. "Can I see where this file is?" gets a shrug and a promise for phase two.

Then phase two arrives as a single question in a chat thread.

## Why the HTTP idea is tempting

I understand the pull. One request in, one answer out. The caller asks "what happened to file X?" and the response walks the whole chain: Azure side, on-prem hop, customer delivery. No extra storage. No eventual anything. It feels honest.

It is also the wrong shape, and I'd say so even before looking at latency. The request would have to stay open across a link we don't control, to a machine we don't operate, delivering to a customer whose site may be down for maintenance on a Tuesday afternoon. Every timeout you configure becomes a lie. Set it at 30 seconds and a slow transfer looks like a failed one. Set it at 10 minutes and you're holding threads and gateway connections hostage to a customer's network.

The real cost isn't slow responses. It's that the status question and the transfer have been welded together, so you can no longer answer "what happened?" without redoing the waiting.

## Keep the events, add a status record

The Service Bus design isn't the problem. It's missing a read side.

Give every file a correlation ID at the moment it enters the flow. Each hop, when it finishes or fails, writes one small record: ID, stage, timestamp, outcome. Put those in something cheap and queryable. Table Storage or Cosmos DB will do; I wouldn't reach for a relational database here, because the access pattern is "all records for this ID, in order" and nothing else.

Now the HTTP endpoint you wanted exists after all. It just reads the record instead of chasing the file. `GET /files/{id}/status` returns in milliseconds and says "delivered to customer at 14:02" or "on-prem received, forward pending since 13:40". The expensive part, waiting, stays asynchronous where it belongs. If a caller really needs to block, give them the standard 202 Accepted plus a status URL and let them poll it. That's boring. Boring is what you want from a status API.

## The compliance hop changes who writes the last record

Here is where the original constraint matters, and where I'd push back on treating it as a nuisance. If reporting must originate from the on-prem side, then the on-prem agent is the authority on the final two stages. The cloud shouldn't guess. So the on-prem component pushes its own status events back to Azure, outbound only, over HTTPS to a small ingest endpoint or onto a Service Bus queue of its own. Outbound-only is also the easier conversation with the customer's network team, which counts for more than people admit.

What the cloud side must never do is infer success. "Sent to on-prem" is not "delivered". Our status page should say exactly which of those it knows, and for how long it has known nothing newer.

That last part is the one I'd defend hardest. A status record with a stale timestamp is a signal. A file that has sat at "on-prem received" for four hours is a support ticket you can open before the customer calls. Add an alert on stage age, per stage, with thresholds you can argue about: ten minutes for the on-prem forward, an hour for customer delivery, say. You will tune them wrong the first time. Tune them anyway.

## The counterpoint that actually matters

The status record is a second source of truth, and second sources of truth drift. An agent crashes after forwarding but before writing its record, and now the log says pending for a file the customer already has. Make the writes idempotent, make the on-prem agent re-report on restart, and accept that for a short window the status can lag reality. If a file's status could ever cost someone money or a compliance finding, add a reconciliation job that compares against the customer-side acknowledgement. I would not skip it for a regulated flow.

I still prefer that drift to the synchronous alternative. Drift is bounded and repairable. A request chain that spans three organizations' networks fails in ways you cannot even enumerate.

## What I'm doing about it

We're keeping the Service Bus trigger. Correlation ID at ingress, a stage-record table, an outbound status feed from the on-prem agent, and one GET endpoint over the top. The whole read side is maybe two days of work, which is the part that stings: we only got to it because someone asked in a chat thread, not because anyone planned it.

If operational excellence is the pillar that gets cut first, the cheapest defence is to treat "where is it now?" as a feature with a ticket, written in the first sprint, not a question you answer in the last one.
