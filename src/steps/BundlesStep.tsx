import { useState } from 'react';
import { useStore, newComponentGroup, newRelatedComponent } from '../model/store';
import { Card, Field, Text, Num, Check, Empty, toCode } from '../ui/primitives';
import type { QuantityScaleMethod } from '../model/types';

export default function BundlesStep() {
  const {
    products,
    componentGroups,
    relatedComponents,
    classifications,
    add,
    update,
    remove,
  } = useStore();

  const bundles = products.filter((p) => p.type === 'Bundle');
  const [selected, setSelected] = useState<string | null>(bundles[0]?.id ?? null);
  const bundle = bundles.find((b) => b.id === selected) ?? bundles[0] ?? null;

  if (bundles.length === 0) {
    return (
      <>
        <div className="page-head">
          <h2>Bundles</h2>
          <p>Set a product's Type to Bundle in the previous step and it will show up here.</p>
        </div>
        <Card>
          <Empty>No bundles defined yet.</Empty>
        </Card>
      </>
    );
  }

  const groups = bundle
    ? componentGroups.filter((g) => g.bundleId === bundle.id).sort((a, b) => a.sequence - b.sequence)
    : [];

  return (
    <>
      <div className="page-head">
        <h2>Bundle structure</h2>
        <p>
          Component groups are the sections a sales rep sees while configuring. A component either names one
          product or points at a classification, which pulls in every product of that kind — never both.
        </p>
      </div>

      <div className="inline" style={{ marginBottom: 16 }}>
        {bundles.map((b) => (
          <button
            key={b.id}
            className={b.id === bundle?.id ? 'btn primary' : 'btn'}
            onClick={() => setSelected(b.id)}
          >
            {b.name || 'Untitled bundle'}
          </button>
        ))}
      </div>

      {bundle &&
        groups.map((g) => {
          const members = relatedComponents
            .filter((rc) => rc.groupId === g.id)
            .sort((a, b) => a.sequence - b.sequence);
          const candidates = products.filter((p) => p.id !== bundle.id);

          return (
            <Card
              key={g.id}
              title={g.name || 'Untitled group'}
              sub={`${members.length} component${members.length === 1 ? '' : 's'}`}
              actions={
                <button className="btn danger" onClick={() => remove('componentGroups', g.id)}>
                  Delete group
                </button>
              }
            >
              <div className="grid c4" style={{ marginBottom: 16 }}>
                <Field label="Group name">
                  <Text
                    value={g.name}
                    placeholder="Core"
                    onChange={(name) =>
                      update('componentGroups', g.id, {
                        name,
                        ...(g.code ? {} : { code: `${toCode(name)}-${toCode(bundle.productCode)}` }),
                      })
                    }
                  />
                </Field>
                <Field label="Code" hint="components join on this">
                  <Text value={g.code} onChange={(code) => update('componentGroups', g.id, { code })} />
                </Field>
                <Field label="Min components" hint="blank = no minimum">
                  <Num
                    value={g.minComponents}
                    min={0}
                    onChange={(minComponents) => update('componentGroups', g.id, { minComponents })}
                  />
                </Field>
                <Field label="Max components" hint="blank = unlimited">
                  <Num
                    value={g.maxComponents}
                    min={0}
                    onChange={(maxComponents) => update('componentGroups', g.id, { maxComponents })}
                  />
                </Field>
              </div>

              {members.length === 0 ? (
                <Empty>No components in this group yet.</Empty>
              ) : (
                <div className="scroll-x">
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th style={{ width: 55 }}>Seq</th>
                        <th style={{ width: 260 }}>Component</th>
                        <th style={{ width: 60 }}>Qty</th>
                        <th style={{ width: 60 }}>Min</th>
                        <th style={{ width: 60 }}>Max</th>
                        <th style={{ width: 70 }}>Required</th>
                        <th style={{ width: 70 }}>Default</th>
                        <th style={{ width: 70 }}>Qty edit</th>
                        <th style={{ width: 80 }}>Price incl.</th>
                        <th style={{ width: 120 }}>Scaling</th>
                        <th style={{ width: 44 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((rc) => {
                        // One control for both target kinds keeps the "never both" rule enforceable.
                        const value = rc.childClassificationId
                          ? `class:${rc.childClassificationId}`
                          : rc.childProductId
                            ? `prod:${rc.childProductId}`
                            : '';
                        return (
                          <tr key={rc.id}>
                            <td className="tiny">
                              <input
                                type="number"
                                value={rc.sequence}
                                onChange={(e) =>
                                  update('relatedComponents', rc.id, { sequence: Number(e.target.value) })
                                }
                              />
                            </td>
                            <td>
                              <select
                                value={value}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  update('relatedComponents', rc.id, {
                                    childProductId: v.startsWith('prod:') ? v.slice(5) : null,
                                    childClassificationId: v.startsWith('class:') ? v.slice(6) : null,
                                  });
                                }}
                              >
                                <option value="">— choose a component —</option>
                                <optgroup label="Any product of a classification">
                                  {classifications.map((c) => (
                                    <option key={c.id} value={`class:${c.id}`}>
                                      {c.name || 'Untitled'}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="A specific product">
                                  {candidates.map((p) => (
                                    <option key={p.id} value={`prod:${p.id}`}>
                                      {p.name || 'Untitled'}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                            <td className="tiny">
                              <input
                                type="number"
                                min={1}
                                value={rc.quantity}
                                onChange={(e) =>
                                  update('relatedComponents', rc.id, { quantity: Number(e.target.value) })
                                }
                              />
                            </td>
                            <td className="tiny">
                              <Num
                                value={rc.minQuantity}
                                onChange={(minQuantity) =>
                                  update('relatedComponents', rc.id, { minQuantity })
                                }
                              />
                            </td>
                            <td className="tiny">
                              <Num
                                value={rc.maxQuantity}
                                onChange={(maxQuantity) =>
                                  update('relatedComponents', rc.id, { maxQuantity })
                                }
                              />
                            </td>
                            <td className="check-cell">
                              <Check
                                checked={rc.isComponentRequired}
                                onChange={(isComponentRequired) =>
                                  update('relatedComponents', rc.id, { isComponentRequired })
                                }
                              />
                            </td>
                            <td className="check-cell">
                              <Check
                                checked={rc.isDefaultComponent}
                                onChange={(isDefaultComponent) =>
                                  update('relatedComponents', rc.id, { isDefaultComponent })
                                }
                              />
                            </td>
                            <td className="check-cell">
                              <Check
                                checked={rc.isQuantityEditable}
                                onChange={(isQuantityEditable) =>
                                  update('relatedComponents', rc.id, { isQuantityEditable })
                                }
                              />
                            </td>
                            <td className="check-cell">
                              <Check
                                checked={rc.doesBundlePriceIncludeChild}
                                onChange={(doesBundlePriceIncludeChild) =>
                                  update('relatedComponents', rc.id, { doesBundlePriceIncludeChild })
                                }
                              />
                            </td>
                            <td>
                              <select
                                value={rc.quantityScaleMethod}
                                onChange={(e) =>
                                  update('relatedComponents', rc.id, {
                                    quantityScaleMethod: e.target.value as QuantityScaleMethod,
                                  })
                                }
                              >
                                <option value="">—</option>
                                <option value="Constant">Constant</option>
                                <option value="Proportional">Proportional</option>
                              </select>
                            </td>
                            <td>
                              <button
                                className="btn danger"
                                onClick={() => remove('relatedComponents', rc.id)}
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

              <div style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={() =>
                    add('relatedComponents', newRelatedComponent(bundle.id, g.id, members.length + 1))
                  }
                >
                  Add component
                </button>
              </div>
            </Card>
          );
        })}

      {bundle && (
        <button
          className="btn primary"
          onClick={() => add('componentGroups', newComponentGroup(bundle.id, groups.length + 1))}
        >
          Add component group
        </button>
      )}
    </>
  );
}
