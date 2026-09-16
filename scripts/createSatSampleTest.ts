/**
 * scripts/createSatSampleTest.ts
 *
 * One-off: publish a real, student-openable SAT Math test at the FIXED code
 * "123456", built from the bundled sample content
 * (`data/sat-math-default-paper.json`, via `lib/SatDefaultPaper.ts` — the same
 * pure builder the teacher builder's "Namunaviy variant" button uses).
 *
 * ⚠️ Unlike the builder UI (which always calls `reserveSatCode()` for a RANDOM
 * code), this writes the exact code "123456" directly — a memorable, fixed
 * demo code, not something a teacher can get by clicking around the app.
 *
 * ⚠️ `teacherId: ""` — deliberately NO OWNER (same "platform" sentinel used
 * elsewhere in this pass). Consequence: this test will not appear in anyone's
 * `/teacher/sat/math` list or Natijalar (results) page — `listMySatMathTests`/
 * `listSatMathResults` both filter `teacherId == <a real signed-in uid>`,
 * which "" never matches. A student can still open it by code; nobody can
 * manage it or see its results from the UI afterward. That trade-off was a
 * deliberate choice — see the commit/PR discussion, not a bug.
 *
 * Usage:
 *   npx tsx scripts/createSatSampleTest.ts            # dry run — prints the plan, writes nothing
 *   npx tsx scripts/createSatSampleTest.ts --apply     # actually writes
 *
 * Credentials: `.env.local` (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY) — same as scripts/backfillrandfield.ts.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { buildSatSamplePaper } from '../lib/SatDefaultPaper';
import { satByteSize, SAT_MAX_BYTES } from '../lib/SatMathQuiz';
import sampleFile from '../data/sat-math-default-paper.json';
import type { SatSamplePaperFile } from '../lib/SatDefaultPaper';

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
const CODE = '123456';
const TESTS = 'sat_math_tests';

async function main() {
  const paper = buildSatSamplePaper(sampleFile as unknown as SatSamplePaperFile);
  if (paper.problems.length > 0) {
    throw new Error(`data/sat-math-default-paper.json does not validate: ${paper.problems[0]}`);
  }

  const bytes = satByteSize(paper.module1, paper.module2Easier, paper.module2Harder);
  console.log(`Module sizes: ${paper.module1.length} / ${paper.module2Easier.length} / ${paper.module2Harder.length}, ${Math.round(bytes / 1024)} KB (cap ${Math.round(SAT_MAX_BYTES / 1024)} KB)`);
  if (bytes > SAT_MAX_BYTES) throw new Error(`Paper is ${bytes} bytes — over the ${SAT_MAX_BYTES} cap.`);

  const existing = await db.collection(TESTS).where('accessCode', '==', CODE).limit(5).get();
  if (!existing.empty) {
    console.log(`${existing.size} existing test(s) already use code ${CODE}:`);
    for (const d of existing.docs) console.log(`  ${d.id} — status=${d.get('status')} title=${JSON.stringify(d.get('title'))}`);
    if (!APPLY) {
      console.log('Dry run stops here — decide whether to reuse/close the existing one before --apply.');
      return;
    }
    throw new Error(`Refusing to create a second test at code ${CODE} — resolve the existing one(s) first.`);
  } else {
    console.log(`No existing test uses code ${CODE}.`);
  }

  const now = FieldValue.serverTimestamp();
  const id = `sat_${db.collection(TESTS).doc().id}`;
  const docData = {
    id,
    title: 'SAT Matematika — Namunaviy test',
    description: '',
    teacherId: '',
    teacherName: 'SAT Matematika (namuna)',
    accessCode: CODE,
    module1: paper.module1,
    module2Easier: paper.module2Easier,
    module2Harder: paper.module2Harder,
    module1Minutes: paper.module1Minutes,
    module2Minutes: paper.module2Minutes,
    routingThreshold: paper.routingThreshold,
    shuffle: true,
    showAnswers: true,
    status: 'published' as const,
    createdAt: now,
    updatedAt: now,
  };

  if (!APPLY) {
    console.log(`\nDry run — would create ${TESTS}/${id} with accessCode ${CODE}, status published.`);
    console.log('Pass --apply to actually write it.');
    return;
  }

  await db.collection(TESTS).doc(id).set(docData);
  console.log(`\nDone — created ${TESTS}/${id} at code ${CODE} (published). A student can now open /sat/math and enter ${CODE}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
