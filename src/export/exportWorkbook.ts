import { type CatalogModel, type Id, relationshipTypeFor } from '../model/types';

/**
 * One tab per Salesforce object, one header row of real API names.
 *
 * Lookups use the `Field:Object:ExternalKey` syntax that the Revenue Cloud
 * product import understands, so nothing here depends on record ids existing
 * beforehand — the loader resolves them by name or code at import time.
 */

interface Tab {
  name: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
}

const bool = (b: boolean) => (b ? 'true' : 'false');
const num = (n: number | null) => (n === null ? '' : n);

/** The order the tabs must be loaded in; dependencies always come first. */
export const LOAD_ORDER = [
  'ProductCatalog',
  'ProductCategory',
  'AttributePicklist',
  'AttributePicklistValue',
  'AttributeCategory',
  'AttributeDefinition',
  'ProductClassification',
  'ProductClassificationAttr',
  'ProductSellingModel',
  'Pricebook2',
  'Product2',
  'ProductCategoryProduct',
  'ProductSellingModelOption',
  'PricebookEntry',
  'ProductComponentGroup',
  'ProductRelatedComponent',
] as const;

/**
 * Loading the workbook is not the last step. Pricing is served to the catalog
 * through a decision table, and it keeps returning stale rows until it is
 * refreshed.
 */
export const POST_LOAD_STEPS: [string, string][] = [
  [
    'Refresh the PricebookEntry decision table',
    'Setup → Decision Tables → the PricebookEntry table → Refresh Data. Until this runs the catalog resolves no price and products stay hidden, even though every record loaded cleanly.',
  ],
  [
    'Republish the catalog',
    'Product Catalog Management → the catalog → Publish, so category and product changes reach the store.',
  ],
  [
    'Check the pricing procedure',
    'Confirm the pricing procedure assigned to the quote reads the refreshed decision table.',
  ],
  [
    'Spot-check one product per selling model',
    'Add it to a quote. A product that loads but never appears is almost always missing its ProductSellingModelOption or its PricebookEntry.',
  ],
];

export function buildTabs(m: CatalogModel): Tab[] {
  const catalogCode = (id: Id) => m.catalogs.find((c) => c.id === id)?.code ?? '';
  const categoryCode = (id: Id) => m.categories.find((c) => c.id === id)?.code ?? '';
  const picklistName = (id: Id | null) => (id ? (m.picklists.find((p) => p.id === id)?.name ?? '') : '');
  const attrApiName = (id: Id) => m.attributes.find((a) => a.id === id)?.apiName ?? '';
  const attrCategoryCode = (id: Id | null) =>
    id ? (m.attributeCategories.find((c) => c.id === id)?.code ?? '') : '';
  const classificationName = (id: Id | null) =>
    id ? (m.classifications.find((c) => c.id === id)?.name ?? '') : '';
  const classificationCode = (id: Id) => m.classifications.find((c) => c.id === id)?.code ?? '';
  const productName = (id: Id | null) => (id ? (m.products.find((p) => p.id === id)?.name ?? '') : '');
  const groupCode = (id: Id) => m.componentGroups.find((g) => g.id === id)?.code ?? '';
  const sellingModelName = (id: Id) => m.sellingModels.find((s) => s.id === id)?.name ?? '';
  const pricebookName = (id: Id) => m.pricebooks.find((b) => b.id === id)?.name ?? '';

  /*
   * Selling models and price books can point at a record that already exists in the org
   * rather than being created. Such a record is left out of its own tab, and its children
   * reference it by Id.
   *
   * That means two ways of resolving the same lookup, so the child tabs carry an Id column
   * *and* the name column, with exactly one filled per row. The Id column only appears when
   * something actually uses it — a catalog that creates everything exports exactly the
   * workbook it did before.
   */
  const existingSellingModelId = (id: Id) =>
    m.sellingModels.find((s) => s.id === id)?.existingId?.trim() ?? '';
  const existingPricebookId = (id: Id) =>
    m.pricebooks.find((b) => b.id === id)?.existingId?.trim() ?? '';

  const anyExistingSellingModel = m.sellingModels.some((s) => s.existingId?.trim());
  const anyExistingPricebook = m.pricebooks.some((b) => b.existingId?.trim());

  /** Name column stays blank when the row resolves by Id, so the loader reads one or the other. */
  const byName = (name: string, existing: string) => (existing ? '' : name);

  const bySequence = <T extends { sequence: number }>(rows: T[]) =>
    [...rows].sort((a, b) => a.sequence - b.sequence);

  return [
    {
      name: 'ProductCatalog',
      columns: ['Name', 'Code', 'Description'],
      rows: m.catalogs.map((c) => [c.name, c.code, c.description]),
    },
    {
      name: 'ProductCategory',
      columns: [
        'Name',
        'Code',
        'Catalog:ProductCatalog:Code',
        'ParentCategory:ProductCategory:Code',
        'SortOrder',
        'IsNavigational',
      ],
      rows: [...m.categories]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => [
          c.name,
          c.code,
          catalogCode(c.catalogId),
          c.parentId ? categoryCode(c.parentId) : '',
          c.sortOrder,
          bool(c.showInMenu),
        ]),
    },
    {
      name: 'AttributePicklist',
      columns: ['Name', 'Code', 'Status', 'DataType', 'Description'],
      rows: m.picklists.map((p) => [p.name, p.code, p.status, p.dataType, p.description]),
    },
    {
      name: 'AttributePicklistValue',
      columns: [
        'Picklist:AttributePicklist:Name',
        'Name',
        'Code',
        'Abbreviation',
        'DisplayValue',
        'Value',
        'Status',
        'IsDefault',
        'Sequence',
      ],
      rows: bySequence(m.picklistValues).map((v) => [
        picklistName(v.picklistId),
        v.name,
        v.code,
        v.abbreviation,
        v.displayValue || v.name,
        v.value || v.name,
        v.status,
        bool(v.isDefault),
        v.sequence,
      ]),
    },
    {
      name: 'AttributeCategory',
      columns: ['Name', 'Code', 'Description'],
      rows: m.attributeCategories.map((c) => [c.name, c.code, c.description]),
    },
    {
      name: 'AttributeDefinition',
      columns: [
        'Label',
        'Name',
        'Code',
        'DataType',
        'PicklistId:AttributePicklist:Name',
        'DefaultValue',
        'IsActive',
        'Description',
      ],
      rows: m.attributes.map((a) => [
        a.label,
        a.apiName,
        a.code || a.apiName,
        a.dataType,
        a.dataType === 'Picklist' ? picklistName(a.picklistId) : '',
        a.defaultValue,
        bool(a.isActive),
        a.description,
      ]),
    },
    {
      name: 'ProductClassification',
      columns: ['Name', 'Code', 'Status'],
      rows: m.classifications.map((c) => [c.name, c.code, c.status]),
    },
    {
      name: 'ProductClassificationAttr',
      columns: [
        'ProductClassification:ProductClassification:Code',
        'AttributeDefinition:AttributeDefinition:Name',
        'AttributeCategory:AttributeCategory:Code',
        'Sequence',
        'IsRequired',
        'IsHidden',
        'IsReadOnly',
        'DefaultValue',
      ],
      rows: bySequence(m.classificationAttributes).map((ca) => [
        classificationCode(ca.classificationId),
        attrApiName(ca.attributeId),
        attrCategoryCode(ca.attributeCategoryId),
        ca.sequence,
        bool(ca.isRequired),
        bool(ca.isHidden),
        bool(ca.isReadOnly),
        ca.defaultValue,
      ]),
    },
    {
      name: 'ProductSellingModel',
      columns: ['Name', 'SellingModelType', 'PricingTerm', 'PricingTermUnit', 'Status'],
      // Models marked as already in the org are referenced, not created.
      rows: m.sellingModels
        .filter((s) => !s.existingId?.trim())
        .map((s) => [
          s.name,
          s.type,
          s.type === 'TermDefined' ? num(s.pricingTerm) : '',
          s.type === 'TermDefined' ? s.pricingTermUnit : '',
          s.status,
        ]),
    },
    {
      name: 'Pricebook2',
      columns: ['Name', 'IsStandard', 'IsActive'],
      rows: m.pricebooks
        .filter((b) => !b.existingId?.trim())
        .map((b) => [b.name, bool(b.isStandard), bool(b.isActive)]),
    },
    {
      name: 'Product2',
      columns: [
        'Name',
        'ProductCode',
        'Description',
        'Type',
        'RecordType:RecordType:Name',
        'Family',
        'BasedOn:ProductClassification:Name',
        'UnitOfMeasure:UnitOfMeasure:Name',
        'ConfigureDuringSale',
        'IsActive',
        'IsAssetizable',
        'IsSoldOnlyWithOtherProds',
        'AvailabilityDate',
        'DisplayUrl',
      ],
      rows: m.products.map((p) => [
        p.name,
        p.productCode,
        p.description,
        p.type,
        p.recordType,
        p.family,
        classificationName(p.classificationId),
        p.unitOfMeasure,
        p.configureDuringSale,
        bool(p.isActive),
        bool(p.isAssetizable),
        bool(p.isSoldOnlyWithOtherProds),
        p.availabilityDate,
        p.displayUrl,
      ]),
    },
    {
      name: 'ProductCategoryProduct',
      columns: ['ProductCategory:ProductCategory:Code', 'Product:Product2:ProductCode', 'Product Name'],
      rows: m.products.flatMap((p) =>
        p.categoryIds.map((cid) => [categoryCode(cid), p.productCode, p.name]),
      ),
    },
    {
      name: 'ProductSellingModelOption',
      columns: [
        'Product2:Product2:Name',
        ...(anyExistingSellingModel ? ['ProductSellingModelId'] : []),
        'ProductSellingModel:ProductSellingModel:Name',
        'IsDefault',
        'ProrationPolicy:ProrationPolicy:Name',
      ],
      rows: m.sellingModelOptions.map((o) => {
        const existing = existingSellingModelId(o.sellingModelId);
        return [
          productName(o.productId),
          ...(anyExistingSellingModel ? [existing] : []),
          byName(sellingModelName(o.sellingModelId), existing),
          bool(o.isDefault),
          o.prorationPolicy,
        ];
      }),
    },
    {
      name: 'PricebookEntry',
      columns: [
        ...(anyExistingPricebook ? ['Pricebook2Id'] : []),
        'Pricebook2:Pricebook2:Name',
        'Product2:Product2:Name',
        ...(anyExistingSellingModel ? ['ProductSellingModelId'] : []),
        'ProductSellingModel:ProductSellingModel:Name',
        'IsActive',
        'UnitPrice',
        'CurrencyISOCode',
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
          bool(e.isActive),
          e.unitPrice,
          e.currency,
        ];
      }),
    },
    {
      name: 'ProductComponentGroup',
      columns: [
        'ParentProduct:Product2:Name',
        'Name',
        'Code',
        'Sequence',
        'Description',
        'MinBundleComponents',
        'MaxBundleComponents',
      ],
      rows: bySequence(m.componentGroups).map((g) => [
        productName(g.bundleId),
        g.name,
        g.code,
        g.sequence,
        g.description,
        num(g.minComponents),
        num(g.maxComponents),
      ]),
    },
    {
      name: 'ProductRelatedComponent',
      columns: [
        'ParentProduct:Product2:Name',
        'ProductComponentGroup:ProductComponentGroup:Code',
        'ProductRelationshipType:ProductRelationshipType:Name',
        'ChildProduct:Product2:Name',
        'ChildProductClassification:ProductClassification:Name',
        'Sequence',
        'Quantity',
        'IsComponentRequired',
        'IsDefaultComponent',
        'IsQuantityEditable',
        'MinQuantity',
        'MaxQuantity',
        'DoesBundlePriceIncludeChild',
        'QuantityScaleMethod',
      ],
      rows: bySequence(m.relatedComponents).map((rc) => [
        productName(rc.bundleId),
        groupCode(rc.groupId),
        relationshipTypeFor(rc),
        productName(rc.childProductId),
        classificationName(rc.childClassificationId),
        rc.sequence,
        rc.quantity,
        bool(rc.isComponentRequired),
        bool(rc.isDefaultComponent),
        bool(rc.isQuantityEditable),
        num(rc.minQuantity),
        num(rc.maxQuantity),
        bool(rc.doesBundlePriceIncludeChild),
        rc.quantityScaleMethod,
      ]),
    },
  ];
}

function readmeTab(tabs: Tab[]): Tab {
  return {
    name: '_ReadMe',
    columns: ['#', 'Load order', 'Rows', 'Notes'],
    rows: [
      ...LOAD_ORDER.map((name, i) => {
        const tab = tabs.find((t) => t.name === name);
        return [i + 1, name, tab?.rows.length ?? 0, NOTES[name] ?? ''];
      }),
      ['', '', '', ''],
      ['', 'AFTER LOADING', '', 'Records alone do not make a product sellable.'],
      ...POST_LOAD_STEPS.map(([title, detail], i) => [i + 1, title, '', detail]),
    ],
  };
}

const NOTES: Record<string, string> = {
  ProductCatalog: 'Load first. Everything browsable hangs off a catalog.',
  ProductCategory: 'Parent categories must exist before their children; rows are already sorted.',
  AttributePicklist: 'Load before AttributeDefinition, which looks picklists up by Name.',
  AttributePicklistValue: 'Matched to its picklist by Name. Sequence drives the order in the configurator.',
  AttributeCategory: 'Optional grouping used to lay out attributes in the configurator.',
  AttributeDefinition: 'Name is the API name and must be unique across the org.',
  ProductClassification: 'Load before Product2 — products reference it via BasedOn.',
  ProductClassificationAttr: 'Attaches attributes to a classification; every product based on it inherits them.',
  ProductSellingModel:
    'Load before Product2. Models marked as already in the org are not here — their children point at them by Id instead, so do not recreate them.',
  Pricebook2:
    'The standard price book usually exists already. A book marked as already in the org is not here — PricebookEntry points at it by Id instead.',
  Product2: 'Bundles are just products with Type = Bundle. RecordType must already exist in the org.',
  ProductCategoryProduct: 'Publishes products into categories. Necessary but not sufficient — pricing decides the rest.',
  ProductSellingModelOption: 'Without a row here the product has nothing to be priced against and stays invisible.',
  PricebookEntry:
    'The other half of visibility. Where an Id column is filled, leave the matching name column blank — the loader resolves one or the other, not both. Then refresh the decision table — see AFTER LOADING below.',
  ProductComponentGroup: 'Matched to its bundle by product Name. Code must be unique — components join on it.',
  ProductRelatedComponent: 'Load last. Set either ChildProduct or ChildProductClassification, never both.',
};

export async function exportWorkbook(m: CatalogModel, filename = 'rca-product-workbook.xlsx') {
  // ExcelJS is ~1MB, and only this one click needs it.
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const tabs = buildTabs(m);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RCA Product Builder';

  for (const tab of [readmeTab(tabs), ...tabs]) {
    const ws = wb.addWorksheet(tab.name);
    ws.addRow(tab.columns);
    for (const row of tab.rows) ws.addRow(row);

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEF2F7' },
    };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: tab.columns.length },
    };
    ws.columns = tab.columns.map((c, i) => {
      const longest = Math.max(
        c.length,
        ...tab.rows.map((r) => String(r[i] ?? '').length),
      );
      return { width: Math.min(Math.max(longest + 2, 12), 46) };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
