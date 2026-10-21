# The mapping graph — verified paths, recipes, and the honest no

Marked **✓** where confirmed against Salesforce Help, release notes or a published
walkthrough; **⚠︎** where the label shifts between releases or could not be confirmed.
**The org's Setup UI is the authority** — when it disagrees with this file, the org wins
and this file gets corrected.

---

## How a value actually travels

Never field-to-field. Always **field → context attribute → field**, and only **at a
lifecycle operation** ✓:

```
        quote creation          order creation           order activation
Product ───────────▶ Quote/QLI ───────────▶ Order/OrderItem ───────────▶ Asset
                          │                       │                        │
                          └── amendment/renewal quotes read assets back ◀──┘
                                        (asset update mapping ✓)
```

Custom field mapping is supported for these operations ✓ *(Summer '24+)*: quote creation,
order creation, **asset creation, asset update**, contract creation.

Three consequences that decide half the questions before any Setup path matters:

1. **Nothing is live.** The value is copied when the operation runs. Editing the quote
   after the order exists changes nothing downstream — that is by design, an order is a
   record of what was agreed. If the user wants live sync, the answer is "not possible as
   asked"; the nearest real options are re-creating the order or a display-only formula.
2. **Nothing flows backwards.** Asset → Quote exists only in the sense that amendment and
   renewal *operations* read assets into new quotes. There is no reverse field mapping.
3. **Nothing is retroactive.** Existing records are untouched by a new mapping. Backfill
   is a data load (`/sf-data-deploy`), not a mapping.

## The context, its nodes, its surfaces

- Standard definition: **Sales Transaction Context** ✓ (`RevSalesTransactionContext`), and
  it is **read-only — extend it, never edit it** ✓. An org should have one extended
  definition in use; find it before proposing to create one:
  `Setup → Context Service → Context Definitions` ✓.
- Nodes ✓: **Sales Transaction** (header: Quote ↔ Order) and **Sales Transaction Item**
  (line: QuoteLineItem ↔ OrderItem). Wrong node ⇒ mapping saves, field arrives blank, no
  error ✓. Header-to-line or line-to-header is not a mapping — that is an aggregation or a
  default, and belongs to the pricing procedure or a Flow.
- Attributes: created under the node's **Structure**, need a **unique tag** ✓ and both
  **Input and Output enabled** ✓ — one toggle off is the other silent blank.
- Mappings live in the definition's **Map Data** tab ✓, one section per entity:
  **Quote Entities Mapping** ✓, **Order Entities Mapping** ✓, asset entities section ⚠︎
  *(label varies; it appears alongside the others once asset lifecycle is enabled)*.
- **Activation** of the definition version is what turns any of it on ✓.
- The **Transaction Line Editor** shows context attributes, not raw fields — a custom QLI
  column in the TLE is an attribute on Sales Transaction Item with the field mapped, no
  second hop needed ✓.

## Recipes

### One hop, line level: QuoteLineItem.Field__c → OrderItem.Field__c ✓

1. Confirm both fields exist with compatible types (`sf sobject describe`). Incompatible
   types refuse to save ✓ — this is the one failure the org catches for you.
2. `Setup → Context Service → Context Definitions` → open the **extended** definition.
3. Node **Sales Transaction Item** → Structure → add attribute, unique tag
   (e.g. `qliInstallNotes`), **Input ✓ Output ✓**.
4. Map Data → **Quote Entities Mapping**: `QuoteLineItem.Field__c` → attribute.
5. Map Data → **Order Entities Mapping**: attribute → `OrderItem.Field__c`.
6. **Activate** the version.
7. Test: quote → add line → populate → create order → value on the order product.

Header level (Quote → Order): same recipe on the **Sales Transaction** node.

### Two hops: QuoteLineItem.Field__c → Asset.Field__c — the worked example

The value must survive two operations, so it is hop 1 above **plus**:

8. A field on **Asset** to land in (create it; match the type).
9. In the same extended definition, map the attribute into the asset entity section ⚠︎
   *(verify the exact section label in the org)* so **asset creation** writes it when order
   activation creates the asset ✓.
10. If amendments must carry it too, repeat for the **asset update** operation ✓ — asset
    creation and asset update are separate operations with separate mappings.
11. Test end-to-end: quote → order → **activate** → check the asset. Then the negative
    test: edit the QLI field after ordering, confirm the asset value stays — and put that
    sentence in the plan, because it is the expectation most users arrive with.

If the org's asset section does not expose the target field, the fallback is a
record-triggered Flow on Asset create reading back through the order item — acceptable for
display-only fields, and say explicitly that it bypasses the context.

### Product → QuoteLineItem (defaulting from the catalog) ✓

Same mechanics, quote-creation direction: attribute on Sales Transaction Item, product
entity mapping ⚠︎ as source, quote entity mapping as target. Used to stamp catalog data
(spec, family, provisioning code) onto lines at quoting time.

### Show a custom QLI field in the Transaction Line Editor ✓

Attribute on Sales Transaction Item + Quote Entities Mapping + activate, then add the
column in the TLE configuration. No target mapping — display only needs the attribute to
exist and be populated.

## When the answer is "you don't need CD"

| Ask | Give instead |
|---|---|
| "Report on quote fields next to assets" | SOQL / report joins — `OrderItem.QuoteLineItemId` ✓ links the chain |
| "Fix the records already out there" | Data load — mappings are never retroactive |
| "Field B is derived from field A on the same object" | Formula or before-save Flow |
| "Copy it so it shows on the asset page" (nothing else reads it) | Record-triggered Flow on Asset create — cheaper, but state that pricing/TLE would never see it |
| "Map Amount / Quantity / the fields that already arrive" | Nothing — check the predefined standard mappings first ✓; RLM ships a set |

## When the answer is "not possible as asked"

| Ask | Why | Nearest real thing |
|---|---|---|
| "Asset field back onto the quote line" | No backwards field mapping | Amendment/renewal operations read assets into *new* quotes ✓; or a Flow for display |
| "Keep the asset in sync when the quote changes" | Mappings fire at operations, not continuously | Re-create the order, or accept point-in-time semantics |
| Text field → number field, etc. | Type compatibility is enforced at save ✓ | Fix the types, or map into a matching field and convert with a formula |
| "Map into the engine's own calculated fields" (prices, totals) | The pricing procedure owns them; a mapping fights the engine | Change the pricing procedure — `/sf-pricing-procedure` |
| "Map to an object outside the lifecycle" (Case, custom object) | The context carries the sales transaction, not the org | Record-triggered Flow on the lifecycle object |

## Failure modes, ordered by what it actually turns out to be

| Symptom | Cause, in order |
|---|---|
| Mapped field arrives blank | 1. Version not **activated** · 2. Wrong **node** · 3. Attribute missing **Input or Output** · 4. Mapping saved on the standard definition instead of the extended one ⚠︎ · 5. Operation never ran (order not activated ⇒ no asset) |
| Mapping refuses to save | Data type mismatch ✓ |
| Quote-to-order conversion fails org-wide after a change | A bad mapping in the active version ✓ — deactivate, restore previous version; this is why plans say sandbox-first |
| Worked for order, blank on asset | Hop 2 missing: attribute never mapped in the asset section, or amendments expected but only asset-creation was mapped |
| TLE column empty | Attribute not on Sales Transaction Item, or quote entity mapping missing |

## Sources

- Field mapping via context definitions, extend-don't-edit, node choice, Input/Output,
  silent-blank and org-wide-block gotchas — https://www.minusculetechnologies.com/blogs/map-fields-quote-to-order-salesforce-revenue-cloud
- Custom field mapping operations (quote/order/asset create, asset update, contract) —
  Summer '24 release notes, https://gettectonic.com/salesforce-revenue-summer-24-release-notes/
- Asset lifecycle objects and creation from orders —
  https://help.salesforce.com/s/articleView?id=ind.qocal_asset_lifecycle.htm
- Context Service Developer Guide —
  https://developer.salesforce.com/docs/platform/context-service/overview
