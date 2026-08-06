import type { CatalogModel, Id, Product, PricebookEntry } from './types';

/**
 * Why a product a consultant *thinks* is published still does not show up in
 * Browse Catalog. Category membership is only the first of five conditions —
 * the pricing records are what most catalogs are actually missing.
 */
export type BlockReason =
  | 'inactive'
  | 'technical'
  | 'sold-only-with-others'
  | 'no-category'
  | 'no-selling-model'
  | 'no-price';

export const BLOCK_LABEL: Record<BlockReason, string> = {
  inactive: 'Product is not active',
  technical: 'Technical products are not browsable',
  'sold-only-with-others': 'Sold only with other products, so it is hidden on its own',
  'no-category': 'Not published to any category in this catalog',
  'no-selling-model': 'No ProductSellingModelOption, so it has nothing to be priced against',
  'no-price': 'No active PricebookEntry in this price book for its selling model',
};

/** The selling model a product is quoted under by default. */
export const defaultSellingModelId = (m: CatalogModel, productId: Id): Id | null => {
  const options = m.sellingModelOptions.filter((o) => o.productId === productId);
  return (options.find((o) => o.isDefault) ?? options[0])?.sellingModelId ?? null;
};

/** The entry a rep would see, i.e. the one for the default selling model. */
export const priceOf = (
  m: CatalogModel,
  productId: Id,
  pricebookId: Id | null,
): PricebookEntry | null => {
  if (!pricebookId) return null;
  const smId = defaultSellingModelId(m, productId);
  return (
    m.pricebookEntries.find(
      (e) =>
        e.productId === productId &&
        e.pricebookId === pricebookId &&
        e.isActive &&
        (smId === null || e.sellingModelId === smId),
    ) ?? null
  );
};

/**
 * Everything standing between this product and the catalog. Empty means it
 * shows up. Both the preview and validation read this, so they can never
 * disagree about what a rep will see.
 */
export function blockers(
  m: CatalogModel,
  product: Product,
  catalogId: Id | null,
  pricebookId: Id | null,
): BlockReason[] {
  const out: BlockReason[] = [];

  if (!product.isActive) out.push('inactive');
  if (product.recordType === 'Technical') out.push('technical');
  if (product.isSoldOnlyWithOtherProds) out.push('sold-only-with-others');

  const inCatalog = product.categoryIds.some(
    (cid) => m.categories.find((c) => c.id === cid)?.catalogId === catalogId,
  );
  if (!inCatalog) out.push('no-category');

  const options = m.sellingModelOptions.filter((o) => o.productId === product.id);
  if (options.length === 0) out.push('no-selling-model');
  else {
    const hasEntry = m.pricebookEntries.some(
      (e) =>
        e.productId === product.id &&
        e.pricebookId === pricebookId &&
        e.isActive &&
        options.some((o) => o.sellingModelId === e.sellingModelId),
    );
    if (!hasEntry) out.push('no-price');
  }

  return out;
}

/** Reasons that mean "you meant to publish this and it will not appear". */
export const isMisconfigured = (reasons: BlockReason[]) =>
  reasons.length > 0 &&
  !reasons.includes('technical') &&
  !reasons.includes('sold-only-with-others') &&
  !reasons.includes('inactive') &&
  !reasons.includes('no-category');
