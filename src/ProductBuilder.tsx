import { useMemo, useState } from 'react';
import { useStore, modelOf } from './model/store';
import { validate, countBy, type StepKey } from './model/validate';
import { exportWorkbook, buildTabs, POST_LOAD_STEPS } from './export/exportWorkbook';
import { sampleModel } from './data/sample';
import CatalogStep from './steps/CatalogStep';
import PicklistsStep from './steps/PicklistsStep';
import AttributesStep from './steps/AttributesStep';
import ClassificationsStep from './steps/ClassificationsStep';
import ProductsStep from './steps/ProductsStep';
import BundlesStep from './steps/BundlesStep';
import PricingStep from './steps/PricingStep';
import BrowseCatalog from './preview/BrowseCatalog';
import { Card, Empty } from './ui/primitives';

type Page = StepKey | 'preview' | 'export';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'catalog', label: 'Catalog & categories' },
  { key: 'picklists', label: 'Picklists' },
  { key: 'attributes', label: 'Attributes' },
  { key: 'classifications', label: 'Classifications' },
  { key: 'products', label: 'Products' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'pricing', label: 'Selling models & pricing' },
];

export default function ProductBuilder({ go }: { go: (route: string) => void }) {
  const store = useStore();
  const [page, setPage] = useState<Page>('catalog');

  const model = useMemo(() => modelOf(store), [store]);
  const issues = useMemo(() => validate(model), [model]);
  const errors = issues.filter((i) => i.severity === 'error');

  const counts: Record<StepKey, number> = {
    catalog: model.catalogs.length + model.categories.length,
    picklists: model.picklists.length,
    attributes: model.attributes.length,
    classifications: model.classifications.length,
    products: model.products.length,
    bundles: model.products.filter((p) => p.type === 'Bundle').length,
    pricing: model.pricebookEntries.length,
  };

  const stepIndex = STEPS.findIndex((s) => s.key === page);

  const loadSample = () => {
    if (
      model.products.length > 0 &&
      !confirm('This replaces everything currently in the builder. Continue?')
    )
      return;
    store.replaceModel(sampleModel());
    setPage('catalog');
  };

  const clearAll = () => {
    if (!confirm('Clear the whole catalog? This cannot be undone.')) return;
    store.reset();
    setPage('catalog');
  };

  const saveJson = () => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rca-catalog.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.replaceModel(JSON.parse(String(reader.result)));
        setPage('catalog');
      } catch {
        alert('That file is not a catalog export from this tool.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="back-link" onClick={() => go('/')}>
          ← All tools
        </button>
        <h1>RCA Product Builder</h1>
        <p className="tagline">Design a Revenue Cloud catalog, then export it as a load-ready workbook.</p>

        <ul className="nav">
          {STEPS.map((s, i) => {
            const { errors: e, warnings: w } = countBy(issues, s.key);
            return (
              <li key={s.key}>
                <button className={page === s.key ? 'active' : ''} onClick={() => setPage(s.key)}>
                  <span className="idx">{i + 1}</span>
                  <span className="label">{s.label}</span>
                  {e > 0 ? (
                    <span className="badge err">{e}</span>
                  ) : w > 0 ? (
                    <span className="badge warn">{w}</span>
                  ) : (
                    <span className="count">{counts[s.key] || ''}</span>
                  )}
                </button>
              </li>
            );
          })}
          <li style={{ marginTop: 10 }}>
            <button className={page === 'preview' ? 'active' : ''} onClick={() => setPage('preview')}>
              <span className="idx">👁</span>
              <span className="label">Preview catalog</span>
            </button>
          </li>
          <li>
            <button className={page === 'export' ? 'active' : ''} onClick={() => setPage('export')}>
              <span className="idx">↓</span>
              <span className="label">Review & export</span>
              {errors.length > 0 && <span className="badge err">{errors.length}</span>}
            </button>
          </li>
        </ul>

        <div className="sidebar-actions">
          <button className="btn" onClick={loadSample}>
            Load sample catalog
          </button>
          <button className="btn" onClick={saveJson}>
            Save as JSON
          </button>
          <label className="btn" style={{ textAlign: 'center', cursor: 'pointer' }}>
            Load JSON
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && loadJson(e.target.files[0])}
            />
          </label>
          <button className="btn danger" onClick={clearAll}>
            Clear everything
          </button>
        </div>
      </aside>

      <main className="main">
        {page === 'catalog' && <CatalogStep />}
        {page === 'picklists' && <PicklistsStep />}
        {page === 'attributes' && <AttributesStep />}
        {page === 'classifications' && <ClassificationsStep />}
        {page === 'products' && <ProductsStep />}
        {page === 'bundles' && <BundlesStep />}
        {page === 'pricing' && <PricingStep />}
        {page === 'preview' && <BrowseCatalog />}
        {page === 'export' && <ExportPage />}
      </main>

      {stepIndex >= 0 && (
        <div className="footer-bar">
          <button
            className="btn"
            disabled={stepIndex === 0}
            onClick={() => setPage(STEPS[stepIndex - 1].key)}
          >
            ← Back
          </button>
          <span className="muted">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <div className="spacer" />
          {errors.length > 0 && (
            <span className="badge err">
              {errors.length} issue{errors.length === 1 ? '' : 's'} to fix
            </span>
          )}
          {stepIndex === STEPS.length - 1 ? (
            <button className="btn primary" onClick={() => setPage('preview')}>
              Preview catalog →
            </button>
          ) : (
            <button className="btn primary" onClick={() => setPage(STEPS[stepIndex + 1].key)}>
              Next: {STEPS[stepIndex + 1].label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ExportPage() {
  const store = useStore();
  const model = useMemo(() => modelOf(store), [store]);
  const issues = useMemo(() => validate(model), [model]);
  const tabs = useMemo(() => buildTabs(model), [model]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const totalRows = tabs.reduce((n, t) => n + t.rows.length, 0);

  return (
    <>
      <div className="page-head">
        <h2>Review & export</h2>
        <p>
          One tab per Salesforce object, one header row of real API names. Lookups use the
          <span className="mono"> Field:Object:Key </span> syntax, so the loader resolves records by name or
          code and you never have to paste ids.
        </p>
      </div>

      <Card
        title="Validation"
        sub={
          errors.length === 0
            ? `clean · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
            : `${errors.length} error${errors.length === 1 ? '' : 's'}`
        }
      >
        {issues.length === 0 ? (
          <div className="badge ok">Everything checks out.</div>
        ) : (
          <div className="issues">
            {[...errors, ...warnings].map((i, n) => (
              <div key={n} className={`issue ${i.severity}`}>
                <span className="where">{i.step}</span>
                <span>{i.message}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Workbook contents" sub={`${tabs.length} tabs · ${totalRows} rows`} flush>
        <table className="grid-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Tab</th>
              <th style={{ width: 70 }}>Rows</th>
              <th>Columns</th>
            </tr>
          </thead>
          <tbody>
            {tabs.map((t, i) => (
              <tr key={t.name}>
                <td className="muted">{i + 1}</td>
                <td className="mono">
                  <strong>{t.name}</strong>
                </td>
                <td>{t.rows.length}</td>
                <td className="muted" style={{ fontSize: 11 }}>
                  {t.columns.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="After loading the workbook" sub="records alone do not make a product sellable">
        <ol className="checklist">
          {POST_LOAD_STEPS.map(([title, detail]) => (
            <li key={title}>
              <strong>{title}</strong>
              <div className="muted">{detail}</div>
            </li>
          ))}
        </ol>
      </Card>

      {totalRows === 0 ? (
        <Card>
          <Empty>Nothing to export yet.</Empty>
        </Card>
      ) : (
        <div className="inline">
          <button className="btn primary" onClick={() => exportWorkbook(model)}>
            Download .xlsx
          </button>
          {errors.length > 0 && (
            <span className="muted">
              You can still download, but the {errors.length} error
              {errors.length === 1 ? '' : 's'} above will fail on import.
            </span>
          )}
        </div>
      )}
    </>
  );
}
