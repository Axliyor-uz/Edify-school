/**
 * scripts/importSATEnglishQuestions.ts
 *
 * One-off: imports the donated SAT Reading & Writing question bank
 * (questions.json, repo root — 1,443 rows, 4 official R&W domains,
 * Easy/Medium/Hard) into `teacher_questions` as PLATFORM-owned content —
 * `creatorId: SAT_PLATFORM_CREATOR_ID` ('' — the same "no owner" sentinel
 * scripts/createSatSampleTest.ts already uses for `sat_math_tests.teacherId`).
 * Every teacher's SAT English builder can then pick from this pool
 * (app/teacher/sat/english/_components/SatEnglishBankPicker.tsx, "Platform
 * bank" tab) exactly as if it were their own bank, with zero rules change —
 * `teacher_questions` read rule is `allow read: if isAuth()` for everyone.
 *
 * Each row becomes ONE `teacher_questions` v1 document, built through the
 * SAME adapter every hand-authored question goes through
 * (lib/questionSchema.ts::toQuestionV1) — not a hand-rolled shape — so it
 * renders, filters and grades identically to a teacher-written question.
 *
 * ⚠️ DEDUPES by content (paragraph + question + choices + answer) before
 * writing: the source file's own `id` field is JUNK (only 799 unique values
 * across 1,443 rows, with completely different questions sharing an id — do
 * not use it for anything), and 37 rows are exact content duplicates under a
 * handful of ids. ~1,406 unique questions get imported.
 *
 * ⚠️ The source has no shared long passage — each row is already a
 * self-contained `paragraph` + `question`, matching the "one question per
 * screen" runner (docs/SAT_QUIZ.md). The two are joined into ONE
 * `question` field (paragraph, blank line, then the actual question) since
 * the v1 schema has no separate passage field — this is also exactly how the
 * real digital SAT presents a Reading & Writing item.
 *
 * Usage:
 *   npx tsx scripts/importSATEnglishQuestions.ts            # dry run — prints the plan, writes nothing
 *   npx tsx scripts/importSATEnglishQuestions.ts --apply     # actually writes
 *
 * Credentials: `.env.local` (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY) — same as scripts/backfillrandfield.ts /
 * scripts/createSatSampleTest.ts.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { toQuestionV1 } from '../lib/questionSchema';
import { SAT_PLATFORM_CREATOR_ID, SAT_RW_DOMAINS, SAT_RW_TAXONOMY_SLUG } from '../lib/SatMathQuiz';
import { DIFFICULTY_ID_BY_NAME, type DifficultyName, type QuestionV1 } from '../types/question';
import rawQuestions from '../questions.json';

function loadEnvLocal() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.FIREBASE_PRIVATE_KEY) loadEnvLocal();

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const APPLY = process.argv.includes('--apply');
const COLLECTION = 'teacher_questions';
const CREATOR_NAME = 'SAT Ingliz tili (bank)';

interface SourceRow {
  id: string;
  domain: string;
  visuals?: { type: string; svg_content: string };
  question: {
    choices: Record<string, string>;
    question: string;
    paragraph: string;
    explanation: string;
    correct_answer: string;
  };
  difficulty: string;
}

// `toLocalized(bareString)` puts the string into `.uz`, not `.en` (same
// quirk SAT_MATH_DOMAINS relies on — the UI falls back to `.uz` when `.en` is
// blank) — so the registry's English domain name lives at `.name.uz`, not `.en`.
const DOMAIN_BY_NAME = new Map(SAT_RW_DOMAINS.map((d) => [d.name.uz, d]));

/**
 * 766 of the 1,443 source rows (53%) have a data-quality artifact: `paragraph`
 * already ends with its own trailing meta-question ("...individuals. What is
 * the main point of the passage?") that `question.question` then restates
 * more specifically — a leftover from however the source bank was generated.
 * Left alone, joining the two shows the student the question twice. This
 * regex isolates the passage up to the LAST sentence boundary before that
 * trailing "?", verified against all 766 affected rows: 657 strip cleanly
 * (spot-checked, no case strips below 40 chars — never a near-empty result);
 * the other 109 don't match this shape confidently and are left as-is rather
 * than risk cutting real passage content.
 */
const TRAILING_QUESTION = /^([\s\S]*?[.!])\s+[^.!?]*\?$/;
function stripTrailingQuestion(paragraph: string): string {
  const trimmed = paragraph.trim();
  if (!trimmed.endsWith('?')) return trimmed;
  const match = TRAILING_QUESTION.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/** Same contentKey shape used to find the 37 exact duplicates during review. */
const contentKey = (row: SourceRow) => JSON.stringify([
  row.question.paragraph.trim(),
  row.question.question.trim(),
  Object.entries(row.question.choices).sort(),
  row.question.correct_answer,
]);

function dedupe(rows: SourceRow[]): SourceRow[] {
  const seen = new Set<string>();
  const out: SourceRow[] = [];
  for (const row of rows) {
    const key = contentKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function toRaw(row: SourceRow, domain: { id: string; name: { uz: string } }) {
  const options: Record<string, { uz: string; ru: string; en: string }> = {};
  for (const [letter, text] of Object.entries(row.question.choices)) {
    options[letter] = { uz: '', ru: '', en: text };
  }

  const difficultyName = row.difficulty.toLowerCase() as DifficultyName;
  const difficultyId = DIFFICULTY_ID_BY_NAME[difficultyName] ?? DIFFICULTY_ID_BY_NAME.medium;

  return {
    question: { uz: '', ru: '', en: `${stripTrailingQuestion(row.question.paragraph)}\n\n${row.question.question.trim()}` },
    imageUrl: null,
    imageStoragePath: null,

    type: 'mcq' as const,
    options,
    correctAnswer: {
      value: row.question.correct_answer,
      acceptedAnswers: [],
      caseSensitive: false,
    },

    subject: { id: SAT_RW_TAXONOMY_SLUG, name: 'SAT Ingliz tili (Reading & Writing)' },
    topic: { id: domain.id, name: domain.name.uz },
    subtopic: { id: domain.id, name: domain.name.uz },
    chapter: { id: '', name: '' },

    difficulty: { id: difficultyId, name: difficultyName },
    difficultyId,

    explanation: { uz: '', ru: '', en: row.question.explanation?.trim() || '' },
    hint: '',
    tags: [],
    curriculum: [],
    language: ['en'],
  };
}

async function main() {
  const rows = rawQuestions as unknown as SourceRow[];
  console.log(`Source: ${rows.length} rows in questions.json`);

  const unique = dedupe(rows);
  console.log(`After content de-dup: ${unique.length} unique questions`);

  const skipped: { row: SourceRow; reason: string }[] = [];
  const docs: { id: string; payload: QuestionV1 }[] = [];
  const byDomain = new Map<string, number>();
  const byDifficulty = new Map<string, number>();

  for (const row of unique) {
    const domain = DOMAIN_BY_NAME.get(row.domain);
    if (!domain) { skipped.push({ row, reason: `unknown domain "${row.domain}"` }); continue; }
    if (Object.keys(row.question.choices).length !== 4) {
      skipped.push({ row, reason: `expected 4 choices, got ${Object.keys(row.question.choices).length}` });
      continue;
    }
    if (!(row.question.correct_answer in row.question.choices)) {
      skipped.push({ row, reason: `correct_answer "${row.question.correct_answer}" not among its own choices` });
      continue;
    }

    const id = `tq_${db.collection(COLLECTION).doc().id}`;
    const timestamp = FieldValue.serverTimestamp();
    const payload = toQuestionV1(toRaw(row, domain), {
      id,
      creatorId: SAT_PLATFORM_CREATOR_ID,
      creatorName: CREATOR_NAME,
      creationMethod: 'exam_import',
      status: 'published', // curated, already-correct content — no review queue needed
      timestamp,
    });

    docs.push({ id, payload });
    byDomain.set(domain.id, (byDomain.get(domain.id) ?? 0) + 1);
    byDifficulty.set(row.difficulty, (byDifficulty.get(row.difficulty) ?? 0) + 1);
  }

  console.log(`\nBuilt ${docs.length} v1 documents (${skipped.length} skipped).`);
  if (skipped.length) {
    console.log('Skipped (first 10):');
    for (const s of skipped.slice(0, 10)) console.log(`  ${s.row.id}: ${s.reason}`);
  }
  console.log('\nBy domain:');
  for (const d of SAT_RW_DOMAINS) console.log(`  ${d.name.uz}: ${byDomain.get(d.id) ?? 0}`);
  console.log('By difficulty:');
  for (const [k, v] of byDifficulty) console.log(`  ${k}: ${v}`);

  if (!APPLY) {
    console.log(`\nDry run — would write ${docs.length} documents to ${COLLECTION}.`);
    console.log('Pass --apply to actually write them.');
    return;
  }

  const BATCH_SIZE = 400; // Firestore's cap is 500 writes per batch — leave margin.
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { id, payload } of chunk) batch.set(db.collection(COLLECTION).doc(id), payload);
    await batch.commit();
    written += chunk.length;
    console.log(`  committed ${written}/${docs.length}`);
  }

  console.log(`\nDone — wrote ${written} SAT English questions to ${COLLECTION} (creatorId: "${SAT_PLATFORM_CREATOR_ID}").`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
