import { useState } from 'react';
import { useStore, newProduct } from '../model/store';
import { Card, Field, Text, Area, Select, Check, Empty, toCode } from '../ui/primitives';
import type { Product, ProductType, RecordTypeName } from '../model/types';

const TYPES: readonly { value: ProductType; label: string }[] = [
  { value: '', label: 'Standalone product' },
  { value: 'Bundle', label: 'Bundle' },
  { value: 'Set', label: 'Set' },
  { value: 'Bundle Proxy', label: 'Bundle Proxy' },
];

const RECORD_TYPES: readonly { value: RecordTypeName; label: string }[] = [
  { value: 'Commercial', label: 'Commercial — sellable, appears in the catalog' },
  { value: 'Technical', label: 'Technical — fulfillment only, not browsable' },
];

const UOM = ['Each', 'API Call', 'GB', 'Hour', 'Month', 'User'];

export default function ProductsStep() {
  const { products, classifications, catalogs, categories, add, update, remove } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const visible = products.filter((p) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q);
  });

  const addProduct = () => {
    const p = newProduct();
    add('products', p);
    setOpenId(p.id);
  };

  return (
    <>
      <div className="page-head">
        <h2>Products</h2>
        <p>
          A bundle is just a product with Type set to Bundle — you assemble its contents in the next step.
          Basing a product on a classification is what gives it attributes; publishing it to a category is
          what makes it show up in Browse Catalog.
        </p>
      </div>

      <Card
        title="Product list"
        sub={`${products.length} product${products.length === 1 ? '' : 's'}`}
        actions={
          <div className="inline">
            <input
              type="text"
              placeholder="Filter by name or code"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '5px 9px', border: '1px solid var(--line)', borderRadius: 6 }}
            />
            <button className="btn primary" onClick={addProduct}>
              Add product
            </button>
          </div>
        }
        flush
      >
        {visible.length === 0 ? (
          <Empty>{products.length ? 'Nothing matches that filter.' : 'No products yet.'}</Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 140 }}>Product code</th>
                  <th style={{ width: 150 }}>Type</th>
                  <th style={{ width: 170 }}>Based on</th>
                  <th style={{ width: 110 }}>Record type</th>
                  <th style={{ width: 180 }}>Categories</th>
                  <th style={{ width: 60 }}>Active</th>
                  <th style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="text"
                        value={p.name}
                        placeholder="CloudSuite Starter"
                        onChange={(e) =>
                          update('products', p.id, {
                            name: e.target.value,
                            ...(p.productCode ? {} : { productCode: toCode(e.target.value) }),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="mono"
                        value={p.productCode}
                        onChange={(e) => update('products', p.id, { productCode: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={p.type}
                        onChange={(e) => update('products', p.id, { type: e.target.value as ProductType })}
                      >
                        {TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={p.classificationId ?? ''}
                        onChange={(e) =>
                          update('products', p.id, { classificationId: e.target.value || null })
                        }
                      >
                        <option value="">— none —</option>
                        {classifications.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || 'Untitled'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={p.recordType}
                        onChange={(e) =>
                          update('products', p.id, { recordType: e.target.value as RecordTypeName })
                        }
                      >
                        <option value="Commercial">Commercial</option>
                        <option value="Technical">Technical</option>
                      </select>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {p.categoryIds.length
                        ? p.categoryIds
                            .map((cid) => categories.find((c) => c.id === cid)?.name)
                            .filter(Boolean)
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="check-cell">
                      <Check
                        checked={p.isActive}
                        onChange={(isActive) => update('products', p.id, { isActive })}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn small" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                          {openId === p.id ? 'Hide' : 'Details'}
                        </button>
                        <button className="btn danger" onClick={() => remove('products', p.id)}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openId && (() => {
        const p = products.find((x) => x.id === openId);
        if (!p) return null;
        return (
          <ProductDetail
            key={p.id}
            product={p}
            onChange={(patch) => update('products', p.id, patch)}
            catalogs={catalogs}
            categories={categories}
          />
        );
      })()}
    </>
  );
}

function ProductDetail({
  product: p,
  onChange,
  catalogs,
  categories,
}: {
  product: Product;
  onChange: (patch: Partial<Product>) => void;
  catalogs: { id: string; name: string }[];
  categories: { id: string; catalogId: string; name: string; parentId: string | null }[];
}) {
  const toggleCategory = (id: string) =>
    onChange({
      categoryIds: p.categoryIds.includes(id)
        ? p.categoryIds.filter((c) => c !== id)
        : [...p.categoryIds, id],
    });

  return (
    <Card title={p.name || 'Untitled product'} sub="details">
      <div className="grid c3" style={{ marginBottom: 16 }}>
        <Field label="Family" hint="free text, groups products in reports">
          <Text value={p.family} placeholder="Software" onChange={(family) => onChange({ family })} />
        </Field>
        <Field label="Unit of measure">
          <select value={p.unitOfMeasure} onChange={(e) => onChange({ unitOfMeasure: e.target.value })}>
            {UOM.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Configure during sale">
          <Select
            value={p.configureDuringSale}
            onChange={(configureDuringSale) => onChange({ configureDuringSale })}
            options={[
              { value: 'Allowed', label: 'Allowed' },
              { value: 'NotAllowed', label: 'Not allowed' },
            ]}
          />
        </Field>
        <Field label="Availability date">
          <input
            type="date"
            value={p.availabilityDate ? p.availabilityDate.slice(0, 10) : ''}
            onChange={(e) =>
              onChange({ availabilityDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' })
            }
          />
        </Field>
        <Field label="Display URL" hint="static resource path for the catalog tile">
          <Text
            value={p.displayUrl}
            placeholder="/resource/images/router.png"
            onChange={(displayUrl) => onChange({ displayUrl })}
          />
        </Field>
        <Field label="Record type">
          <Select
            value={p.recordType}
            onChange={(recordType) => onChange({ recordType })}
            options={RECORD_TYPES}
          />
        </Field>
      </div>

      <div className="grid c2" style={{ marginBottom: 16 }}>
        <Field label="Description" hint="shown on the catalog tile">
          <Area value={p.description} onChange={(description) => onChange({ description })} />
        </Field>
        <div className="stack">
          <Check
            checked={p.isAssetizable}
            onChange={(isAssetizable) => onChange({ isAssetizable })}
            label="Assetizable — creates an asset when the order is fulfilled"
          />
          <Check
            checked={p.isSoldOnlyWithOtherProds}
            onChange={(isSoldOnlyWithOtherProds) => onChange({ isSoldOnlyWithOtherProds })}
            label="Sold only with other products — hidden from standalone browsing"
          />
          <Check checked={p.isActive} onChange={(isActive) => onChange({ isActive })} label="Active" />
        </div>
      </div>

      <Field label="Publish to categories" hint="a product with no category never appears in Browse Catalog">
        <div className="stack" style={{ marginTop: 4 }}>
          {catalogs.length === 0 && <span className="muted">Define a catalog first.</span>}
          {catalogs.map((cat) => (
            <div key={cat.id}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                {cat.name || 'Untitled catalog'}
              </div>
              <div className="inline">
                {categories
                  .filter((c) => c.catalogId === cat.id)
                  .map((c) => (
                    <Check
                      key={c.id}
                      checked={p.categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      label={c.parentId ? `↳ ${c.name}` : c.name || 'Untitled'}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Field>
    </Card>
  );
}
