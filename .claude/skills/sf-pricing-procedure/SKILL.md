---
name: sf-pricing-procedure
description: Read an existing Salesforce Revenue Cloud pricing procedure and explain what it actually does element by element, then say exactly what to add — which element, where in the sequence, with what config — to achieve a pricing outcome. Use when the user asks to explain, review, document, extend or change a pricing procedure, asks "how do I add a volume discount / attribute pricing / rounding / a discount cap", asks why a price came out the way it did, or names an expression set used for pricing.
---

# Pricing procedures — read one, then change it

Three things this does. Work out which is being asked before starting, and say which one
you are doing:

| Ask | Mode |
|-----|------|
| "What does this procedure do?" / "document it" | **Explain** — §2 |
| "How do I add X?" / "I want prices to do Y" | **Extend** — §3 |
| "Why is this line priced at £X?" | **Trace** — §4 |

Read `references/pricing-elements.md` before answering anything. There are fifteen element
types and choosing the wrong one is the usual reason a pricing change half-works.

## 1. Get the real procedure out of the org first

Never explain a procedure from its name. Pull it:

```bash
# What exists, and which is active
sf data query -o <alias> -q "SELECT Id,Name,UsageType,Status FROM ExpressionSet"

# The procedure itself — BOTH types, the definition is a shell without its version
sf project retrieve start -o <alias> \
  -m "ExpressionSetDefinition:<name>" \
  -m "ExpressionSetDefinitionVersion:<name>"
```

Retrieved XML lands under `force-app/main/default/expressionSetDefinitions/` ⚠︎ *(path
varies by release — check what actually appeared)*.

**Known trap:** the CLI has documented failures retrieving and deploying
`ExpressionSetDefinitionVersion` and `DecisionMatrixDefinitionVersion`. If it errors, do not
improvise — say so, and fall back to reading the procedure in Setup (`Setup → Pricing
Procedures`) or moving it by change set. A pricing procedure that half-deploys is worse than
one that did not deploy.

Also pull what the procedure depends on, because the elements reference these rather than
fields directly:

```bash
sf data query -o <alias> -q "SELECT Id,Name FROM ContextDefinition"
```

Elements reference **context tags** (e.g. `InputUnitPrice`), not `QuoteLineItem.UnitPrice`.
The tag→field mapping lives in the context definition, and a tag that maps to nothing is
silently null. When a procedure reads correctly but produces nothing, check there first.

And check the org-level switches in `Setup → Salesforce Pricing Setup`, since several change
what a procedure appears to do: which **Pricing Recipe** and **Pricing Procedure** are
selected, whether **Price Waterfall** is on, **Price Tracking History**, **proration
settings**, **Price Logs Capture**, and **Parallel Execution**.

## 2. Explain mode

Produce a walkthrough someone can hand to a new team member. Not a list of element names —
what each one *does to the price*.

```markdown
## <Procedure name>  ·  <active version>  ·  usage: Pricing

**In one line:** what a quote line goes through, start to finish.

**Sequence**
| # | Element | Type | Reads | Writes | Backed by |
|---|---------|------|-------|--------|-----------|
| 1 | Initialise | Pricing Setting | — | — | — |
| 2 | Get list price | List Price | Product, PriceBook, Selling Model, Quantity | ListPrice, NetTotalPrice | PricebookEntry decision table |
| … |

**Worked example** — one product, one quantity, the number after each element:
`List 100.00 → volume −10% 90.00 → attribute +15.00 105.00 → round 104.99`

**Decision tables it depends on** — name, source object, who maintains the rows, and the
fact that each needs refreshing after a change.

**Context tags it reads** — tag, mapped field, and any that resolve to null today.

**What this procedure does NOT do** — the elements a reader might assume are there and
are not. This section is the one that prevents the next bug.
```

Always include the worked example with real numbers. It is the fastest way for a reviewer
to spot that two elements are in the wrong order.

## 3. Extend mode — "how do I achieve X"

`references/recipes.md` maps goals to elements. Follow it rather than inventing a design.

The answer must always contain these five things:

1. **Which element**, named exactly as it appears in the Add Element menu.
2. **Where in the sequence**, and *why there* — before or after which existing element.
   Order is the design: a percentage discount applied before an override lands on a
   different base than after it.
3. **What backs it** — the decision table or matrix, its source object, its columns, and who
   maintains the rows. If the requirement changes quarterly, it belongs in a table, not in
   the procedure.
4. **What must exist first** — a context tag mapped to a real field, an attribute flagged
   **Is Price Impacting**, a `PriceAdjustmentTier` set, a product field.
5. **Activate and refresh** — a new expression set version must be activated, and every
   decision table refreshed after its rows change. Neither raises an error when skipped;
   both are why "I added the element and nothing happened".

Then give the verification: one concrete quote line, the expected waterfall before and
after, and the negative case (the line that should *not* be affected).

Output shape:

```markdown
## Goal: <what the business asked for>

**Add** <element> at position <n>, after <element> and before <element>.
**Because** <one line — why this element and this position>.

**Prerequisites**
- [ ] …

**Steps**
1. `Setup → …` …
N. Activate the new version, then refresh <table>.

**Config**
| Setting | Value |

**Verify**
| Line | Before | After |
Negative case: …

**Rollback** — deactivate the new version; the previous one resumes.
```

If the goal cannot be met with a standard element, say so plainly and give the two real
options: a **Price Adjustment Matrix** over a custom decision table, or Apex through the
procedure plan definition — noting that Apex means the class must be migrated with the
procedure.

## 4. Trace mode

Ask for the **price waterfall** of one specific quote line before theorising. It records
each element's contribution and is the whole point of the architecture.

If the waterfall is empty, check whether it is switched off in `Setup → Salesforce Pricing
Setup` before treating it as a bug — and say that is what you found.

Then read the waterfall against the element sequence and name the element that produced the
wrong number. "The 15% came from Attribute-Based Price, not from the manual discount" is the
finding; everything else is commentary.

## 5. Rules that hold in every mode

- **Never invent an element name.** The set is in `references/pricing-elements.md`;
  availability varies by release, so if the org's Add Element menu disagrees, the org wins
  and the reference file should be corrected.
- **A Pricing Setting element is the first element.** A procedure without one is a finding.
- **Elements read tags, not fields.** Any answer that names a field must also name the tag
  and confirm it is mapped.
- **Decision tables are the maintainable surface.** Push anything the business will change
  into a table, and say who owns the rows.
- **State the deployment split.** Metadata (`ExpressionSetDefinition` +
  `ExpressionSetDefinitionVersion`, decision matrix definitions and their versions) vs.
  records (the rows) vs. manual (activation, refreshes, Salesforce Pricing Setup toggles).
- **Existing quotes do not re-price themselves.** Say what happens to in-flight quotes and
  whether a re-price is needed.

Related: `/sf-ticket-solution` when the pricing question arrived as a ticket and needs a Jira
write-up, `/sf-data-deploy` for loading decision table rows, `/sf-tdd` when the change is
big enough to need a design document.
