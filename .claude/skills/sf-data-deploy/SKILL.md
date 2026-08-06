---
name: sf-data-deploy
description: Plan and execute a Salesforce data load or migration — object order, external IDs, CSV/plan templates, sf CLI or Data Loader commands, validation and rollback. Use when the user asks to load, migrate, seed, export or fix data between orgs, or to deploy a Revenue Cloud catalog into an org.
---

# Salesforce data deployment & migration

Data loads fail on relationships and on order, almost never on the data itself. The plan is
the deliverable; the commands are the easy part.

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

## 8. Always dry-run first

Load a 5–10 row sample of each object into the target, in order, and verify the
relationships resolved before running the full volume. Every failure found on the sample is
a failure you did not have to clean up at scale.

```bash
head -11 products.csv > products-sample.csv
sf data upsert bulk -s Product2 -f products-sample.csv -i ProductCode -w 10 -o TARGET
```

Then check the results file the CLI writes — `sf data upsert resume` reports both success
and failure counts, and the failure CSV names the row and the reason.

## 9. Guardrails

- Confirm the **target org alias** out loud before any write command, and never run a load
  or a delete against production without the user explicitly confirming that org.
- `sf data delete bulk` is irreversible — require an explicit confirmation and a backup
  first, and quote back the record count that will be deleted.
- Report load results honestly: rows attempted, succeeded, failed, and the actual error
  text from the failure file. Never report a load as clean without reading the results.

Related: the **RCA Product Builder** exports a workbook already in this load order,
`/sf-tdd` documents the deployment plan, `/sf-ticket-solution` when the data issue is
really a config issue.
