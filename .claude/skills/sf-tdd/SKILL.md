---
name: sf-tdd
description: Write a Technical Design Document for a Salesforce feature — scope, data model, component design, integrations, security, test and deployment strategy — in a consistent template. Use when the user asks for a TDD, technical design, solution design document, SDD, or "document the design for". Revenue Cloud Advanced aware.
---

# Salesforce Technical Design Document

A TDD is the contract between the solution and the build. It is read by a developer who
will implement it, an architect who will approve it, and a tester who will verify it — so
it must be specific enough to build from and honest about what is still unknown.

Use `references/tdd-template.md` as the skeleton. Fill every section; delete none. A
section with nothing in it is itself information — write "Not applicable — <reason>".

## 1. Establish the inputs before writing

Ask for whatever is missing, in one batch:

- The **requirement or approved solution** (often the output of `/sf-ticket-solution`).
- The **org** — is there a connected org or repo metadata to verify against? Sandbox names?
- **Existing design docs** or naming conventions the team follows.
- **Non-functional numbers** — record volumes, users, integration frequency, SLAs. Without
  these the design section is guesswork; say so if they never arrive.

Verify the schema you describe. Same tooling as `/sf-ticket-solution`:

```bash
sf sobject describe -s <Object> -o <alias>
sf project retrieve start -m "CustomObject:<Object>__c" -o <alias>
```

Mark anything unverified with `(assumed)` inline. Reviewers forgive assumptions; they do
not forgive assumptions dressed as facts.

## 2. Design decisions carry their alternatives

Every meaningful choice in the document gets a one-line rationale and the rejected
alternative. This is the part reviewers actually read:

> **Decision** — Quote line rollups computed in an after-save Flow rather than a
> roll-up summary field, because the parent-child relationship is lookup, not
> master-detail, and converting it would break the existing Asset sharing model.

Collect these in a **Design decisions** table so they can be scanned without reading the
whole document.

## 3. Sections that people get wrong

**Data model** — Include an ERD (mermaid `erDiagram`), and for each new field: API name,
type, length/precision, required, unique, external ID, default, help text, FLS by profile.
State the relationship type (lookup vs. master-detail) and the delete behaviour. If you
extend a standard object, say why a custom object was not used.

**Component design** — Name real components. `QuoteLinePricingService.cls`,
`Quote_Line_Rollup_After_Save.flow`, not "an Apex class handles pricing". For each: its
responsibility, entry point, and what calls it. Include the sequence for anything with more
than two hops (mermaid `sequenceDiagram`).

**Order of execution** — Any object with more than one automation gets an explicit table:
what fires, in what order, with what trigger context. This section prevents the most
expensive class of production bug.

**Integrations** — Direction, protocol, auth (Named Credential + External Credential —
never a hardcoded key), payload shape, error handling, retry, idempotency key, and volume.
Note the governor limits that apply (100 callouts/transaction, 120s cumulative).

**Security** — Profiles/permission sets, sharing model, `with sharing` vs. `without
sharing` per class and the justification, FLS/CRUD enforcement approach
(`Security.stripInaccessible`, `WITH USER_MODE`), and any data classified as PII.

**Limits & scale** — SOQL/DML per transaction against the volumes from section 1, heap for
the largest expected payload, async strategy, and the concurrency story for bulk loads.

**Test strategy** — Apex coverage target (75% is the floor, not the goal), the specific
negative and bulk cases, UAT scenarios mapped to acceptance criteria, and who signs off.

**Deployment** — Component list, deployment order, pre/post steps, config that cannot be
deployed and must be done by hand (record types in some cases, decision table refreshes,
scheduled job re-scheduling), and the rollback plan.

## 4. Revenue Cloud Advanced

When the design covers RCA, the data model section must state where each object sits in the
dependency chain, because that dictates both deployment and data load order:

`ProductCatalog → ProductCategory → AttributePicklist → AttributePicklistValue →
AttributeCategory → AttributeDefinition → ProductClassification →
ProductClassificationAttr → ProductSellingModel → Pricebook2 → Product2 →
ProductCategoryProduct → ProductSellingModelOption → PricebookEntry →
ProductComponentGroup → ProductRelatedComponent`

Also call out explicitly:
- Which **Pricing Procedure** and Price Elements apply, and which **Decision Tables** back
  them — including the post-deployment refresh, which is a manual step.
- Whether logic belongs in a **Pricing Procedure / Extension Rule** rather than Apex.
- Any **Configuration Rules** (exclusion, validation, auto-add) and what they enforce.
- Asset lifecycle impact for amendment, renewal and cancellation paths.

## 5. Output

Write to `docs/tdd/<TICKET-ID>-<short-slug>.md` unless the user names a path. Keep mermaid
diagrams in fenced blocks — they render in GitHub and in Claude artifacts.

If the user wants it as a shareable page rather than a repo file, offer to publish it as an
artifact after the markdown is agreed.

## 6. Before you hand it over

- Every API name is verified or marked `(assumed)`.
- Every design decision names its rejected alternative.
- The order-of-execution table exists if the object has more than one automation.
- Deployment has a rollback plan, and manual post-steps are listed separately from the
  component list.
- Open questions are collected at the top, not scattered — a reviewer should see the
  unknowns in the first screen.

Related: `/sf-ticket-solution` for the approved approach this documents,
`/sf-flow-design` for the flow-level detail, `/sf-data-deploy` for the data load plan.
