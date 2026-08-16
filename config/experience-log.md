# Experience Log

A running inbox of real,, raw material — not a polished document. Add a bullet here any time
something happens that's worth an article someday: a decision you made, an incident, a debate
you had with a teammate, a number that surprised you, a pattern you noticed twice. Don't
polish it, don't tie it to a pillar, don't wait for the "right" moment — just capture it.

**How to add an entry**: edit this file directly on GitHub (the pencil "Edit this file" icon
on github.com, or the GitHub mobile app), or edit it locally if you're at your laptop. Add a
new bullet under `## Unused`, starting with today's date (`YYYY-MM-DD: ...`).

**Hard gate: no entry dated today = no article today.** The daily drafting routine checks
`## Unused` for a bullet dated with the current date before doing anything else. If none
exists, it skips the entire run — no topic popped from the queue, no draft, no PR — and just
reports that it skipped. This is deliberate: it forces you to actually engage that day, rather
than the routine falling back to generic filler.

That gate only decides *whether* today's run happens — it doesn't restrict *which* entry gets
used. Once unlocked, the routine considers everything still sitting in `## Unused`, today's or
older, and picks whichever single entry best fits that day's topic. So: **you never need to
delete anything yourself.** Log as much as you want on any given day — extras that don't get
picked simply wait their turn and get used whenever they're the best fit, then move to
`## Referenced` automatically. Nothing goes stale, nothing needs manual cleanup.

## Unused

- *(example — delete once you've added real ones: "2026-07-20: Spent a sprint arguing with a
  teammate over whether a new reporting service should be its own bounded context or bolted
  onto the existing orders service. We split it out; six months later glad we did because the
  reporting side needed a completely different scaling profile.")*
  
2026-08-16: 
# Field Validation Framework 
A generic, pluggable field-level validation engine for React forms in this app. It is **not**
a restricted-character or max-length tool specifically — those are just two of the rule kinds
it understands. New rule kinds are added without touching any page that already uses it.

Files:
- `src/utils/fieldValidation.ts` — the rule registry + pure validator functions (`validateFieldValue`, `resolveSanitizer`, presets).
- `src/customhooks/useFieldValidation.ts` — the React hook any page imports to get `errors`, `sanitizeOnChange`, `validateField`, `validateAll`, `isAllValid`, `clearError`. Lives in `customhooks/` (not `utils/`) alongside `useDebounce.tsx` — this codebase's convention for reusable, non-page-specific hooks.

## 1. What this is

Each form defines a `Record<string, FieldRule>` — one entry per field it wants validated — and
passes it to `useFieldValidation(rules)`. The hook gives back everything needed to wire live
sanitization (e.g. stripping disallowed characters as the user types), blur-time error display,
and a submit-time gate, without writing new regex/validation logic by hand for each field.

## 2. Rule kinds reference

| Key | Shape | What it does |
|---|---|---|
| `required` | `boolean \| { message }` | Value must be non-blank (after `.trim()`). |
| `minLength` | `number \| { value, message }` | Value must be at least N characters. |
| `maxLength` | `number \| { value, message }` | Value must be at most N characters. |
| `pattern` | `{ regex, message }` | Value **must match** the regex (e.g. digits-only). |
| `forbiddenPattern` | `{ regex, message }` | Value **must not match** the regex. |
| `restrictedChars` | `boolean \| { chars, message? }` | Preset built on `forbiddenPattern` for "these specific characters are not allowed." `true` defaults to `\`, `'`, `"`. Also drives live-stripping via `sanitizeOnChange` (see below). |
| `numeric` | `boolean \| { message }` | Value must be digits only. |
| `email` | `boolean \| { message }` | Value must look like an email address. |
| `custom` | `(value, ctx) => string \| null` or an array of these | Escape hatch for anything not covered, including cross-field rules via `ctx.allValues`. |
| `sanitize` | `(raw: string) => string` | Explicit live-transform run on every keystroke/paste via `sanitizeOnChange`. Wins over the `restrictedChars` preset if both are present. |

Example:
```ts
const rules: Record<string, FieldRule> = {
  productName: { required: true, restrictedChars: true, maxLength: 100 },
  hostAddress: { pattern: { regex: HOST_REGEX, message: 'Enter a valid host or IP.' } },
  confirmPassword: { custom: (value, ctx) => (value !== ctx?.allValues?.password ? 'Passwords do not match.' : null) }
};
```

## 3. The repeatable recipe

1. Add one entry to your page's `Record<string, FieldRule>` config.
2. In the field's change handler, run the raw value through `sanitizeOnChange(name, rawValue, allValues)` before calling `setState`. This gives "strip disallowed characters as you type" for any rule with a `sanitize`/`restrictedChars` preset; it's a pass-through for everything else.
3. Wire the field's blur handler to call `validateField(name, value, allValues)` — reuse your page's existing blur dispatcher if it has one (see FAQ) rather than adding a second one.
4. Pass `errorMessage={errors[name]}` and `isInvalid={!!errors[name]}` into `CustomFormLabelAndInput` (or your input component) for that field. No changes to the input component are needed — it already supports these two optional props.
5. Wherever your page currently decides whether Submit/Next is enabled, call `validateAll(currentValues, allValues)` for the ruled fields instead of writing a new bespoke check next to it.
6. If you need a rule kind that isn't in the table above, reach for `custom` first. Only add a new named preset to `fieldValidation.ts`'s rule registry once the same logic is needed in 2+ places — this keeps the engine's surface small and demand-driven.


## Referenced

*(entries land here once a draft has used them, e.g. "2026-07-20: ... — used in
2026-07-26-bounded-context-when")*

2026-07-26: created branching strategy and  multiple azure environments on the fly so the building product can be be fast phased — used in 2026-07-27-subscription-per-environment-question

2026-07-28: gitflow release strategy: i have built pipeline and from develop to release on this build pipeline runs and with same artifact we will release to different environment, (dev,qa,sit,uat,prod)  and after succesfull deployment of release we tag the particular release after merginng from release to main, now any issue comes in the production, we raise branch from tag as hot fix and creates pr to Release and deploy to the UAT slot as hot fix after testing we will toggle the slot, we are cherry picking the hotfix and merging into the develop and to the main branch and updating the tag, the point here is that how to release the hotfix from release branch?
release have untested code so we release directly from hotfix branch itself and we have some more scenarios where we documented the approach — used in 2026-07-26-hotfix-cherry-pick-smell

2026-07-29: nuget package implementation of domain projects and pushing to private artifactory and using custom dependent bot to bump the version and releasing to the microservice repos — used in 2026-07-29-net-core-production-ready

2026-07-30: The error is a classic APIM named-value uniqueness conflict, not a pipeline/script bug:"Property with the same name already exist." (target: "name")
  APIM named values have two identifiers:- id — the resource ID (what apiops derives from your artifact folder name)- name — the display name property inside the resource, which APIM enforces must be unique across the whole service, independent of id This error means: in one environment, there is already a named value (created earlier — likely manually via portal, or under a different id/folder) whose name property is key1, but its id differs from the id the publisher is trying to PUT. APIM refuses the write because you'd end up with two different named values sharing the same name. — used in 2026-07-30-design-review-naming-collision

2026-08-11: Distributed Tracing with OpenTelemetry: A single user action in ALSC — for example, uploading an EPCIS batch file — fans out into many independent executions: a browser request, a Node.js Function, a blob write, a Service Bus message, a .NET Function, a Hangfire background job, and several more Service Bus hops. Each of these already produces its own logs. The problem distributed tracing solves is not "do we have enough logs" — it is "can we prove which logs, across which services, belong to the same end-user action."
Three practical outcomes motivated this work for ALSC specifically:
●	Faster incident response. A support ticket referencing a failed batch can be resolved by pulling one trace ID's full path through Application Map, instead of asking four different teams to search their own logs around a rough timestamp.
●	Visibility into a genuinely non-obvious hop. Hangfire's Redis-backed queue does not carry any request context by default — a job dequeued by the Hangfire server has no idea which upload triggered it unless that link is captured explicitly. Distributed tracing forces this link to be made explicit in code, rather than left as an assumption.
●	Safe cost control. Because trace volume maps directly to Application Insights ingestion cost, the platform needed the ability to turn tracing on only when investigating an incident, without redeploying every service. (Part X covers this in full.) — used in 2026-08-11-c4-diagram-seven-hops
