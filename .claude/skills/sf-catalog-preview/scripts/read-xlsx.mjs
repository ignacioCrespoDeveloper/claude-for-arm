#!/usr/bin/env node
// Dumps every tab of an .xlsx to TSV on stdout — zero dependencies, so it runs in any
// project without an npm install. Node's zlib inflates the zip entries directly.
//
//   node read-xlsx.mjs file.xlsx [more.xlsx ...]
//
// Caveats, by design:
//  - Dates print as Excel serial numbers (e.g. 45231). Convert with
//    new Date(Date.UTC(1899, 11, 30) + serial * 86400000) when the column is a date.
//  - Formula cells print their cached result.

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { basename } from 'node:path';

/** Minimal zip reader: central directory → { name: Buffer }. */
function unzip(buf) {
  // End-of-central-directory signature, scanned from the tail (comment can follow it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip/xlsx file (no end-of-central-directory)');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // Sizes in the local header may be zero (data descriptor), so trust the central dir.
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    files[name] = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Concatenated text of every <t> inside a fragment (rich text splits one string in many). */
const textOf = (xml) => {
  let out = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decode(m[1]);
  return out;
};

const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref) {
    if (ch >= '0' && ch <= '9') break;
    n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  }
  return n - 1;
};

function parseSheet(xml, shared) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const c of rowMatch[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? 'n';
      const idx = ref ? colIndex(ref) : cells.length;

      let value = '';
      if (type === 'inlineStr') value = textOf(body);
      else {
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else value = decode(v);
      }
      cells[idx] = value;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    if (cells.some((v) => v !== '')) rows.push(cells);
  }
  return rows;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node read-xlsx.mjs file.xlsx [more.xlsx ...]');
  process.exit(2);
}

for (const file of files) {
  const zip = unzip(readFileSync(file));
  const get = (name) => zip[name]?.toString('utf8') ?? '';

  const shared = [];
  for (const m of get('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) {
    shared.push(textOf(m[1]));
  }

  // Sheet order and names from workbook.xml; r:id → file path from the rels part.
  const rels = {};
  for (const m of get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1])?.[1];
    const target = /Target="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) rels[id] = target.replace(/^\/?(xl\/)?/, 'xl/');
  }

  console.log(`# ${basename(file)}`);
  for (const m of get('xl/workbook.xml').matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const name = decode(/name="([^"]*)"/.exec(m[1])?.[1] ?? '?');
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1];
    const path = rels[rid];
    const rows = path ? parseSheet(get(path), shared) : [];
    console.log(`\n## TAB: ${name}  (${rows.length} rows)\n`);
    for (const r of rows) console.log(r.map((v) => v.replace(/[\t\r\n]+/g, ' ')).join('\t'));
  }
  console.log('');
}
