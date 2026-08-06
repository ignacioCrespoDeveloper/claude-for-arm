import { useMemo, useState } from 'react';
import { useStore, modelOf } from '../model/store';
import { blockers, priceOf, BLOCK_LABEL, isMisconfigured } from '../model/visibility';
import { Modal } from '../ui/primitives';
import {
  TagIcon,
  SearchIcon,
  CategoriesIcon,
  CatalogIcon,
  MinusIcon,
  PlusIcon,
  GearIcon,
  FilterIcon,
  SortIcon,
  CheckIcon,
  ImagePlaceholder,
} from '../ui/icons';
import Configurator from './Configurator';
import type { Id, Product } from '../model/types';

type SortKey = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

interface QuoteLine {
  key: string;
  productId: Id;
  quantity: number;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name-asc', label: 'Name A → Z' },
  { key: 'name-desc', label: 'Name Z → A' },
  { key: 'price-asc', label: 'Price low → high' },
  { key: 'price-desc', label: 'Price high → low' },
];

/**
 * A stand-in for Salesforce's Browse Products modal. It renders strictly from
 * the model, so anything missing here — a product with no category, a picklist
 * with no values — is missing in the org too.
 */
export default function BrowseCatalog() {
  const m = useStore();
  const { catalogs, categories, products } = m;

  const [catalogId, setCatalogId] = useState<Id | null>(null);
  const [categoryId, setCategoryId] = useState<Id | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [quantities, setQuantities] = useState<Record<Id, number>>({});
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [sort, setSort] = useState<SortKey>('name-asc');
  const [openMenu, setOpenMenu] = useState<'sort' | 'filter' | null>(null);
  const [bundlesOnly, setBundlesOnly] = useState(false);
  const [showQuote, setShowQuote] = useState(false);

  const catalog = catalogs.find((c) => c.id === catalogId) ?? catalogs[0] ?? null;

  const tree = useMemo(() => {
    if (!catalog) return [];
    const own = categories
      .filter((c) => c.catalogId === catalog.id && c.showInMenu)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return own
      .filter((c) => !c.parentId)
      .map((root) => ({ root, children: own.filter((c) => c.parentId === root.id) }));
  }, [catalog, categories]);

  const model = useMemo(() => modelOf(m), [m]);
  const pricebook = m.pricebooks.find((b) => b.isStandard) ?? m.pricebooks[0] ?? null;

  /**
   * Category membership is not what makes a product browsable — it also needs a
   * selling model and an active price entry. Same rule the validator uses.
   */
  const browsable = useMemo(
    () => products.filter((p) => blockers(model, p, catalog?.id ?? null, pricebook?.id ?? null).length === 0),
    [products, model, catalog, pricebook],
  );

  /** Products someone clearly meant to publish that will silently not appear. */
  const invisible = useMemo(
    () =>
      products
        .map((p) => ({ product: p, reasons: blockers(model, p, catalog?.id ?? null, pricebook?.id ?? null) }))
        .filter(({ reasons }) => isMisconfigured(reasons)),
    [products, model, catalog, pricebook],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = browsable.filter((p) => {
      if (categoryId && !p.categoryIds.includes(categoryId)) return false;
      if (bundlesOnly && p.type !== 'Bundle') return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.productCode.toLowerCase().includes(q)) return false;
      return true;
    });
    const price = (p: Product) => priceOf(model, p.id, pricebook?.id ?? null)?.unitPrice ?? 0;
    return [...rows].sort((a, b) => {
      switch (sort) {
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-asc':
          return price(a) - price(b);
        case 'price-desc':
          return price(b) - price(a);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [browsable, categoryId, bundlesOnly, search, sort, model, pricebook]);

  const qtyOf = (id: Id) => quantities[id] ?? 1;
  const setQty = (id: Id, n: number) => setQuantities((q) => ({ ...q, [id]: Math.max(1, n) }));

  const toggle = (id: Id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));

  const addLines = (items: Product[]) => {
    setLines((prev) => [
      ...prev,
      ...items.map((p, i) => ({
        key: `${p.id}-${prev.length + i}`,
        productId: p.id,
        quantity: qtyOf(p.id),
      })),
    ]);
  };

  const configurable = (p: Product) =>
    p.configureDuringSale === 'Allowed' &&
    (p.type === 'Bundle' ||
      m.classificationAttributes.some((ca) => ca.classificationId === p.classificationId));

  if (!catalog) {
    return (
      <>
        <div className="page-head">
          <h2>Browse catalog</h2>
        </div>
        <div className="card">
          <div className="empty">Define a catalog and publish some products to see the storefront.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h2>Browse catalog</h2>
        <p>
          What a rep sees before anything is loaded into an org. Products missing from a category here will
          be missing there too — that mismatch is the point of this screen.
        </p>
      </div>

      {catalogs.length > 1 && (
        <div className="inline" style={{ marginBottom: 14 }}>
          {catalogs.map((c) => (
            <button
              key={c.id}
              className={c.id === catalog.id ? 'btn primary' : 'btn'}
              onClick={() => {
                setCatalogId(c.id);
                setCategoryId(null);
                setSelected(new Set());
              }}
            >
              {c.name || 'Untitled catalog'}
            </button>
          ))}
        </div>
      )}

      <div className="sf-shell" onClick={() => setOpenMenu(null)}>
        <header className="sf-topbar">
          <h2>
            Catalog: <strong>{catalog.name || 'Untitled catalog'}</strong>
          </h2>
          <button className="sf-quotelink" onClick={() => setShowQuote(true)}>
            <TagIcon /> New Quote Line Items ({lines.length})
          </button>
        </header>

        <div className="sf-subbar">
          <span className="sf-appicon">
            <CatalogIcon />
          </span>
          <h3>Browse Products</h3>
          <div className="sf-search">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search for products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="sf-body">
          <aside className="sf-cats">
            <div className="sf-cats-head">
              <CategoriesIcon /> Categories
            </div>
            <button
              className={categoryId === null ? 'sf-cat active' : 'sf-cat'}
              onClick={() => setCategoryId(null)}
            >
              All Products
            </button>
            {tree.map(({ root, children }) => (
              <div key={root.id}>
                <button
                  className={categoryId === root.id ? 'sf-cat active' : 'sf-cat'}
                  onClick={() => setCategoryId(root.id)}
                >
                  {root.name || 'Untitled'}
                </button>
                {children.map((child) => (
                  <button
                    key={child.id}
                    className={categoryId === child.id ? 'sf-cat child active' : 'sf-cat child'}
                    onClick={() => setCategoryId(child.id)}
                  >
                    {child.name || 'Untitled'}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <section className="sf-list">
            <div className="sf-list-head">
              <label className="sf-selectall">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allShownSelected && shown.some((p) => selected.has(p.id));
                  }}
                  onChange={() =>
                    setSelected(allShownSelected ? new Set() : new Set(shown.map((p) => p.id)))
                  }
                />
                <span>{categoryId ? categories.find((c) => c.id === categoryId)?.name : 'All Products'}</span>
              </label>

              <div className="sf-head-actions">
                <button
                  className="sf-btn-outline"
                  disabled={selected.size === 0}
                  onClick={() => {
                    addLines(shown.filter((p) => selected.has(p.id)));
                    setSelected(new Set());
                  }}
                >
                  Add Selection to Quote
                </button>
                <div className="sf-menu-wrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={bundlesOnly ? 'sf-icon-btn on' : 'sf-icon-btn'}
                    title="Filter"
                    onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
                  >
                    <FilterIcon />
                  </button>
                  {openMenu === 'filter' && (
                    <div className="sf-menu">
                      <label className="sf-menu-item">
                        <input
                          type="checkbox"
                          checked={bundlesOnly}
                          onChange={(e) => setBundlesOnly(e.target.checked)}
                        />
                        Bundles only
                      </label>
                    </div>
                  )}
                </div>
                <div className="sf-menu-wrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="sf-icon-btn"
                    title="Sort"
                    onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
                  >
                    <SortIcon />
                  </button>
                  {openMenu === 'sort' && (
                    <div className="sf-menu">
                      {SORTS.map((s) => (
                        <button
                          key={s.key}
                          className={s.key === sort ? 'sf-menu-item on' : 'sf-menu-item'}
                          onClick={() => {
                            setSort(s.key);
                            setOpenMenu(null);
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sf-count">{selected.size} Product(s) Selected</div>

            <div className="sf-rows">
              {shown.length === 0 && (
                <div className="sf-empty">
                  {browsable.length === 0
                    ? 'No products are published to this catalog yet.'
                    : 'Nothing matches the current filter.'}
                </div>
              )}

              {shown.map((p) => (
                <article className="sf-row" key={p.id}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />

                  <div className="sf-thumb">
                    <ImagePlaceholder />
                  </div>

                  <div className="sf-info">
                    <div className="sf-pname">{p.name || 'Untitled product'}</div>
                    <div className="sf-price">
                      {(() => {
                        const entry = priceOf(model, p.id, pricebook?.id ?? null);
                        return entry ? (
                          <>
                            {entry.currency} {entry.unitPrice}
                          </>
                        ) : (
                          <span className="sf-noprice">No price set</span>
                        );
                      })()}
                      <TagIcon size={14} />
                    </div>
                    <AttributeSummary product={p} />
                  </div>

                  <div className="sf-qty">
                    <button onClick={() => setQty(p.id, qtyOf(p.id) - 1)} aria-label="Decrease">
                      <MinusIcon />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={qtyOf(p.id)}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                    />
                    <button onClick={() => setQty(p.id, qtyOf(p.id) + 1)} aria-label="Increase">
                      <PlusIcon />
                    </button>
                  </div>

                  <button
                    className="sf-icon-btn"
                    title={configurable(p) ? 'Configure' : 'Nothing to configure'}
                    disabled={!configurable(p)}
                    onClick={() => setConfiguring(p)}
                  >
                    <GearIcon />
                  </button>

                  <button className="sf-add" onClick={() => addLines([p])}>
                    Add
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="sf-footer">
          <button className="sf-save" disabled={lines.length === 0} onClick={() => setShowQuote(true)}>
            <CheckIcon /> Save Quote
          </button>
        </footer>
      </div>

      {invisible.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <header className="card-head">
            <h3>
              Published but not visible{' '}
              <span className="sub">
                {invisible.length} product{invisible.length === 1 ? '' : 's'} would load cleanly and still
                never appear
              </span>
            </h3>
          </header>
          <div className="card-body flush">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: 120 }}>Code</th>
                  <th>Why it is missing</th>
                </tr>
              </thead>
              <tbody>
                {invisible.map(({ product, reasons }) => (
                  <tr key={product.id}>
                    <td>{product.name || 'Untitled'}</td>
                    <td className="mono">{product.productCode}</td>
                    <td>
                      {reasons.map((r) => (
                        <div key={r} className="badge err" style={{ marginRight: 6 }}>
                          {BLOCK_LABEL[r]}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {configuring && <Configurator product={configuring} onClose={() => setConfiguring(null)} />}

      {showQuote && (
        <Modal
          title={`Quote line items (${lines.length})`}
          onClose={() => setShowQuote(false)}
          footer={
            <>
              <button className="btn" onClick={() => setLines([])}>
                Clear quote
              </button>
              <button className="btn primary" onClick={() => setShowQuote(false)}>
                Done
              </button>
            </>
          }
        >
          {lines.length === 0 ? (
            <p className="muted">Nothing added yet.</p>
          ) : (
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: 90 }}>Code</th>
                  <th style={{ width: 60 }}>Qty</th>
                  <th style={{ width: 120 }}>Extended</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = m.products.find((x) => x.id === l.productId);
                  const entry = priceOf(model, l.productId, pricebook?.id ?? null);
                  const ext = (entry?.unitPrice ?? 0) * l.quantity;
                  return (
                    <tr key={l.key}>
                      <td>{p?.name}</td>
                      <td className="mono">{p?.productCode}</td>
                      <td>{l.quantity}</td>
                      <td>
                        {entry?.currency ?? ''} {ext.toLocaleString('en-US')}
                      </td>
                      <td>
                        <button
                          className="btn danger"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
            Amounts come from the PricebookEntry for each product's default selling model in{' '}
            {pricebook?.name ?? 'the price book'}. Adjustments and proration are not applied here.
          </p>
        </Modal>
      )}
    </>
  );
}

/** The one-line attribute recap Salesforce prints under the price. */
function AttributeSummary({ product }: { product: Product }) {
  const m = useStore();
  if (!product.classificationId) return null;

  const parts = m.classificationAttributes
    .filter((ca) => ca.classificationId === product.classificationId && !ca.isHidden)
    .sort((a, b) => a.sequence - b.sequence)
    .map((ca) => {
      const attr = m.attributes.find((a) => a.id === ca.attributeId);
      if (!attr) return null;
      const value = ca.defaultValue || attr.defaultValue;
      if (!value) return null;
      // A checkbox reads as a feature name when on, and is left out when off.
      if (attr.dataType === 'Checkbox') return value === 'true' ? attr.label : null;
      return `${value} ${attr.label}`;
    })
    .filter(Boolean);

  if (parts.length === 0) return null;
  return <div className="sf-attrs">{parts.join(' , ')}</div>;
}
