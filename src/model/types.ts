/**
 * Domain model for a Revenue Cloud Advanced product catalog.
 *
 * Everything is keyed by a local `id` (uuid-ish) so the UI can rename freely.
 * Export resolves ids into the natural keys Salesforce's import expects
 * (Name / Code), never the local id.
 */

export type Id = string;

export type Status = 'Active' | 'Draft' | 'Obsolete';

/** AttributeDefinition.DataType — the subset RCA actually accepts. */
export type AttributeDataType =
  | 'Text'
  | 'Number'
  | 'Checkbox'
  | 'Picklist'
  | 'Date'
  | 'DateTime'
  | 'Currency'
  | 'Percent';

/** Product2.Type. An empty type means a plain standalone product. */
export type ProductType = '' | 'Bundle' | 'Set' | 'Bundle Proxy';

export type ConfigureDuringSale = 'Allowed' | 'NotAllowed';

export type RecordTypeName = 'Commercial' | 'Technical';

/** ProductRelatedComponent.QuantityScaleMethod */
export type QuantityScaleMethod = '' | 'Constant' | 'Proportional';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface Catalog {
  id: Id;
  name: string;
  code: string;
  description: string;
}

export interface Category {
  id: Id;
  catalogId: Id;
  /** Parent category id, or null for a top-level category. */
  parentId: Id | null;
  name: string;
  code: string;
  sortOrder: number;
  showInMenu: boolean;
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

export interface AttributePicklist {
  id: Id;
  name: string;
  code: string;
  status: Status;
  /** AttributePicklist.DataType — the type of the values it holds. */
  dataType: 'Text' | 'Number';
  description: string;
}

export interface PicklistValue {
  id: Id;
  picklistId: Id;
  name: string;
  code: string;
  abbreviation: string;
  displayValue: string;
  value: string;
  status: Status;
  isDefault: boolean;
  sequence: number;
}

export interface AttributeCategory {
  id: Id;
  name: string;
  code: string;
  description: string;
}

export interface AttributeDefinition {
  id: Id;
  /** Human label shown in the configurator. */
  label: string;
  /** Developer/API name. Must be unique and identifier-safe. */
  apiName: string;
  code: string;
  dataType: AttributeDataType;
  /** Required when dataType === 'Picklist'. */
  picklistId: Id | null;
  defaultValue: string;
  isActive: boolean;
  description: string;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface ProductClassification {
  id: Id;
  name: string;
  code: string;
  status: Status;
}

/** ProductClassificationAttr — attaches an attribute to a classification. */
export interface ClassificationAttribute {
  id: Id;
  classificationId: Id;
  attributeId: Id;
  attributeCategoryId: Id | null;
  sequence: number;
  isRequired: boolean;
  isHidden: boolean;
  isReadOnly: boolean;
  /** Overrides AttributeDefinition.defaultValue for this classification. */
  defaultValue: string;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface Product {
  id: Id;
  name: string;
  productCode: string;
  description: string;
  type: ProductType;
  recordType: RecordTypeName;
  family: string;
  /** Product2.BasedOnId → ProductClassification. */
  classificationId: Id | null;
  unitOfMeasure: string;
  configureDuringSale: ConfigureDuringSale;
  isActive: boolean;
  isAssetizable: boolean;
  isSoldOnlyWithOtherProds: boolean;
  availabilityDate: string;
  displayUrl: string;
  /** Category ids this product is published under (ProductCategoryProduct). */
  categoryIds: Id[];
}

// ---------------------------------------------------------------------------
// Pricing
//
// A product is only reachable in Browse Catalog once it offers a selling model
// and has a PricebookEntry for it. Category membership alone is not enough.
// ---------------------------------------------------------------------------

export type SellingModelType = 'OneTime' | 'Evergreen' | 'TermDefined';

export type TermUnit = '' | 'Days' | 'Months' | 'Years';

export interface SellingModel {
  id: Id;
  name: string;
  type: SellingModelType;
  /** Required when type is TermDefined. */
  pricingTerm: number | null;
  pricingTermUnit: TermUnit;
  status: Status;
  /**
   * Salesforce Id of a record that already exists in the org. When set, the workbook does
   * not create this selling model — it is left out of the `ProductSellingModel` tab, and
   * `ProductSellingModelOption` / `PricebookEntry` point at it by Id instead of by name.
   *
   * Optional so catalogs saved before this existed still load.
   */
  existingId?: string;
}

/** ProductSellingModelOption — which selling models a product is sold under. */
export interface SellingModelOption {
  id: Id;
  productId: Id;
  sellingModelId: Id;
  isDefault: boolean;
  /** Name of a ProrationPolicy that already exists in the org. */
  prorationPolicy: string;
}

export interface Pricebook {
  id: Id;
  name: string;
  isStandard: boolean;
  isActive: boolean;
  /**
   * Salesforce Id of a price book that already exists in the org — almost always the
   * standard one. When set, the workbook does not create it: the `Pricebook2` tab leaves it
   * out and `PricebookEntry` points at it by Id instead of by name.
   *
   * Optional so catalogs saved before this existed still load.
   */
  existingId?: string;
}

export interface PricebookEntry {
  id: Id;
  pricebookId: Id;
  productId: Id;
  sellingModelId: Id;
  unitPrice: number;
  currency: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Bundle structure
// ---------------------------------------------------------------------------

export interface ComponentGroup {
  id: Id;
  /** The bundle Product this group belongs to. */
  bundleId: Id;
  name: string;
  code: string;
  sequence: number;
  description: string;
  minComponents: number | null;
  maxComponents: number | null;
}

export interface RelatedComponent {
  id: Id;
  bundleId: Id;
  groupId: Id;
  /** Exactly one of childProductId / childClassificationId is set. */
  childProductId: Id | null;
  childClassificationId: Id | null;
  sequence: number;
  quantity: number;
  isComponentRequired: boolean;
  isDefaultComponent: boolean;
  isQuantityEditable: boolean;
  minQuantity: number | null;
  maxQuantity: number | null;
  doesBundlePriceIncludeChild: boolean;
  quantityScaleMethod: QuantityScaleMethod;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface CatalogModel {
  catalogs: Catalog[];
  categories: Category[];
  picklists: AttributePicklist[];
  picklistValues: PicklistValue[];
  attributeCategories: AttributeCategory[];
  attributes: AttributeDefinition[];
  classifications: ProductClassification[];
  classificationAttributes: ClassificationAttribute[];
  products: Product[];
  sellingModels: SellingModel[];
  sellingModelOptions: SellingModelOption[];
  pricebooks: Pricebook[];
  pricebookEntries: PricebookEntry[];
  componentGroups: ComponentGroup[];
  relatedComponents: RelatedComponent[];
}

export const emptyModel = (): CatalogModel => ({
  catalogs: [],
  categories: [],
  picklists: [],
  picklistValues: [],
  attributeCategories: [],
  attributes: [],
  classifications: [],
  classificationAttributes: [],
  products: [],
  sellingModels: [],
  sellingModelOptions: [],
  pricebooks: [],
  pricebookEntries: [],
  componentGroups: [],
  relatedComponents: [],
});

/** The relationship type name RCA expects, chosen by what the component points at. */
export const relationshipTypeFor = (rc: RelatedComponent): string =>
  rc.childClassificationId
    ? 'Bundle to Product Classification Component Relationship'
    : 'Bundle to Bundle Component Relationship';
