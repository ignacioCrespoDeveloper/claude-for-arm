import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type CatalogModel,
  type Id,
  emptyModel,
  type Catalog,
  type Category,
  type AttributePicklist,
  type PicklistValue,
  type AttributeCategory,
  type AttributeDefinition,
  type ProductClassification,
  type ClassificationAttribute,
  type Product,
  type ComponentGroup,
  type RelatedComponent,
  type SellingModel,
  type SellingModelOption,
  type Pricebook,
  type PricebookEntry,
} from './types';

export const uid = (): Id => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Collection = keyof CatalogModel;

interface Actions {
  add<K extends Collection>(key: K, row: CatalogModel[K][number]): void;
  update<K extends Collection>(key: K, id: Id, patch: Partial<CatalogModel[K][number]>): void;
  remove(key: Collection, id: Id): void;
  replaceModel(model: CatalogModel): void;
  reset(): void;
}

export type Store = CatalogModel & Actions;

/**
 * Deleting a row has to take its dependants with it, otherwise the export
 * emits dangling lookups that fail on import.
 */
const cascade = (state: CatalogModel, key: Collection, id: Id): Partial<CatalogModel> => {
  switch (key) {
    case 'catalogs': {
      const categoryIds = state.categories.filter((c) => c.catalogId === id).map((c) => c.id);
      return {
        categories: state.categories.filter((c) => c.catalogId !== id),
        products: state.products.map((p) => ({
          ...p,
          categoryIds: p.categoryIds.filter((cid) => !categoryIds.includes(cid)),
        })),
      };
    }
    case 'categories': {
      const doomed = new Set<Id>([id]);
      // Walk down the tree so nested categories go too.
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of state.categories) {
          if (c.parentId && doomed.has(c.parentId) && !doomed.has(c.id)) {
            doomed.add(c.id);
            grew = true;
          }
        }
      }
      return {
        categories: state.categories.filter((c) => !doomed.has(c.id)),
        products: state.products.map((p) => ({
          ...p,
          categoryIds: p.categoryIds.filter((cid) => !doomed.has(cid)),
        })),
      };
    }
    case 'picklists':
      return {
        picklistValues: state.picklistValues.filter((v) => v.picklistId !== id),
        attributes: state.attributes.map((a) => (a.picklistId === id ? { ...a, picklistId: null } : a)),
      };
    case 'attributeCategories':
      return {
        classificationAttributes: state.classificationAttributes.map((ca) =>
          ca.attributeCategoryId === id ? { ...ca, attributeCategoryId: null } : ca,
        ),
      };
    case 'attributes':
      return {
        classificationAttributes: state.classificationAttributes.filter((ca) => ca.attributeId !== id),
      };
    case 'classifications':
      return {
        classificationAttributes: state.classificationAttributes.filter((ca) => ca.classificationId !== id),
        products: state.products.map((p) => (p.classificationId === id ? { ...p, classificationId: null } : p)),
        relatedComponents: state.relatedComponents.filter((rc) => rc.childClassificationId !== id),
      };
    case 'products':
      return {
        componentGroups: state.componentGroups.filter((g) => g.bundleId !== id),
        relatedComponents: state.relatedComponents.filter(
          (rc) => rc.bundleId !== id && rc.childProductId !== id,
        ),
        sellingModelOptions: state.sellingModelOptions.filter((o) => o.productId !== id),
        pricebookEntries: state.pricebookEntries.filter((e) => e.productId !== id),
      };
    case 'sellingModels':
      return {
        sellingModelOptions: state.sellingModelOptions.filter((o) => o.sellingModelId !== id),
        pricebookEntries: state.pricebookEntries.filter((e) => e.sellingModelId !== id),
      };
    case 'sellingModelOptions': {
      // The entry that priced this option is meaningless without it.
      const option = state.sellingModelOptions.find((o) => o.id === id);
      if (!option) return {};
      return {
        pricebookEntries: state.pricebookEntries.filter(
          (e) => !(e.productId === option.productId && e.sellingModelId === option.sellingModelId),
        ),
      };
    }
    case 'pricebooks':
      return { pricebookEntries: state.pricebookEntries.filter((e) => e.pricebookId !== id) };
    case 'componentGroups':
      return { relatedComponents: state.relatedComponents.filter((rc) => rc.groupId !== id) };
    default:
      return {};
  }
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...emptyModel(),

      add: (key, row) =>
        set((s) => ({ [key]: [...(s[key] as unknown[]), row] }) as unknown as Partial<Store>),

      update: (key, id, patch) =>
        set((s) => ({
          [key]: (s[key] as { id: Id }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }) as unknown as Partial<Store>),

      remove: (key, id) =>
        set((s) => {
          const rest = cascade(s, key, id);
          return {
            ...rest,
            [key]: (s[key] as { id: Id }[]).filter((r) => r.id !== id),
          } as unknown as Partial<Store>;
        }),

      replaceModel: (model) => set(() => ({ ...emptyModel(), ...model })),
      reset: () => set(() => ({ ...emptyModel() })),
    }),
    {
      name: 'rca-product-builder',
      version: 2,
      /**
       * v1 kept a preview-only `listPrice` on the product. v2 replaced it with
       * real pricing records, so fold each price into a standard pricebook
       * rather than dropping it.
       */
      migrate: (persisted, version) => {
        const state = persisted as CatalogModel & Record<string, unknown>;
        if (version >= 2) return state;

        const legacy = (state.products ?? []) as (Product & { listPrice?: number | null; currency?: string })[];
        const priced = legacy.filter((p) => typeof p.listPrice === 'number');
        if (priced.length === 0) return { ...emptyModel(), ...state };

        const pricebook: Pricebook = { id: 'pb-std', name: 'Standard Price Book', isStandard: true, isActive: true };
        const sellingModel: SellingModel = {
          id: 'sm-onetime',
          name: 'One Time',
          type: 'OneTime',
          pricingTerm: null,
          pricingTermUnit: '',
          status: 'Active',
        };

        return {
          ...emptyModel(),
          ...state,
          products: legacy.map(({ listPrice: _lp, currency: _c, ...rest }) => rest),
          pricebooks: [pricebook],
          sellingModels: [sellingModel],
          sellingModelOptions: priced.map((p) => ({
            id: `smo-${p.id}`,
            productId: p.id,
            sellingModelId: sellingModel.id,
            isDefault: true,
            prorationPolicy: '',
          })),
          pricebookEntries: priced.map((p) => ({
            id: `pbe-${p.id}`,
            pricebookId: pricebook.id,
            productId: p.id,
            sellingModelId: sellingModel.id,
            unitPrice: p.listPrice ?? 0,
            currency: p.currency ?? 'USD',
            isActive: true,
          })),
        };
      },
    },
  ),
);

/** Strips the action functions so the model can be serialized or exported. */
export const modelOf = (s: Store): CatalogModel => ({
  catalogs: s.catalogs,
  categories: s.categories,
  picklists: s.picklists,
  picklistValues: s.picklistValues,
  attributeCategories: s.attributeCategories,
  attributes: s.attributes,
  classifications: s.classifications,
  classificationAttributes: s.classificationAttributes,
  products: s.products,
  sellingModels: s.sellingModels,
  sellingModelOptions: s.sellingModelOptions,
  pricebooks: s.pricebooks,
  pricebookEntries: s.pricebookEntries,
  componentGroups: s.componentGroups,
  relatedComponents: s.relatedComponents,
});

// Factories — every new row starts valid enough to render.

export const newCatalog = (): Catalog => ({ id: uid(), name: '', code: '', description: '' });

export const newCategory = (catalogId: Id, sortOrder: number): Category => ({
  id: uid(),
  catalogId,
  parentId: null,
  name: '',
  code: '',
  sortOrder,
  showInMenu: true,
});

export const newPicklist = (): AttributePicklist => ({
  id: uid(),
  name: '',
  code: '',
  status: 'Active',
  dataType: 'Text',
  description: '',
});

export const newPicklistValue = (picklistId: Id, sequence: number): PicklistValue => ({
  id: uid(),
  picklistId,
  name: '',
  code: '',
  abbreviation: '',
  displayValue: '',
  value: '',
  status: 'Active',
  isDefault: false,
  sequence,
});

export const newAttributeCategory = (): AttributeCategory => ({ id: uid(), name: '', code: '', description: '' });

export const newAttribute = (): AttributeDefinition => ({
  id: uid(),
  label: '',
  apiName: '',
  code: '',
  dataType: 'Text',
  picklistId: null,
  defaultValue: '',
  isActive: true,
  description: '',
});

export const newClassification = (): ProductClassification => ({
  id: uid(),
  name: '',
  code: '',
  status: 'Active',
});

export const newClassificationAttribute = (
  classificationId: Id,
  attributeId: Id,
  sequence: number,
): ClassificationAttribute => ({
  id: uid(),
  classificationId,
  attributeId,
  attributeCategoryId: null,
  sequence,
  isRequired: false,
  isHidden: false,
  isReadOnly: false,
  defaultValue: '',
});

export const newProduct = (): Product => ({
  id: uid(),
  name: '',
  productCode: '',
  description: '',
  type: '',
  recordType: 'Commercial',
  family: '',
  classificationId: null,
  unitOfMeasure: 'Each',
  configureDuringSale: 'Allowed',
  isActive: true,
  isAssetizable: true,
  isSoldOnlyWithOtherProds: false,
  availabilityDate: '',
  displayUrl: '',
  categoryIds: [],
});

export const newSellingModel = (): SellingModel => ({
  id: uid(),
  name: '',
  type: 'OneTime',
  pricingTerm: null,
  pricingTermUnit: '',
  status: 'Active',
});

export const newPricebook = (isStandard = false): Pricebook => ({
  id: uid(),
  name: isStandard ? 'Standard Price Book' : '',
  isStandard,
  isActive: true,
});

export const newSellingModelOption = (
  productId: Id,
  sellingModelId: Id,
  isDefault: boolean,
): SellingModelOption => ({ id: uid(), productId, sellingModelId, isDefault, prorationPolicy: '' });

export const newPricebookEntry = (
  pricebookId: Id,
  productId: Id,
  sellingModelId: Id,
): PricebookEntry => ({
  id: uid(),
  pricebookId,
  productId,
  sellingModelId,
  unitPrice: 0,
  currency: 'USD',
  isActive: true,
});

export const newComponentGroup = (bundleId: Id, sequence: number): ComponentGroup => ({
  id: uid(),
  bundleId,
  name: '',
  code: '',
  sequence,
  description: '',
  minComponents: null,
  maxComponents: null,
});

export const newRelatedComponent = (bundleId: Id, groupId: Id, sequence: number): RelatedComponent => ({
  id: uid(),
  bundleId,
  groupId,
  childProductId: null,
  childClassificationId: null,
  sequence,
  quantity: 1,
  isComponentRequired: false,
  isDefaultComponent: false,
  isQuantityEditable: true,
  minQuantity: null,
  maxQuantity: null,
  doesBundlePriceIncludeChild: false,
  quantityScaleMethod: '',
});
