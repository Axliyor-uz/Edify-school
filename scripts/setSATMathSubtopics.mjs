// scripts/setSATMathSubtopics.mjs
//
// Replaces the SUBTOPICS under the four `sat-matematika` topics in
// data/question_topics.json with the learning-centre's own SAT Math book
// structure (chapter → section), supplied 2026-09-16. Run once with
// `node scripts/setSATMathSubtopics.mjs`; idempotent (it rewrites the four
// topics' subtopic arrays rather than appending).
//
// Supersedes the subtopic half of scripts/addSATMathTopics.mjs, which seeded
// College Board's own published content categories. That script is kept for
// history — do NOT re-run it, it would put the official categories back.
//
// ⚠️ THE FOUR TOPIC IDS AND NAMES ARE DELIBERATELY UNCHANGED.
//   algebra · advanced-math · problem-solving-and-data-analysis · geometry-and-trigonometry
// They are not just taxonomy rows: each is a `SatMathDomain` in
// types/SatQuiz.ts, is mirrored by SAT_MATH_DOMAINS in lib/SatMathQuiz.ts, is
// snapshotted onto every `SatQuizItem.domain`, and is a KEY inside
// `SatMathResult.domains` on every sitting ever submitted. Renaming or
// re-slugging one silently orphans finished results and breaks the typed
// union. The supplied chapter titles map 1:1 onto these four, so only the
// section level actually changes.
//
// ⚠️ OLD SUBTOPIC IDS BECOME ORPHANS. A question already saved under, say,
// `linear-equations-in-one-variable` keeps that id — `normalizeQuestion` reads
// the stored NAME, so it still displays and grades fine, but it no longer
// matches any row in the taxonomy, so a subtopic filter won't find it. Only
// two ids survive the swap by coincidence: `linear-functions` and `circles`.
// Nothing is migrated, in line with docs/QUESTIONS.md ("never touch a legacy
// doc"); re-file them by hand if it ever matters.
//
// ⚠️ "Trignometry" in the supplied list is a typo for "Trigonometry" and is
// corrected here — the id would otherwise be `trignometry` forever, and these
// ids are persisted into documents.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/**
 * Matches how every existing subject was slugified (addSATMathTopics.mjs),
 * plus one addition: `&` becomes "and". No prior subject name contained an
 * ampersand, so the shared slug function never had to handle it; left alone it
 * would produce ids like `exponents&radicals`.
 */
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘ʻ`]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[.,:;()"?!]/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// Keyed by the EXISTING topic id — the supplied chapters in order:
// Algebra · Advanced math · Problem solving · Geometry and Trigonometry.
// Section titles are kept verbatim (page numbers dropped, as requested).
const SECTIONS = {
  'algebra': [
    'Algebra Formulas',
    'Expressions',
    'Linear Equations',
    'Linear System of Equations',
    'Linear Functions',
    'Linear Inequalities',
  ],
  'advanced-math': [
    'Advanced math Formulas',
    'Polynomials',
    'Exponents&Radicals',
    'Functions&Function Notation',
    'Exponential Functions',
    'Quadratics',
  ],
  'problem-solving-and-data-analysis': [
    'Problem solving Formulas',
    'Percent; Ratio&Proportion',
    'Unit Conversion',
    'Probability',
    'Mean, Median, Mode, Range',
    'Scatterplots',
    'Research organizing (Margin of Error; Outliers)',
  ],
  'geometry-and-trigonometry': [
    'Geometry & Trigonometry Formulas',
    'Lines&Angles',
    'Triangles',
    'Trigonometry', // supplied as "Trignometry" — typo corrected, see header
    'Circles',
    'Areas&Volumes',
  ],
};

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const subject = data.subjects.find((s) => s.id === 'sat-matematika');
if (!subject) {
  console.error('sat-matematika subject not found — run scripts/addSATMathTopics.mjs first.');
  process.exit(1);
}

const expected = Object.keys(SECTIONS);
const actual = subject.topics.map((t) => t.id);
if (expected.length !== actual.length || expected.some((id) => !actual.includes(id))) {
  console.error('Topic ids drifted — refusing to write.');
  console.error('  expected:', expected);
  console.error('  found:   ', actual);
  process.exit(1);
}

const before = new Set(subject.topics.flatMap((t) => t.subtopics.map((s) => s.id)));

for (const topic of subject.topics) {
  topic.subtopics = SECTIONS[topic.id].map((title) => ({ id: slug(title), name: title }));
}

// Ids must be unique inside their parent — a duplicate makes one of the two
// paths unreachable forever, since saved docs reference ids.
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const dupes = [];
for (const topic of subject.topics) {
  const seen = new Set();
  for (const sub of topic.subtopics) {
    if (seen.has(sub.id)) dupes.push(`${topic.id} / ${sub.id}: duplicate id`);
    seen.add(sub.id);
    if (!SLUG_SHAPE.test(sub.id)) dupes.push(`${topic.id} / ${sub.id}: malformed id`);
    if (!sub.name.trim()) dupes.push(`${topic.id} / ${sub.id}: empty name`);
  }
}
if (dupes.length) {
  console.error('Refusing to write:', dupes);
  process.exit(1);
}

writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

const after = new Set(subject.topics.flatMap((t) => t.subtopics.map((s) => s.id)));
const kept = [...before].filter((id) => after.has(id));
const orphaned = [...before].filter((id) => !after.has(id));

console.log(`sat-matematika: ${subject.topics.length} topics, ${after.size} subtopics`);
for (const t of subject.topics) {
  console.log(`  ${t.id} (${t.subtopics.length})`);
  for (const s of t.subtopics) console.log(`      ${s.id.padEnd(46)} ${s.name}`);
}
console.log(`\nSurvived the swap (existing docs still match): ${kept.join(', ') || 'none'}`);
console.log(`Now orphaned on existing docs (${orphaned.length}): ${orphaned.join(', ') || 'none'}`);
