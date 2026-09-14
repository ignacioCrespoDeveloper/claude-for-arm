import {
  type CatalogModel,
  type AttributeDataType,
  type AttributeDefinition,
  type AttributePicklist,
  type Catalog,
  type Category,
  type ComponentGroup,
  type ConfigureDuringSale,
  type Pricebook,
  type Product,
  type ProductClassification,
  type ProductType,
  type QuantityScaleMethod,
  type RecordTypeName,
  type SellingModel,
  type SellingModelType,
  type Status,
  type TermUnit,
  emptyModel,
} from '../model/types';

/**
 * The exact inverse of `buildTabs`: read the workbook this tool exports back
 * into a CatalogModel, so a downloaded .xlsx is also a save file. Every lookup
 * the export writes by name or code is resolved back to a local id here.
 *
 * Anything that does not resolve becomes a warning, never a crash — a workbook
 * that has been edited by hand should degrade to "this row was skipped, here is
 * why", not refuse to load.
 */

export interface RawTab {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface ImportResult {
  model: CatalogModel;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Reading a workbook object into plain string tabs
// ---------------------------------------------------------------------------

interface CellLike {
  value: unknown;
}
interface WorksheetLike {
  name: string;
  rowCount: number;
  columnCount: number;
  getRow(n: number): { getCell(n: number): CellLike };
}
export interface WorkbookLike {
  worksheets: WorksheetLike[];
}

/** ExcelJS cell values come in many shapes; flatten them all to a string. */
const cellString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return o.richText.map((r) => cellString((r as { text?: unknown }).text)).join('');
    if ('result' in o) return cellString(o.result);
    if ('text' in o) return cellString(o.text);
  }
  return String(v).trim();
};

/** Works on both the browser and Node ExcelJS workbook — the shape is the same. */
export function workbookToTabs(wb: WorkbookLike): RawTab[] {
  const tabs: RawTab[] = [];
  for (const ws of wb.worksheets) {
    if (ws.name.startsWith('_')) continue; // _ReadMe and friends
    const header = ws.getRow(1);
    const columns: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) columns.push(cellString(header.getCell(c).value));
    while (columns.length && columns[columns.length - 1] === '') columns.pop();
    if (columns.length === 0) continue;

    const rows: string[][] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const values = columns.map((_, c) => cellString(row.getCell(c + 1).value));
      if (values.some((v) => v !== '')) rows.push(values);
    }
    tabs.push({ name: ws.name, columns, rows });
  }
  return tabs;
}

// ---------------------------------------------------------------------------
// Tabs → model
// ---------------------------------------------------------------------------

const isTrue = (s: string) => /^(true|1|yes|y)$/i.test(s);
/** Blank cells fall back to the field's factory default rather than to false. */
const asBool = (s: string, blank = false) => (s === '' ? blank : isTrue(s));
const asNum = (s: string): number | null => {
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function modelFromTabs(tabs: RawTab[]): ImportResult {
  const warnings: string[] = [];
  const model = emptyModel();

  let seq = 0;
  const uid = () => `imp${(seq++).toString(36)}`;

  /** Row accessors keyed by header name, so a reordered column still reads. */
  const rowsOf = (tabName: string) => {
    const tab = tabs.find((t) => t.name === tabName);
    if (!tab) return [];
    const index = new Map(tab.columns.map((c, i) => [c, i]));
    return tab.rows.map((values, i) => ({
      line: i + 2, // spreadsheet row number, header is row 1
      get: (col: string) => {
        const ci = index.get(col);
        return ci === undefined ? '' : (values[ci] ?? '');
      },
      has: (col: string) => index.has(col),
    }));
  };

  const skip = (tabName: string, line: number, why: string) =>
    warnings.push(`${tabName} row ${line}: ${why} — row skipped`);
  const note = (tabName: string, line: number, why: string) =>
    warnings.push(`${tabName} row ${line}: ${why}`);

  // 1. ProductCatalog ---------------------------------------------------------
  const catalogByCode = new Map<string, Catalog>();
  for (const r of rowsOf('ProductCatalog')) {
    const cat: Catalog = { id: uid(), name: r.get('Name'), code: r.get('Code'), description: r.get('Description') };
    model.catalogs.push(cat);
    if (cat.code) catalogByCode.set(cat.code, cat);
  }

  // 2. ProductCategory — two passes so a child can precede its parent ---------
  const categoryByCode = new Map<string, Category>();
  const pendingParents: { cat: Category; parentCode: string; line: number }[] = [];
  for (const r of rowsOf('ProductCategory')) {
    const catalogCode = r.get('Catalog:ProductCatalog:Code');
    // A blank code is forgiven when there is only one catalog to belong to.
    const catalog = catalogCode ? catalogByCode.get(catalogCode) : model.catalogs.length === 1 ? model.catalogs[0] : undefined;
    if (!catalog) {
      skip('ProductCategory', r.line, `catalog code "${catalogCode}" matches no catalog`);
      continue;
    }
    const cat: Category = {
      id: uid(),
      catalogId: catalog.id,
      parentId: null,
      name: r.get('Name'),
      code: r.get('Code'),
      sortOrder: asNum(r.get('SortOrder')) ?? model.categories.length + 1,
      showInMenu: asBool(r.get('IsNavigational'), true),
    };
    model.categories.push(cat);
    if (cat.code) categoryByCode.set(cat.code, cat);
    const parentCode = r.get('ParentCategory:ProductCategory:Code');
    if (parentCode) pendingParents.push({ cat, parentCode, line: r.line });
  }
  for (const { cat, parentCode, line } of pendingParents) {
    const parent = categoryByCode.get(parentCode);
    if (parent) cat.parentId = parent.id;
    else note('ProductCategory', line, `parent code "${parentCode}" matches no category`);
  }

  // 3. AttributePicklist ------------------------------------------------------
  const picklistByName = new Map<string, AttributePicklist>();
  for (const r of rowsOf('AttributePicklist')) {
    const p: AttributePicklist = {
      id: uid(),
      name: r.get('Name'),
      code: r.get('Code'),
      status: (r.get('Status') || 'Active') as Status,
      dataType: r.get('DataType') === 'Number' ? 'Number' : 'Text',
      description: r.get('Description'),
    };
    model.picklists.push(p);
    if (p.name) picklistByName.set(p.name, p);
  }

  // 4. AttributePicklistValue -------------------------------------------------
  for (const r of rowsOf('AttributePicklistValue')) {
    const picklist = picklistByName.get(r.get('Picklist:AttributePicklist:Name'));
    if (!picklist) {
      skip('AttributePicklistValue', r.line, `picklist "${r.get('Picklist:AttributePicklist:Name')}" matches no AttributePicklist row`);
      continue;
    }
    model.picklistValues.push({
      id: uid(),
      picklistId: picklist.id,
      name: r.get('Name'),
      code: r.get('Code'),
      abbreviation: r.get('Abbreviation'),
      displayValue: r.get('DisplayValue'),
      value: r.get('Value'),
      status: (r.get('Status') || 'Active') as Status,
      isDefault: asBool(r.get('IsDefault')),
      sequence: asNum(r.get('Sequence')) ?? model.picklistValues.length + 1,
    });
  }

  // 5. AttributeCategory ------------------------------------------------------
  const attrCategoryByCode = new Map<string, { id: string }>();
  for (const r of rowsOf('AttributeCategory')) {
    const c = { id: uid(), name: r.get('Name'), code: r.get('Code'), description: r.get('Description') };
    model.attributeCategories.push(c);
    if (c.code) attrCategoryByCode.set(c.code, c);
  }

  // 6. AttributeDefinition ----------------------------------------------------
  const attributeByApiName = new Map<string, AttributeDefinition>();
  for (const r of rowsOf('AttributeDefinition')) {
    const dataType = (r.get('DataType') || 'Text') as AttributeDataType;
    const picklistName = r.get('PicklistId:AttributePicklist:Name');
    const picklist = picklistName ? picklistByName.get(picklistName) : undefined;
    if (picklistName && !picklist)
      note('AttributeDefinition', r.line, `picklist "${picklistName}" matches no AttributePicklist row`);
    const a: AttributeDefinition = {
      id: uid(),
      label: r.get('Label'),
      apiName: r.get('Name'),
      code: r.get('Code'),
      dataType,
      picklistId: picklist?.id ?? null,
      defaultValue: r.get('DefaultValue'),
      isActive: asBool(r.get('IsActive'), true),
      description: r.get('Description'),
    };
    model.attributes.push(a);
    if (a.apiName) attributeByApiName.set(a.apiName, a);
  }

  // 7. ProductClassification --------------------------------------------------
  const classificationByName = new Map<string, ProductClassification>();
  const classificationByCode = new Map<string, ProductClassification>();
  for (const r of rowsOf('ProductClassification')) {
    const c: ProductClassification = {
      id: uid(),
      name: r.get('Name'),
      code: r.get('Code'),
      status: (r.get('Status') || 'Active') as Status,
    };
    model.classifications.push(c);
    if (c.name) classificationByName.set(c.name, c);
    if (c.code) classificationByCode.set(c.code, c);
  }

  // 8. ProductClassificationAttr ----------------------------------------------
  for (const r of rowsOf('ProductClassificationAttr')) {
    const classification = classificationByCode.get(r.get('ProductClassification:ProductClassification:Code'));
    const attribute = attributeByApiName.get(r.get('AttributeDefinition:AttributeDefinition:Name'));
    if (!classification || !attribute) {
      skip(
        'ProductClassificationAttr',
        r.line,
        !classification
          ? `classification code "${r.get('ProductClassification:ProductClassification:Code')}" matches no classification`
          : `attribute "${r.get('AttributeDefinition:AttributeDefinition:Name')}" matches no AttributeDefinition row`,
      );
      continue;
    }
    const categoryCode = r.get('AttributeCategory:AttributeCategory:Code');
    const attrCategory = categoryCode ? attrCategoryByCode.get(categoryCode) : undefined;
    if (categoryCode && !attrCategory)
      note('ProductClassificationAttr', r.line, `attribute category code "${categoryCode}" matches no AttributeCategory row`);
    model.classificationAttributes.push({
      id: uid(),
      classificationId: classification.id,
      attributeId: attribute.id,
      attributeCategoryId: attrCategory?.id ?? null,
      sequence: asNum(r.get('Sequence')) ?? model.classificationAttributes.length + 1,
      isRequired: asBool(r.get('IsRequired')),
      isHidden: asBool(r.get('IsHidden')),
      isReadOnly: asBool(r.get('IsReadOnly')),
      defaultValue: r.get('DefaultValue'),
    });
  }

  // 9. ProductSellingModel ----------------------------------------------------
  // Models referenced by Id are not in this tab; they are synthesized on first
  // use below, carrying the Id but no name — the workbook never had one.
  const sellingModelByName = new Map<string, SellingModel>();
  const sellingModelByExistingId = new Map<string, SellingModel>();
  for (const r of rowsOf('ProductSellingModel')) {
    const m: SellingModel = {
      id: uid(),
      name: r.get('Name'),
      type: (r.get('SellingModelType') || 'OneTime') as SellingModelType,
      pricingTerm: asNum(r.get('PricingTerm')),
      pricingTermUnit: r.get('PricingTermUnit') as TermUnit,
      status: (r.get('Status') || 'Active') as Status,
    };
    model.sellingModels.push(m);
    if (m.name) sellingModelByName.set(m.name, m);
  }
  const existingSellingModel = (sfId: string): SellingModel => {
    let m = sellingModelByExistingId.get(sfId);
    if (!m) {
      m = { id: uid(), name: '', type: 'OneTime', pricingTerm: null, pricingTermUnit: '', status: 'Active', existingId: sfId };
      model.sellingModels.push(m);
      sellingModelByExistingId.set(sfId, m);
    }
    return m;
  };

  // 10. Pricebook2 ------------------------------------------------------------
  const pricebookByName = new Map<string, Pricebook>();
  const pricebookByExistingId = new Map<string, Pricebook>();
  for (const r of rowsOf('Pricebook2')) {
    const b: Pricebook = {
      id: uid(),
      name: r.get('Name'),
      isStandard: asBool(r.get('IsStandard')),
      isActive: asBool(r.get('IsActive'), true),
    };
    model.pricebooks.push(b);
    if (b.name) pricebookByName.set(b.name, b);
  }
  const existingPricebook = (sfId: string): Pricebook => {
    let b = pricebookByExistingId.get(sfId);
    if (!b) {
      b = { id: uid(), name: '', isStandard: false, isActive: true, existingId: sfId };
      model.pricebooks.push(b);
      pricebookByExistingId.set(sfId, b);
    }
    return b;
  };

  // 11. Product2 --------------------------------------------------------------
  const productByName = new Map<string, Product>();
  const productByCode = new Map<string, Product>();
  for (const r of rowsOf('Product2')) {
    if (!r.get('Name')) {
      skip('Product2', r.line, 'a product needs a Name — every other tab joins on it');
      continue;
    }
    const classificationName = r.get('BasedOn:ProductClassification:Name');
    const classification = classificationName ? classificationByName.get(classificationName) : undefined;
    if (classificationName && !classification)
      note('Product2', r.line, `classification "${classificationName}" matches no ProductClassification row`);
    const p: Product = {
      id: uid(),
      name: r.get('Name'),
      productCode: r.get('ProductCode'),
      description: r.get('Description'),
      type: r.get('Type') as ProductType,
      recordType: (r.get('RecordType:RecordType:Name') || 'Commercial') as RecordTypeName,
      family: r.get('Family'),
      classificationId: classification?.id ?? null,
      unitOfMeasure: r.get('UnitOfMeasure:UnitOfMeasure:Name'),
      configureDuringSale: (r.get('ConfigureDuringSale') || 'Allowed') as ConfigureDuringSale,
      isActive: asBool(r.get('IsActive'), true),
      isAssetizable: asBool(r.get('IsAssetizable'), true),
      isSoldOnlyWithOtherProds: asBool(r.get('IsSoldOnlyWithOtherProds')),
      availabilityDate: r.get('AvailabilityDate'),
      displayUrl: r.get('DisplayUrl'),
      categoryIds: [],
    };
    model.products.push(p);
    productByName.set(p.name, p);
    if (p.productCode) productByCode.set(p.productCode, p);
  }

  // 12. ProductCategoryProduct ------------------------------------------------
  for (const r of rowsOf('ProductCategoryProduct')) {
    const product =
      productByCode.get(r.get('Product:Product2:ProductCode')) ?? productByName.get(r.get('Product Name'));
    const category = categoryByCode.get(r.get('ProductCategory:ProductCategory:Code'));
    if (!product || !category) {
      skip(
        'ProductCategoryProduct',
        r.line,
        !product
          ? `product code "${r.get('Product:Product2:ProductCode')}" matches no Product2 row`
          : `category code "${r.get('ProductCategory:ProductCategory:Code')}" matches no ProductCategory row`,
      );
      continue;
    }
    if (!product.categoryIds.includes(category.id)) product.categoryIds.push(category.id);
  }

  // 13. ProductSellingModelOption ---------------------------------------------
  const resolveSellingModel = (r: { get: (c: string) => string }): SellingModel | undefined => {
    const sfId = r.get('ProductSellingModelId');
    if (sfId) return existingSellingModel(sfId);
    return sellingModelByName.get(r.get('ProductSellingModel:ProductSellingModel:Name'));
  };
  for (const r of rowsOf('ProductSellingModelOption')) {
    const product = productByName.get(r.get('Product2:Product2:Name'));
    const sellingModel = resolveSellingModel(r);
    if (!product || !sellingModel) {
      skip(
        'ProductSellingModelOption',
        r.line,
        !product
          ? `product "${r.get('Product2:Product2:Name')}" matches no Product2 row`
          : `selling model "${r.get('ProductSellingModel:ProductSellingModel:Name')}" matches no ProductSellingModel row`,
      );
      continue;
    }
    model.sellingModelOptions.push({
      id: uid(),
      productId: product.id,
      sellingModelId: sellingModel.id,
      isDefault: asBool(r.get('IsDefault')),
      prorationPolicy: r.get('ProrationPolicy:ProrationPolicy:Name'),
    });
  }

  // 14. PricebookEntry --------------------------------------------------------
  for (const r of rowsOf('PricebookEntry')) {
    const pbId = r.get('Pricebook2Id');
    const pricebook = pbId ? existingPricebook(pbId) : pricebookByName.get(r.get('Pricebook2:Pricebook2:Name'));
    const product = productByName.get(r.get('Product2:Product2:Name'));
    const sellingModel = resolveSellingModel(r);
    if (!pricebook || !product || !sellingModel) {
      skip(
        'PricebookEntry',
        r.line,
        !pricebook
          ? `price book "${r.get('Pricebook2:Pricebook2:Name')}" matches no Pricebook2 row`
          : !product
            ? `product "${r.get('Product2:Product2:Name')}" matches no Product2 row`
            : `selling model "${r.get('ProductSellingModel:ProductSellingModel:Name')}" matches no ProductSellingModel row`,
      );
      continue;
    }
    model.pricebookEntries.push({
      id: uid(),
      pricebookId: pricebook.id,
      productId: product.id,
      sellingModelId: sellingModel.id,
      unitPrice: asNum(r.get('UnitPrice')) ?? 0,
      currency: r.get('CurrencyISOCode') || 'USD',
      isActive: asBool(r.get('IsActive'), true),
    });
  }

  // 15. ProductComponentGroup -------------------------------------------------
  const groupByBundleAndCode = new Map<string, ComponentGroup>();
  const groupByCode = new Map<string, ComponentGroup>();
  for (const r of rowsOf('ProductComponentGroup')) {
    const bundle = productByName.get(r.get('ParentProduct:Product2:Name'));
    if (!bundle) {
      skip('ProductComponentGroup', r.line, `bundle "${r.get('ParentProduct:Product2:Name')}" matches no Product2 row`);
      continue;
    }
    const g: ComponentGroup = {
      id: uid(),
      bundleId: bundle.id,
      name: r.get('Name'),
      code: r.get('Code'),
      sequence: asNum(r.get('Sequence')) ?? model.componentGroups.length + 1,
      description: r.get('Description'),
      minComponents: asNum(r.get('MinBundleComponents')),
      maxComponents: asNum(r.get('MaxBundleComponents')),
    };
    model.componentGroups.push(g);
    if (g.code) {
      groupByBundleAndCode.set(`${bundle.id} ${g.code}`, g);
      if (!groupByCode.has(g.code)) groupByCode.set(g.code, g);
    }
  }

  // 16. ProductRelatedComponent -----------------------------------------------
  for (const r of rowsOf('ProductRelatedComponent')) {
    const bundle = productByName.get(r.get('ParentProduct:Product2:Name'));
    const code = r.get('ProductComponentGroup:ProductComponentGroup:Code');
    const group = bundle ? (groupByBundleAndCode.get(`${bundle.id} ${code}`) ?? groupByCode.get(code)) : undefined;
    if (!bundle || !group) {
      skip(
        'ProductRelatedComponent',
        r.line,
        !bundle
          ? `bundle "${r.get('ParentProduct:Product2:Name')}" matches no Product2 row`
          : `group code "${code}" matches no ProductComponentGroup row`,
      );
      continue;
    }
    const childName = r.get('ChildProduct:Product2:Name');
    const childClassName = r.get('ChildProductClassification:ProductClassification:Name');
    const childProduct = childName ? productByName.get(childName) : undefined;
    const childClassification = childClassName ? classificationByName.get(childClassName) : undefined;
    if (childName && !childProduct)
      note('ProductRelatedComponent', r.line, `child product "${childName}" matches no Product2 row`);
    if (childClassName && !childClassification)
      note('ProductRelatedComponent', r.line, `child classification "${childClassName}" matches no ProductClassification row`);
    model.relatedComponents.push({
      id: uid(),
      bundleId: bundle.id,
      groupId: group.id,
      childProductId: childProduct?.id ?? null,
      childClassificationId: childClassification?.id ?? null,
      sequence: asNum(r.get('Sequence')) ?? model.relatedComponents.length + 1,
      quantity: asNum(r.get('Quantity')) ?? 1,
      isComponentRequired: asBool(r.get('IsComponentRequired')),
      isDefaultComponent: asBool(r.get('IsDefaultComponent')),
      isQuantityEditable: asBool(r.get('IsQuantityEditable'), true),
      minQuantity: asNum(r.get('MinQuantity')),
      maxQuantity: asNum(r.get('MaxQuantity')),
      doesBundlePriceIncludeChild: asBool(r.get('DoesBundlePriceIncludeChild')),
      quantityScaleMethod: r.get('QuantityScaleMethod') as QuantityScaleMethod,
    });
  }

  return { model, warnings };
}

/** True when the workbook produced nothing at all — probably not our file. */
export const isEmptyImport = (m: CatalogModel): boolean =>
  Object.values(m).every((rows) => Array.isArray(rows) && rows.length === 0);

// ---------------------------------------------------------------------------
// Browser entry point
// ---------------------------------------------------------------------------

export async function importWorkbook(file: File): Promise<ImportResult> {
  // Same lazy ExcelJS load as the export — only this one click needs it.
  const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return modelFromTabs(workbookToTabs(wb as unknown as WorkbookLike));
}
