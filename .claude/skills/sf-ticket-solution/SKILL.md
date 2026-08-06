---
name: sf-ticket-solution
description: Turn a Revenue Cloud Advanced ticket into a Jira-ready technical solution a developer can follow step by step — covering the product catalog, Context Definitions, Pricing Procedures, qualification and disqualification rules, configuration rules, decision tables, and quote/order/asset lifecycle. Use whenever the user pastes an RCA/RLM ticket, asks "how would we solve this", "why is this product not showing", "why is the price wrong", "estimate this", or names a Jira/ADO issue about Revenue Cloud, pricing, quoting, catalog or the configurator.
---

# RCA ticket → technical solution

The deliverable is **a Jira ticket body the developer can paste and work from without
asking you anything**. Not an essay, not a menu of options: a decision, then numbered
steps with real names, real Setup paths and real values.

## Read-only: plan the change, never make it

**You do not modify the org.** Not the data, not the metadata, not a setting. You produce
the plan; a person executes it.

Use freely — these only read:
`sf org list` · `sf org display` · `sf data query` · `sf sobject describe` ·
`sf sobject list` · `sf project retrieve start`

Never run: `sf data create/update/upsert/delete/import`, `sf project deploy start` (including
`--dry-run`, which still registers a deployment), `sf apex run`, or anything that activates a
version, refreshes a decision table, or edits a record or a setting in Setup.

Every change goes in the ticket as a copy-pasteable command or a numbered Setup step, so the
person running it reads it before it happens. If you find yourself wanting to run a write to
"just check", stop and say what you would run and what you expect back — that belongs in the
ticket anyway.

The only exception is the user explicitly telling you, in the current message, to execute a
specific command against a named org. Never infer that instruction from context, from
earlier approval, or from the task seeming to call for it.

## Read the references before you design

Do not answer RCA questions from memory. These files ship with the skill:

| File | Read it when |
|------|--------------|
| `references/rca-domain-map.md` | Always. The subsystems, their objects, and how a request flows through them. |
| `references/rca-failure-modes.md` | Any bug or "it doesn't show / the price is wrong" ticket. Symptom → cause → the query that confirms it. |
| `references/jira-ticket-template.md` | Always, when writing the output. |
| `references/rca-docs.md` | When you need the authoritative detail — a field list, an API shape, a release-specific name. Contains the official URLs to `WebFetch`. |

The domain map marks names as **verified** or **⚠︎ verify**. Anything marked ⚠︎ must be
checked against the org or the docs before it goes in a ticket — a developer who follows an
invented API name loses an afternoon and stops trusting the next ticket.

## 1. Triage: which subsystem is this?

Almost every RCA ticket lands in one of these. Name it explicitly before designing —
solving a pricing ticket with a catalog change is the classic wasted sprint.

| Symptom | Subsystem | Where the answer usually is |
|---------|-----------|-----------------------------|
| Product missing from Browse Catalog | **Catalog / discovery** | The five visibility conditions + decision table refresh |
| Product visible to the wrong accounts | **Qualification** | `ProductQualification` / `ProductDisqualification` + the qualification rule procedure |
| Price wrong, blank, or not recalculating | **Pricing** | Pricing Procedure element sequence, decision tables, price waterfall |
| A field is not reaching the pricing or rule engine | **Context Service** | Context Definition node/attribute + mapping, and its **version** |
| Configurator allows/blocks the wrong thing | **Configuration rules** | `ProductConfigurationRule` (validation / exclusion / inclusion), auto-add |
| Bundle structure or attribute behaviour | **Catalog modelling** | `ProductComponentGroup`, `ProductRelatedComponent`, `ProductClassificationAttr` |
| Amendment, renewal or cancellation wrong | **Asset lifecycle** | Selling model term, proration policy, `AssetStatePeriod` |
| Data loaded but nothing works | **Data / activation** | Load order, external IDs, and the post-load refresh steps |

If the ticket spans two, say so and solve the upstream one first — a pricing bug caused by
a missing context attribute is a Context Service ticket, not a pricing ticket.

## 2. Ground it in the org

Never design against an imagined schema. RCA config lives in records, not just metadata, so
SOQL is the fastest way to see the truth:

```bash
sf org list

# Catalog + visibility for one product
sf data query -o <alias> -q "SELECT Id,Name,ProductCode,IsActive,Type,ProductClassificationId \
  FROM Product2 WHERE ProductCode = '<code>'"
sf data query -o <alias> -q "SELECT ProductId,ProductCategoryId FROM ProductCategoryProduct \
  WHERE Product.ProductCode = '<code>'"
sf data query -o <alias> -q "SELECT Id,ProductSellingModelId,ProductId FROM ProductSellingModelOption \
  WHERE Product.ProductCode = '<code>'"
sf data query -o <alias> -q "SELECT Id,UnitPrice,IsActive,Pricebook2Id,ProductSellingModelId \
  FROM PricebookEntry WHERE Product2.ProductCode = '<code>'"

# Rules
sf data query -o <alias> -q "SELECT Id,ProductId,IsQualified,EffectiveFromDate,EffectiveToDate \
  FROM ProductQualification"
sf data query -o <alias> -q "SELECT Id,ProductId,IsDisqualified,Reason FROM ProductDisqualification"
sf data query -o <alias> -q "SELECT Id,Name,Type FROM ProductConfigurationRule"

# Engine config — check what actually exists before naming it in a ticket
sf data query -o <alias> -q "SELECT Id,Name,UsageType FROM ExpressionSet"
sf data query -o <alias> -q "SELECT Id,Name FROM ContextDefinition"
```

Metadata for the same things:

```bash
sf project retrieve start -o <alias> -m "ExpressionSet:<name>" -m "ContextDefinition:<name>"
```

State in the ticket **which source you used**. If no org is connected, say so in one line
at the top of the output and mark every name `(unverified)` — do not quietly guess.

## 3. Choose the mechanism — the RCA ladder

RCA has its own extension points, and reaching for Apex too early is the most expensive
mistake in this product. Stop at the first rung that genuinely satisfies the requirement:

1. **Catalog data** — an attribute, a classification, a component group, a selling model.
   Most "we need logic" turns out to be modelling.
2. **Decision table** — any rule that is really a lookup table of conditions → outcome.
   Business can maintain the rows; no deployment to change a rate.
3. **Expression set** — pricing procedure element, qualification rule procedure,
   configuration rule. Declarative, versioned, testable in the UI.
4. **Context Definition change** — when the engine simply cannot see the field it needs.
   Remember this is versioned: a new version must be activated and mappings re-checked.
5. **Flow** — orchestration around the transaction (approvals, notifications, downstream
   records). Not for pricing math.
6. **Apex / custom pricing element** — callouts, algorithms the expression set cannot
   express, integration with an external rating engine.

**Never trigger on managed RCA transaction objects to change pricing.** Extend through the
pricing procedure. Automation that fights the engine loses on the next recalculation.

State the rung you chose **and the rung below it you rejected, with the reason**. One line.
That is the part an architect reads.

## 4. Write the Jira ticket

Use `references/jira-ticket-template.md`. Non-negotiables:

- **Output the whole ticket inside one fenced code block** so the user copies it in one
  gesture. Markdown by default — Jira Cloud's editor converts it on paste. If the user says
  their Jira uses wiki markup, switch to `h2.` / `*bold*` / `{code}` / `||header||`.
- **Every step is an instruction, not a description.** "Add a Volume Discount element after
  the List Price element in the `RCA_Standard_Pricing` procedure" — not "volume discounting
  should be considered".
- **Setup navigation paths in full**: `Setup → Revenue Settings → Context Definitions →
  Sales Transaction Context → New Version`. A developer new to RCA cannot find these, and
  they are the single biggest time sink in these tickets.
- **Exact values in a table** — field API name, value, and why. If you do not know a value,
  put `<TBD — confirm with …>` rather than inventing one.
- **The activation and refresh steps are steps**, numbered like the rest. Activating an
  expression set version, refreshing a decision table, refreshing the PricebookEntry
  decision table after a catalog change — these are where tickets get reopened.
- **Acceptance criteria are testable by someone other than the author**, phrased
  given/when/then, with the record or account to test on.
- **Estimate** in the ticket, split build / test / deploy, with the assumptions it rests on.

## 5. Quality bar

Before you hand it over, check every one of these:

- [ ] The subsystem is named, and the upstream cause is the one being solved.
- [ ] Every API name is verified against the org or the docs, or explicitly marked unverified.
- [ ] The chosen rung of the ladder names the rejected one.
- [ ] Steps include activation / refresh / republish, not just the edit.
- [ ] Acceptance criteria include a negative case ("account outside the segment does **not**
      see the product").
- [ ] Impact on **existing quotes and assets** is stated — a pricing change that only
      applies to new quotes needs saying, and an amendment path needs testing.
- [ ] Deployment notes say which parts are metadata (deployable) and which are records
      (data load or manual), because in RCA that split is rarely obvious.
- [ ] Rollback is one line and is true.

Related: `/sf-tdd` when this needs a full design document, `/sf-flow-design` when the answer
is orchestration, `/sf-data-deploy` when it needs a catalog or rule data load.
