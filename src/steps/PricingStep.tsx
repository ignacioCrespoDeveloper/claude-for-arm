import { useState } from 'react';
import {
  useStore,
  newSellingModel,
  newPricebook,
  newSellingModelOption,
  newPricebookEntry,
} from '../model/store';
import { Card, Field, Num, Check, Empty, Modal } from '../ui/primitives';
import type { SellingModelType, TermUnit } from '../model/types';

const MODEL_TYPES: readonly { value: SellingModelType; label: string }[] = [
  { value: 'OneTime', label: 'One time' },
  { value: 'Evergreen', label: 'Evergreen — recurring, no end date' },
  { value: 'TermDefined', label: 'Term defined — fixed length' },
];

const TERM_UNITS: readonly { value: TermUnit; label: string }[] = [
  { value: '', label: '—' },
  { value: 'Days', label: 'Days' },
  { value: 'Months', label: 'Months' },
  { value: 'Years', label: 'Years' },
];

/**
 * Create-or-reference switch, for the two objects that usually already exist in the org.
 * Choosing "Already in the org" keeps the record out of the workbook and makes its children
 * point at the pasted Id instead of resolving the name.
 */
function SourceCells({
  existingId,
  onChange,
  placeholder,
}: {
  existingId: string | undefined;
  onChange: (existingId: string | undefined) => void;
  placeholder: string;
}) {
  const isExisting = existingId !== undefined;
  return (
    <>
      <td>
        <select
          value={isExisting ? 'existing' : 'new'}
          onChange={(e) => onChange(e.target.value === 'existing' ? (existingId ?? '') : undefined)}
        >
          <option value="new">Create it</option>
          <option value="existing">Already in the org</option>
        </select>
      </td>
      <td>
        {isExisting ? (
          <input
            type="text"
            className="mono"
            value={existingId}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </>
  );
}

export default function PricingStep() {
  const {
    products,
    sellingModels,
    sellingModelOptions,
    pricebooks,
    pricebookEntries,
    add,
    update,
    remove,
  } = useStore();

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkModel, setBulkModel] = useState('');
  const [bulkPrice, setBulkPrice] = useState<number | null>(0);

  const book = pricebooks.find((b) => b.isStandard) ?? pricebooks[0] ?? null;

  /** Products that need a price: sellable, and either browsable or a priced component. */
  const needsPricing = products.filter(
    (p) => p.isActive && p.recordType === 'Commercial',
  );

  const entryFor = (productId: string, sellingModelId: string) =>
    pricebookEntries.find(
      (e) => e.productId === productId && e.sellingModelId === sellingModelId && e.pricebookId === book?.id,
    );

  const attach = (productId: string, sellingModelId: string) => {
    if (!sellingModelId || !book) return;
    const already = sellingModelOptions.some(
      (o) => o.productId === productId && o.sellingModelId === sellingModelId,
    );
    if (already) return;
    const isFirst = !sellingModelOptions.some((o) => o.productId === productId);
    add('sellingModelOptions', newSellingModelOption(productId, sellingModelId, isFirst));
    add('pricebookEntries', newPricebookEntry(book.id, productId, sellingModelId));
  };

  const applyBulk = () => {
    if (!bulkModel || !book) return;
    for (const p of needsPricing) {
      if (sellingModelOptions.some((o) => o.productId === p.id)) continue;
      add('sellingModelOptions', newSellingModelOption(p.id, bulkModel, true));
      const entry = newPricebookEntry(book.id, p.id, bulkModel);
      add('pricebookEntries', { ...entry, unitPrice: bulkPrice ?? 0 });
    }
    setBulkOpen(false);
  };

  const unpriced = needsPricing.filter((p) => !sellingModelOptions.some((o) => o.productId === p.id));

  return (
    <>
      <div className="page-head">
        <h2>Selling models and pricing</h2>
        <p>
          This is the step that decides whether a product is reachable at all. A product only appears in
          Browse Catalog once it offers a selling model and has an active price entry for it — being
          published to a category is not enough.
        </p>
      </div>

      <Card
        title="Selling models"
        sub="ProductSellingModel"
        actions={
          <button className="btn" onClick={() => add('sellingModels', newSellingModel())}>
            Add selling model
          </button>
        }
      >
        <p className="hint-line">
          Set <strong>Record</strong> to <em>Already in the org</em> and paste the record Id to reuse a
          model that is already there. It is then left out of the workbook, and the pricing rows point
          at that Id instead of matching on name. Type and term stay editable either way — the preview
          uses them to bucket totals, but they are not exported for an existing record.
        </p>

        {sellingModels.length === 0 ? (
          <Empty>
            No selling models. An RCA org usually ships some already — reference those by Id rather than
            creating duplicates.
          </Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Name</th>
                  <th style={{ width: 172 }}>Record</th>
                  <th style={{ width: 190 }}>Existing Id</th>
                  <th style={{ width: 220 }}>Type</th>
                  <th style={{ width: 90 }}>Term</th>
                  <th style={{ width: 110 }}>Term unit</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 70 }}>Products</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {sellingModels.map((sm) => (
                  <tr key={sm.id}>
                    <td>
                      <input
                        type="text"
                        value={sm.name}
                        placeholder="Term Based - Yearly"
                        onChange={(e) => update('sellingModels', sm.id, { name: e.target.value })}
                      />
                    </td>
                    <SourceCells
                      existingId={sm.existingId}
                      placeholder="15 or 18-char Id"
                      onChange={(existingId) => update('sellingModels', sm.id, { existingId })}
                    />
                    <td>
                      <select
                        value={sm.type}
                        onChange={(e) =>
                          update('sellingModels', sm.id, {
                            type: e.target.value as SellingModelType,
                            ...(e.target.value === 'TermDefined'
                              ? {}
                              : { pricingTerm: null, pricingTermUnit: '' as TermUnit }),
                          })
                        }
                      >
                        {MODEL_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tiny">
                      {sm.type === 'TermDefined' ? (
                        <Num
                          value={sm.pricingTerm}
                          min={1}
                          onChange={(pricingTerm) => update('sellingModels', sm.id, { pricingTerm })}
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {sm.type === 'TermDefined' ? (
                        <select
                          value={sm.pricingTermUnit}
                          onChange={(e) =>
                            update('sellingModels', sm.id, { pricingTermUnit: e.target.value as TermUnit })
                          }
                        >
                          {TERM_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={sm.status}
                        onChange={(e) =>
                          update('sellingModels', sm.id, { status: e.target.value as 'Active' })
                        }
                      >
                        <option value="Active">Active</option>
                        <option value="Draft">Draft</option>
                        <option value="Obsolete">Obsolete</option>
                      </select>
                    </td>
                    <td className="muted">
                      {sellingModelOptions.filter((o) => o.sellingModelId === sm.id).length}
                    </td>
                    <td>
                      <button className="btn danger" onClick={() => remove('sellingModels', sm.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Price books"
        sub="Pricebook2"
        actions={
          <div className="inline">
            {!pricebooks.some((b) => b.isStandard) && (
              <button className="btn" onClick={() => add('pricebooks', newPricebook(true))}>
                Add standard price book
              </button>
            )}
            <button className="btn" onClick={() => add('pricebooks', newPricebook())}>
              Add price book
            </button>
          </div>
        }
      >
        <p className="hint-line">
          The standard price book already exists in every org, so it is usually the one to reference by
          Id rather than create. Standard and Active still drive this app&apos;s preview; they are not
          exported for an existing book.
        </p>

        {pricebooks.length === 0 ? (
          <Empty>No price book yet. Every org has exactly one standard price book — start with that.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Name</th>
                  <th style={{ width: 172 }}>Record</th>
                  <th style={{ width: 190 }}>Existing Id</th>
                  <th style={{ width: 90 }}>Standard</th>
                  <th style={{ width: 70 }}>Active</th>
                  <th style={{ width: 80 }}>Entries</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {pricebooks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input
                        type="text"
                        value={b.name}
                        placeholder="Standard Price Book"
                        onChange={(e) => update('pricebooks', b.id, { name: e.target.value })}
                      />
                    </td>
                    <SourceCells
                      existingId={b.existingId}
                      placeholder="01s..."
                      onChange={(existingId) => update('pricebooks', b.id, { existingId })}
                    />
                    <td className="check-cell">
                      <Check
                        checked={b.isStandard}
                        onChange={(isStandard) => {
                          if (isStandard)
                            for (const other of pricebooks)
                              if (other.id !== b.id && other.isStandard)
                                update('pricebooks', other.id, { isStandard: false });
                          update('pricebooks', b.id, { isStandard });
                        }}
                      />
                    </td>
                    <td className="check-cell">
                      <Check
                        checked={b.isActive}
                        onChange={(isActive) => update('pricebooks', b.id, { isActive })}
                      />
                    </td>
                    <td className="muted">
                      {pricebookEntries.filter((e) => e.pricebookId === b.id).length}
                    </td>
                    <td>
                      <button className="btn danger" onClick={() => remove('pricebooks', b.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Product pricing"
        sub={book ? `${book.name} · ProductSellingModelOption + PricebookEntry` : 'no price book yet'}
        actions={
          <button
            className="btn"
            disabled={!book || sellingModels.length === 0 || unpriced.length === 0}
            onClick={() => {
              setBulkModel(sellingModels[0]?.id ?? '');
              setBulkOpen(true);
            }}
          >
            Price the {unpriced.length} remaining
          </button>
        }
      >
        {!book || sellingModels.length === 0 ? (
          <Empty>Add a price book and at least one selling model first.</Empty>
        ) : needsPricing.length === 0 ? (
          <Empty>No sellable products yet.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: 210 }}>Selling model</th>
                  <th style={{ width: 70 }}>Default</th>
                  <th style={{ width: 110 }}>Unit price</th>
                  <th style={{ width: 80 }}>Currency</th>
                  <th style={{ width: 65 }}>Active</th>
                  <th style={{ width: 170 }}>Proration policy</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {needsPricing.map((p) => {
                  const options = sellingModelOptions.filter((o) => o.productId === p.id);
                  const unused = sellingModels.filter(
                    (sm) => !options.some((o) => o.sellingModelId === sm.id),
                  );

                  if (options.length === 0) {
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name || 'Untitled'}</strong>
                          <div className="muted" style={{ fontSize: 11 }}>{p.productCode}</div>
                        </td>
                        <td colSpan={6}>
                          <select value="" onChange={(e) => attach(p.id, e.target.value)}>
                            <option value="">— not sold under any model, pick one —</option>
                            {sellingModels.map((sm) => (
                              <option key={sm.id} value={sm.id}>
                                {sm.name || 'Untitled'}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td />
                      </tr>
                    );
                  }

                  return options.map((o, i) => {
                    const sm = sellingModels.find((s) => s.id === o.sellingModelId);
                    const entry = entryFor(p.id, o.sellingModelId);
                    return (
                      <tr key={o.id}>
                        {i === 0 && (
                          <td rowSpan={options.length}>
                            <strong>{p.name || 'Untitled'}</strong>
                            <div className="muted" style={{ fontSize: 11 }}>{p.productCode}</div>
                            {unused.length > 0 && (
                              <select
                                value=""
                                style={{ marginTop: 4 }}
                                onChange={(e) => attach(p.id, e.target.value)}
                              >
                                <option value="">+ another selling model…</option>
                                {unused.map((sm2) => (
                                  <option key={sm2.id} value={sm2.id}>
                                    {sm2.name || 'Untitled'}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        )}
                        <td>{sm?.name || <span className="muted">missing selling model</span>}</td>
                        <td className="check-cell">
                          <Check
                            checked={o.isDefault}
                            onChange={(isDefault) => {
                              if (isDefault)
                                for (const other of options)
                                  if (other.id !== o.id && other.isDefault)
                                    update('sellingModelOptions', other.id, { isDefault: false });
                              update('sellingModelOptions', o.id, { isDefault });
                            }}
                          />
                        </td>
                        <td>
                          {entry ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={entry.unitPrice}
                              onChange={(e) =>
                                update('pricebookEntries', entry.id, {
                                  unitPrice: Number(e.target.value),
                                })
                              }
                            />
                          ) : (
                            <button
                              className="btn small"
                              onClick={() =>
                                add('pricebookEntries', newPricebookEntry(book.id, p.id, o.sellingModelId))
                              }
                            >
                              Add price
                            </button>
                          )}
                        </td>
                        <td>
                          {entry && (
                            <input
                              type="text"
                              value={entry.currency}
                              onChange={(e) =>
                                update('pricebookEntries', entry.id, { currency: e.target.value })
                              }
                            />
                          )}
                        </td>
                        <td className="check-cell">
                          {entry && (
                            <Check
                              checked={entry.isActive}
                              onChange={(isActive) =>
                                update('pricebookEntries', entry.id, { isActive })
                              }
                            />
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            value={o.prorationPolicy}
                            placeholder={sm?.type === 'OneTime' ? '—' : 'Default Proration Policy'}
                            onChange={(e) =>
                              update('sellingModelOptions', o.id, { prorationPolicy: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <button className="btn danger" onClick={() => remove('sellingModelOptions', o.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {bulkOpen && (
        <Modal
          title={`Price the ${unpriced.length} products with no selling model`}
          onClose={() => setBulkOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setBulkOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={applyBulk}>
                Apply
              </button>
            </>
          }
        >
          <div className="grid c2">
            <Field label="Selling model">
              <select value={bulkModel} onChange={(e) => setBulkModel(e.target.value)}>
                {sellingModels.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.name || 'Untitled'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit price" hint="you can adjust each one afterwards">
              <Num value={bulkPrice} min={0} onChange={setBulkPrice} />
            </Field>
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Applies to: {unpriced.map((p) => p.name || 'Untitled').join(', ')}
          </p>
        </Modal>
      )}
    </>
  );
}
