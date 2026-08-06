import { type CatalogModel, type Id } from './types';

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  /** Wizard step this issue belongs to, so the UI can badge and deep-link it. */
  step: StepKey;
  message: string;
}

export type StepKey =
  | 'catalog'
  | 'picklists'
  | 'attributes'
  | 'classifications'
  | 'products'
  | 'bundles'
  | 'pricing';

const dupes = <T>(rows: T[], key: (r: T) => string): string[] => {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = key(r).trim().toLowerCase();
    if (!k) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
};

const API_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Every check here maps to something that actually fails (or silently
 * misbehaves) on import into Revenue Cloud — not style preferences.
 */
export function validate(m: CatalogModel): Issue[] {
  const issues: Issue[] = [];
  const err = (step: StepKey, message: string) => issues.push({ severity: 'error', step, message });
  const warn = (step: StepKey, message: string) => issues.push({ severity: 'warning', step, message });

  const label = (name: string, fallback: string) => (name.trim() ? name.trim() : fallback);

  // --- Catalog -------------------------------------------------------------
  for (const c of m.catalogs) {
    if (!c.name.trim()) err('catalog', 'A catalog has no name.');
    if (!c.code.trim()) err('catalog', `Catalog "${label(c.name, 'untitled')}" has no code.`);
  }
  for (const d of dupes(m.catalogs, (c) => c.code)) err('catalog', `Two catalogs share the code "${d}".`);
  for (const d of dupes(m.categories, (c) => c.code)) err('catalog', `Two categories share the code "${d}".`);
  for (const c of m.categories) {
    if (!c.name.trim()) err('catalog', 'A category has no name.');
    if (!c.code.trim()) err('catalog', `Category "${label(c.name, 'untitled')}" has no code.`);
    if (c.parentId && !m.categories.some((p) => p.id === c.parentId))
      err('catalog', `Category "${label(c.name, 'untitled')}" points at a parent that no longer exists.`);
    if (c.parentId) {
      const parent = m.categories.find((p) => p.id === c.parentId);
      if (parent && parent.catalogId !== c.catalogId)
        err('catalog', `Category "${label(c.name, 'untitled')}" sits under a parent from a different catalog.`);
    }
  }

  // --- Picklists -----------------------------------------------------------
  for (const p of m.picklists) {
    if (!p.name.trim()) err('picklists', 'A picklist has no name.');
    const values = m.picklistValues.filter((v) => v.picklistId === p.id);
    if (values.length === 0)
      err('picklists', `Picklist "${label(p.name, 'untitled')}" has no values, so any attribute using it renders empty.`);
    if (values.filter((v) => v.isDefault).length > 1)
      err('picklists', `Picklist "${label(p.name, 'untitled')}" has more than one default value.`);
    for (const d of dupes(values, (v) => v.code))
      err('picklists', `Picklist "${label(p.name, 'untitled')}" repeats the value code "${d}".`);
  }
  for (const d of dupes(m.picklists, (p) => p.name)) err('picklists', `Two picklists share the name "${d}".`);
  for (const v of m.picklistValues) {
    if (!v.name.trim()) err('picklists', 'A picklist value has no name.');
    if (!v.code.trim()) err('picklists', `Picklist value "${label(v.name, 'untitled')}" has no code.`);
  }

  // --- Attributes ----------------------------------------------------------
  for (const a of m.attributes) {
    const who = label(a.label, 'untitled');
    if (!a.label.trim()) err('attributes', 'An attribute has no label.');
    if (!a.apiName.trim()) err('attributes', `Attribute "${who}" has no API name.`);
    else if (!API_NAME.test(a.apiName))
      err('attributes', `Attribute API name "${a.apiName}" must start with a letter and use only letters, numbers and underscores.`);
    if (a.dataType === 'Picklist' && !a.picklistId)
      err('attributes', `Attribute "${who}" is a Picklist but no picklist is selected.`);
    if (a.dataType !== 'Picklist' && a.picklistId)
      warn('attributes', `Attribute "${who}" has a picklist attached but its data type is ${a.dataType}; the picklist is ignored.`);
    if (a.dataType === 'Checkbox' && a.defaultValue && !['true', 'false'].includes(a.defaultValue.trim().toLowerCase()))
      err('attributes', `Attribute "${who}" is a Checkbox so its default must be true or false.`);
    if (a.dataType === 'Picklist' && a.picklistId && a.defaultValue.trim()) {
      const ok = m.picklistValues.some(
        (v) => v.picklistId === a.picklistId && v.value.trim() === a.defaultValue.trim(),
      );
      if (!ok) err('attributes', `Attribute "${who}" defaults to "${a.defaultValue}", which is not a value of its picklist.`);
    }
  }
  for (const d of dupes(m.attributes, (a) => a.apiName))
    err('attributes', `Two attributes share the API name "${d}".`);
  for (const d of dupes(m.attributeCategories, (c) => c.code))
    err('attributes', `Two attribute categories share the code "${d}".`);

  // --- Classifications -----------------------------------------------------
  for (const c of m.classifications) {
    const who = label(c.name, 'untitled');
    if (!c.name.trim()) err('classifications', 'A classification has no name.');
    if (!c.code.trim()) err('classifications', `Classification "${who}" has no code.`);
  }
  for (const d of dupes(m.classifications, (c) => c.code))
    err('classifications', `Two classifications share the code "${d}".`);
  const caSeen = new Set<string>();
  for (const ca of m.classificationAttributes) {
    const cls = m.classifications.find((c) => c.id === ca.classificationId);
    const attr = m.attributes.find((a) => a.id === ca.attributeId);
    if (!cls || !attr) {
      err('classifications', 'An attribute assignment points at a classification or attribute that no longer exists.');
      continue;
    }
    const key = `${ca.classificationId}|${ca.attributeId}`;
    if (caSeen.has(key))
      err('classifications', `Classification "${cls.name}" has "${attr.label}" assigned twice.`);
    caSeen.add(key);
    if (ca.isRequired && ca.isHidden)
      err('classifications', `"${attr.label}" on "${cls.name}" is both required and hidden, so the bundle can never be configured.`);
    if (ca.isRequired && ca.isReadOnly && !ca.defaultValue.trim() && !attr.defaultValue.trim())
      err('classifications', `"${attr.label}" on "${cls.name}" is required and read-only but has no default value.`);
  }

  // --- Products ------------------------------------------------------------
  for (const p of m.products) {
    const who = label(p.name, 'untitled');
    if (!p.name.trim()) err('products', 'A product has no name.');
    if (!p.productCode.trim()) err('products', `Product "${who}" has no product code.`);
    if (p.classificationId && !m.classifications.some((c) => c.id === p.classificationId))
      err('products', `Product "${who}" is based on a classification that no longer exists.`);
    if (p.type === 'Bundle' && p.configureDuringSale !== 'Allowed')
      warn('products', `Bundle "${who}" has Configure During Sale set to NotAllowed, so it cannot be configured in a quote.`);
    if (p.recordType === 'Technical' && p.categoryIds.length > 0)
      warn('products', `Technical product "${who}" is published to a catalog category; technical products are normally not browsable.`);
    if (p.recordType === 'Commercial' && p.categoryIds.length === 0 && !p.isSoldOnlyWithOtherProds)
      warn('products', `Product "${who}" is not in any category, so it will not appear in Browse Catalog.`);
  }
  for (const d of dupes(m.products, (p) => p.productCode))
    err('products', `Two products share the product code "${d}".`);
  for (const d of dupes(m.products, (p) => p.name))
    err('products', `Two products share the name "${d}"; the import matches components by name.`);

  // --- Pricing -------------------------------------------------------------
  for (const sm of m.sellingModels) {
    const who = label(sm.name, 'untitled');
    if (!sm.name.trim()) err('pricing', 'A selling model has no name.');
    if (sm.type === 'TermDefined') {
      if (!sm.pricingTerm)
        err('pricing', `Selling model "${who}" is term-defined but has no pricing term.`);
      if (!sm.pricingTermUnit)
        err('pricing', `Selling model "${who}" is term-defined but has no term unit.`);
    }
    if (sm.type !== 'TermDefined' && sm.pricingTerm)
      warn('pricing', `Selling model "${who}" sets a pricing term but is ${sm.type}, so the term is ignored.`);
  }
  for (const d of dupes(m.sellingModels, (s) => s.name))
    err('pricing', `Two selling models share the name "${d}"; pricing rows are matched by name.`);
  for (const d of dupes(m.pricebooks, (p) => p.name))
    err('pricing', `Two price books share the name "${d}".`);
  if (m.pricebooks.filter((p) => p.isStandard).length > 1)
    err('pricing', 'More than one price book is marked standard; an org has exactly one.');

  const optionSeen = new Set<string>();
  for (const o of m.sellingModelOptions) {
    const product = m.products.find((p) => p.id === o.productId);
    const sm = m.sellingModels.find((s) => s.id === o.sellingModelId);
    if (!product || !sm) {
      err('pricing', 'A selling model option points at a product or selling model that no longer exists.');
      continue;
    }
    const key = `${o.productId}|${o.sellingModelId}`;
    if (optionSeen.has(key))
      err('pricing', `"${product.name}" offers "${sm.name}" twice.`);
    optionSeen.add(key);
  }

  const entrySeen = new Set<string>();
  for (const e of m.pricebookEntries) {
    const product = m.products.find((p) => p.id === e.productId);
    const book = m.pricebooks.find((b) => b.id === e.pricebookId);
    const sm = m.sellingModels.find((s) => s.id === e.sellingModelId);
    if (!product || !book || !sm) {
      err('pricing', 'A price entry points at a product, price book or selling model that no longer exists.');
      continue;
    }
    const key = `${e.pricebookId}|${e.productId}|${e.sellingModelId}`;
    if (entrySeen.has(key))
      err('pricing', `"${product.name}" is priced twice for "${sm.name}" in ${book.name}.`);
    entrySeen.add(key);

    if (!m.sellingModelOptions.some((o) => o.productId === e.productId && o.sellingModelId === e.sellingModelId))
      err('pricing', `"${product.name}" is priced for "${sm.name}" but is not sold under it; add the selling model option first.`);
    if (e.unitPrice < 0) err('pricing', `"${product.name}" has a negative price in ${book.name}.`);
    if (!e.currency.trim()) err('pricing', `"${product.name}" has a price with no currency in ${book.name}.`);
  }

  // The rule that actually decides whether a rep can find the product.
  const standardBook = m.pricebooks.find((b) => b.isStandard) ?? m.pricebooks[0] ?? null;
  for (const p of m.products) {
    const options = m.sellingModelOptions.filter((o) => o.productId === p.id);
    const who = label(p.name, 'untitled');

    if (options.length > 1 && options.filter((o) => o.isDefault).length === 0)
      err('pricing', `"${who}" offers several selling models but none is the default.`);
    if (options.filter((o) => o.isDefault).length > 1)
      err('pricing', `"${who}" has more than one default selling model.`);

    const needsPricing = p.isActive && p.recordType === 'Commercial' && p.categoryIds.length > 0;
    if (!needsPricing) continue;

    if (options.length === 0) {
      err('pricing', `"${who}" is published to a category but has no selling model, so it will not appear in Browse Catalog.`);
      continue;
    }
    if (!standardBook) {
      err('pricing', 'Products are published but no price book exists, so nothing can be priced.');
      break;
    }
    const hasEntry = m.pricebookEntries.some(
      (e) =>
        e.productId === p.id &&
        e.pricebookId === standardBook.id &&
        e.isActive &&
        options.some((o) => o.sellingModelId === e.sellingModelId),
    );
    if (!hasEntry)
      err('pricing', `"${who}" has no active price in ${standardBook.name}, so it will not appear in Browse Catalog.`);
  }

  // --- Bundles -------------------------------------------------------------
  const bundleIds = new Set<Id>(m.products.filter((p) => p.type === 'Bundle').map((p) => p.id));
  for (const g of m.componentGroups) {
    const bundle = m.products.find((p) => p.id === g.bundleId);
    const who = label(g.name, 'untitled');
    if (!bundle) {
      err('bundles', `Component group "${who}" belongs to a product that no longer exists.`);
      continue;
    }
    if (!bundleIds.has(g.bundleId))
      err('bundles', `"${bundle.name}" has component groups but its Type is not Bundle.`);
    if (!g.name.trim()) err('bundles', `A component group on "${bundle.name}" has no name.`);
    if (!g.code.trim()) err('bundles', `Component group "${who}" on "${bundle.name}" has no code.`);
    const members = m.relatedComponents.filter((rc) => rc.groupId === g.id);
    if (members.length === 0)
      warn('bundles', `Component group "${who}" on "${bundle.name}" has no components.`);
    if (g.minComponents != null && g.maxComponents != null && g.minComponents > g.maxComponents)
      err('bundles', `Component group "${who}" has a minimum larger than its maximum.`);
    if (g.minComponents != null && g.minComponents > members.length)
      err('bundles', `Component group "${who}" requires ${g.minComponents} components but only ${members.length} are defined.`);
    const defaults = members.filter((rc) => rc.isDefaultComponent).length;
    if (g.maxComponents != null && defaults > g.maxComponents)
      err('bundles', `Component group "${who}" defaults ${defaults} components in but allows at most ${g.maxComponents}.`);
    if (g.minComponents != null && g.minComponents > 0 && defaults === 0)
      warn('bundles', `Component group "${who}" requires at least ${g.minComponents} but nothing is included by default.`);
  }
  for (const d of dupes(m.componentGroups, (g) => g.code))
    err('bundles', `Two component groups share the code "${d}"; components are matched to groups by code.`);

  for (const rc of m.relatedComponents) {
    const bundle = m.products.find((p) => p.id === rc.bundleId);
    const group = m.componentGroups.find((g) => g.id === rc.groupId);
    const where = `${bundle?.name ?? 'unknown bundle'} / ${group?.name ?? 'unknown group'}`;
    if (!bundle || !group) {
      err('bundles', 'A component points at a bundle or group that no longer exists.');
      continue;
    }
    if (!rc.childProductId && !rc.childClassificationId)
      err('bundles', `A component in ${where} has neither a product nor a classification selected.`);
    if (rc.childProductId && rc.childClassificationId)
      err('bundles', `A component in ${where} sets both a product and a classification; only one is allowed.`);
    if (rc.childProductId === rc.bundleId)
      err('bundles', `Bundle "${bundle.name}" includes itself as a component.`);
    if (rc.quantity < 1) err('bundles', `A component in ${where} has a quantity below 1.`);
    if (rc.minQuantity != null && rc.minQuantity > rc.quantity)
      err('bundles', `A component in ${where} has a minimum quantity above its starting quantity.`);
    if (rc.maxQuantity != null && rc.maxQuantity < rc.quantity)
      err('bundles', `A component in ${where} has a maximum quantity below its starting quantity.`);
    if (!rc.isQuantityEditable && (rc.minQuantity != null || rc.maxQuantity != null))
      warn('bundles', `A component in ${where} sets quantity bounds but does not allow quantity changes.`);
    if (rc.isComponentRequired && !rc.isDefaultComponent)
      warn('bundles', `A component in ${where} is required but not included by default.`);

    // A component that carries its own price needs its own PricebookEntry, even
    // though it never appears in the catalog on its own.
    if (!rc.doesBundlePriceIncludeChild && rc.childProductId) {
      const child = m.products.find((p) => p.id === rc.childProductId);
      if (child) {
        const options = m.sellingModelOptions.filter((o) => o.productId === child.id);
        if (options.length === 0)
          err('pricing', `"${child.name}" brings its own price into ${bundle.name} but has no selling model.`);
        else if (
          !m.pricebookEntries.some(
            (e) =>
              e.productId === child.id &&
              e.isActive &&
              options.some((o) => o.sellingModelId === e.sellingModelId),
          )
        )
          err('pricing', `"${child.name}" brings its own price into ${bundle.name} but has no active price entry.`);
      }
    }
  }

  // Cycles: a bundle that eventually contains itself hangs the configurator.
  const childBundles = new Map<Id, Id[]>();
  for (const rc of m.relatedComponents) {
    if (rc.childProductId && bundleIds.has(rc.childProductId)) {
      childBundles.set(rc.bundleId, [...(childBundles.get(rc.bundleId) ?? []), rc.childProductId]);
    }
  }
  const state = new Map<Id, 'visiting' | 'done'>();
  const walk = (id: Id, trail: Id[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const names = [...trail.slice(trail.indexOf(id)), id]
        .map((x) => m.products.find((p) => p.id === x)?.name ?? '?')
        .join(' → ');
      err('bundles', `Bundles contain each other in a loop: ${names}.`);
      return;
    }
    state.set(id, 'visiting');
    for (const child of childBundles.get(id) ?? []) walk(child, [...trail, id]);
    state.set(id, 'done');
  };
  for (const id of bundleIds) walk(id, []);

  return issues;
}

export const countBy = (issues: Issue[], step: StepKey) => ({
  errors: issues.filter((i) => i.step === step && i.severity === 'error').length,
  warnings: issues.filter((i) => i.step === step && i.severity === 'warning').length,
});
