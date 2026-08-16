---
title: "The same drift bug that breaks your Terraform state also breaks your login form"
pillar: devops_cloud
tags: [devops, cloud]
review_id: 2026-08-16-same-drift-bug-twice
date: 2026-08-16
---

Somewhere in your infrastructure right now, a resource doesn't match what your Terraform state file claims. I'd put money on it. Maybe it's a firewall rule someone added through the portal during an incident at 2am and never ticketed. Maybe it's a tag that got renamed by a policy remediation task outside the pipeline. Doesn't matter which. The shape of the bug is always the same: there is a declared source of truth, and there is an easier path around it, and eventually someone takes the easier path.

I spent last month staring at the exact same bug in a codebase that has nothing to do with infrastructure.

A teammate and I built a generic field-validation engine for the React forms in one of our apps: a rule registry, basically. Each form declares a small config object: this field is required, this one has a max length of 100, this one only allows digits, this one needs a custom cross-field check against another field's value. Ten rule kinds cover almost everything: required, min/max length, pattern match, forbidden pattern, a restricted-characters preset, numeric, email, a custom escape hatch, and an explicit sanitizer for live input-stripping. A hook wires it all up: errors, sanitize-on-change, validate-on-blur, validate-all-on-submit. Any page that needs field validation imports the hook, writes its rule config, and it works.

It's a good pattern. I'd build it again. The whole point was to stop every page from reinventing its own bespoke regex checks scattered across the codebase, each slightly different, each with its own bugs.

Except the escape hatch that makes the engine flexible is the same door that lets it drift.

Nothing stops a developer, six months from now, mid-sprint, from writing a raw regex check directly in a field's onChange handler instead of routing it through the rule registry. It compiles. It works, for that one field, in that one moment. Nobody's build breaks. QA doesn't flag it, because the field still validates correctly from the user's point of view. But now there is a rule living outside the registry that the registry doesn't know about, that the next developer won't find when they go looking at the shared config to understand what's enforced where, and that won't get the live-sanitization or the shared error-display wiring for free. The declared source of truth — "these are the validation rules for this app" — quietly stopped being true for one field. Nothing announced it.

That's drift. Not a compile error. Not a test failure. A fact that becomes false without anyone deciding it should.

Terraform drift works the same way, mechanically, even though the domain couldn't be more different. You declare desired state in `.tf` files. Someone with portal access — an on-call engineer under pressure, someone doing "just this one quick thing" — changes a resource directly. `terraform plan` on a clean environment should show zero diff. The moment it doesn't, the state file has quietly become a work of fiction about your actual infrastructure. And just like the validation engine, the manual portal edit usually works fine in isolation. Nothing breaks that day. It breaks three months later, when someone runs an apply based on the state file's stale assumptions and the plan output doesn't match what's actually running. Or worse, the apply "corrects" a change someone made deliberately and nobody remembers why anymore.

Here's the part I think most teams get wrong about drift, in both the infra sense and the code sense: they try to solve it with process. Code review. A wiki page that says "please use the shared validation hook." A runbook that says "please don't edit resources manually, always go through the pipeline." Review didn't catch the inline regex. It looked like a normal, working field check, and nobody reviewing that PR was thinking about the registry's completeness as a system property. The runbook doesn't stop the 2am portal edit, because in the moment, going through a slower pipeline felt like the wrong call to the person holding the pager.

Process catches drift only when someone happens to be looking at the right diff at the right time. That's luck with a policy document stapled to it.

What actually works is removing the choice, or at minimum making drift loud and automatic instead of quiet and manual. For infrastructure, that means scheduled drift detection: `terraform plan -detailed-exitcode`, or your IaC tool's equivalent, running on a cron against every managed environment, not just before a deliberate deploy, with any nonzero diff treated as an incident that pages someone, not a dashboard tile nobody opens. For the validation engine, the fix was less glamorous: a lint rule. We flag any onChange handler in a form file that contains a raw regex literal, on the theory that if you're writing pattern-matching logic in a component, you've probably reinvented what the registry already does, badly, somewhere nobody else will look.

Neither fix is complete. The lint rule can be silenced with an inline comment, the same way a human can still `terraform apply -target` around a plan. Drift prevention doesn't eliminate the escape hatch. That's usually a legitimate need, at least occasionally. What it does is make bypassing the shared path cost something, instead of costing nothing. That's the actual trade-off: total lockdown kills the flexibility that made the registry, or the pipeline, worth building in the first place. Total permissiveness turns "declared state" into a suggestion. The useful middle is friction proportional to how much a bypass should hurt to justify.

If your team runs drift detection on infrastructure but nowhere else that has this shape — a declared shared source of truth plus a legitimate escape hatch — you're only watching for the bug in the one place you already got burned by it. Feature flags. Config registries. Permission tables. Validation rules. It shows up anywhere a system lets someone take the fast path around the slow, correct one. Go find the other places before they find you at 2am.
