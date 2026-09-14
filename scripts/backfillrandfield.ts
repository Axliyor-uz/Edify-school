/**
 * scripts/backfillrandfield.ts
 *
 * Adds a `rand` field (uniform in [0, 1)) to every questions1 AND teacher_questions
 * doc that lacks one. The Milliy sertifikat exam samples through that field
 * (lib/Examquestions.ts for questions1 slots 1–32, lib/ExamTeacher.ts for the
 * teacher slots 33–45), so a doc with no `rand` is invisible to the random
 * per-student sampler — for teacher_questions it means the exam draws the SAME
 * fixed page for every student until this runs.
 *
 *   npm run backfill:rand           # only docs missing `rand`
 *   npm run backfill:rand -- --force  # re-randomise every doc
 *
 * Run it again whenever new questions are bulk-imported. (New teacher_questions
 * written through the builder already get `rand` from toQuestionV1 — this is only
 * for the pre-existing bank.) Credentials come from .env.local
 * (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY),
 * the same ones lib/firebaseAdmin.ts uses.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
const PAGE_SIZE = 2000;
const FORCE = process.argv.includes('--force');

async function backfill(collection: string): Promise<number> {
  const col = db.collection(collection);
  const total = (await col.count().get()).data().count;
  console.log(`${collection}: ${total} documents. force=${FORCE}`);

  const writer = db.bulkWriter();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let updated = 0;

  for (;;) {
    // select('rand') keeps the page tiny — the question bodies are never read.
    let page = col.select('rand').orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);

    const snap = await page.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned += 1;
      if (!FORCE && typeof doc.get('rand') === 'number') continue;
      void writer.update(doc.ref, { rand: Math.random() });
      updated += 1;
    }

    cursor = snap.docs[snap.docs.length - 1];
    console.log(`  scanned ${scanned}/${total} · queued ${updated} updates`);
    if (snap.size < PAGE_SIZE) break;
  }

  await writer.close();
  console.log(`${collection}: wrote rand to ${updated} documents.`);
  return updated;
}

async function main() {
  // Both banks the exam samples from. teacher_questions is the one that makes
  // the exam per-student instead of identical for everyone.
  await backfill('questions1');
  await backfill('teacher_questions');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
