import { useState } from 'react';
import { useStore, newPicklist, newPicklistValue, uid } from '../model/store';
import { Card, Field, Text, Select, Check, Empty, Modal, Area, toCode } from '../ui/primitives';
import type { PicklistValue } from '../model/types';

const STATUS = [
  { value: 'Active', label: 'Active' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Obsolete', label: 'Obsolete' },
] as const;

export default function PicklistsStep() {
  const { picklists, picklistValues, attributes, add, update, remove } = useStore();
  const [bulkFor, setBulkFor] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');

  /** Paste one value per line — the fastest way to fill a long picklist. */
  const applyBulk = () => {
    if (!bulkFor) return;
    const existing = picklistValues.filter((v) => v.picklistId === bulkFor);
    let seq = existing.length;
    for (const line of bulkText.split('\n').map((l) => l.trim()).filter(Boolean)) {
      seq += 1;
      const row: PicklistValue = {
        id: uid(),
        picklistId: bulkFor,
        name: line,
        code: toCode(line),
        abbreviation: line.slice(0, 12),
        displayValue: line,
        value: line,
        status: 'Active',
        isDefault: false,
        sequence: seq,
      };
      add('picklistValues', row);
    }
    setBulkFor(null);
    setBulkText('');
  };

  return (
    <>
      <div className="page-head">
        <h2>Attribute picklists</h2>
        <p>
          Define the reusable value sets first. Attributes point at a picklist by name, so a picklist with no
          values leaves an attribute that renders as an empty dropdown in the configurator.
        </p>
      </div>

      {picklists.length === 0 && (
        <Card>
          <Empty>
            No picklists yet.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => add('picklists', newPicklist())}>
                Add picklist
              </button>
            </div>
          </Empty>
        </Card>
      )}

      {picklists.map((p) => {
        const values = picklistValues
          .filter((v) => v.picklistId === p.id)
          .sort((a, b) => a.sequence - b.sequence);
        const usedBy = attributes.filter((a) => a.picklistId === p.id);

        return (
          <Card
            key={p.id}
            title={p.name || 'Untitled picklist'}
            sub={`${values.length} value${values.length === 1 ? '' : 's'}${
              usedBy.length ? ` · used by ${usedBy.map((a) => a.label).join(', ')}` : ''
            }`}
            actions={
              <button className="btn danger" onClick={() => remove('picklists', p.id)}>
                Delete
              </button>
            }
          >
            <div className="grid c4" style={{ marginBottom: 18 }}>
              <Field label="Picklist name" hint="unique">
                <Text
                  value={p.name}
                  placeholder="Included Storage"
                  onChange={(name) =>
                    update('picklists', p.id, { name, ...(p.code ? {} : { code: toCode(name) }) })
                  }
                />
              </Field>
              <Field label="Code">
                <Text value={p.code} onChange={(code) => update('picklists', p.id, { code })} />
              </Field>
              <Field label="Value data type">
                <Select
                  value={p.dataType}
                  onChange={(dataType) => update('picklists', p.id, { dataType })}
                  options={[
                    { value: 'Text', label: 'Text' },
                    { value: 'Number', label: 'Number' },
                  ]}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={p.status}
                  onChange={(status) => update('picklists', p.id, { status })}
                  options={STATUS}
                />
              </Field>
            </div>

            <div className="scroll-x">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th style={{ width: 55 }}>Seq</th>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Abbreviation</th>
                    <th>Display value</th>
                    <th>Stored value</th>
                    <th style={{ width: 70 }}>Default</th>
                    <th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {values.map((v) => (
                    <tr key={v.id}>
                      <td className="tiny">
                        <input
                          type="number"
                          value={v.sequence}
                          onChange={(e) =>
                            update('picklistValues', v.id, { sequence: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={v.name}
                          placeholder="4TB"
                          onChange={(e) => {
                            const name = e.target.value;
                            update('picklistValues', v.id, {
                              name,
                              ...(v.code ? {} : { code: toCode(name) }),
                              ...(v.displayValue ? {} : { displayValue: name }),
                              ...(v.value ? {} : { value: name }),
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="mono"
                          value={v.code}
                          onChange={(e) => update('picklistValues', v.id, { code: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={v.abbreviation}
                          onChange={(e) =>
                            update('picklistValues', v.id, { abbreviation: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={v.displayValue}
                          onChange={(e) =>
                            update('picklistValues', v.id, { displayValue: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => update('picklistValues', v.id, { value: e.target.value })}
                        />
                      </td>
                      <td className="check-cell">
                        <Check
                          checked={v.isDefault}
                          onChange={(isDefault) => {
                            // Only one default per picklist.
                            if (isDefault) {
                              for (const other of values) {
                                if (other.id !== v.id && other.isDefault)
                                  update('picklistValues', other.id, { isDefault: false });
                              }
                            }
                            update('picklistValues', v.id, { isDefault });
                          }}
                        />
                      </td>
                      <td>
                        <button className="btn danger" onClick={() => remove('picklistValues', v.id)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inline" style={{ marginTop: 12 }}>
              <button
                className="btn"
                onClick={() => add('picklistValues', newPicklistValue(p.id, values.length + 1))}
              >
                Add value
              </button>
              <button className="btn" onClick={() => setBulkFor(p.id)}>
                Paste a list
              </button>
            </div>
          </Card>
        );
      })}

      {picklists.length > 0 && (
        <button className="btn" onClick={() => add('picklists', newPicklist())}>
          Add another picklist
        </button>
      )}

      {bulkFor && (
        <Modal
          title="Paste values, one per line"
          onClose={() => setBulkFor(null)}
          footer={
            <>
              <button className="btn" onClick={() => setBulkFor(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={applyBulk}>
                Add values
              </button>
            </>
          }
        >
          <Field label="Values" hint="codes and display values are filled in for you and stay editable">
            <Area value={bulkText} onChange={setBulkText} placeholder={'4TB\n8TB\n12TB'} />
          </Field>
        </Modal>
      )}
    </>
  );
}
