---
title: "What actually belongs in an architecture decision record (and what doesn't)"
pillar: architecture
tags: [architecture, softwaredesign, systemdesign]
review_id: 2026-07-25-adr-what-belongs
date: 2026-07-25
---

Most architecture decision records fail for the opposite reason people assume. The problem usually isn't that teams skip writing them. It's that the ones they do write are stuffed with the wrong content, and the one thing a reader actually needs (why this option and not the others) is buried on page three under a changelog of API endpoints.

An ADR has one job: capture a decision that's expensive to reverse, along with the reasoning that led to it, at the moment that reasoning is freshest. That's it. It is not a design doc, not a spec, and not a research dump. If you keep that scope narrow, everything else about what to include and what to leave out falls out of it directly.

## The format that still holds up

Michael Nygard's original ADR template from 2011 (title, status, context, decision, consequences) has survived for a reason. It maps to the actual questions a future reader has. What was the situation? What did we decide? What did we give up? Teams that reinvent this with ten extra sections (owners, review dates, risk matrices, approval sign-off chains) usually end up with a document nobody finishes reading, which defeats the purpose. If your ADR template is longer than the template itself would take to fill in for a trivial decision, cut sections until it isn't.

A useful gut check: an ADR that runs longer than a page and a half is very often a design doc wearing an ADR's title. That's not a hard rule, but I've yet to see a genuinely good ADR clear 600 words. The decisions worth recording this way are ones you can state, justify, and own the trade-offs of in a page. If you can't, the record isn't the problem. The decision is probably still too coupled to five other undecided things.

## What belongs

**The decision, stated as a decision, not a description.** "We will use event-driven integration between the order and inventory services instead of synchronous REST calls" is a decision. "The order service integrates with inventory" is a description of the current state and belongs in a wiki, not an ADR.

**The forces that made this hard.** Not a literature review, just the two or three constraints that were actually in tension. Latency budget vs. consistency guarantees. Team ownership boundaries vs. a shared database that made those boundaries fictional. Cost ceiling vs. the vendor lock-in that comes with the cheaper option. If there was no real tension, you probably didn't need an ADR for it.

**The alternatives you seriously considered, and why they lost.** Not every option under the sun, just the ones a competent engineer would reasonably ask about six months later. "We considered a shared database with row-level locking; we rejected it because it recreates the coupling we were trying to remove between the two teams' deploy cycles." That one sentence saves the next person from re-litigating a decision that was already made.

**The consequences, including the ones you don't love.** This is the section teams skip most often, and it's the one with the highest payoff. Every real architectural decision costs something. If you adopt event-driven integration, you've traded synchronous simplicity for eventual consistency and a harder debugging story when a message gets lost. Write that down. An ADR that lists only upside isn't a record of a decision. It's a sales pitch to your future self, and future-you will not be fooled twice.

## What doesn't belong

**Implementation detail.** Class names, endpoint paths, table schemas, retry counts. These change constantly and rot the document within a quarter. If the ADR needs a code sample to make its point, that's a sign the decision being recorded is actually an implementation choice, not an architectural one, and it should live in the code or the design doc instead.

**Decisions that aren't actually decisions yet.** If three options are still open and nobody's picked one, that's a design doc or a spike ticket. Writing an ADR for a decision in progress produces a record that contradicts itself by the time it's approved, and contradicting records are worse than no record: they actively mislead the next reader.

**A decision made after the fact to satisfy process.** This is the rubber-stamp failure mode, and it's more common than teams admit. Someone builds the thing, then writes the ADR retroactively because the checklist requires one. The "alternatives considered" section becomes fiction, because nothing was actually considered. The option that got shipped is the only one that ever existed on paper. Readers can tell. An ADR written after the code is merged reads differently than one written before, and once a team's ADRs get a reputation for being theater, people stop reading them, which is worse than never having required them.

**Every decision, regardless of size.** This is the trade-off nobody wants to state plainly: requiring an ADR for every non-trivial pull request produces a pile of records where the field-naming convention and the choice to go fully async both get the same template and the same ceremony. The signal-to-noise ratio collapses, and the actually consequential records (the ones about service boundaries, data ownership, and irreversible platform bets) get lost in a queue of forty near-duplicates about logging formats. Reserve ADRs for decisions that are genuinely hard to reverse: things that touch team boundaries, data ownership, or a platform choice you'll be living with for years. Everything smaller can go in a pull request description or a design note.

## The test that actually matters

Before you write the next one, ask: if this decision turned out to be wrong in eighteen months, would the person debugging it be grateful this document exists? If the answer is "they'd skim past the boilerplate looking for the one paragraph that explains why we didn't just do the obvious thing," write that paragraph first and build the rest of the record around it. Everything else, the status field, review date, approval chain, is optional scaffolding. The reasoning is the artifact. Treat it that way and the format takes care of itself.
