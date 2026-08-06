// Bundles the pure model/export code for Node, runs it against the sample
// catalog, writes a workbook and reads it back. Proves the export is loadable
// without opening a browser.
//
// Usage: node tools/verify-export.mjs

import { build } from 'esbuild';
import ExcelJS from 'exceljs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'rca-verify-'));
const entry = join(dir, 'entry.mjs');

await build({
  stdin: {
    contents: `
      export { buildTabs, LOAD_ORDER } from './src/export/exportWorkbook.ts';
      export { sampleModel } from './src/data/sample.ts';
      export { validate } from './src/model/validate.ts';
      export { blockers } from './src/model/visibility.ts';
      export { frequencyOf } from './src/model/pricing.ts';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: entry,
  external: ['exceljs'],
  logLevel: 'warning',
});

const { buildTabs, LOAD_ORDER, sampleModel, validate, blockers, frequencyOf } = await import(entry);

const model = sampleModel();
const issues = validate(model);
const errors = issues.filter((i) => i.severity === 'error');

console.log(`Validation: ${errors.length} errors, ${issues.length - errors.length} warnings`);
for (const i of issues) console.log(`  [${i.severity}] ${i.step}: ${i.message}`);

const tabs = buildTabs(model);

// Every tab the loader expects must be present and in dependency order.
const names = tabs.map((t) => t.name);
const missing = LOAD_ORDER.filter((n) => !names.includes(n));
if (missing.length) throw new Error(`Missing tabs: ${missing.join(', ')}`);
if (names.join('|') !== LOAD_ORDER.join('|'))
  throw new Error(`Tab order drifted from LOAD_ORDER:\n  got  ${names.join(', ')}`);

// Every lookup column must resolve to a real value in its target tab.
const problems = [];
for (const tab of tabs) {
  tab.columns.forEach((col, ci) => {
    const parts = col.split(':');
    if (parts.length !== 3) return;
    const [, targetObject, targetField] = parts;
    const target = tabs.find((t) => t.name === targetObject);
    if (!target) return; // RecordType / UnitOfMeasure live in the org, not the workbook.
    const fi = target.columns.indexOf(targetField);
    if (fi === -1) {
      problems.push(`${tab.name}.${col} references ${targetObject}.${targetField}, which that tab has no column for`);
      return;
    }
    const valid = new Set(target.rows.map((r) => String(r[fi] ?? '')));
    tab.rows.forEach((row, ri) => {
      const v = String(row[ci] ?? '');
      if (v && !valid.has(v))
        problems.push(`${tab.name} row ${ri + 2}: ${col} = "${v}" has no match in ${targetObject}.${targetField}`);
    });
  });
}

console.log('\nTabs:');
for (const t of tabs) console.log(`  ${t.name.padEnd(28)} ${String(t.rows.length).padStart(3)} rows`);

if (problems.length) {
  console.log('\nBroken lookups:');
  for (const p of problems) console.log(`  ✗ ${p}`);
} else {
  console.log('\nAll cross-tab lookups resolve.');
}

// Round-trip through a real workbook file.
const wb = new ExcelJS.Workbook();
for (const tab of tabs) {
  const ws = wb.addWorksheet(tab.name);
  ws.addRow(tab.columns);
  for (const row of tab.rows) ws.addRow(row);
}
const out = join(dir, 'out.xlsx');
await wb.xlsx.writeFile(out);

const back = new ExcelJS.Workbook();
await back.xlsx.readFile(out);
console.log(`\nRound-trip: wrote and re-read ${back.worksheets.length} tabs from ${out}`);
const sample = back.getWorksheet('ProductRelatedComponent');
console.log(`ProductRelatedComponent header: ${sample.getRow(1).values.slice(1, 5).join(' | ')}`);
console.log(`ProductRelatedComponent row 2:  ${sample.getRow(2).values.slice(1, 5).join(' | ')}`);

// The rule that costs the most time in a real project: a product that loads
// cleanly but never appears because its pricing records are missing.
console.log('\nVisibility rules:');
const failures = [];

const check = (name, mutate, expectReason, expectErrorMatch) => {
  const broken = mutate(sampleModel());
  const product = broken.products.find((p) => p.id === 'p2');
  const reasons = blockers(broken, product, 'cat1', 'pb1');
  const errors = validate(broken).filter((i) => i.severity === 'error');

  const gotReason = reasons.includes(expectReason);
  const gotError = errors.some((e) => e.message.includes(expectErrorMatch));
  console.log(`  ${gotReason && gotError ? '✓' : '✗'} ${name}`);
  if (!gotReason) failures.push(`${name}: blockers() did not return "${expectReason}" (got ${JSON.stringify(reasons)})`);
  if (!gotError) failures.push(`${name}: validate() raised no error containing "${expectErrorMatch}"`);
};

check(
  'no ProductSellingModelOption hides the product',
  (m) => ({ ...m, sellingModelOptions: m.sellingModelOptions.filter((o) => o.productId !== 'p2') }),
  'no-selling-model',
  'has no selling model',
);

check(
  'no PricebookEntry hides the product',
  (m) => ({ ...m, pricebookEntries: m.pricebookEntries.filter((e) => e.productId !== 'p2') }),
  'no-price',
  'has no active price',
);

check(
  'an inactive PricebookEntry hides the product',
  (m) => ({
    ...m,
    pricebookEntries: m.pricebookEntries.map((e) =>
      e.productId === 'p2' ? { ...e, isActive: false } : e,
    ),
  }),
  'no-price',
  'has no active price',
);

// The intact sample must stay visible, otherwise the checks above prove nothing.
const clean = sampleModel();
const visible = blockers(clean, clean.products.find((p) => p.id === 'p2'), 'cat1', 'pb1');
console.log(`  ${visible.length === 0 ? '✓' : '✗'} a fully configured product is visible`);
if (visible.length) failures.push(`intact sample product is blocked by ${JSON.stringify(visible)}`);

// Which summary bucket each selling model lands in.
console.log('\nSummary buckets:');
const bucket = (type, term, unit) => {
  const m = sampleModel();
  m.sellingModels = [{ id: 'x', name: 'x', type, pricingTerm: term, pricingTermUnit: unit, status: 'Active' }];
  m.sellingModelOptions = [{ id: 'o', productId: 'p2', sellingModelId: 'x', isDefault: true, prorationPolicy: '' }];
  return frequencyOf(m, 'p2');
};
for (const [label, args, expected] of [
  ['one time', ['OneTime', null, ''], 'One Time'],
  ['evergreen', ['Evergreen', null, ''], 'Monthly'],
  ['1 month term', ['TermDefined', 1, 'Months'], 'Monthly'],
  ['3 month term', ['TermDefined', 3, 'Months'], 'Quarterly'],
  ['6 month term', ['TermDefined', 6, 'Months'], 'Semi-Annual'],
  ['12 month term', ['TermDefined', 12, 'Months'], 'Annual'],
  ['1 year term', ['TermDefined', 1, 'Years'], 'Annual'],
  ['no selling model', ['OneTime', null, ''], 'One Time'],
]) {
  const got = bucket(...args);
  console.log(`  ${got === expected ? '✓' : '✗'} ${label} → ${got}`);
  if (got !== expected) failures.push(`${label}: expected ${expected}, got ${got}`);
}

if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
}

await rm(dir, { recursive: true, force: true });
if (problems.length || failures.length) process.exit(1);
