---
title: "The difference between a design review and a rubber stamp"
pillar: architecture
tags: [architecture, softwaredesign, systemdesign]
review_id: 2026-08-16-design-review-vs-rubber-stamp
date: 2026-08-16
---

I approved a pull request last month in about four minutes. Tests passed, the diff was clean, the checklist was all green. By every mechanical measure it was a fine review. It was also a rubber stamp, and I didn't notice until three weeks later, when someone tried to reuse the same "quick regex check" pattern for a fourth field and the file had turned into a pile of copy-pasted validation logic.

That's the gap I want to talk about.

A design review that only asks "does this work" isn't reviewing the design. It's reviewing the implementation. Those are different questions, and conflating them is how teams end up with codebases full of individually reasonable decisions that add up to a mess.

Here's the test I use now, and it comes straight from a validation engine I built recently for a set of React forms that kept accumulating one-off regex checks. The engine's rule registry currently has ten kinds — required, minLength, maxLength, pattern, forbiddenPattern, restrictedChars, numeric, email, custom, and sanitize. Every field a page needs validated gets one entry in a rules object, and a single hook wires up live sanitization, blur-time errors, and a submit-time gate off that same object. On paper, that's a nice piece of generalized infrastructure. The interesting part isn't the registry, though. It's the rule I attached to growing it: a new named preset only gets added once the same logic is needed in at least two places. Until then, you reach for the `custom` escape hatch and write it inline.

Nobody asked me to write that rule down. I added it after watching the opposite happen on a different project, where a "flexible" config object grew a new top-level key for every caller's pet requirement until it had thirty optional fields, and reading any one form's config meant mentally filtering out the twenty-six that didn't apply. Generality that isn't load-bearing yet is just clutter with extra steps.

This is exactly where most design reviews go quiet. Someone proposes a new rule kind — say, a `crossFieldMatch` preset because a signup form needs "confirm password." The review checks whether the regex works, whether it handles empty strings, whether there's a test. All reasonable. None of it asks the question that actually matters: is this the second caller, or the first? If it's the first, `custom` already does the job, and adding a named preset for one consumer is premature generalization dressed up as good architecture. It reads fine in the PR. Eighteen months later it reads as bloat, because nobody remembers why there are three ways to express the same rule.

A rubber-stamp review can't catch this. Catching it requires context the diff doesn't contain — how many other places in the codebase actually need this, and whether "two" is real or aspirational. That's not something a linter flags. It's judgment, and supplying it instead of a checklist is the entire point of having a design review at all.

I'll grant the obvious objection: doesn't gatekeeping every new preset behind "prove you need it twice" slow teams down? A little, sometimes. Someone writes the same three-line custom validator twice instead of importing a preset once. I think that cost is worth paying, because the alternative — a registry with fifteen presets, six of which exist for a single caller each — is worse and much harder to undo. You can always promote a duplicated `custom` block into a named preset once the duplication is real. You can't un-invent a preset that three other teams have already started depending on for reasons that have nothing to do with why you built it.

There's a second question a real review should ask, and almost never does: where does the pure logic live relative to the framework glue. In this engine, `fieldValidation.ts` holds nothing but rule definitions and pure validator functions — no React, no hooks, no component state. `useFieldValidation.ts` is the only file that touches React at all, and its entire job is wiring those pure functions into a component's lifecycle: `errors`, `sanitizeOnChange`, `validateField`, `validateAll`. That split wasn't originally deliberate. It happened because the pure functions were easier to unit test without a rendering harness. Only later did it become the reason the validation logic could survive a framework migration untouched. A rubber-stamp review doesn't ask "will this still work if the framework changes," because that question doesn't affect whether today's PR merges. A real design review asks it anyway. Today's PR is never just today's PR — it's a small vote on the shape of the next fifty PRs that get built on top of it.

None of this shows up in a green CI run.

That's the actual argument for keeping design review distinct from code review, rather than collapsing both into a single "LGTM" gate. Code review answers whether something is correct. Design review answers whether it's the right shape, and whether you're generalizing at the right moment — and that second question needs someone in the room asking it out loud, because the diff itself will never volunteer the answer.
