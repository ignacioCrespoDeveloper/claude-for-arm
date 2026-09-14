---
name: sf-catalog-preview
description: Turn a product spreadsheet (Excel/CSV) into a faithful preview of how those products will render in Revenue Cloud's Browse Catalog, plus the complete set of load-ready records — ProductCatalog, ProductCategory, Product2, ProductCategoryProduct, selling models, PricebookEntry, bundle components — that make them visible. Use when the user shares product data and asks "how will this look in the catalog", "preview these products", "will these show up in Browse Catalog", or wants the RCA catalog data generated from a product list.
---

# RCA catalog preview from a spreadsheet

Someone hands you an Excel with products. Two questions follow, always in this order:
**"what will a rep actually see in Browse Catalog?"** and **"what records do I have to load
to make that happen?"** This skill answers both from the same generated model, so the
preview and the load files can never disagree.

Two deliverables, every run:

1. **The preview** — a single self-contained HTML page that replicates Salesforce's
   Browse Products modal (same layout, same colors, same behavior: category tree, search,
   sort, filters, quantities, quote lines). It renders strictly from the generated model:
   a product missing here will be missing in the org too.
2. **The load files** — one CSV per Salesforce object, numbered in dependency order, with
   the `Field:Object:ExternalKey` header syntax the Revenue Cloud importer resolves by
   name instead of by id.

## Read-only: generate files, never touch the org

**You do not modify the org.** Everything this skill produces is a local file. Reading the
org is allowed and often necessary — `sf data query`, `sf sobject describe` — to fetch the
ids of records that already exist (the standard price book, the standard selling models,
proration policies) so the load files reference them instead of duplicating them. Loading
the generated files is the operator's job; hand them `/sf-data-deploy` for the runbook.

The only exception is the user explicitly telling you, in the current message, to run a
specific write command against a named org. Never infer it.

## 1. Read the spreadsheet

For `.xlsx`, run the bundled zero-dependency reader — it works in any project, no
`npm install`:

```bash
node <skill_dir>/scripts/read-xlsx.mjs path/to/products.xlsx
```

It prints every tab as TSV. Two caveats it will remind you of:

- Dates may come out as Excel serial numbers (`45231`). Convert with
  `new Date(Date.UTC(1899, 11, 30) + serial * 86400000)` when a column is clearly a date.
- Formulas print their cached result, not the formula.

CSV or a pasted table: just read it. If the workbook already has tabs named after RCA
objects (`Product2`, `PricebookEntry`, …) it is an export in our own format — map tab per
tab instead of guessing.

## 2. Map it onto the catalog model

Read `references/data-mapping.md` — it defines the canonical `model.json` shape (the same
model the RCA Product Builder uses), the column-name synonyms to recognize in English and
Spanish, and the defaults to apply.

The law that governs the mapping — **a product is visible in Browse Catalog only when all
five hold**:

1. `Product2.IsActive = true`, record type Commercial, not `IsSoldOnlyWithOtherProds`
2. Published to a category **in that catalog** (`ProductCategoryProduct`)
3. Has at least one `ProductSellingModelOption`
4. Has an **active** `PricebookEntry` in the price book, for one of those selling models
5. After loading: the PricebookEntry decision table was refreshed

The spreadsheet will almost never carry all of this. **Synthesize what is missing so every
product the user clearly wants published ends up visible** — a default catalog, an
`All Products` category, a One-Time selling model, entries in the standard price book from
whatever price column exists. Every synthesized record is an assumption: keep a running
list and show it in the final report. A product with no price anywhere is the one thing
you do not invent — leave it priceless and let the preview's "published but not visible"
panel say so.

If the user names an org, look up what already exists before creating it:

```bash
sf data query -q "SELECT Id, Name FROM Pricebook2 WHERE IsStandard = true" -o ORG
sf data query -q "SELECT Id, Name, SellingModelType FROM ProductSellingModel" -o ORG
```

Put those ids in the model's `existingId` fields — the load files will then reference them
by id instead of recreating them.

Write the result to `catalog-preview/model.json` in the project.

## 3. Render the preview

Copy `assets/preview-template.html` from this skill, replace the single `__MODEL_JSON__`
token (inside the `<script id="catalog-model" type="application/json">` block) with the
model JSON, and save it as `catalog-preview/preview.html`. Do not edit anything
else in the template — the design replicates the org pixel by pixel and drift defeats the
purpose. Deliver it as an Artifact when publishing is available, otherwise send the file.

What the template already does, because it ports the Product Builder's preview logic:

- Category sidebar (two levels, sort order, `IsNavigational` respected), search, sort
  menu, bundles-only filter, select-all, quantities, quote lines with extended amounts
- Prices resolve exactly like the org: the active PricebookEntry for the product's
  **default** selling model in the selected price book
- The attribute recap line under the price, from the product's classification defaults
- A simplified configurator for bundles (groups, min/max, component prices) — the full
  configurator lives in the Product Builder app
- A **"Published but not visible"** panel listing every product that would load cleanly
  and still never appear, with the exact reason

## 4. Generate the load files

```bash
node <skill_dir>/scripts/build-load-files.mjs catalog-preview/model.json catalog-preview/load
```

Zero dependencies. It writes one CSV per object, numbered `01`–`16` in the mandatory load
order, plus `00_README.md` with row counts and the post-load steps. Records marked
`existingId` are excluded from their own file and referenced by id from their children —
never recreate the standard price book or the standard selling models.

## 5. Report

End with, in this order:

1. **Visibility table** — every product: visible ✓, or the blocking reasons
2. **Assumptions** — each synthesized record and why; the user corrects, you regenerate
3. **What was written** — `model.json`, `preview.html`, the `load/` folder
4. **After loading** — refresh the PricebookEntry decision table (the number one "the
   load worked but nothing shows up"), republish the catalog, spot-check one product per
   selling model. For the full runbook: `/sf-data-deploy`.

Related: the **RCA Product Builder** app is the interactive version of this — import the
generated workbook there to keep editing. `/sf-data-deploy` turns the load files into an
executable runbook. `/sf-ticket-solution` when a product is invisible in a real org and
nobody knows why.
