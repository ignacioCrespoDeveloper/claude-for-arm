import { useStore, newCatalog, newCategory } from '../model/store';
import { Card, Field, Text, Check, Empty, toCode } from '../ui/primitives';

export default function CatalogStep() {
  const { catalogs, categories, add, update, remove } = useStore();

  return (
    <>
      <div className="page-head">
        <h2>Catalog and categories</h2>
        <p>
          A catalog is the shelf your products sit on, and categories are its aisles. Nothing appears in
          Browse Catalog until it is published to a category, so this is where the whole structure starts.
        </p>
      </div>

      {catalogs.length === 0 && (
        <Card>
          <Empty>
            No catalogs yet. Most orgs need exactly one to start.
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => add('catalogs', newCatalog())}>
                Add catalog
              </button>
            </div>
          </Empty>
        </Card>
      )}

      {catalogs.map((cat) => {
        const own = categories
          .filter((c) => c.catalogId === cat.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const roots = own.filter((c) => !c.parentId);

        return (
          <Card
            key={cat.id}
            title={cat.name || 'Untitled catalog'}
            sub={`${own.length} categor${own.length === 1 ? 'y' : 'ies'}`}
            actions={
              <button className="btn danger" onClick={() => remove('catalogs', cat.id)}>
                Delete catalog
              </button>
            }
          >
            <div className="grid c3" style={{ marginBottom: 18 }}>
              <Field label="Catalog name">
                <Text
                  value={cat.name}
                  placeholder="Quantra Catalog"
                  onChange={(name) =>
                    update('catalogs', cat.id, { name, ...(cat.code ? {} : { code: toCode(name) }) })
                  }
                />
              </Field>
              <Field label="Code" hint="unique">
                <Text value={cat.code} placeholder="QUANTRA" onChange={(code) => update('catalogs', cat.id, { code })} />
              </Field>
              <Field label="Description">
                <Text
                  value={cat.description}
                  onChange={(description) => update('catalogs', cat.id, { description })}
                />
              </Field>
            </div>

            <div className="scroll-x">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Order</th>
                    <th>Category name</th>
                    <th>Code</th>
                    <th style={{ width: 190 }}>Nested under</th>
                    <th style={{ width: 90 }}>In menu</th>
                    <th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {own.map((c) => (
                    <tr key={c.id}>
                      <td className="tiny">
                        <input
                          type="number"
                          value={c.sortOrder}
                          onChange={(e) =>
                            update('categories', c.id, { sortOrder: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={c.name}
                          placeholder="Subscriptions"
                          onChange={(e) =>
                            update('categories', c.id, {
                              name: e.target.value,
                              ...(c.code ? {} : { code: `${cat.code}-${toCode(e.target.value)}` }),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="mono"
                          value={c.code}
                          onChange={(e) => update('categories', c.id, { code: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={c.parentId ?? ''}
                          onChange={(e) =>
                            update('categories', c.id, { parentId: e.target.value || null })
                          }
                        >
                          <option value="">— top level —</option>
                          {roots
                            .filter((r) => r.id !== c.id)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name || 'Untitled'}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="check-cell">
                        <Check
                          checked={c.showInMenu}
                          onChange={(showInMenu) => update('categories', c.id, { showInMenu })}
                        />
                      </td>
                      <td>
                        <button className="btn danger" onClick={() => remove('categories', c.id)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                className="btn"
                onClick={() => add('categories', newCategory(cat.id, own.length + 1))}
              >
                Add category
              </button>
            </div>
          </Card>
        );
      })}

      {catalogs.length > 0 && (
        <button className="btn" onClick={() => add('catalogs', newCatalog())}>
          Add another catalog
        </button>
      )}
    </>
  );
}
