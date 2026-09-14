# Mapping a spreadsheet onto the catalog model

The canonical shape is `model.json` — the same model the RCA Product Builder edits and
exports. Every array can be empty, but the preview and the load files both read this one
file, so whatever is not here does not exist.

## model.json

```jsonc
{
  "catalogs": [
    { "id": "cat1", "name": "Main Catalog", "code": "MAIN", "description": "" }
  ],
  "categories": [
    // parentId null = top level; only two levels render in Browse Catalog
    { "id": "c1", "catalogId": "cat1", "parentId": null, "name": "Hardware",
      "code": "HW", "sortOrder": 1, "showInMenu": true }
  ],
  "picklists": [
    { "id": "pl1", "name": "Colors", "code": "COLORS", "status": "Active",
      "dataType": "Text", "description": "" }
  ],
  "picklistValues": [
    { "id": "plv1", "picklistId": "pl1", "name": "Red", "code": "RED",
      "abbreviation": "", "displayValue": "Red", "value": "Red",
      "status": "Active", "isDefault": true, "sequence": 1 }
  ],
  "attributeCategories": [
    { "id": "ac1", "name": "General", "code": "GEN", "description": "" }
  ],
  "attributes": [
    // dataType: Text | Number | Checkbox | Picklist | Date | DateTime | Currency | Percent
    { "id": "a1", "label": "Color", "apiName": "Color", "code": "COLOR",
      "dataType": "Picklist", "picklistId": "pl1", "defaultValue": "Red",
      "isActive": true, "description": "" }
  ],
  "classifications": [
    { "id": "cl1", "name": "Devices", "code": "DEV", "status": "Active" }
  ],
  "classificationAttributes": [
    { "id": "ca1", "classificationId": "cl1", "attributeId": "a1",
      "attributeCategoryId": "ac1", "sequence": 1, "isRequired": false,
      "isHidden": false, "isReadOnly": false, "defaultValue": "" }
  ],
  "products": [
    // type: "" (standalone) | "Bundle" | "Set" | "Bundle Proxy"
    // recordType: "Commercial" | "Technical" — Technical never shows in Browse Catalog
    { "id": "p1", "name": "Router X200", "productCode": "RTR-X200",
      "description": "", "type": "", "recordType": "Commercial", "family": "",
      "classificationId": "cl1", "unitOfMeasure": "Each",
      "configureDuringSale": "Allowed", "isActive": true, "isAssetizable": false,
      "isSoldOnlyWithOtherProds": false, "availabilityDate": "", "displayUrl": "",
      "categoryIds": ["c1"] }
  ],
  "sellingModels": [
    // type: OneTime | Evergreen | TermDefined (TermDefined needs pricingTerm + unit)
    // existingId: Salesforce Id of a model already in the org → referenced, not created
    { "id": "sm1", "name": "One-Time", "type": "OneTime", "pricingTerm": null,
      "pricingTermUnit": "", "status": "Active", "existingId": "" }
  ],
  "sellingModelOptions": [
    { "id": "smo1", "productId": "p1", "sellingModelId": "sm1", "isDefault": true,
      "prorationPolicy": "" }
  ],
  "pricebooks": [
    // existingId: Id of the org's standard price book → referenced, not created
    { "id": "pb1", "name": "Standard Price Book", "isStandard": true,
      "isActive": true, "existingId": "" }
  ],
  "pricebookEntries": [
    { "id": "pbe1", "pricebookId": "pb1", "productId": "p1",
      "sellingModelId": "sm1", "unitPrice": 299, "currency": "EUR",
      "isActive": true }
  ],
  "componentGroups": [
    { "id": "g1", "bundleId": "p9", "name": "Accessories", "code": "ACC",
      "sequence": 1, "description": "", "minComponents": 0, "maxComponents": 2 }
  ],
  "relatedComponents": [
    // exactly one of childProductId / childClassificationId
    // quantityScaleMethod: "" | "Constant" | "Proportional"
    { "id": "rc1", "bundleId": "p9", "groupId": "g1", "childProductId": "p1",
      "childClassificationId": null, "sequence": 1, "quantity": 1,
      "isComponentRequired": false, "isDefaultComponent": true,
      "isQuantityEditable": true, "minQuantity": 0, "maxQuantity": 5,
      "doesBundlePriceIncludeChild": false, "quantityScaleMethod": "Proportional" }
  ]
}
```

`id` values are local keys for cross-referencing inside this file only — any unique string.
The load files resolve them to Name/Code, never to the local id.

## Recognizing columns

Match case-insensitively, ignoring accents, spaces and underscores. The usual suspects:

| Model field | Recognize (EN) | Recognize (ES) |
|---|---|---|
| product.name | Name, Product, Product Name, Item | Nombre, Producto |
| product.productCode | Code, SKU, Product Code, Reference | Código, Referencia, SKU |
| product.description | Description, Details | Descripción, Detalle |
| product.family | Family, Line, Range | Familia, Línea, Gama |
| product.type | Type (Bundle/Set) | Tipo (Bundle/Paquete/Pack) |
| category | Category, Group, Section | Categoría, Grupo, Sección |
| parent category | Parent, Parent Category | Categoría padre, Padre |
| price | Price, Unit Price, Amount, List Price | Precio, Importe, PVP, Tarifa |
| currency | Currency, CCY | Moneda, Divisa |
| selling model | Selling Model, Billing, Frequency, Term | Modelo de venta, Facturación, Periodicidad |
| active | Active, Status, Enabled | Activo, Estado |
| quantity (bundle) | Qty, Quantity | Cantidad |
| bundle parent | Bundle, Parent Product, Part Of | Paquete, Producto padre |
| attribute columns | any remaining column with few distinct values | ídem |

Signals for structure:

- **A "Bundle"/"Parent" column** filled on some rows → those rows are components; create
  the bundle product, one default `componentGroup` (`Components`, code `COMP`), and a
  `relatedComponent` per row. Quantity column → `quantity`; a Required column →
  `isComponentRequired`.
- **A frequency column** (`Monthly`, `Annual`, `One-Time`, `Mensual`, `Anual`, `Único`) →
  distinct selling models. `Monthly`/`Mensual` → Evergreen or TermDefined 12 Months —
  ask only if it changes the answer, otherwise Evergreen and flag the assumption.
- **Several price columns** (`Price Monthly`, `Precio anual`) → one PricebookEntry per
  column, each with its selling model and a matching `sellingModelOption`.
- **Repeated low-cardinality columns** (Color, Size, Talla) → an `AttributeDefinition`
  (+ picklist when values repeat), one classification per product family carrying them.
  Only do this when the user cares about the configurator; otherwise skip attributes —
  they are not required for visibility.

## Defaults when the spreadsheet is silent

Apply, and list every one applied in the final report:

| Missing | Default |
|---|---|
| Catalog | one catalog named after the file (or `Product Catalog`), code from its initials |
| Category | one `All Products` category, code `ALL`, all products in it |
| Category codes | slug of the name, upper snake case, unique |
| Product code | slug of the name — flag loudly, real SKUs matter |
| Selling model | `One-Time` (`OneTime`), default for every product |
| Price book | `Standard Price Book`, `isStandard: true` |
| Currency | the org's currency if known, else EUR — flag it |
| unitOfMeasure | `Each` |
| recordType | `Commercial` |
| configureDuringSale | `Allowed` for bundles and classified products, else `NotAllowed` |
| isActive / status | `true` / `Active` |

## What must already exist in the org

Never create rows for these — the load files reference them by name (or by `existingId`):
`RecordType`, `UnitOfMeasure`, `ProrationPolicy`, and usually the standard price book and
the standard selling models. When an org is named, query their ids and fill `existingId`.

## Load order (what build-load-files.mjs emits)

```
01 ProductCatalog            09 ProductSellingModel (minus existingId rows)
02 ProductCategory           10 Pricebook2          (minus existingId rows)
03 AttributePicklist         11 Product2
04 AttributePicklistValue    12 ProductCategoryProduct
05 AttributeCategory         13 ProductSellingModelOption
06 AttributeDefinition       14 PricebookEntry
07 ProductClassification     15 ProductComponentGroup
08 ProductClassificationAttr 16 ProductRelatedComponent
```

Empty objects are skipped. Lookups use `Field:Object:ExternalKey` headers
(e.g. `Product:Product2:ProductCode`) so nothing depends on ids existing beforehand.
