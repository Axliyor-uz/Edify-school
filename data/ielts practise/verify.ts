#!/usr/bin/env tsx
/**
 * Authoring-time checker for the IELTS practice dataset.
 *
 *   npm run ielts:verify                          # everything under data/ielts practise/
 *   npm run ielts:verify -- reading               # one sub-folder (relative to that dir)
 *   npm run ielts:verify -- path/to/file.json     # one file
 *   npm run ielts:verify -- --strict              # warnings fail the run too
 *
 * It runs the EXACT validator the admin importer runs (lib/ielts/importValidation.ts),
 * so "verify passes" and "the paste box accepts it" mean the same thing. Errors block
 * an import; warnings do not, but for the curated repo dataset you should fix both —
 * use --strict in a pre-commit check.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateIeltsImport, type ImportIssue } from '../../lib/ielts/importValidation';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const targets = argv.filter((a) => !a.startsWith('--'));

function collect(target: string): string[] {
  const abs = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
  const resolved = statSafe(abs) ? abs : path.resolve(HERE, target);
  const st = statSafe(resolved);
  if (!st) {
    console.error(`  ✗ not found: ${target}`);
    process.exitCode = 1;
    return [];
  }
  if (st.isFile()) return resolved.endsWith('.json') ? [resolved] : [];
  return readdirSync(resolved)
    .sort()
    .flatMap((entry) => collect(path.join(resolved, entry)));
}

function statSafe(p: string) {
  try { return statSync(p); } catch { return null; }
}

function printIssues(issues: ImportIssue[], symbol: string) {
  for (const i of issues) {
    console.log(`  ${symbol} ${i.label ? `${i.label} — ` : ''}${i.path}`);
    console.log(`      ${i.message}`);
    if (i.hint) console.log(`      ↳ ${i.hint}`);
  }
}

const files = (targets.length ? targets : [HERE]).flatMap(collect);

if (!files.length) {
  console.log('No .json files found.');
  process.exit(process.exitCode ?? 0);
}

let errorFiles = 0;
let warnFiles = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.log(`\n${rel}`);
    console.log(`  ✗ invalid JSON: ${(e as Error).message}`);
    errorFiles++;
    continue;
  }

  const res = validateIeltsImport(parsed);
  const title = (parsed as { test_title?: string })?.test_title ?? '(untitled)';
  console.log(`\n${rel}  —  "${title}"`);

  if (res.ok && res.summary) {
    const s = res.summary;
    console.log(`  ${s.module}${s.category ? ` (${s.category})` : ''} · ${s.sections} section(s) · `
      + `${s.questions} question(s) · ${s.timeMinutes} min · id ${s.testId}`);
    const types = Object.entries(s.typeBreakdown);
    if (types.length) console.log(`  types: ${types.map(([k, v]) => `${v}×${k}`).join(', ')}`);
  }
  if (res.errors.length) { errorFiles++; printIssues(res.errors, '✗'); }
  if (res.warnings.length) { warnFiles++; printIssues(res.warnings, '!'); }
  if (!res.errors.length && !res.warnings.length) console.log('  ✓ clean');
}

console.log('');
console.log(`${files.length} file(s) · ${errorFiles} with errors · ${warnFiles} with warnings`);
const failed = errorFiles > 0 || (strict && warnFiles > 0);
console.log(failed ? 'FAILED' : 'All checks passed.');
process.exit(failed ? 1 : 0);
