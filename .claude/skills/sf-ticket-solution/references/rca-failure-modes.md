# RCA failure modes — symptom → cause → the check that proves it

Work top to bottom within a section. The causes are ordered by how often they are actually
the answer, not by how interesting they are. Confirm with the query before writing the
solution: a ticket that names the wrong cause wastes the developer's day *and* the retest.

---

## "The product doesn't appear in Browse Catalog"

| # | Cause | Check |
|---|-------|-------|
| 1 | **Decision table not refreshed** after the catalog load or a price change | Refresh it and re-browse. If it appears, that was it. |
| 2 | No active `PricebookEntry` for that price book **and selling model** | `SELECT Id,UnitPrice,IsActive,Pricebook2Id,ProductSellingModelId FROM PricebookEntry WHERE Product2.ProductCode='<code>'` |
| 3 | No `ProductSellingModelOption` | `SELECT Id FROM ProductSellingModelOption WHERE Product.ProductCode='<code>'` |
| 4 | Not published to a category in the catalog being browsed | `SELECT ProductCategoryId FROM ProductCategoryProduct WHERE Product.ProductCode='<code>'` |
| 5 | `IsActive = false`, or the wrong record type | `SELECT IsActive,RecordType.Name,Type FROM Product2 WHERE ProductCode='<code>'` |
| 6 | **Disqualified** for this account/user | `SELECT ProductId,IsDisqualified,Reason FROM ProductDisqualification` — and check the qualification procedure's usage type |
| 7 | Qualification rule dates | `EffectiveFromDate`/`EffectiveToDate` on the qualification record — a dormant rule looks identical to a missing one |
| 8 | Category itself not in the catalog, or nested under an unpublished parent | Walk `ProductCategory.ParentCategoryId` up to the catalog |

The tell that separates 1 from 2–5: if the product is missing for **everyone** and the data
looks complete, it is the refresh. If it is missing for **some users only**, jump to 6.

---

## "The price is wrong"

| # | Cause | Check |
|---|-------|-------|
| 1 | **Element order** in the pricing procedure — an override before a percentage discount computes differently than after | Read the element sequence; walk the waterfall for one line |
| 2 | Decision table behind the adjustment not refreshed after a rate change | Refresh, re-price the same line |
| 3 | Wrong pricing procedure invoked | `procedureName` in the Price Context call / the procedure bound to the transaction |
| 4 | Attribute not marked **Is Price Impacting**, so Attribute-Based Adjustment ignores it | Attribute definition setting |
| 5 | Attribute value not reaching the engine — missing context attribute or unmapped field | Context Definition → the attribute exists **and** is mapped **and** the version is active |
| 6 | `PricebookEntry` for the wrong selling model — right product, wrong term | Compare `ProductSellingModelId` on the entry vs. the quote line |
| 7 | Bundle child priced independently (`DoesBundlePriceIncludeChild = false`) and missing its own entry | Query the child's `PricebookEntry` |
| 8 | Currency / price book mismatch on the transaction | Quote's `Pricebook2Id` vs. where the entry lives |

**Always ask for the price waterfall for one concrete line before theorising.** If the
waterfall is empty, check whether it is disabled in Salesforce Pricing Setup — that is a
setting, not a bug, and it changes the answer to "why can't we see the calculation".

---

## "My change had no effect"

The RCA answer is almost always **something was not activated or not refreshed**:

| Changed | Also required |
|---------|---------------|
| Context Definition | New version → map → **activate**; then re-save/re-activate expression sets that read it |
| Expression set (pricing procedure, qualification procedure, configuration rule) | Activate the new **version**; check the transaction points at it |
| Rule records (`ProductQualification`, adjustment tiers, …) | **Refresh the decision table** |
| Catalog or price records | **Refresh the PricebookEntry decision table** |
| Expression set usage type | Wrong usage type = never invoked, with no error |

None of these raise an error. That is why they dominate this list.

---

## "The configurator behaves wrongly"

| Symptom | Look at |
|---------|---------|
| Cannot add a component that should be allowed | `ProductComponentGroup` max, an **exclusion** rule, or the component's own qualification |
| Component missing from a group | Classification-based group: is the product of that classification and otherwise valid? |
| Something is added that the rep did not choose | An **inclusion / auto-add** rule — check whether it is also locked |
| Cannot save a valid configuration | A **validation** rule, an unmet group minimum, or a required attribute with no value |
| Required attribute not enforced | `IsRequired` on the classification attribute, not on the attribute definition |
| Attribute missing entirely | `ProductClassificationAttr` — the product inherits attributes through its classification |

Structure first, rules second. If a group minimum can express it, a configuration rule
should not.

---

## "It worked in the sandbox"

| # | Cause |
|---|-------|
| 1 | Decision tables never refreshed in the target org after the data load |
| 2 | Expression set deployed but left **inactive**, or an older version is active |
| 3 | Context Definition version differs — the custom attribute exists in one org only |
| 4 | Rule/price **records** were not migrated: metadata deployed, data did not |
| 5 | Standard records referenced by name (selling models, price book, proration policy, UoM) are named differently in the target |
| 6 | Permission sets / licences for RCA features not assigned to the test user |

Cause 4 is structural, not careless: in RCA a large share of configuration is *records*, so
"deploy the metadata" never completes the job. Any ticket must split its deployment notes
into metadata vs. data vs. manual.

---

## "Amendment / renewal / cancellation is wrong"

| # | Cause |
|---|-------|
| 1 | Proration policy on the `ProductSellingModelOption` |
| 2 | Selling model term does not match the contract term |
| 3 | Asset state at the amendment date — check `AssetStatePeriod` ⚠︎ before the quote logic |
| 4 | The pricing change was made after the asset existed and does not retro-apply |

Cause 4 is a scoping question, not a bug: decide and state whether in-flight records get
re-priced, and make it an acceptance criterion either way.

---

## Sanity checks worth running on any RCA ticket

```bash
# Does the product satisfy all five visibility conditions?
sf data query -o <alias> -q "SELECT Id,Name,IsActive,Type,RecordType.Name FROM Product2 WHERE ProductCode='<code>'"
sf data query -o <alias> -q "SELECT COUNT() FROM ProductCategoryProduct WHERE Product.ProductCode='<code>'"
sf data query -o <alias> -q "SELECT COUNT() FROM ProductSellingModelOption WHERE Product.ProductCode='<code>'"
sf data query -o <alias> -q "SELECT COUNT() FROM PricebookEntry WHERE Product2.ProductCode='<code>' AND IsActive=true"

# Which engines are configured at all?
sf data query -o <alias> -q "SELECT Id,Name,UsageType FROM ExpressionSet"
sf data query -o <alias> -q "SELECT Id,Name FROM ContextDefinition"
```

If a query errors because the object does not exist in the org, that is itself the finding:
the feature is not enabled or the org is not on a release that has it. Report that rather
than working around it.
