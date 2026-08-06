import type { CatalogModel } from '../model/types';

/**
 * A trimmed version of the Quantra / CloudSuite catalog, kept as a worked
 * example: a configurable bundle, two static variants of it, classification-
 * based component groups, and attributes driven by picklists.
 *
 * Ids are literals so the relationships stay readable.
 */
export function sampleModel(): CatalogModel {
  return {
    catalogs: [
      { id: 'cat1', name: 'Quantra Catalog', code: 'QUANTRA', description: 'Main sales catalog' },
    ],
    categories: [
      { id: 'cg1', catalogId: 'cat1', parentId: null, name: 'Subscriptions', code: 'QUANTRA-SUBSCRIPTIONS', sortOrder: 1, showInMenu: true },
      { id: 'cg2', catalogId: 'cat1', parentId: null, name: 'Networking', code: 'QUANTRA-NET', sortOrder: 2, showInMenu: true },
      { id: 'cg3', catalogId: 'cat1', parentId: null, name: 'Surveillance', code: 'QUANTRA-SUR', sortOrder: 3, showInMenu: true },
      { id: 'cg4', catalogId: 'cat1', parentId: null, name: 'Support', code: 'QUANTRA-SUP', sortOrder: 4, showInMenu: true },
    ],
    picklists: [
      { id: 'pl1', name: 'Edition', code: 'EDITION', status: 'Active', dataType: 'Text', description: '' },
      { id: 'pl2', name: 'Included Storage', code: 'INCLUDED_STORAGE', status: 'Active', dataType: 'Text', description: '' },
      { id: 'pl3', name: 'Processor', code: 'PROCESSOR', status: 'Active', dataType: 'Text', description: '' },
    ],
    picklistValues: [
      { id: 'pv1', picklistId: 'pl1', name: 'Starter', code: 'START', abbreviation: 'START', displayValue: 'Starter', value: 'Starter', status: 'Active', isDefault: true, sequence: 1 },
      { id: 'pv2', picklistId: 'pl1', name: 'Professional', code: 'PRO', abbreviation: 'PRO', displayValue: 'Professional', value: 'Professional', status: 'Active', isDefault: false, sequence: 2 },
      { id: 'pv3', picklistId: 'pl1', name: 'Enterprise', code: 'ENT', abbreviation: 'ENT', displayValue: 'Enterprise', value: 'Enterprise', status: 'Active', isDefault: false, sequence: 3 },
      { id: 'pv4', picklistId: 'pl2', name: '4TB', code: '4TB', abbreviation: '4TB', displayValue: '4TB', value: '4TB', status: 'Active', isDefault: true, sequence: 1 },
      { id: 'pv5', picklistId: 'pl2', name: '8TB', code: '8TB', abbreviation: '8TB', displayValue: '8TB', value: '8TB', status: 'Active', isDefault: false, sequence: 2 },
      { id: 'pv6', picklistId: 'pl2', name: '12TB', code: '12TB', abbreviation: '12TB', displayValue: '12TB', value: '12TB', status: 'Active', isDefault: false, sequence: 3 },
      { id: 'pv7', picklistId: 'pl3', name: 'Intel i5', code: 'INTELI5', abbreviation: 'i5', displayValue: 'Intel i5', value: 'Intel i5', status: 'Active', isDefault: true, sequence: 1 },
      { id: 'pv8', picklistId: 'pl3', name: 'Intel i7', code: 'INTELI7', abbreviation: 'i7', displayValue: 'Intel i7', value: 'Intel i7', status: 'Active', isDefault: false, sequence: 2 },
      { id: 'pv9', picklistId: 'pl3', name: 'Intel Xeon E-2224', code: 'INTELXE2224', abbreviation: 'XeonE2224', displayValue: 'Intel Xeon E-2224', value: 'Intel Xeon E-2224', status: 'Active', isDefault: false, sequence: 3 },
    ],
    attributeCategories: [
      { id: 'ac1', name: 'Plan Characteristics', code: 'PLAN', description: '' },
      { id: 'ac2', name: 'Features', code: 'FEAT', description: '' },
      { id: 'ac3', name: 'Add-ons', code: 'ADD', description: '' },
    ],
    attributes: [
      { id: 'at1', label: 'Edition', apiName: 'Edition', code: 'EDITION', dataType: 'Picklist', picklistId: 'pl1', defaultValue: 'Starter', isActive: true, description: '' },
      { id: 'at2', label: 'Included Storage', apiName: 'IncludedStorage', code: 'INCLUDED_STORAGE', dataType: 'Picklist', picklistId: 'pl2', defaultValue: '4TB', isActive: true, description: '' },
      { id: 'at3', label: 'Processor', apiName: 'Processor', code: 'PROCESSOR', dataType: 'Picklist', picklistId: 'pl3', defaultValue: 'Intel i5', isActive: true, description: '' },
      { id: 'at4', label: 'Redundant Power Supply?', apiName: 'RedundantPowerSupply', code: 'REDUNDANT_POWER_SUPPLY', dataType: 'Checkbox', picklistId: null, defaultValue: 'false', isActive: true, description: '' },
    ],
    classifications: [
      { id: 'cl1', name: 'Configurable Plan', code: 'CONFPLAN', status: 'Active' },
      { id: 'cl2', name: 'Plan', code: 'PLAN', status: 'Active' },
      { id: 'cl3', name: 'Network Video Recorder', code: 'NVR', status: 'Active' },
      { id: 'cl4', name: 'Camera', code: 'CAM', status: 'Active' },
      { id: 'cl5', name: 'Router', code: 'ROUTER', status: 'Active' },
      { id: 'cl6', name: 'User License', code: 'USER', status: 'Active' },
      { id: 'cl7', name: 'Usage-Based', code: 'USAGE', status: 'Active' },
    ],
    classificationAttributes: [
      { id: 'ca1', classificationId: 'cl1', attributeId: 'at1', attributeCategoryId: 'ac1', sequence: 1, isRequired: true, isHidden: false, isReadOnly: false, defaultValue: '' },
      { id: 'ca2', classificationId: 'cl3', attributeId: 'at2', attributeCategoryId: 'ac2', sequence: 1, isRequired: true, isHidden: false, isReadOnly: false, defaultValue: '' },
      { id: 'ca3', classificationId: 'cl3', attributeId: 'at3', attributeCategoryId: 'ac2', sequence: 2, isRequired: true, isHidden: false, isReadOnly: false, defaultValue: '' },
      { id: 'ca4', classificationId: 'cl3', attributeId: 'at4', attributeCategoryId: 'ac3', sequence: 3, isRequired: false, isHidden: false, isReadOnly: false, defaultValue: '' },
    ],
    products: [
      { id: 'p1', name: 'CloudSuite', productCode: 'CS', description: 'Configurable CloudSuite plan.', type: 'Bundle', recordType: 'Commercial', family: 'Software', classificationId: 'cl1', unitOfMeasure: 'Each', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: ['cg1'] },
      { id: 'p2', name: 'CloudSuite Starter', productCode: 'CS-START', description: 'Entry-level features. Suitable for small teams.', type: 'Bundle', recordType: 'Commercial', family: 'Software', classificationId: 'cl2', unitOfMeasure: 'Each', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: ['cg1'] },
      { id: 'p3', name: 'CloudSuite Enterprise', productCode: 'CS-ENT', description: 'Full feature set including advanced analytics and compliance.', type: 'Bundle', recordType: 'Commercial', family: 'Software', classificationId: 'cl2', unitOfMeasure: 'Each', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: ['cg1'] },
      { id: 'p4', name: 'CloudSuite Included User', productCode: 'CS-USER-INC', description: '', type: '', recordType: 'Commercial', family: 'Software', classificationId: 'cl6', unitOfMeasure: 'User', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: true, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: [] },
      { id: 'p5', name: 'CloudSuite Additional User', productCode: 'CS-USER-ADD', description: '', type: '', recordType: 'Commercial', family: 'Software', classificationId: 'cl6', unitOfMeasure: 'User', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: true, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: [] },
      { id: 'p6', name: 'CloudSuite Remote Requests (Committed)', productCode: 'CS-RR-C', description: '', type: '', recordType: 'Commercial', family: 'Software', classificationId: 'cl7', unitOfMeasure: 'API Call', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: true, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: [] },
      { id: 'p7', name: 'QuantumEdge Router', productCode: 'QER', description: 'Used to administer and route network traffic.', type: '', recordType: 'Commercial', family: 'Hardware', classificationId: 'cl5', unitOfMeasure: 'Each', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: ['cg2'] },
      { id: 'p8', name: 'QuantumVision Camera', productCode: 'QVC', description: 'Indoor/outdoor IP camera.', type: '', recordType: 'Commercial', family: 'Hardware', classificationId: 'cl4', unitOfMeasure: 'Each', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: ['cg3'] },
      { id: 'p9', name: 'QuantumVault NVR', productCode: 'QVN', description: 'Network video recorder with configurable storage.', type: '', recordType: 'Commercial', family: 'Hardware', classificationId: 'cl3', unitOfMeasure: 'Each', configureDuringSale: 'Allowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: ['cg3'] },
      { id: 'p10', name: 'CloudSuite Platform', productCode: 'CS-PLAT', description: 'Access to the CloudSuite Platform.', type: '', recordType: 'Technical', family: 'Software', classificationId: null, unitOfMeasure: 'Each', configureDuringSale: 'NotAllowed', isActive: true, isAssetizable: true, isSoldOnlyWithOtherProds: false, availabilityDate: '2025-07-01T00:00:00.000Z', displayUrl: '', categoryIds: [] },
    ],
    sellingModels: [
      { id: 'sm1', name: 'Term Based - Yearly', type: 'TermDefined', pricingTerm: 12, pricingTermUnit: 'Months', status: 'Active' },
      { id: 'sm2', name: 'One Time', type: 'OneTime', pricingTerm: null, pricingTermUnit: '', status: 'Active' },
    ],
    pricebooks: [{ id: 'pb1', name: 'Standard Price Book', isStandard: true, isActive: true }],
    // Software is sold on a yearly term, hardware one time. The technical
    // product (p10) is deliberately left unpriced — it is never sold directly.
    sellingModelOptions: [
      { id: 'smo1', productId: 'p1', sellingModelId: 'sm1', isDefault: true, prorationPolicy: 'Default Proration Policy' },
      { id: 'smo2', productId: 'p2', sellingModelId: 'sm1', isDefault: true, prorationPolicy: 'Default Proration Policy' },
      { id: 'smo3', productId: 'p3', sellingModelId: 'sm1', isDefault: true, prorationPolicy: 'Default Proration Policy' },
      { id: 'smo4', productId: 'p4', sellingModelId: 'sm1', isDefault: true, prorationPolicy: 'Default Proration Policy' },
      { id: 'smo5', productId: 'p5', sellingModelId: 'sm1', isDefault: true, prorationPolicy: 'Default Proration Policy' },
      { id: 'smo6', productId: 'p6', sellingModelId: 'sm1', isDefault: true, prorationPolicy: 'Default Proration Policy' },
      { id: 'smo7', productId: 'p7', sellingModelId: 'sm2', isDefault: true, prorationPolicy: '' },
      { id: 'smo8', productId: 'p8', sellingModelId: 'sm2', isDefault: true, prorationPolicy: '' },
      { id: 'smo9', productId: 'p9', sellingModelId: 'sm2', isDefault: true, prorationPolicy: '' },
    ],
    pricebookEntries: [
      { id: 'pbe1', pricebookId: 'pb1', productId: 'p1', sellingModelId: 'sm1', unitPrice: 65000, currency: 'USD', isActive: true },
      { id: 'pbe2', pricebookId: 'pb1', productId: 'p2', sellingModelId: 'sm1', unitPrice: 65000, currency: 'USD', isActive: true },
      { id: 'pbe3', pricebookId: 'pb1', productId: 'p3', sellingModelId: 'sm1', unitPrice: 125000, currency: 'USD', isActive: true },
      { id: 'pbe4', pricebookId: 'pb1', productId: 'p4', sellingModelId: 'sm1', unitPrice: 0, currency: 'USD', isActive: true },
      { id: 'pbe5', pricebookId: 'pb1', productId: 'p5', sellingModelId: 'sm1', unitPrice: 1200, currency: 'USD', isActive: true },
      { id: 'pbe6', pricebookId: 'pb1', productId: 'p6', sellingModelId: 'sm1', unitPrice: 0.05, currency: 'USD', isActive: true },
      { id: 'pbe7', pricebookId: 'pb1', productId: 'p7', sellingModelId: 'sm2', unitPrice: 2400, currency: 'USD', isActive: true },
      { id: 'pbe8', pricebookId: 'pb1', productId: 'p8', sellingModelId: 'sm2', unitPrice: 850, currency: 'USD', isActive: true },
      { id: 'pbe9', pricebookId: 'pb1', productId: 'p9', sellingModelId: 'sm2', unitPrice: 3200, currency: 'USD', isActive: true },
    ],
    componentGroups: [
      { id: 'g1', bundleId: 'p1', name: 'Core', code: 'CORE-CONF', sequence: 1, description: 'Always included.', minComponents: null, maxComponents: null },
      { id: 'g2', bundleId: 'p1', name: 'Router', code: 'ROUTE-CONF', sequence: 2, description: '', minComponents: null, maxComponents: 1 },
      { id: 'g3', bundleId: 'p1', name: 'Network Video Recorder', code: 'NVR-CONF', sequence: 3, description: '', minComponents: null, maxComponents: 1 },
      { id: 'g4', bundleId: 'p1', name: 'Camera', code: 'CAM-CONF', sequence: 4, description: '', minComponents: null, maxComponents: null },
      { id: 'g5', bundleId: 'p2', name: 'Core', code: 'CORE-START', sequence: 1, description: '', minComponents: null, maxComponents: null },
      { id: 'g6', bundleId: 'p3', name: 'Core', code: 'CORE-ENT', sequence: 1, description: '', minComponents: null, maxComponents: null },
    ],
    relatedComponents: [
      { id: 'rc1', bundleId: 'p1', groupId: 'g1', childProductId: 'p4', childClassificationId: null, sequence: 1, quantity: 25, isComponentRequired: true, isDefaultComponent: true, isQuantityEditable: false, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: true, quantityScaleMethod: 'Proportional' },
      { id: 'rc2', bundleId: 'p1', groupId: 'g1', childProductId: 'p5', childClassificationId: null, sequence: 2, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: true, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: '' },
      { id: 'rc3', bundleId: 'p1', groupId: 'g1', childProductId: 'p6', childClassificationId: null, sequence: 3, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: true, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: '' },
      { id: 'rc4', bundleId: 'p1', groupId: 'g2', childProductId: null, childClassificationId: 'cl5', sequence: 1, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: false, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: 'Constant' },
      { id: 'rc5', bundleId: 'p1', groupId: 'g3', childProductId: null, childClassificationId: 'cl3', sequence: 1, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: false, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: 'Constant' },
      { id: 'rc6', bundleId: 'p1', groupId: 'g4', childProductId: null, childClassificationId: 'cl4', sequence: 1, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: true, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: '' },
      { id: 'rc7', bundleId: 'p2', groupId: 'g5', childProductId: 'p4', childClassificationId: null, sequence: 1, quantity: 3, isComponentRequired: true, isDefaultComponent: true, isQuantityEditable: false, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: true, quantityScaleMethod: 'Proportional' },
      { id: 'rc8', bundleId: 'p2', groupId: 'g5', childProductId: 'p5', childClassificationId: null, sequence: 2, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: true, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: '' },
      { id: 'rc9', bundleId: 'p3', groupId: 'g6', childProductId: 'p4', childClassificationId: null, sequence: 1, quantity: 25, isComponentRequired: true, isDefaultComponent: true, isQuantityEditable: false, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: true, quantityScaleMethod: 'Proportional' },
      { id: 'rc10', bundleId: 'p3', groupId: 'g6', childProductId: 'p5', childClassificationId: null, sequence: 2, quantity: 1, isComponentRequired: false, isDefaultComponent: false, isQuantityEditable: true, minQuantity: null, maxQuantity: null, doesBundlePriceIncludeChild: false, quantityScaleMethod: '' },
    ],
  };
}
