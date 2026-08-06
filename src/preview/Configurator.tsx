import { useMemo, useState } from 'react';
import { useStore, modelOf } from '../model/store';
import { defaultSellingModelId, priceOf } from '../model/visibility';
import { frequencyOf, money, FREQUENCIES, type Frequency } from '../model/pricing';
import { StarIcon, CaretIcon, SearchIcon, RefreshIcon, ErrorIcon, WarnIcon, InfoIcon, ChevronIcon } from '../ui/icons';
import type { Id, Product, RelatedComponent } from '../model/types';

/**
 * A stand-in for the Revenue Cloud product configurator. Attribute categories
 * become the first tab strip, component groups the second — the same shape a
 * rep sees, so a group with no components or a required attribute with no
 * picklist values is obvious here rather than after a deployment.
 */

interface Selection {
  key: string;
  groupId: Id;
  componentId: Id;
  productId: Id;
  quantity: number;
}

type Severity = 'error' | 'warning' | 'info';
interface Message {
  severity: Severity;
  text: string;
}

export default function Configurator({ product, onClose }: { product: Product; onClose: () => void }) {
  const store = useStore();
  const m = useMemo(() => modelOf(store), [store]);
  const pricebook = m.pricebooks.find((b) => b.isStandard) ?? m.pricebooks[0] ?? null;

  const groups = useMemo(
    () => m.componentGroups.filter((g) => g.bundleId === product.id).sort((a, b) => a.sequence - b.sequence),
    [m.componentGroups, product.id],
  );

  const attributeRows = useMemo(
    () =>
      m.classificationAttributes
        .filter((ca) => ca.classificationId === product.classificationId && !ca.isHidden)
        .sort((a, b) => a.sequence - b.sequence),
    [m.classificationAttributes, product.classificationId],
  );

  /** Attribute categories become the first tab strip; ungrouped ones land in "Other". */
  const attributeTabs = useMemo(() => {
    const byCategory = new Map<string, typeof attributeRows>();
    for (const row of attributeRows) {
      const key = row.attributeCategoryId ?? '';
      byCategory.set(key, [...(byCategory.get(key) ?? []), row]);
    }
    return [...byCategory.entries()].map(([id, rows]) => ({
      id,
      label: m.attributeCategories.find((c) => c.id === id)?.name ?? 'Other',
      rows,
    }));
  }, [attributeRows, m.attributeCategories]);

  const componentsOf = (groupId: Id) => m.relatedComponents.filter((rc) => rc.groupId === groupId);

  /** A classification component stands in for every active product of that kind. */
  const candidatesFor = (rc: RelatedComponent): Product[] => {
    if (rc.childProductId) {
      const p = m.products.find((x) => x.id === rc.childProductId);
      return p ? [p] : [];
    }
    return m.products.filter((p) => p.classificationId === rc.childClassificationId && p.isActive);
  };

  const [quantity, setQuantity] = useState(1);
  const [values, setValues] = useState<Record<Id, string>>(() => {
    const seed: Record<Id, string> = {};
    for (const ca of attributeRows) {
      const attr = m.attributes.find((a) => a.id === ca.attributeId);
      seed[ca.id] = ca.defaultValue || attr?.defaultValue || '';
    }
    return seed;
  });

  const [selections, setSelections] = useState<Selection[]>(() =>
    groups.flatMap((g) =>
      componentsOf(g.id)
        .filter((rc) => rc.isDefaultComponent)
        .flatMap((rc) => {
          const first = candidatesFor(rc)[0];
          return first
            ? [{ key: `${rc.id}-${first.id}`, groupId: g.id, componentId: rc.id, productId: first.id, quantity: rc.quantity }]
            : [];
        }),
    ),
  );

  const [attrTab, setAttrTab] = useState(0);
  const [groupTab, setGroupTab] = useState(0);
  const [picking, setPicking] = useState<Id | null>(null);
  const [validation, setValidation] = useState(true);
  const [instantPricing, setInstantPricing] = useState(false);
  const [compact, setCompact] = useState(false);
  const [starred, setStarred] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  /** Totals shown to the user. Stale until Update Prices unless instant pricing is on. */
  const [pricedAt, setPricedAt] = useState<Selection[] | null>(null);

  const priced = instantPricing ? selections : pricedAt;
  const stale = priced === null || (!instantPricing && priced !== selections);

  const unitPrice = priceOf(m, product.id, pricebook?.id ?? null);
  const currency = unitPrice?.currency ?? 'USD';
  const sellingModelName =
    m.sellingModels.find((s) => s.id === defaultSellingModelId(m, product.id))?.name ?? '';

  // --- messages ------------------------------------------------------------
  const messages: Message[] = useMemo(() => {
    if (!validation) return [];
    const out: Message[] = [];

    for (const ca of attributeRows) {
      const attr = m.attributes.find((a) => a.id === ca.attributeId);
      if (!attr) continue;
      if (ca.isRequired && !values[ca.id])
        out.push({ severity: 'error', text: `${attr.label} is required.` });
      if (attr.dataType === 'Picklist' && m.picklistValues.every((v) => v.picklistId !== attr.picklistId))
        out.push({ severity: 'warning', text: `${attr.label} has no picklist values to choose from.` });
    }

    for (const g of groups) {
      const chosen = selections.filter((s) => s.groupId === g.id);
      if (g.minComponents != null && chosen.length < g.minComponents)
        out.push({
          severity: 'error',
          text: `${g.name} needs at least ${g.minComponents} component${g.minComponents === 1 ? '' : 's'}; ${chosen.length} selected.`,
        });
      if (g.maxComponents != null && chosen.length > g.maxComponents)
        out.push({ severity: 'error', text: `${g.name} allows at most ${g.maxComponents}; ${chosen.length} selected.` });
      if (componentsOf(g.id).length === 0)
        out.push({ severity: 'warning', text: `${g.name} has no components defined.` });

      for (const rc of componentsOf(g.id)) {
        if (rc.isComponentRequired && !chosen.some((s) => s.componentId === rc.id)) {
          const label = rc.childProductId
            ? m.products.find((p) => p.id === rc.childProductId)?.name
            : m.classifications.find((c) => c.id === rc.childClassificationId)?.name;
          out.push({ severity: 'error', text: `${label} is required in ${g.name}.` });
        }
      }
    }

    if (!unitPrice)
      out.push({ severity: 'warning', text: `${product.name} has no price entry, so totals will be empty.` });

    return out;
  }, [validation, attributeRows, values, groups, selections, m, unitPrice, product.name]);

  const counts = {
    error: messages.filter((x) => x.severity === 'error').length,
    warning: messages.filter((x) => x.severity === 'warning').length,
    info: messages.filter((x) => x.severity === 'info').length,
  };

  // --- totals --------------------------------------------------------------
  const totals = useMemo(() => {
    const out = new Map<Frequency, number>();
    if (priced === null) return out;

    const addTo = (freq: Frequency, amount: number) => out.set(freq, (out.get(freq) ?? 0) + amount);
    addTo(frequencyOf(m, product.id), (unitPrice?.unitPrice ?? 0) * quantity);

    for (const s of priced) {
      const rc = m.relatedComponents.find((r) => r.id === s.componentId);
      // A component whose price the bundle already includes must not be added twice.
      if (!rc || rc.doesBundlePriceIncludeChild) continue;
      const entry = priceOf(m, s.productId, pricebook?.id ?? null);
      if (!entry) continue;
      addTo(frequencyOf(m, s.productId), entry.unitPrice * s.quantity * quantity);
    }
    return out;
  }, [priced, m, product.id, unitPrice, quantity, pricebook]);

  const netAmount = [...totals.values()].reduce((a, b) => a + b, 0);

  // --- actions -------------------------------------------------------------
  const addSelection = (rc: RelatedComponent, chosen: Product) =>
    setSelections((prev) => [
      ...prev,
      { key: `${rc.id}-${chosen.id}-${prev.length}`, groupId: rc.groupId, componentId: rc.id, productId: chosen.id, quantity: rc.quantity },
    ]);

  const activeGroup = groups[groupTab];

  return (
    <div className="cfg-backdrop">
      <div className={compact ? 'cfg-shell compact' : 'cfg-shell'}>
        <header className="cfg-head">
          <h2>Configure {product.name || 'product'}</h2>
          <Toggle label="Product Validation" on={validation} onChange={setValidation} />
          <Toggle label="Instant Pricing" on={instantPricing} onChange={setInstantPricing} />
          <Toggle label="Compact Mode" on={compact} onChange={setCompact} />
          <div className="cfg-head-btns">
            <button
              className={starred ? 'cfg-sq on' : 'cfg-sq'}
              onClick={() => setStarred((s) => !s)}
              title="Save as favorite"
            >
              <StarIcon filled={starred} />
            </button>
            <button className="cfg-sq" title="More actions">
              <CaretIcon />
            </button>
          </div>
        </header>

        {stale && !instantPricing && (
          <div className="cfg-notice">
            Prices don't reflect the latest selections. To get the latest pricing, enable Instant Pricing or
            click Update Prices.
          </div>
        )}

        <div className="cfg-messages">
          <button
            className={messagesOpen ? 'cfg-chev open' : 'cfg-chev'}
            onClick={() => setMessagesOpen((o) => !o)}
            disabled={messages.length === 0}
          >
            <ChevronIcon />
          </button>
          <span className="cfg-msg-count">
            <ErrorIcon /> Errors ({counts.error})
          </span>
          <span className="cfg-msg-count">
            <WarnIcon /> Warnings ({counts.warning})
          </span>
          <span className="cfg-msg-count">
            <InfoIcon /> Info ({counts.info})
          </span>
        </div>

        {messagesOpen && messages.length > 0 && (
          <ul className="cfg-msg-list">
            {messages.map((msg, i) => (
              <li key={i} className={msg.severity}>
                {msg.severity === 'error' ? <ErrorIcon /> : msg.severity === 'warning' ? <WarnIcon /> : <InfoIcon />}
                {msg.text}
              </li>
            ))}
          </ul>
        )}

        <div className="cfg-body">
          <section className="cfg-main">
            <button className="cfg-sq cfg-search" title="Search components">
              <SearchIcon />
            </button>

            <div className="cfg-product">
              <h3>{product.name || 'Untitled product'}</h3>
              <div className="cfg-product-price">
                <div className="amount">{unitPrice ? money(unitPrice.unitPrice, currency) : '—'}</div>
                <div className="model">{sellingModelName || 'No selling model'}</div>
                <label className="qty">
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </label>
              </div>
            </div>

            {attributeTabs.length > 0 && (
              <>
                <nav className="cfg-tabs">
                  {attributeTabs.map((tab, i) => (
                    <button
                      key={tab.id || 'other'}
                      className={i === attrTab ? 'active' : ''}
                      onClick={() => setAttrTab(i)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>

                <div className="cfg-attrs">
                  {attributeTabs[attrTab]?.rows.map((ca) => {
                    const attr = m.attributes.find((a) => a.id === ca.attributeId);
                    if (!attr) return null;
                    const picklistValues = m.picklistValues
                      .filter((v) => v.picklistId === attr.picklistId)
                      .sort((a, b) => a.sequence - b.sequence);
                    const value = values[ca.id] ?? '';
                    const set = (v: string) => setValues((prev) => ({ ...prev, [ca.id]: v }));
                    const invalid = validation && ca.isRequired && !value;

                    return (
                      <div className="cfg-field" key={ca.id}>
                        <label>
                          {ca.isRequired && <span className="req">*</span>} {attr.label}
                        </label>
                        {attr.dataType === 'Picklist' ? (
                          <select
                            className={invalid ? 'invalid' : ''}
                            value={value}
                            disabled={ca.isReadOnly}
                            onChange={(e) => set(e.target.value)}
                          >
                            <option value="" />
                            {picklistValues.map((v) => (
                              <option key={v.id} value={v.value}>
                                {v.displayValue || v.name}
                              </option>
                            ))}
                          </select>
                        ) : attr.dataType === 'Checkbox' ? (
                          <input
                            type="checkbox"
                            checked={value === 'true'}
                            disabled={ca.isReadOnly}
                            onChange={(e) => set(String(e.target.checked))}
                          />
                        ) : (
                          <input
                            className={invalid ? 'invalid' : ''}
                            type={
                              attr.dataType === 'Number' || attr.dataType === 'Currency' || attr.dataType === 'Percent'
                                ? 'number'
                                : attr.dataType === 'Date'
                                  ? 'date'
                                  : 'text'
                            }
                            value={value}
                            disabled={ca.isReadOnly}
                            onChange={(e) => set(e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {groups.length > 0 && (
              <>
                <nav className="cfg-tabs">
                  {groups.map((g, i) => (
                    <button key={g.id} className={i === groupTab ? 'active' : ''} onClick={() => setGroupTab(i)}>
                      {g.name || 'Untitled group'}
                    </button>
                  ))}
                </nav>

                {activeGroup && (
                  <div className="cfg-group">
                    {(() => {
                      const chosen = selections.filter((s) => s.groupId === activeGroup.id);
                      const options = componentsOf(activeGroup.id);
                      const full =
                        activeGroup.maxComponents != null && chosen.length >= activeGroup.maxComponents;

                      return (
                        <>
                          {chosen.length > 0 && (
                            <table className="cfg-comp-table">
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th style={{ width: 110 }}>Quantity</th>
                                  <th style={{ width: 150 }}>Price</th>
                                  <th style={{ width: 44 }} />
                                </tr>
                              </thead>
                              <tbody>
                                {chosen.map((s) => {
                                  const rc = m.relatedComponents.find((r) => r.id === s.componentId);
                                  const child = m.products.find((p) => p.id === s.productId);
                                  const entry = priceOf(m, s.productId, pricebook?.id ?? null);
                                  return (
                                    <tr key={s.key}>
                                      <td>
                                        {child?.name}
                                        {rc?.isComponentRequired && <span className="cfg-pill">Required</span>}
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          min={rc?.minQuantity ?? 1}
                                          max={rc?.maxQuantity ?? undefined}
                                          value={s.quantity}
                                          disabled={!rc?.isQuantityEditable}
                                          onChange={(e) =>
                                            setSelections((prev) =>
                                              prev.map((x) =>
                                                x.key === s.key
                                                  ? { ...x, quantity: Math.max(1, Number(e.target.value)) }
                                                  : x,
                                              ),
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        {rc?.doesBundlePriceIncludeChild ? (
                                          <span className="muted">Included in bundle</span>
                                        ) : entry ? (
                                          money(entry.unitPrice * s.quantity, entry.currency)
                                        ) : (
                                          <span className="muted">No price</span>
                                        )}
                                      </td>
                                      <td>
                                        <button
                                          className="cfg-remove"
                                          disabled={rc?.isComponentRequired}
                                          title={rc?.isComponentRequired ? 'Required component' : 'Remove'}
                                          onClick={() =>
                                            setSelections((prev) => prev.filter((x) => x.key !== s.key))
                                          }
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

                          <button
                            className="cfg-add"
                            disabled={options.length === 0 || full}
                            onClick={() => setPicking(activeGroup.id)}
                          >
                            Add {activeGroup.name || 'components'}
                          </button>
                          {full && <span className="cfg-hint">Maximum of {activeGroup.maxComponents} reached.</span>}
                          {options.length === 0 && <span className="cfg-hint">This group has no components.</span>}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {groups.length === 0 && attributeTabs.length === 0 && (
              <p className="cfg-hint" style={{ padding: 20 }}>
                This product has no attributes and no component groups, so there is nothing to configure.
              </p>
            )}
          </section>

          <aside className="cfg-summary">
            <h4>Summary</h4>
            <div className="cfg-sum-product">{product.name || 'Untitled product'}</div>
            <div className="cfg-sum-row">
              <div>
                <div className="k">Quantity</div>
                <div className="v">{quantity}</div>
              </div>
              <div className="right">
                <div className="k">Net Amount</div>
                <div className="v">{priced === null ? '-' : money(netAmount, currency)}</div>
              </div>
            </div>
            <dl className="cfg-totals">
              {FREQUENCIES.map((f) => (
                <div key={f}>
                  <dt>{f} Total</dt>
                  <dd>{priced === null || !totals.get(f) ? '-' : money(totals.get(f) ?? 0, currency)}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <footer className="cfg-foot">
          {counts.error > 0 ? <ErrorIcon size={22} /> : counts.warning > 0 ? <WarnIcon size={22} /> : null}
          <div className="spacer" />
          <button className="cfg-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="cfg-btn" onClick={() => setPricedAt(selections)} disabled={instantPricing}>
            <RefreshIcon /> Update Prices
          </button>
          <button className="cfg-btn primary" onClick={onClose} disabled={validation && counts.error > 0}>
            Save &amp; Exit
          </button>
        </footer>

        {picking && (
          <ComponentPicker
            group={groups.find((g) => g.id === picking)!}
            options={componentsOf(picking)}
            candidatesFor={candidatesFor}
            onPick={(rc, chosen) => {
              addSelection(rc, chosen);
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="cfg-toggle">
      <span className="lbl">{label}</span>
      <button className={on ? 'sw on' : 'sw'} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
        <span className="knob" />
      </button>
      <span className="state">{on ? 'Enabled' : 'Disabled'}</span>
    </div>
  );
}

function ComponentPicker({
  group,
  options,
  candidatesFor,
  onPick,
  onClose,
}: {
  group: { name: string };
  options: RelatedComponent[];
  candidatesFor: (rc: RelatedComponent) => Product[];
  onPick: (rc: RelatedComponent, chosen: Product) => void;
  onClose: () => void;
}) {
  const m = useStore();
  return (
    <div className="cfg-picker-backdrop" onClick={onClose}>
      <div className="cfg-picker" onClick={(e) => e.stopPropagation()}>
        <header>
          <h4>Add {group.name}</h4>
          <button className="cfg-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="cfg-picker-body">
          {options.map((rc) => {
            const cls = m.classifications.find((c) => c.id === rc.childClassificationId);
            const candidates = candidatesFor(rc);
            return (
              <div key={rc.id} className="cfg-picker-group">
                {cls && <div className="cfg-picker-label">Any {cls.name}</div>}
                {candidates.length === 0 ? (
                  <div className="cfg-hint">
                    {cls ? `No active products carry the ${cls.name} classification.` : 'Component product is missing.'}
                  </div>
                ) : (
                  candidates.map((p) => (
                    <button key={p.id} className="cfg-picker-item" onClick={() => onPick(rc, p)}>
                      <span>{p.name}</span>
                      <span className="mono muted">{p.productCode}</span>
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
