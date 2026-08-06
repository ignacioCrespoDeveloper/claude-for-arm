# Revenue Cloud Advanced — domain map

The subsystems, what lives in each, and how a request flows through them.

**Confidence markers.** Names are marked **✓** when confirmed against the Revenue Cloud
Developer Guide, and **⚠︎** when they vary by release, by org, or were not confirmed. Never
put a ⚠︎ name in a ticket without checking it first — see `rca-docs.md` for the pages to
`WebFetch`, or query the org.

RCA is also called RLM (Revenue Lifecycle Management) and, in newer material, Agentforce
Revenue Management. Same product; the docs URL still says `revenue_lifecycle_management`.

---

## The flow a quote actually takes

```
Rep opens Browse Catalog
   │
   ├─ 1. DISCOVERY ─ which products exist and are published?
   │      ProductCatalog → ProductCategory → ProductCategoryProduct → Product2
   │
   ├─ 2. QUALIFICATION ─ which of those may THIS account see?
   │      Qualification rule procedure (ExpressionSet)
   │        → EvaluateQualification / EvaluateDisqualification
   │        → decision tables over ProductQualification / ProductDisqualification
   │        → reading the Product Discovery Context
   │
   ├─ 3. CONFIGURATION ─ what can be combined?
   │      ProductComponentGroup / ProductRelatedComponent (structure)
   │      AttributeDefinition / ProductClassificationAttr (attributes)
   │      ProductConfigurationRule (validation, exclusion, inclusion/auto-add)
   │
   ├─ 4. PRICING ─ what does it cost?
   │      Pricing procedure (ExpressionSet) over the Sales Transaction Context
   │        → List Price → adjustments → net price, recorded in the price waterfall
   │
   └─ 5. LIFECYCLE ─ quote → order → asset → amend / renew / cancel
```

Every layer reads a **Context Definition**. When a rule or a price "cannot see" a field,
the fault is almost always at that layer, not in the rule.

---

## 1. Catalog (Product Catalog Management)

Load and dependency order — parents first. This is also the export order of the RCA Product
Builder in this repo. All **✓**.

| # | Object | Resolves by |
|---|--------|-------------|
| 1 | `ProductCatalog` | — |
| 2 | `ProductCategory` | catalog, parent category (self-lookup → two passes) |
| 3 | `AttributePicklist` | — |
| 4 | `AttributePicklistValue` | picklist |
| 5 | `AttributeCategory` | — |
| 6 | `AttributeDefinition` | picklist |
| 7 | `ProductClassification` | — |
| 8 | `ProductClassificationAttr` | classification, attribute, attribute category |
| 9 | `ProductSellingModel` | — |
| 10 | `Pricebook2` | — |
| 11 | `Product2` | classification, record type, unit of measure |
| 12 | `ProductCategoryProduct` | category, product |
| 13 | `ProductSellingModelOption` | product, selling model, proration policy |
| 14 | `PricebookEntry` | price book, product, selling model |
| 15 | `ProductComponentGroup` | bundle product |
| 16 | `ProductRelatedComponent` | bundle, group, child product **or** classification |

Key modelling facts:

- A **bundle is a Product2 with `Type = Bundle`**. There is no separate bundle object.
- A component group can point at a **classification** instead of a named product — every
  product of that kind then becomes selectable. This is how you avoid rebuilding bundles
  when the catalog grows.
- Attributes are defined **once org-wide** (`AttributeDefinition`) and attached to products
  through `ProductClassificationAttr`. `AttributeCategory` groups them into the tabs the
  configurator shows.
- `RecordType`, `UnitOfMeasure`, `ProrationPolicy`, standard selling models and the standard
  price book are **referenced by name and must already exist**. Never duplicate them.
- A component with `DoesBundlePriceIncludeChild = false` carries its own price, so it needs
  its own selling model option and price entry even though it is never browsable alone.

### The five conditions for a product to appear in Browse Catalog

All must hold **and** the decision table must have been refreshed:

1. `IsActive = true`
2. Commercial record type
3. published to a category in the catalog (`ProductCategoryProduct`)
4. offers a selling model (`ProductSellingModelOption`)
5. has an active `PricebookEntry` for the price book **and that selling model**

…then **refresh the PricebookEntry decision table**. Until that runs, the catalog resolves
no price and the product stays hidden even though every record imported cleanly.

---

## 2. Context Service — Context Definitions

The abstraction layer that normalises data from Quotes, Orders, Products and Accounts into
one shape the engines consume. If the pricing procedure or a rule cannot read a field, it is
because the field is not in the context.

**Standard definitions ✓**

| Definition | Used by |
|-----------|---------|
| **Sales Transaction Context** | Pricing procedures, quote/order transactions |
| **Product Discovery Context** | Product qualification / disqualification, catalog browse |

**Structure ✓** — nodes are hierarchical containers, attributes are the fields on them:

- Root node, e.g. `SalesTransaction`
- Child nodes, e.g. `SalesLineItem`
- Related nodes, e.g. `Account`, `Product`
- Attributes: system (predefined), custom (mapped from a field), computed

Referenced in expression sets with dot notation: `SalesTransaction.LineItem.UnitPrice`.

**Setup** ⚠︎ *(the menu label moved between releases — confirm in the org)*:
`Setup → Revenue Settings → Context Definitions`, then the definition → **New Version** →
map fields → **Activate**.

**The three things that go wrong**

1. **Versioning.** Context definitions are versioned. Editing means creating a new version
   and activating it. A change that "did nothing" is usually an unactivated version.
2. **Mapping.** A custom field must be added as an attribute *and* mapped to its source
   field. One without the other silently yields null.
3. **Downstream refresh.** Expression sets referencing the changed context may need
   re-saving/re-activating to pick up the new attribute.

For qualification, the context needs at least these attributes ✓:
`ProductId`, `RootProductId`, `ParentProductId`, `IsQualified`, `Reason`, `CurrentDate`
(and for categories: `CategoryId`, `IsCategoryQualified`, category disqualification reason).

---

## 3. Pricing

A **pricing procedure is an ExpressionSet** ✓ — an ordered stack of price elements. Each
element reads the Sales Transaction Context, adjusts the running price, and records its
contribution in the **price waterfall**, which is what makes RCA pricing auditable.

**Elements ✓** (exact availability varies by release — confirm the picker in the org):

| Element | What it does |
|---------|--------------|
| **List Price** | Seeds the price from `PricebookEntry`. Almost always element 1. |
| **Volume Discount** | Quantity bands → one rate for the whole quantity. Reads a Volume Discount Entries decision table over `PriceAdjustmentTier` ⚠︎. |
| **Tiered Adjustment** | Like Volume Discount, but each band is priced separately (true tiering). |
| **Attribute-Based Adjustment** | Adjusts by attribute value. The attribute must be marked **Is Price Impacting** ✓ or it will not be offered. |
| **Manual / contract / partner adjustments** ⚠︎ | Rep-entered or agreement-driven overrides. |

**Order is the design.** An override placed before a percentage discount produces a
different number than after it. When a ticket says "the discount is wrong", check the
element sequence before checking the rates.

**Invocation ✓** — Price Context API:

```
POST /services/data/v60.0+/connect/core-pricing/price-contexts/{contextId}
{
  "procedureName": "<pricing procedure name>",
  "configurationOverrides": {
    "skipWaterfall": false,
    "useSessionScopedContext": false,
    "persistContext": true,
    "taggedData": {}
  }
}
```

If the waterfall is disabled in Salesforce Pricing Setup, this response omits waterfall
detail — use the Price Waterfall API instead ✓. A "we cannot see how the price was
calculated" ticket is often just this setting.

---

## 4. Qualification & disqualification

Controls **which products and categories a given user or account may see**. Not the same as
catalog publication: publication decides existence, qualification decides eligibility.

**Objects ✓** (API v60.0+):

| Object | Holds |
|--------|-------|
| `ProductQualification` | `ProductId`, `RootProductId`, `ParentProductId`, `IsQualified`, `Reason`, `EffectiveFromDate`, `EffectiveToDate` |
| `ProductDisqualification` | same shape, with `IsDisqualified` |
| `ProductCategoryQualification` | category equivalent |
| `ProductCategoryDisqual` ⚠︎ *(name truncated in the docs nav — verify)* | category equivalent |

Each record **is one rule**; its columns are the criteria.

**How it is wired ✓**

1. Rule records live in the objects above.
2. A **decision table** per object turns those records into a fast lookup, with per-field
   operators.
3. A **qualification rule procedure** (an `ExpressionSet`) uses two elements:
   **`EvaluateQualification`** and **`EvaluateDisqualification`**.
4. The expression set's **Usage Type** is set to `Product Qualification` or
   `Product Category Qualification` ✓ — the wrong usage type is why a procedure never fires.
5. It reads the **Product Discovery Context**.
6. Sales channels invoke it during product discovery; the response marks each product
   qualified or disqualified, with a reason.

**Semantics worth stating in a ticket:** disqualification is the stronger signal — a product
that is both qualified and disqualified is not shown. Model exclusions as
disqualifications rather than as gaps in qualification; gaps are invisible to whoever
maintains the rules later. And `EffectiveFromDate` / `EffectiveToDate` mean a rule can be
correct and still dormant — always check dates before declaring a rule broken.

**After editing rule records, the decision table must be refreshed** before the change
takes effect.

---

## 5. Configuration rules

`ProductConfigurationRule` ✓ — business logic applied during quoting, configuration and
ordering:

| Type | Effect | Example |
|------|--------|---------|
| **Validation** | Blocks an invalid combination with a message | Wired *and* wireless keyboard on one laptop bundle |
| **Exclusion** | Makes mutually exclusive options unselectable | Extended warranty hides standard warranty |
| **Inclusion / requirement** | Adds a required product or attribute automatically | Laptop Pro bundle auto-adds a software licence |

**Auto-add** ✓ adds or removes products based on other selections, and auto-added products
can be **locked** so a rep cannot remove them. Locking is a business decision — put it in
the ticket explicitly rather than leaving it to the developer.

Configuration rules are also expression-set driven, so the same rules apply: they are
versioned, they must be activated, and they read a context.

Structural constraints (group min/max, required components) live on
`ProductComponentGroup` / `ProductRelatedComponent`, **not** in configuration rules. Use the
structure first; a rule that re-implements a group minimum is a smell.

---

## 6. Decision tables

The shared mechanism under qualification, pricing adjustments and disqualification: an
advanced lookup table giving multiple matching outcomes for one set of inputs, sourced from
sObject records, with different operators per column.

Why it matters for solutioning: **a decision table is business-maintainable**. Rates and
eligibility rows change without a deployment. When a requirement reads "and this will change
quarterly", that is a decision table, not Apex.

**Every decision table must be refreshed after its source records change.** This single step
accounts for more RCA "bugs" than any other cause. Any ticket touching rule or price records
must carry the refresh as a numbered step.

---

## 7. Quote → Order → Asset lifecycle

- Quote lines carry the configured structure and the priced waterfall.
- Ordering converts them; assets are created from order items.
- Amendment, renewal and cancellation read the **asset** state, driven by the selling model
  term, the proration policy, and `AssetStatePeriod` ⚠︎.

Consequence for tickets: a pricing or catalog change usually does **not** retro-apply to
existing quotes, orders or assets. Say what happens to in-flight records, and whether a
re-price or a data fix is needed. This is the question that comes back from UAT.
