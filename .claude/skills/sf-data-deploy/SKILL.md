---
name: sf-data-deploy
description: Plan a Salesforce data load or migration — object order, external IDs, CSV/plan templates, the sf CLI commands to run, per-step validation and rollback. Produces the runbook; the operator executes it. Use when the user asks to load, migrate, seed, export or fix data between orgs, or to deploy a Revenue Cloud catalog into an org.
---

# Salesforce data deployment & migration

Data loads fail on relationships and on order, almost never on the data itself. **The plan is
the deliverable** — a runbook someone can execute step by step. The commands are the easy
part, and they are theirs to run.

## Read-only: write the runbook, never run it

**You do not modify the org.** You produce the load plan; a person executes it, watching the
results between steps.

Use freely — these only read:
`sf org list` · `sf org display` · `sf data query` · `sf data export` ·
`sf sobject describe` · `sf sobject list` · `sf project retrieve start`

Never run: `sf data create/update/upsert/delete/import`, `sf project deploy start`,
`sf apex run`, or any Setup change — **including the sample dry run in §8**. That sample load
is step one of the runbook, not something you do to check your own work.

Reading the source org to build the plan is not only allowed, it is the job: query the
counts, describe the objects, confirm the external ID fields exist. Every write goes into
the plan as a copy-pasteable command.

Building files **locally** — CSV templates, plan files, the runbook — is expected. The
restriction is the org.

The only exception is the user explicitly telling you, in the current message, to execute a
specific command against a named org. Never infer it from context, from earlier approval, or
from the task obviously needing it. A data load is the least reversible thing in this
toolkit; when in doubt, hand it over.

## 1. Establish the shape of the job

Ask, in one batch, whatever is not already clear:

- **Source and target** — org-to-org, workbook-to-org, production extract to sandbox?
- **Volume** per object. Under ~10k rows changes which tool is appropriate.
- **One-off or repeatable?** Repeatable means external IDs are mandatory, not optional.
- **Does the target already have this data?** Insert, upsert, or replace — and if replace,
  what happens to records that reference the old ones.
- **PII** — if production data is going to a sandbox, it needs masking. Raise this even if
  they did not ask.

## 2. Determine load order from the dependency graph

Parents before children, always. Build the order explicitly and show it — this is the part
that prevents the failed load.

For **Revenue Cloud Advanced**, the order is fixed:

```
 1 ProductCatalog
 2 ProductCategory              → catalog, parent category
 3 AttributePicklist
 4 AttributePicklistValue       → picklist
 5 AttributeCategory
 6 AttributeDefinition          → picklist
 7 ProductClassification
 8 ProductClassificationAttr    → classification, attribute, attribute category
 9 ProductSellingModel
10 Pricebook2
11 Product2                     → classification, record type, UoM
12 ProductCategoryProduct       → category, product
13 ProductSellingModelOption    → product, selling model, proration policy
14 PricebookEntry               → price book, product, selling model
15 ProductComponentGroup        → bundle product
16 ProductRelatedComponent      → bundle, group, child product *or* classification
```

`RecordType`, `UnitOfMeasure`, `ProrationPolicy`, the standard selling models and the
standard price book are referenced **by name and must already exist** — never create
duplicates of them.

Self-referencing objects (ProductCategory's parent, Account's parent, bundles containing
bundles) need **two passes**: load the records with the self-lookup blank, then update it.

## 3. Resolve relationships without ids

Never paste record ids between orgs. Use one of:

- **External ID upsert** — the correct default. Mark or create an External ID field
  (`Legacy_Id__c`, unique, external id) and upsert against it. Idempotent, so a re-run
  fixes rather than duplicates.
- **`Field:Object:ExternalKey` header syntax** — what the Revenue Cloud workbook importer
  understands, e.g. `Product2Id:Product2:ProductCode`. This is what the RCA Product Builder
  export emits.
- **`sf data export tree` / `import tree`** with a plan file — resolves references by
  reference id inside the plan. Good for small related sets (≤200 records per file), not
  for volume.

## 4. Pick the tool to match the volume

| Volume | Tool |
|--------|------|
| < 200 related records, dev seeding | `sf data export tree` / `sf data import tree` |
| Up to ~50k per object | `sf data upsert bulk` (Bulk API 2.0) |
| > 50k, or scheduled | Bulk API 2.0 with batching, or an ETL (Mulesoft, Informatica, Talend) |
| Business user, ad hoc | Data Loader GUI or Data Import Wizard |

```bash
# Extract with the lookups spelled out
sf data query -q "SELECT Id,Name,Legacy_Id__c,Account.Legacy_Id__c FROM Contact" \
  -r csv -o SOURCE > contacts.csv

# Load, idempotent
sf data upsert bulk -s Contact -f contacts.csv -i Legacy_Id__c -w 30 -o TARGET

# Watch it
sf data upsert resume -i <jobId> -o TARGET

# Small related sets
sf data export tree -q "SELECT Id,Name,(SELECT Name FROM Contacts) FROM Account" \
  -p -d ./data -o SOURCE
sf data import tree -p ./data/Account-Contact-plan.json -o TARGET
```

## 5. Turn off what will fight you — and write down how to turn it back on

Before the load, list what must be suspended and its restore step. An un-restored setting
is a worse outcome than a failed load:

- Validation rules, workflow rules, record-triggered Flows, Apex triggers that fire on
  insert (a `Data_Load__c` custom permission or a hierarchy custom setting checked by each
  automation is the clean way).
- Duplicate rules and matching rules.
- Sharing recalculation — defer with **Setup → Defer Sharing Calculations** for large loads.
- Email deliverability → set to **System email only** in a sandbox before loading, or you
  will send real email to real customers.

Also: set `Owner` explicitly if the loading user is not the intended owner, and be aware
that audit fields (`CreatedDate`, `CreatedById`) require "Set Audit Fields upon Record
Creation" to be enabled.

## 6. Produce the plan

```markdown
## Data load: <name> — <source> → <target>

**Pre-flight**
- [ ] Backup taken (`sf data export` of affected objects) — path
- [ ] Automation suspended: <list>, restore step each
- [ ] Email deliverability set to System only (sandbox)
- [ ] External ID fields exist on: <objects>

**Load order**
| # | Object | Rows | Operation | External ID | Resolves | File |

**Commands** — one per step, copy-pasteable.

**Validation after each step**
| # | Check | Expected |
e.g. `SELECT COUNT() FROM Product2 WHERE IsActive = true` → 412

**Post-load steps** — the manual things that no load performs.

**Rollback** — how to undo each step, in reverse order, and what cannot be undone.
```

## 7. Post-load steps that people forget

- **Revenue Cloud: refresh the PricebookEntry decision table.** Until this runs, products
  are invisible in Browse Catalog and prices resolve to nothing even though every record
  imported cleanly. This is the number one "the load worked but nothing shows up".
- Refresh any other Decision Tables backing Pricing Procedures.
- Re-activate the automation suspended in step 5.
- Re-run sharing recalculation if it was deferred.
- Reschedule scheduled jobs.
- Spot-check in the UI, not only in SOQL — record type, page layout and visibility problems
  do not show up in a query.

## 8. The plan always starts with a dry run

Load a 5–10 row sample of each object into the target, in order, and verify the
relationships resolved before running the full volume. Every failure found on the sample is
a failure you did not have to clean up at scale.

```bash
head -11 products.csv > products-sample.csv
sf data upsert bulk -s Product2 -f products-sample.csv -i ProductCode -w 10 -o TARGET
```

This is **step one of the runbook, handed to the operator** — not something you run to check
your own work. Write it as a step, with the query that proves the relationships resolved and
the go/no-go it feeds: if the sample fails, the full load does not start.

## 9. Guardrails to write into the plan

You are not running these, so the guardrails have to survive on the page. Put each one in
the runbook where the operator will hit it:

- **Name the target org alias in every command.** Never leave `-o <alias>` as a placeholder
  in a step that writes — an unqualified command run against the wrong org is the failure
  this whole skill exists to prevent.
- **Flag production explicitly.** If any step targets production, mark it, and say what
  confirmation the operator should have before running it.
- **`sf data delete bulk` is irreversible.** Any delete step carries the record count it
  will remove and the backup command that must have run first, as its own numbered step.
- **Tell them what to check after each step**, not just at the end: the query and the number
  it should return. `sf data upsert resume` reports success and failure counts, and the
  failure CSV names the row and the reason — say so in the step, because an operator
  watching only for a green exit code will miss a partial load.
- **Say what a bad result looks like** and what to do about it. A runbook that only
  describes the happy path leaves the person holding it with no decision to make when
  step 4 fails.

Related: the **RCA Product Builder** exports a workbook already in this load order,
`/sf-tdd` documents the deployment plan, `/sf-ticket-solution` when the data issue is
really a config issue.
