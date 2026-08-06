#!/usr/bin/env node
// Dumps every .xlsx in ./xlsx to plain text so it can be read/diffed.
// Usage: node tools/dump-xlsx.mjs [file.xlsx ...]   (no args = all of ./xlsx)

import ExcelJS from 'exceljs';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const SRC = 'xlsx';
const OUT = 'xlsx/_dump';

const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text) return v.text;
    if (v.result !== undefined) return String(v.result);
    if (v.formula) return `=${v.formula}`;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return JSON.stringify(v);
  }
  return String(v);
};

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : (await readdir(SRC)).filter((f) => extname(f) === '.xlsx' && !f.startsWith('~$')).map((f) => join(SRC, f));

if (!files.length) {
  console.log(`No .xlsx found in ./${SRC}/ — drop your files there first.`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

for (const file of files) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const name = basename(file, '.xlsx');
  const lines = [`# ${basename(file)}`, ''];

  console.log(`\n=== ${basename(file)} — ${wb.worksheets.length} tabs ===`);

  for (const ws of wb.worksheets) {
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, (c, i) => { vals[i - 1] = cell(c.value); });
      for (let i = 0; i < vals.length; i++) if (vals[i] === undefined) vals[i] = '';
      if (vals.some((v) => v !== '')) rows.push(vals);
    });
    console.log(`  - ${ws.name}: ${rows.length} rows x ${rows[0]?.length ?? 0} cols`);
    lines.push(`## TAB: ${ws.name}  (${rows.length} rows)`, '');
    for (const r of rows) lines.push(r.map((v) => v.replace(/\t/g, ' ')).join('\t'));
    lines.push('');
  }

  const out = join(OUT, `${name}.txt`);
  await writeFile(out, lines.join('\n'));
  console.log(`  -> ${out}`);
}
