#!/usr/bin/env node
/**
 * vakt-bransch.mjs — vaktar mot hårdkodade bransch-ord i user-facing strängar.
 *
 * Corevo är multi-bransch: bransch-ord (salong, frisör, klippning …) i UI-copy
 * ska komma från terminologi-systemet (verticals.terminology, resolveTerm,
 * resolveStaffNoun, theme-content per bransch) — aldrig hårdkodas.
 *
 * Körning:
 *   node scripts/vakt-bransch.mjs           # failar (exit 1) på NYA träffar mot baseline
 *   node scripts/vakt-bransch.mjs --full    # listar ÄVEN baseline-träffarna (städlistan)
 *
 * Baseline: scripts/vakt-bransch-baseline.json — genereras vid första körningen
 * (alla dåvarande träffar = kända historiska synder). Radera filen och kör om
 * för att regenerera. Matchning sker på fil + ord + radtext (inte radnummer),
 * så orelaterade edits flyttar inte baseline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const BASELINE_PATH = path.join(WEB_ROOT, 'scripts', 'vakt-bransch-baseline.json');
const FULL = process.argv.includes('--full');

// Bransch-ord (svenska böjningar via \p{L}*-svans). Start-gräns via lookbehind.
const WORD_RE =
  /(?<!\p{L})(salong|frisör|barber|klippning|stylist|hårvård)\p{L}*/giu;

// "boka tid" är INTE förbjudet generellt (bokning = modul) — men i mall-/
// storefront-copy ska branschens CTA styra. Flaggas bara i dessa filer:
const BOKA_TID_RE = /boka\s+tid\p{L}*/giu;
function isTemplateCopyFile(rel) {
  return (
    rel.startsWith('components/storefront/layouts/') ||
    path.basename(rel) === 'theme-content.ts'
  );
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = path.join(e.parentPath, e.name);
    if (full.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (!/\.tsx?$/.test(e.name)) continue;
    if (/\.test\./.test(e.name)) continue;
    yield full;
  }
}

const PURE_TEXT_LINE = /^[\p{L}\d\s.,:;!?()&–—%'’""·+\/-]+$/u;

/** Avgör om en träff på raden ser user-facing ut (strängliteral eller JSX-text). */
function classifyMatch(line, start, end, isTsx, inBlockComment) {
  const trimmed = line.trim();
  if (inBlockComment) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return null;
  if (/^\s*import[\s{'"]/.test(line)) return null; // importvägar
  if (line[start - 1] === '/') return null; // path-segment (/salonger, url-slug)

  const before = line.slice(0, start);
  const after = line.slice(end);
  const inString = /['"`]/.test(before) && /['"`]/.test(after);

  // Kommentar i slutet av kodrad: "//" före träffen utan att träffen är i sträng
  if (!inString && /\/\//.test(before)) return null;

  if (inString) return 'sträng';
  if (isTsx && (/[>]/.test(before) || /[<]/.test(after) || PURE_TEXT_LINE.test(trimmed))) {
    return 'jsx-text';
  }
  return null; // identifierare / övrig kod
}

function scan() {
  const hits = []; // { file, line, word, text }
  let filesScanned = 0;
  for (const dirName of SCAN_DIRS) {
    const dir = path.join(WEB_ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      filesScanned++;
      const rel = path.relative(WEB_ROOT, file).replaceAll('\\', '/');
      const isTsx = file.endsWith('.tsx');
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      const patterns = [WORD_RE];
      if (isTemplateCopyFile(rel)) patterns.push(BOKA_TID_RE);
      let inBlock = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const wasInBlock = inBlock;
        // Grov blockkommentar-spårning (radnivå räcker för heuristiken)
        if (/\/\*/.test(line) && !/\*\//.test(line)) inBlock = true;
        if (/\*\//.test(line)) inBlock = false;
        for (const re of patterns) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(line)) !== null) {
            const kind = classifyMatch(line, m.index, m.index + m[0].length, isTsx, wasInBlock);
            if (!kind) continue;
            hits.push({ file: rel, line: i + 1, word: m[0], text: line.trim().slice(0, 200) });
          }
        }
      }
    }
  }
  return { hits, filesScanned };
}

const keyOf = (h) => `${h.file}::${h.word.toLowerCase()}::${h.text}`;

function countMap(entries) {
  const map = new Map();
  for (const e of entries) {
    const k = keyOf(e);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

const { hits, filesScanned } = scan();

// Första körningen: generera baseline av ALLA nuvarande träffar → exit 0.
if (!fs.existsSync(BASELINE_PATH)) {
  const baseline = {
    generated: new Date().toISOString(),
    note:
      'Kända historiska bransch-ord-träffar (städlista). Nya träffar utöver dessa failar vakten. ' +
      'Städa en träff = fixa koden och ta bort raden här. Regenerera = radera filen och kör om.',
    entries: hits,
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`vakt-bransch: baseline genererad (${hits.length} kända träffar) → ${path.relative(WEB_ROOT, BASELINE_PATH).replaceAll('\\', '/')}`);
  console.log(`Summering: 0 nya, ${hits.length} i baseline (${filesScanned} filer skannade).`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const baseCounts = countMap(baseline.entries ?? []);

// Markera varje träff som ny/baseline (per nyckel: fler träffar än baseline = nya)
const seen = new Map();
for (const h of hits) {
  const k = keyOf(h);
  const used = seen.get(k) ?? 0;
  h.isNew = used >= (baseCounts.get(k) ?? 0);
  seen.set(k, used + 1);
}

const newHits = hits.filter((h) => h.isNew);
const baseHits = hits.filter((h) => !h.isNew);
const shown = FULL ? hits : newHits;

// Output: grupperat per fil, klickbara paths
const byFile = new Map();
for (const h of shown) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}
for (const [file, fileHits] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`\n${file} (${fileHits.length} träffar)`);
  for (const h of fileHits.sort((a, b) => a.line - b.line)) {
    const txt = h.text.length > 80 ? h.text.slice(0, 79) + '…' : h.text;
    console.log(`${h.file}:${h.line}: ${h.word}${h.isNew ? ' [NY]' : ''} — ${txt}`);
  }
}

console.log(`\nSummering: ${newHits.length} nya, ${baseHits.length} i baseline (${filesScanned} filer skannade).`);
if (newHits.length > 0) {
  console.log('Nya bransch-ord i user-facing strängar — använd terminologi-systemet (resolveTerm/theme-content) istället.');
  process.exit(1);
}
process.exit(0);
