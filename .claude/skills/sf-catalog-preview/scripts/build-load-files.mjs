#!/usr/bin/env node
// model.json → one CSV per Salesforce object, numbered in load order. Zero dependencies.
//
//   node build-load-files.mjs catalog-preview/model.json catalog-preview/load
//
// Lookup columns use the `Field:Object:ExternalKey` syntax the Revenue Cloud product
// importer resolves by name/code, so nothing depends on record ids existing beforehand.
// Selling models and price books carrying an `existingId` are NOT written to their own
// file — their children reference them by that id instead (never recreate the standard
// price book or the standard selling models).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [modelPath, outDir] = process.argv.slice(2);
if (!modelPath || !outDir) {
  console.error('Usage: node build-load-files.mjs <model.json> <output-dir>');
  process.exit(2);
}

const m = JSON.parse(readFileSync(modelPath, 'utf8'));
for (const key of [
  'catalogs', 'categories', 'picklists', 'picklistValues', 'attributeCategories',
  'attributes', 'classifications', 'classificationAttributes', 'products',
  'sellingModels', 'sellingModelOptions', 'pricebooks', 'pricebookEntries',
  'componentGroups', 'relatedComponents',
]) m[key] ??= [];

const bool = (b) => (b ? 'true' : 'false');
const num = (n) => (n === null || n === undefined ? '' : n);
const bySequence = (rows) => [...rows].sort((a, b) => a.sequence - b.sequence);

const catalogCode = (id) => m.catalogs.find((c) => c.id === id)?.code ?? '';
const categoryCode = (id) => m.categories.find((c) => c.id === id)?.code ?? '';
const picklistName = (id) => (id ? m.picklists.find((p) => p.id === id)?.name ?? '' : '');
const attrApiName = (id) => m.attributes.find((a) => a.id === id)?.apiName ?? '';
const attrCategoryCode = (id) => (id ? m.attributeCategories.find((c) => c.id === id)?.code ?? '' : '');
const classificationName = (id) => (id ? m.classifications.find((c) => c.id === id)?.name ?? '' : '');
const classificationCode = (id) => m.classifications.find((c) => c.id === id)?.code ?? '';
const productName = (id) => (id ? m.products.find((p) => p.id === id)?.name ?? '' : '');
const groupCode = (id) => m.componentGroups.find((g) => g.id === id)?.code ?? '';
const sellingModelName = (id) => m.sellingModels.find((s) => s.id === id)?.name ?? '';
const pricebookName = (id) => m.pricebooks.find((b) => b.id === id)?.name ?? '';

const existingSellingModelId = (id) => m.sellingModels.find((s) => s.id === id)?.existingId?.trim() ?? '';
const existingPricebookId = (id) => m.pricebooks.find((b) => b.id === id)?.existingId?.trim() ?? '';
const anyExistingSellingModel = m.sellingModels.some((s) => s.existingId?.trim());
const anyExistingPricebook = m.pricebooks.some((b) => b.existingId?.trim());
// Name column stays blank when the row resolves by Id, so the loader reads one or the other.
const byName = (name, existing) => (existing ? '' : name);

const relationshipTypeFor = (rc) =>
  rc.childClassificationId
    ? 'Bundle to Product Classification Component Relationship'
    : 'Bundle to Bundle Component Relationship';

const TABS = [
  {
    name: 'ProductCatalog',
    note: 'Load first. Everything browsable hangs off a catalog.',
    columns: ['Name', 'Code', 'Description'],
    rows: m.catalogs.map((c) => [c.name, c.code, c.description]),
  },
  {
    name: 'ProductCategory',
    note: 'Parent categories must exist before their children; rows are already sorted.',
    columns: ['Name', 'Code', 'Catalog:ProductCatalog:Code', 'ParentCategory:ProductCategory:Code', 'SortOrder', 'IsNavigational'],
    rows: [...m.categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
      .map((c) => [c.name, c.code, catalogCode(c.catalogId), c.parentId ? categoryCode(c.parentId) : '', c.sortOrder, bool(c.showInMenu)]),
  },
  {
    name: 'AttributePicklist',
    note: 'Load before AttributeDefinition, which looks picklists up by Name.',
    columns: ['Name', 'Code', 'Status', 'DataType', 'Description'],
    rows: m.picklists.map((p) => [p.name, p.code, p.status, p.dataType, p.description]),
  },
  {
    name: 'AttributePicklistValue',
    note: 'Matched to its picklist by Name. Sequence drives the order in the configurator.',
    columns: ['Picklist:AttributePicklist:Name', 'Name', 'Code', 'Abbreviation', 'DisplayValue', 'Value', 'Status', 'IsDefault', 'Sequence'],
    rows: bySequence(m.picklistValues).map((v) => [
      picklistName(v.picklistId), v.name, v.code, v.abbreviation,
      v.displayValue || v.name, v.value || v.name, v.status, bool(v.isDefault), v.sequence,
    ]),
  },
  {
    name: 'AttributeCategory',
    note: 'Optional grouping used to lay out attributes in the configurator.',
    columns: ['Name', 'Code', 'Description'],
    rows: m.attributeCategories.map((c) => [c.name, c.code, c.description]),
  },
  {
    name: 'AttributeDefinition',
    note: 'Name is the API name and must be unique across the org.',
    columns: ['Label', 'Name', 'Code', 'DataType', 'PicklistId:AttributePicklist:Name', 'DefaultValue', 'IsActive', 'Description'],
    rows: m.attributes.map((a) => [
      a.label, a.apiName, a.code || a.apiName, a.dataType,
      a.dataType === 'Picklist' ? picklistName(a.picklistId) : '',
      a.defaultValue, bool(a.isActive), a.description,
    ]),
  },
  {
    name: 'ProductClassification',
    note: 'Load before Product2 — products reference it via BasedOn.',
    columns: ['Name', 'Code', 'Status'],
    rows: m.classifications.map((c) => [c.name, c.code, c.status]),
  },
  {
    name: 'ProductClassificationAttr',
    note: 'Attaches attributes to a classification; every product based on it inherits them.',
    columns: ['ProductClassification:ProductClassification:Code', 'AttributeDefinition:AttributeDefinition:Name', 'AttributeCategory:AttributeCategory:Code', 'Sequence', 'IsRequired', 'IsHidden', 'IsReadOnly', 'DefaultValue'],
    rows: bySequence(m.classificationAttributes).map((ca) => [
      classificationCode(ca.classificationId), attrApiName(ca.attributeId), attrCategoryCode(ca.attributeCategoryId),
      ca.sequence, bool(ca.isRequired), bool(ca.isHidden), bool(ca.isReadOnly), ca.defaultValue,
    ]),
  },
  {
    name: 'ProductSellingModel',
    note: 'Models with an existingId are not here — their children point at them by Id; do not recreate them.',
    columns: ['Name', 'SellingModelType', 'PricingTerm', 'PricingTermUnit', 'Status'],
    rows: m.sellingModels
      .filter((s) => !s.existingId?.trim())
      .map((s) => [s.name, s.type, s.type === 'TermDefined' ? num(s.pricingTerm) : '', s.type === 'TermDefined' ? s.pricingTermUnit : '', s.status]),
  },
  {
    name: 'Pricebook2',
    note: 'The standard price book usually exists already. A book with an existingId is not here — PricebookEntry points at it by Id.',
    columns: ['Name', 'IsStandard', 'IsActive'],
    rows: m.pricebooks.filter((b) => !b.existingId?.trim()).map((b) => [b.name, bool(b.isStandard), bool(b.isActive)]),
  },
  {
    name: 'Product2',
    note: 'Bundles are just products with Type = Bundle. RecordType must already exist in the org.',
    columns: ['Name', 'ProductCode', 'Description', 'Type', 'RecordType:RecordType:Name', 'Family', 'BasedOn:ProductClassification:Name', 'UnitOfMeasure:UnitOfMeasure:Name', 'ConfigureDuringSale', 'IsActive', 'IsAssetizable', 'IsSoldOnlyWithOtherProds', 'AvailabilityDate', 'DisplayUrl'],
    rows: m.products.map((p) => [
      p.name, p.productCode, p.description, p.type, p.recordType, p.family,
      classificationName(p.classificationId), p.unitOfMeasure, p.configureDuringSale,
      bool(p.isActive), bool(p.isAssetizable), bool(p.isSoldOnlyWithOtherProds),
      p.availabilityDate, p.displayUrl,
    ]),
  },
  {
    name: 'ProductCategoryProduct',
    note: 'Publishes products into categories. Necessary but not sufficient — pricing decides the rest.',
    columns: ['ProductCategory:ProductCategory:Code', 'Product:Product2:ProductCode', 'Product Name'],
    rows: m.products.flatMap((p) => (p.categoryIds ?? []).map((cid) => [categoryCode(cid), p.productCode, p.name])),
  },
  {
    name: 'ProductSellingModelOption',
    note: 'Without a row here the product has nothing to be priced against and stays invisible.',
    columns: [
      'Product2:Product2:Name',
      ...(anyExistingSellingModel ? ['ProductSellingModelId'] : []),
      'ProductSellingModel:ProductSellingModel:Name', 'IsDefault', 'ProrationPolicy:ProrationPolicy:Name',
    ],
    rows: m.sellingModelOptions.map((o) => {
      const existing = existingSellingModelId(o.sellingModelId);
      return [
        productName(o.productId),
        ...(anyExistingSellingModel ? [existing] : []),
        byName(sellingModelName(o.sellingModelId), existing),
        bool(o.isDefault), o.prorationPolicy,
      ];
    }),
  },
  {
    name: 'PricebookEntry',
    note: 'The other half of visibility. Where an Id column is filled, the matching name column is blank — the loader resolves one or the other. Then refresh the decision table — see AFTER LOADING.',
    columns: [
      ...(anyExistingPricebook ? ['Pricebook2Id'] : []),
      'Pricebook2:Pricebook2:Name', 'Product2:Product2:Name',
      ...(anyExistingSellingModel ? ['ProductSellingModelId'] : []),
      'ProductSellingModel:ProductSellingModel:Name', 'IsActive', 'UnitPrice', 'CurrencyISOCode',
    ],
    rows: m.pricebookEntries.map((e) => {
      const book = existingPricebookId(e.pricebookId);
      const model = existingSellingModelId(e.sellingModelId);
      return [
        ...(anyExistingPricebook ? [book] : []),
        byName(pricebookName(e.pricebookId), book),
        productName(e.productId),
        ...(anyExistingSellingModel ? [model] : []),
        byName(sellingModelName(e.sellingModelId), model),
        bool(e.isActive), e.unitPrice, e.currency,
      ];
    }),
  },
  {
    name: 'ProductComponentGroup',
    note: 'Matched to its bundle by product Name. Code must be unique — components join on it.',
    columns: ['ParentProduct:Product2:Name', 'Name', 'Code', 'Sequence', 'Description', 'MinBundleComponents', 'MaxBundleComponents'],
    rows: bySequence(m.componentGroups).map((g) => [
      productName(g.bundleId), g.name, g.code, g.sequence, g.description, num(g.minComponents), num(g.maxComponents),
    ]),
  },
  {
    name: 'ProductRelatedComponent',
    note: 'Load last. Set either ChildProduct or ChildProductClassification, never both.',
    columns: ['ParentProduct:Product2:Name', 'ProductComponentGroup:ProductComponentGroup:Code', 'ProductRelationshipType:ProductRelationshipType:Name', 'ChildProduct:Product2:Name', 'ChildProductClassification:ProductClassification:Name', 'Sequence', 'Quantity', 'IsComponentRequired', 'IsDefaultComponent', 'IsQuantityEditable', 'MinQuantity', 'MaxQuantity', 'DoesBundlePriceIncludeChild', 'QuantityScaleMethod'],
    rows: bySequence(m.relatedComponents).map((rc) => [
      productName(rc.bundleId), groupCode(rc.groupId), relationshipTypeFor(rc),
      productName(rc.childProductId), classificationName(rc.childClassificationId),
      rc.sequence, rc.quantity, bool(rc.isComponentRequired), bool(rc.isDefaultComponent),
      bool(rc.isQuantityEditable), num(rc.minQuantity), num(rc.maxQuantity),
      bool(rc.doesBundlePriceIncludeChild), rc.quantityScaleMethod,
    ]),
  },
];

const POST_LOAD = [
  ['Refresh the PricebookEntry decision table', 'Setup → Decision Tables → the PricebookEntry table → Refresh Data. Until this runs the catalog resolves no price and products stay hidden, even though every record loaded cleanly.'],
  ['Republish the catalog', 'Product Catalog Management → the catalog → Publish, so category and product changes reach the store.'],
  ['Check the pricing procedure', 'Confirm the pricing procedure assigned to the quote reads the refreshed decision table.'],
  ['Spot-check one product per selling model', 'Add it to a quote. A product that loads but never appears is almost always missing its ProductSellingModelOption or its PricebookEntry.'],
];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

mkdirSync(outDir, { recursive: true });

const written = [];
TABS.forEach((tab, i) => {
  const n = String(i + 1).padStart(2, '0');
  if (tab.rows.length === 0) {
    written.push({ n, name: tab.name, file: '(skipped — no rows)', rows: 0, note: tab.note });
    return;
  }
  const file = `${n}_${tab.name}.csv`;
  const body = [tab.columns, ...tab.rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
  writeFileSync(join(outDir, file), body);
  written.push({ n, name: tab.name, file, rows: tab.rows.length, note: tab.note });
});

const readme = [
  '# Catalog load files',
  '',
  'Load in file-number order — dependencies always come first. Lookup columns use the',
  '`Field:Object:ExternalKey` syntax the Revenue Cloud product importer resolves by',
  'name/code, so no ids are needed beforehand. `RecordType`, `UnitOfMeasure`,',
  '`ProrationPolicy` and anything referenced by a raw Id column must already exist in the org.',
  '',
  '| # | Object | Rows | File | Notes |',
  '|---|--------|------|------|-------|',
  ...written.map((w) => `| ${w.n} | ${w.name} | ${w.rows} | ${w.file} | ${w.note} |`),
  '',
  '## After loading',
  '',
  'Records alone do not make a product sellable:',
  '',
  ...POST_LOAD.map(([t, d], i) => `${i + 1}. **${t}** — ${d}`),
  '',
  'For a full runbook (sample load first, per-step checks, rollback): `/sf-data-deploy`.',
  '',
].join('\n');

writeFileSync(join(outDir, '00_README.md'), readme);

console.log(`→ ${outDir}`);
for (const w of written) console.log(`  ${w.n} ${w.name.padEnd(26)} ${String(w.rows).padStart(4)} rows  ${w.file}`);
console.log('  00_README.md (load order + post-load steps)');
