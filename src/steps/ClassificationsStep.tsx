import { useStore, newClassification, newClassificationAttribute } from '../model/store';
import { Card, Field, Text, Select, Check, Empty, toCode } from '../ui/primitives';

const STATUS = [
  { value: 'Active', label: 'Active' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Obsolete', label: 'Obsolete' },
] as const;

export default function ClassificationsStep() {
  const {
    classifications,
    classificationAttributes,
    attributes,
    attributeCategories,
    picklistValues,
    products,
    add,
    update,
    remove,
  } = useStore();

  return (
    <>
      <div className="page-head">
        <h2>Classifications</h2>
        <p>
          A classification is the bridge between attributes and products: every product based on it inherits
          its attributes automatically. It is also what a bundle points at when a component group should
          accept any product of a kind rather than one named product.
        </p>
      </div>

      {classifications.length === 0 && (
        <Card>
          <Empty>
            No classifications yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => add('classifications', newClassification())}>
                Add classification
              </button>
            </div>
          </Empty>
        </Card>
      )}

      {classifications.map((cls) => {
        const assigned = classificationAttributes
          .filter((ca) => ca.classificationId === cls.id)
          .sort((a, b) => a.sequence - b.sequence);
        const assignedIds = new Set(assigned.map((a) => a.attributeId));
        const available = attributes.filter((a) => !assignedIds.has(a.id));
        const usedByProducts = products.filter((p) => p.classificationId === cls.id);

        return (
          <Card
            key={cls.id}
            title={cls.name || 'Untitled classification'}
            sub={`${assigned.length} attribute${assigned.length === 1 ? '' : 's'} · ${
              usedByProducts.length
            } product${usedByProducts.length === 1 ? '' : 's'}`}
            actions={
              <button className="btn danger" onClick={() => remove('classifications', cls.id)}>
                Delete
              </button>
            }
          >
            <div className="grid c3" style={{ marginBottom: 18 }}>
              <Field label="Classification name">
                <Text
                  value={cls.name}
                  placeholder="Network Video Recorder"
                  onChange={(name) =>
                    update('classifications', cls.id, {
                      name,
                      ...(cls.code ? {} : { code: toCode(name) }),
                    })
                  }
                />
              </Field>
              <Field label="Code" hint="unique">
                <Text value={cls.code} onChange={(code) => update('classifications', cls.id, { code })} />
              </Field>
              <Field label="Status">
                <Select
                  value={cls.status}
                  onChange={(status) => update('classifications', cls.id, { status })}
                  options={STATUS}
                />
              </Field>
            </div>

            {assigned.length === 0 ? (
              <Empty>
                No attributes attached. A classification with no attributes is still useful for grouping
                components in a bundle.
              </Empty>
            ) : (
              <div className="scroll-x">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th style={{ width: 55 }}>Seq</th>
                      <th>Attribute</th>
                      <th style={{ width: 170 }}>Section</th>
                      <th style={{ width: 150 }}>Default override</th>
                      <th style={{ width: 75 }}>Required</th>
                      <th style={{ width: 75 }}>Read only</th>
                      <th style={{ width: 65 }}>Hidden</th>
                      <th style={{ width: 50 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.map((ca) => {
                      const attr = attributes.find((a) => a.id === ca.attributeId);
                      const values = picklistValues.filter((v) => v.picklistId === attr?.picklistId);
                      return (
                        <tr key={ca.id}>
                          <td className="tiny">
                            <input
                              type="number"
                              value={ca.sequence}
                              onChange={(e) =>
                                update('classificationAttributes', ca.id, {
                                  sequence: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td>
                            <strong>{attr?.label ?? 'missing attribute'}</strong>{' '}
                            <span className="muted mono">{attr?.dataType}</span>
                          </td>
                          <td>
                            <select
                              value={ca.attributeCategoryId ?? ''}
                              onChange={(e) =>
                                update('classificationAttributes', ca.id, {
                                  attributeCategoryId: e.target.value || null,
                                })
                              }
                            >
                              <option value="">— ungrouped —</option>
                              {attributeCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name || 'Untitled'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {attr?.dataType === 'Picklist' ? (
                              <select
                                value={ca.defaultValue}
                                onChange={(e) =>
                                  update('classificationAttributes', ca.id, {
                                    defaultValue: e.target.value,
                                  })
                                }
                              >
                                <option value="">— inherit —</option>
                                {values.map((v) => (
                                  <option key={v.id} value={v.value}>
                                    {v.displayValue || v.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={ca.defaultValue}
                                placeholder={attr?.defaultValue || 'inherit'}
                                onChange={(e) =>
                                  update('classificationAttributes', ca.id, {
                                    defaultValue: e.target.value,
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="check-cell">
                            <Check
                              checked={ca.isRequired}
                              onChange={(isRequired) =>
                                update('classificationAttributes', ca.id, { isRequired })
                              }
                            />
                          </td>
                          <td className="check-cell">
                            <Check
                              checked={ca.isReadOnly}
                              onChange={(isReadOnly) =>
                                update('classificationAttributes', ca.id, { isReadOnly })
                              }
                            />
                          </td>
                          <td className="check-cell">
                            <Check
                              checked={ca.isHidden}
                              onChange={(isHidden) =>
                                update('classificationAttributes', ca.id, { isHidden })
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="btn danger"
                              onClick={() => remove('classificationAttributes', ca.id)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="inline" style={{ marginTop: 12 }}>
              <select
                value=""
                disabled={available.length === 0}
                onChange={(e) => {
                  if (!e.target.value) return;
                  add(
                    'classificationAttributes',
                    newClassificationAttribute(cls.id, e.target.value, assigned.length + 1),
                  );
                }}
              >
                <option value="">
                  {available.length ? '+ Attach an attribute…' : 'All attributes already attached'}
                </option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || 'Untitled'} ({a.dataType})
                  </option>
                ))}
              </select>
            </div>
          </Card>
        );
      })}

      {classifications.length > 0 && (
        <button className="btn" onClick={() => add('classifications', newClassification())}>
          Add another classification
        </button>
      )}
    </>
  );
}
