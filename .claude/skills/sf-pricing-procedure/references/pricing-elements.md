# Pricing procedure elements

A pricing procedure is an **ExpressionSet** — an ordered stack of elements. Each reads the
sales transaction context, adjusts the running price, and records its contribution in the
**price waterfall**.

Marked **✓** where confirmed against the Revenue Cloud Developer Guide or a published
walkthrough, **⚠︎** where the name or availability varies by release. Availability also
varies by licence: **the Add Element menu in the org is the authority.** If it disagrees
with this file, the org is right — fix this file.

---

## The order that pricing runs in

```
Pricing Setting            ← required, first
   ↓
List Price                 ← seeds from PricebookEntry
   ↓
Volume Discount / Tier Discount        ← quantity-driven
   ↓
Attribute-Based Price / Bundle-Based Price   ← what the product is
   ↓
Price Adjustment Matrix / Derived Price      ← everything else
   ↓
Manual Discount            ← what the rep typed
   ↓
Subscription Pricing → Proration            ← term maths
   ↓
Aggregate Price / Discount Distribution     ← across lines
   ↓
Rounding Values            ← last, always
   ↓
Price Tracking             ← records min/max
```

**Order is the design, not a formality.** A percentage discount before an override applies
to a different base than after it. Rounding anywhere but last gets undone by whatever
follows. When a price is wrong, check the sequence before checking the rates.

---

## The elements

### Pricing Setting ✓
Initialises the pricing framework. **Required, and first.** No inputs, no output of its own.
A procedure without one is a finding — report it.

### List Price ✓
Seeds the price from `PricebookEntry`.

- **Reads:** Product, Price Book, Product Selling Model, Quantity
- **Writes:** `ListPrice`, and the `NetTotalPrice` subtotal
- **Backed by:** the Price Book Entries decision table — which is why a catalog load needs
  that table refreshed before anything prices at all
- **Gotcha:** the entry must match the *selling model* on the line, not just the product.
  Right product + wrong term = no price.

### Volume Discount ✓
Quantity bands, one rate applied to the whole quantity. 150 units at the 100+ rate means all
150 get that rate.

- **Backed by:** Volume Discount Entries decision table over `PriceAdjustmentTier` ⚠︎
- **Rows are business-maintainable** — this is the right home for rates that change

### Tier Discount ✓ *(also seen as Tiered Adjustment)*
Same shape as Volume Discount, but **each band is priced separately** — true tiering. 150
units = first 100 at one rate, next 50 at another.

- **Backed by:** Tiered Adjustment Entries decision table
- **The most common modelling mistake in RCA pricing** is using one of these when the
  business meant the other. Ask which, in words, before building: *"does the better rate
  apply to every unit, or only to the units above the threshold?"*

### Attribute-Based Price ✓
Adjusts by product attribute value — override, percentage or amount.

- **Prerequisite:** the attribute must be flagged **Is Price Impacting** ✓, or it will not be
  offered in the element at all
- **Backed by:** Attribute Discount Entries decision table
- **Also needs:** the attribute reaching the engine — a context tag mapped to it

### Bundle-Based Price ✓
Adjusts a component's price because of the bundle it sits in.

- **Backed by:** Bundle Based Adjustment Entries decision table
- **Interacts with** `DoesBundlePriceIncludeChild`: a child priced independently needs its
  own selling model option and price entry before this can act on it

### Formula Based Pricing ✓
Runs functions and calculations inside the element to produce a price. The escape hatch that
is still declarative.

- Use when the maths is arithmetic over values already in the context
- Do **not** use it to re-implement a lookup — that is a decision table, which the business
  can maintain without a deployment

### Manual Discount ✓
Applies what the rep typed on the quote line — value or percentage.

- Place it deliberately relative to automatic discounts; that placement decides whether a
  rep's 10% stacks on top of the volume discount or replaces its base
- Pair with **Discount Distribution Service** if a floor must be enforced

### Subscription Pricing ✓
Multiplies the periodic price by the term count for subscription selling models.

### Proration ✓
Adjusts a subscription for a partial period. Works **with** Subscription Pricing, after it.

- Driven by the proration policy on `ProductSellingModelOption`, plus the proration settings
  in `Setup → Salesforce Pricing Setup` ✓
- Amendment and co-term maths lands here — most "the amendment price is wrong" tickets are
  this element or its policy, not the quote logic

### Price Adjustment Matrix ✓
Adjustment driven by a **custom decision table** you define. The general-purpose answer when
no standard element fits: any combination of inputs → an adjustment.

- Reach for this before reaching for Apex

### Derived Price ✓
Calculates a price from another pricing source — another product, another line.

- Useful for "this accessory is always 20% of the device it attaches to"

### Price Tracking ✓
Captures minimum and maximum price ranges for the line.

- Backed by Product Price Range Entries ⚠︎; feeds guardrails and approval thresholds
- Requires **Price Tracking History** enabled in Salesforce Pricing Setup

### Rounding Values ✓
Applies rounding rules. **Always last** — anything after it undoes it.

### Aggregate Price ✓
SUM / AVG / MAX / MIN across a group of products. Operates across lines rather than on one.

### Discount Distribution Service ✓
Allocates a discount across multiple lines, respecting floor limits. The element for
"give 10% off the whole deal" without hand-editing every line.

---

## Decision tables behind the elements ✓

Deployment-relevant names seen in the pricing metadata:

Asset Action Source Entries (V1/V2) · Attribute Discount Entries · Bundle Based Adjustment
Entries · Contract Pricing (Adjustment Tiers, Entries, Volume Tiers V1/V2) · Derived Pricing
Entries · Index Rate · Price Book Entries (V1/V2) · Pricebook Rate Card Entries · Product
Price Range Entries (V1/V2) · Tiered Adjustment Entries · Volume Discount Entries

Two facts that matter every time:

1. **Rows are data, the table is metadata.** Moving a procedure between orgs moves the
   table; it does not move the rates. Split them in any deployment plan.
2. **Every table needs refreshing after its rows change.** No error is raised when it is
   skipped — the old numbers simply keep being used.

## Context tags, not fields ✓

Elements reference **tags** defined in the sales transaction context definition
(`RevSalesTransactionContext` in the standard setup), which map to object fields. So:

- `InputUnitPrice` → `QuoteLineItem.UnitPrice`
- A tag mapped to nothing resolves to null, silently
- A custom field must be added to the context **and** mapped **and** the version activated
  before any element can read it

A common pattern worth recognising in an existing procedure: a **List Operation** filtering
for lines where `InputUnitPrice` is null, feeding an **Assignment** that sets it to
`ListPrice` — that is "use the rep's price if they typed one, otherwise the list price". ✓

## Org-level switches that change what a procedure appears to do ✓

`Setup → Salesforce Pricing Setup`: Pricing Recipe · Pricing Procedure · Price Waterfall
on/off · Price Tracking History · Proration Settings (Evergreen / One-Time) · Price Logs
Capture · Parallel Execution.

Permission sets: Salesforce Pricing Admin · Design Time User · Manager · Run Time User ✓ —
a user missing Run Time User sees no prices at all, which reads like a broken procedure.

## Sources

- Salesforce Pricing overview — https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/pricing_overview.htm
- Pricing metadata for deployment — https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/deployment_salesforce_pricing_metadata.htm
- Price Context API — https://developer.salesforce.com/docs/atlas.en-us.revenue_lifecycle_management_dev_guide.meta/revenue_lifecycle_management_dev_guide/connect_resources_price_context.htm
- Pricing architecture, element list — https://revenuecloud.info/architecture-1/
- List price / sales price walkthrough — https://revenuecloud.info/unpacking-the-revenue-cloud-pricing-procedure-part-1-list-price-and-sales-price/
