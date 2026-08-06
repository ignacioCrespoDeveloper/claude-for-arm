# Jira output format

The developer reading this has the ticket and an org. Nothing else. Every question they
could need to ask you must already be answered here.

**Emit the whole ticket inside one fenced code block** so it can be copied in one gesture.
Markdown by default — Jira Cloud converts it on paste. If the org uses wiki markup, switch
to `h2.` / `*bold*` / `{code}` / `||header||header||`.

Put anything you are unsure about in **Open questions**, never inline as a hedge. A step
that says "you may need to…" is not an instruction.

---

## Template

````markdown
## <Verb the outcome — "Restrict Enterprise Support to EMEA accounts">

**Type** Bug | Story | Task  · **Component** RCA – <subsystem> · **Estimate** <S/M/L, Xh>

### Context
2–4 sentences. What is happening today, for whom, and why it matters. Link the source
ticket or conversation. If this is a bug, the reproduction goes here — org, user, record,
exact steps.

### Root cause  *(bugs only)*
The mechanism, in one or two sentences, plus the evidence that proves it — the query you
ran and what it returned. Not a hypothesis.

### Approach
The chosen mechanism in one sentence.
**Rejected:** <the next-simplest option> — <why it does not work here>.

### Implementation

1. **<Imperative step>**
   `Setup → <full navigation path>`
   Exactly what to create/change, with names and values.
2. …
N. **Activate / refresh** — the version to activate, the decision table to refresh.
   Never leave this implied.

### Configuration values

| Object / component | Field | Value | Note |
|---|---|---|---|

Use `<TBD — confirm with X>` for anything genuinely unknown. Never invent a value.

### Deployment

| Part | How it moves |
|---|---|
| Metadata | <expression sets, context definitions, flows> — `sf project deploy start …` |
| Data | <rule records, price records> — data load, see /sf-data-deploy |
| Manual | <activations, decision table refreshes, settings> — must be done by hand in each org |

### Acceptance criteria

- [ ] **Given** <state> **when** <action> **then** <observable result>
- [ ] Negative: **given** <the excluded case> **then** <it does not happen>
- [ ] Existing records: <what happens to in-flight quotes/orders/assets>

### Impact on existing data
Whether current quotes, orders and assets change, and what must be re-priced or fixed.
Say "none" explicitly if none.

### Rollback
One line, and true.

### Open questions
- <question> — @<who can answer>
````

---

## Worked example

The register to aim for. Note that every step names a path, a record and a value, and that
the refresh is step 5 rather than an afterthought.

````markdown
## Restrict Enterprise Support Plan to EMEA accounts in Browse Catalog

**Type** Story · **Component** RCA – Qualification · **Estimate** M, 6h (4 build / 1.5 test / 0.5 deploy)

### Context
Reps in NA and APAC can add "Enterprise Support Plan" (`ENT-SUP-01`) to quotes, but the plan
is only sold in EMEA. Legal has asked for it to be unselectable rather than corrected at
approval. Raised in ARM-1423.

### Approach
Add a disqualification rule keyed on the account's billing region, evaluated by the existing
product qualification procedure.
**Rejected:** removing the product from the shared catalog category — it would hide the plan
from EMEA reps too, and a region-specific catalog means maintaining two category trees.

### Implementation

1. **Confirm the region attribute reaches product discovery.**
   `Setup → Revenue Settings → Context Definitions → Product Discovery Context`
   Check that `Account.BillingCountry` is mapped. If not, create a new version, add the
   attribute, map it, and **activate** the version.
2. **Create the disqualification record.**
   Object `ProductDisqualification`, one record:
   `ProductId` = `ENT-SUP-01`, `IsDisqualified` = true,
   `Reason` = "Sold in EMEA only", `EffectiveFromDate` = go-live date, `EffectiveToDate` = blank.
3. **Add the region criterion to the disqualification decision table.**
   `Setup → Decision Tables → Product Disqualification Entries`
   Add an input column on the billing-country attribute with operator `NOT IN`, value list
   `<EMEA country codes — see Configuration values>`.
4. **Verify the qualification procedure includes the evaluation.**
   The `ExpressionSet` with Usage Type `Product Qualification` must contain an
   `EvaluateDisqualification` element pointing at the table from step 3. Add it if absent,
   then activate the new version.
5. **Refresh the decision table.** Without this the rule does not take effect, and no error
   is raised.

### Configuration values

| Object / component | Field | Value | Note |
|---|---|---|---|
| ProductDisqualification | ProductId | ENT-SUP-01 | |
| ProductDisqualification | IsDisqualified | true | |
| ProductDisqualification | Reason | Sold in EMEA only | Shown to the rep |
| Decision table column | Operator | NOT IN | |
| Decision table column | Values | `<TBD — confirm EMEA country list with Legal>` | Blocking for step 3 |

### Deployment

| Part | How it moves |
|---|---|
| Metadata | Context Definition version, ExpressionSet version, decision table definition — `sf project deploy start` |
| Data | The `ProductDisqualification` record — load per org |
| Manual | Activate both versions; refresh the decision table in every org |

### Acceptance criteria

- [ ] Given a rep on an account with `BillingCountry = Germany`, when they browse the
      catalog, then `ENT-SUP-01` is selectable.
- [ ] Given a rep on an account with `BillingCountry = United States`, when they browse the
      catalog, then `ENT-SUP-01` is not shown, with reason "Sold in EMEA only".
- [ ] Given an account with no billing country, then `ENT-SUP-01` is not shown (fail closed).
- [ ] Existing quotes already containing `ENT-SUP-01` still price and submit unchanged.

### Impact on existing data
None. Disqualification applies at discovery, so quotes that already contain the product are
untouched. Confirmed with Sales Ops that no clean-up of open NA quotes is wanted.

### Rollback
Set `IsDisqualified = false` on the record from step 2 and refresh the decision table.

### Open questions
- Exact EMEA country list — @legal-ops
- Should APAC follow in the same rule, or a separate one? — @product-owner
````

---

## Rules the example demonstrates

- **Steps are imperative and complete.** "Create a record on `ProductDisqualification` with
  these values", not "a disqualification rule will be needed".
- **Setup paths in full.** A developer new to RCA cannot find Context Definitions or
  Decision Tables from a description, and searching for them costs more than the build.
- **Activation and refresh are numbered steps.** In RCA they are the difference between a
  working ticket and a reopened one.
- **The unknown is marked and assigned**, not smoothed over. `<TBD>` in the values table and
  a named owner in Open questions.
- **Fail-closed behaviour is an acceptance criterion**, because null region is exactly the
  case UAT finds and the ticket did not consider.
- **Impact on existing data is stated even when it is "none"** — the reviewer needs to know
  it was considered, not skipped.
