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

// Referencing a record that already exists in the org, instead of creating it.
console.log('\nExisting-record references:');
{
  const cell = (tabs, tabName, col, row = 0) => {
    const tab = tabs.find((t) => t.name === tabName);
    const i = tab.columns.indexOf(col);
    return i === -1 ? undefined : tab.rows[row]?.[i];
  };
  const rowsOf = (tabs, name) => tabs.find((t) => t.name === name).rows.length;

  const base = buildTabs(sampleModel());
  const check = (label, got, expected) => {
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    console.log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  };

  // A catalog that creates everything must export exactly what it did before.
  check('no Id columns when nothing references an existing record',
    base.find((t) => t.name === 'PricebookEntry').columns.some((c) => c.endsWith('Id')), false);

  // Price book by Id: not created, and the entry resolves by Id with the name left blank.
  const pbModel = sampleModel();
  pbModel.pricebooks[0].existingId = '01sAA0000012345';
  const pb = buildTabs(pbModel);
  check('existing price book is not created', rowsOf(pb, 'Pricebook2'), rowsOf(base, 'Pricebook2') - 1);
  check('PricebookEntry carries the price book Id', cell(pb, 'PricebookEntry', 'Pricebook2Id'), '01sAA0000012345');
  check('…and leaves the name column blank', cell(pb, 'PricebookEntry', 'Pricebook2:Pricebook2:Name'), '');
  check('selling model still resolves by name',
    cell(pb, 'PricebookEntry', 'ProductSellingModel:ProductSellingModel:Name'),
    cell(base, 'PricebookEntry', 'ProductSellingModel:ProductSellingModel:Name'));
  check('no selling-model Id column when none is referenced',
    pb.find((t) => t.name === 'PricebookEntry').columns.includes('ProductSellingModelId'), false);

  // Selling model by Id: reaches both child tabs.
  const smModel = sampleModel();
  const smId = smModel.sellingModels[0].id;
  smModel.sellingModels[0].existingId = '0PhAA0000098765';
  const sm = buildTabs(smModel);
  check('existing selling model is not created',
    rowsOf(sm, 'ProductSellingModel'), rowsOf(base, 'ProductSellingModel') - 1);
  const optRow = smModel.sellingModelOptions.findIndex((o) => o.sellingModelId === smId);
  check('ProductSellingModelOption carries the Id',
    cell(sm, 'ProductSellingModelOption', 'ProductSellingModelId', optRow), '0PhAA0000098765');
  check('…and leaves its name column blank',
    cell(sm, 'ProductSellingModelOption', 'ProductSellingModel:ProductSellingModel:Name', optRow), '');

  // Mixed: models resolved by Id and by name in the same tab.
  const otherRow = smModel.sellingModelOptions.findIndex((o) => o.sellingModelId !== smId);
  if (otherRow !== -1) {
    check('a created model in the same tab still resolves by name',
      cell(sm, 'ProductSellingModelOption', 'ProductSellingModelId', otherRow), '');
    check('…with its name column filled',
      cell(sm, 'ProductSellingModelOption', 'ProductSellingModel:ProductSellingModel:Name', otherRow),
      cell(base, 'ProductSellingModelOption', 'ProductSellingModel:ProductSellingModel:Name', otherRow));
  }

  // A malformed Id must be caught before the workbook is built.
  const badModel = sampleModel();
  badModel.pricebooks[0].existingId = 'not-an-id';
  check('a malformed Id is an error',
    validate(badModel).some((i) => i.severity === 'error' && i.message.includes('not a Salesforce Id')), true);

  const wrongPrefix = sampleModel();
  wrongPrefix.pricebooks[0].existingId = '01tAA0000012345';
  check('a price book Id with the wrong prefix warns',
    validate(wrongPrefix).some((i) => i.severity === 'warning' && i.message.includes('price book Ids start')), true);
}

if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
}

await rm(dir, { recursive: true, force: true });
if (problems.length || failures.length) process.exit(1);
