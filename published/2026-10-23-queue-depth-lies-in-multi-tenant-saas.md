---
devto_url: "https://dev.to/webruster/queue-depth-lies-when-one-service-bus-queue-serves-every-customer-11hk-temp-slug-4352121"
published_date: "2026-10-23"
title: "Queue depth lies when one Service Bus queue serves every customer"
pillar: devops_cloud
tags: [devops, cloud, architecture, azure]
review_id: 2026-10-23-queue-depth-lies-in-multi-tenant-saas
date: 2026-10-23
---

Here's the design question that keeps coming back on our SaaS platform: one queue, shared by every customer, sitting between the cloud product and whatever the customer runs on-prem. Is that one queue enough? Scalable enough, reliable enough? I think the answer is yes for a surprisingly long time. What I don't think survives is the dashboard most teams put on top of it.

Start with the plumbing, because the on-prem link is where the decision actually gets made.

There are two ways to get the cloud talking to a customer's data centre. You can have the cloud call in over HTTP, a trigger that hits an endpoint on their side. Or you can put a broker in the middle, Service Bus say, and let the on-prem agent reach out and pull. I'm firmly in the second camp. Customers' firewall teams will say no to inbound holes. They rarely object to an outbound connection on 443 from one agent. And an HTTP trigger has an ugly failure mode: when the customer's site is down for maintenance, your caller either blocks, retries in a tight loop, or drops the call. A queue just holds the message.

That last point is the whole value. The queue turns "the customer is offline" from an incident into a backlog.

Now the multi-tenant part. A single queue for all customers is cheap and simple, and the usual objection is noisy neighbours: one customer bulk-loads fifty thousand messages and everyone behind them waits. That's real. But it's a fairness problem, not a capacity problem, and the two get different fixes. Capacity you buy: Premium tier, more messaging units, partitioning. Fairness you design: session IDs keyed on tenant, so ordering holds per customer and a slow consumer for one tenant doesn't block the others' sessions.

Sessions have a cost. A session-enabled queue means every receiver has to accept a session before it reads anything, and a tenant's session is locked to one receiver at a time. That caps single-tenant throughput at what one receiver can chew through. For most B2B integration traffic that's fine. For a tenant who really does send in bursts, give them their own queue. I'd rather have a shared default and a handful of promoted exceptions than start with queue-per-tenant and own a thousand entities in the deployment pipeline.

So far so ordinary. Here's where I think teams get hurt.

They wire up an alert on active message count. Over 5,000, page someone. It feels right. It's wrong in a multi-tenant queue, and wrong in a specific way: it measures the sum of everybody, and the sum hides the one person who is actually broken.

Picture it. Customer A's on-prem agent lost its credentials on Tuesday afternoon. Their messages pile up, 300 of them. Total queue depth is 300 on a queue that normally runs at 2,000 during business hours. No alert. Nothing looks unusual. Customer A finds out their data hasn't synced for two days when they phone support on Thursday.

Depth fails you in both directions. A big batch from a healthy tenant trips the alarm while every message is being consumed on time. A stuck tenant stays under the threshold forever because the rest of the queue is quiet.

The metric I want instead is the age of the oldest unprocessed message, per tenant. A stuck tenant shows up in minutes, because their oldest message keeps getting older while every other tenant's resets constantly. A bulk load from a healthy tenant shows high depth but a low, flat age. Age separates "busy" from "broken", and depth cannot.

Getting it isn't free. Service Bus doesn't hand you per-session oldest-age as a built-in metric, so you stamp the enqueue time and the tenant ID on every message, and emit the delay from the consumer when it completes one. That gives you processing latency per tenant, which is already useful. For the stuck case, where nothing is completing at all, you need a second signal: a small scheduled check that peeks the head of the queue and flags any tenant with a message older than your threshold. Peek doesn't lock anything, so it's safe to run every minute. Messy, yes. Still much cheaper than the Thursday phone call.

Dead-letter needs the same treatment. A total dead-letter count of 40 means nothing until you know 38 of them belong to one tenant whose payloads started failing schema validation after a release. Tag it, group by tenant, alert on a tenant crossing a number rather than the queue crossing one.

I'll admit the counterpoint with some weight behind it: per-tenant tracking adds cardinality, and metrics platforms bill on it. If you have ten thousand tenants, per-tenant time series is its own cost problem. Fine. Track the top offenders, or sample. But even at that scale, I'd take the oldest-age-by-tenant on the worst twenty over a perfect global depth chart.

On reliability, the answer to "one queue for all customers" comes down to three choices, and none is exotic. Turn on duplicate detection, since the on-prem agent will retry and you don't want a customer's order processed twice. Set max delivery count deliberately, because the default of 10 means a poison message cycles ten times before dead-lettering, and in a session queue that stalls the whole tenant while it does. And make the on-prem consumer idempotent regardless, because duplicate detection only covers the window you configured.

Where does that leave the original question? One queue is fine to start. HTTP triggers into customer networks are the thing I'd avoid. But the part that deserves your design time isn't the topology at all. It's whether, on a quiet Tuesday, you would find out that one customer has been silently stuck since lunch.

If your current alert can't answer that, the queue is not the thing to fix.
