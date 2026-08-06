# Recipes — goal → element, position, prerequisites

Find the goal, then follow the row. Every recipe assumes the procedure already starts with
**Pricing Setting** then **List Price**; positions are relative to those.

Each one still needs the two steps that no recipe can skip: **activate the new expression
set version**, and **refresh any decision table whose rows you touched**.

---

## Quantity

### "Buy more, pay less — the better rate applies to everything"
**Volume Discount**, straight after List Price.

- Backed by: Volume Discount Entries decision table over `PriceAdjustmentTier`
- Rows: lower bound, upper bound, adjustment (% or amount) — business-maintainable
- Ask first, in words: *"at 150 units, does the 100+ rate apply to all 150?"* If yes, this
  element. If no, the next one.
- Verify: 99 units (no discount), 100 (banded), 150 (still the 100+ rate)

### "Each band is priced at its own rate"
**Tier Discount**, same position.

- Backed by: Tiered Adjustment Entries
- Verify: 150 units should cost *more* per unit in total than the flat-band version — if the
  two produce the same number, the wrong element is in place

---

## Who the customer is

### "Gold accounts get 15% off" / "EMEA has different rates"
**Price Adjustment Matrix**, after the quantity elements.

- Backed by: a custom decision table keyed on the account attribute
- **Prerequisite:** the attribute must reach the engine — a context tag mapped to the field
  (e.g. `Account.Customer_Tier__c`), on an **activated** context version. Unmapped tags
  resolve to null and the row never matches, with no error.
- Verify: one account in the segment, one outside, one with the field empty. The empty case
  is the one UAT finds.

### "This customer has a negotiated price"
Contract pricing entries ⚠︎ — check what the org's Add Element menu offers before designing.
If contract pricing is not available, a **Price Adjustment Matrix** keyed on account +
product is the workable equivalent.

- Position: after list price, before general discounts, so the negotiated number is the base
  the rest works from — unless the business means it to be final, in which case place it
  last and say so explicitly

---

## What the product is

### "Price depends on a product attribute" (storage size, colour, tier)
**Attribute-Based Price**, after the quantity elements.

- **Prerequisite:** flag the attribute **Is Price Impacting**. Without it the attribute does
  not even appear in the element.
- Backed by: Attribute Discount Entries
- Verify: two lines of the same product differing only in that attribute

### "Components are cheaper inside this bundle"
**Bundle-Based Price**, after Attribute-Based Price.

- Backed by: Bundle Based Adjustment Entries
- **Prerequisite:** the component must be independently priced —
  `DoesBundlePriceIncludeChild = false`, with its own selling model option and price entry.
  A child with no price of its own has nothing for this element to adjust.

### "This accessory is always 20% of the device"
**Derived Price**, after the product-level elements.

- Verify: change the parent's price and confirm the accessory follows

---

## What the rep does

### "Reps can discount, but not below a floor"
**Manual Discount**, then **Discount Distribution Service**.

- Position matters: after the automatic discounts if rep discount stacks on the already
  discounted price; before them if it should apply to list. Ask which, and write the answer
  into the ticket — it is the most common source of "the maths is wrong".
- The floor lives in Discount Distribution Service; approval routing does **not** belong in
  the procedure — that is a Flow on the quote.

### "Give 10% off the whole deal"
**Discount Distribution Service** near the end, before Rounding.

- Allocates across lines rather than requiring a per-line edit
- Verify: the sum of line discounts equals the deal discount, and no line breaches its floor

---

## Term and time

### "Subscriptions price by term"
**Subscription Pricing**, after the discount elements.

### "Partial periods should be prorated"
**Proration**, immediately after Subscription Pricing.

- Driven by the proration policy on `ProductSellingModelOption` and the proration settings in
  `Setup → Salesforce Pricing Setup`
- Verify: a mid-month start date, a co-term amendment, and a full period as the control

### "Rates follow an index"
Index Rate decision table ⚠︎ — confirm availability in the org first.

---

## Shape of the number

### "Prices should end in .99" / "round to the nearest 5"
**Rounding Values**, **last**.

- Anything placed after it undoes it. If a price is coming out unrounded, look for an
  element below it before looking at the rounding config.

### "Track the min and max price we sold at"
**Price Tracking**, at the end.

- Requires **Price Tracking History** enabled in Salesforce Pricing Setup

### "Total across a group of lines"
**Aggregate Price** — SUM / AVG / MAX / MIN across products, before Rounding.

---

## Arithmetic the elements do not cover

**Formula Based Pricing**, positioned wherever the inputs it needs are already computed.

- Legitimate: arithmetic over values already in the context
- Not legitimate: re-implementing a lookup table. If the business will change the numbers,
  it belongs in a decision table so they can change them without a deployment.

---

## Nothing fits

Two real options, in this order:

1. **Price Adjustment Matrix over a custom decision table.** Any combination of inputs → an
   adjustment. Declarative, versioned, business-maintainable. Try to make the requirement
   fit this before considering the next one.
2. **Apex, via the procedure plan definition.** Needed for external rating engines, callouts,
   or algorithms an expression set cannot express. Note in any plan that **the Apex class
   must be migrated with the procedure** — it is a separate deployable, and forgetting it is
   why the procedure works in one org and not the next.

---

## Before calling any of these done

- [ ] New expression set **version activated**
- [ ] Every touched **decision table refreshed**
- [ ] Context tag exists, is **mapped**, and its context version is active
- [ ] Element sits at the position you intended relative to its neighbours — confirmed by a
      worked example with real numbers, not by reading the list
- [ ] Negative case tested: the line that should **not** be affected
- [ ] Stated what happens to **existing quotes** — they do not re-price themselves
- [ ] Deployment split written down: metadata (`ExpressionSetDefinition` +
      `ExpressionSetDefinitionVersion`, decision matrix definitions + versions) vs. rows vs.
      manual steps (activation, refresh, Pricing Setup toggles)
