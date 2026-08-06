import { useStore, newAttribute, newAttributeCategory } from '../model/store';
import { Card, Check, Empty, toCode, toApiName } from '../ui/primitives';
import type { AttributeDataType } from '../model/types';

const DATA_TYPES: readonly { value: AttributeDataType; label: string }[] = [
  { value: 'Text', label: 'Text' },
  { value: 'Number', label: 'Number' },
  { value: 'Checkbox', label: 'Checkbox' },
  { value: 'Picklist', label: 'Picklist' },
  { value: 'Date', label: 'Date' },
  { value: 'DateTime', label: 'Date/Time' },
  { value: 'Currency', label: 'Currency' },
  { value: 'Percent', label: 'Percent' },
];

export default function AttributesStep() {
  const {
    attributes,
    attributeCategories,
    picklists,
    picklistValues,
    classificationAttributes,
    classifications,
    add,
    update,
    remove,
  } = useStore();

  return (
    <>
      <div className="page-head">
        <h2>Attributes</h2>
        <p>
          Attribute definitions are org-wide and reusable. Categories are only a layout device — they group
          attributes into sections in the configurator. You attach attributes to products in the next step,
          through classifications.
        </p>
      </div>

      <Card
        title="Attribute categories"
        sub="optional grouping shown as sections in the configurator"
        actions={
          <button className="btn" onClick={() => add('attributeCategories', newAttributeCategory())}>
            Add category
          </button>
        }
      >
        {attributeCategories.length === 0 ? (
          <Empty>No categories. Attributes without one still work, they just render ungrouped.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {attributeCategories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="text"
                        value={c.name}
                        placeholder="Plan Characteristics"
                        onChange={(e) =>
                          update('attributeCategories', c.id, {
                            name: e.target.value,
                            ...(c.code ? {} : { code: toCode(e.target.value) }),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="mono"
                        value={c.code}
                        onChange={(e) => update('attributeCategories', c.id, { code: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={c.description}
                        onChange={(e) =>
                          update('attributeCategories', c.id, { description: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <button className="btn danger" onClick={() => remove('attributeCategories', c.id)}>
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
        title="Attribute definitions"
        sub={`${attributes.length} defined`}
        actions={
          <button className="btn primary" onClick={() => add('attributes', newAttribute())}>
            Add attribute
          </button>
        }
      >
        {attributes.length === 0 ? (
          <Empty>No attributes yet.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>API name</th>
                  <th style={{ width: 120 }}>Data type</th>
                  <th style={{ width: 170 }}>Picklist</th>
                  <th style={{ width: 150 }}>Default</th>
                  <th style={{ width: 65 }}>Active</th>
                  <th>Used by</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {attributes.map((a) => {
                  const values = picklistValues.filter((v) => v.picklistId === a.picklistId);
                  const users = classificationAttributes
                    .filter((ca) => ca.attributeId === a.id)
                    .map((ca) => classifications.find((c) => c.id === ca.classificationId)?.name)
                    .filter(Boolean);
                  return (
                    <tr key={a.id}>
                      <td>
                        <input
                          type="text"
                          value={a.label}
                          placeholder="Included Storage"
                          onChange={(e) => {
                            const label = e.target.value;
                            update('attributes', a.id, {
                              label,
                              ...(a.apiName ? {} : { apiName: toApiName(label) }),
                              ...(a.code ? {} : { code: toCode(label) }),
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="mono"
                          value={a.apiName}
                          onChange={(e) => update('attributes', a.id, { apiName: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={a.dataType}
                          onChange={(e) =>
                            update('attributes', a.id, {
                              dataType: e.target.value as AttributeDataType,
                              ...(e.target.value === 'Picklist' ? {} : { picklistId: null }),
                            })
                          }
                        >
                          {DATA_TYPES.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {a.dataType === 'Picklist' ? (
                          <select
                            value={a.picklistId ?? ''}
                            onChange={(e) =>
                              update('attributes', a.id, { picklistId: e.target.value || null })
                            }
                          >
                            <option value="">— choose —</option>
                            {picklists.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name || 'Untitled'}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {a.dataType === 'Picklist' ? (
                          <select
                            value={a.defaultValue}
                            onChange={(e) => update('attributes', a.id, { defaultValue: e.target.value })}
                          >
                            <option value="">— none —</option>
                            {values.map((v) => (
                              <option key={v.id} value={v.value}>
                                {v.displayValue || v.name}
                              </option>
                            ))}
                          </select>
                        ) : a.dataType === 'Checkbox' ? (
                          <select
                            value={a.defaultValue}
                            onChange={(e) => update('attributes', a.id, { defaultValue: e.target.value })}
                          >
                            <option value="">— none —</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={a.defaultValue}
                            onChange={(e) => update('attributes', a.id, { defaultValue: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="check-cell">
                        <Check
                          checked={a.isActive}
                          onChange={(isActive) => update('attributes', a.id, { isActive })}
                        />
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        {users.length ? users.join(', ') : <span className="muted">unassigned</span>}
                      </td>
                      <td>
                        <button className="btn danger" onClick={() => remove('attributes', a.id)}>
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
      </Card>
    </>
  );
}
