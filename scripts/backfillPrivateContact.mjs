// Phase 3 / DEPLOY 1 — copy contact details into the owner-only subcollection.
//
//   users/{uid}.{email,phone}  ──copy──>  users/{uid}/private/contact
//
// `users/{uid}` is readable by every signed-in user and Firestore has no
// field-level read rules, so email/phone sitting on it are world-readable to
// anyone who signs up. They move to a subcollection that is owner-only.
//
// ADDITIVE AND SAFE TO RUN ON LIVE TRAFFIC: the parent fields are left in place,
// so nothing that still reads them breaks. scripts/stripPublicContact.mjs removes
// them in DEPLOY 2, once every reader has moved over.
//
// Idempotent — re-running overwrites the same values.
//
// DRY-RUN by default. Apply with:
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/backfillPrivateContact.mjs --apply
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 400; // Firestore hard limit is 500 writes per batch

console.log(APPLY ? '⚠️  APPLY MODE — writing to Firestore' : '🔍 DRY RUN — no writes (pass --apply to commit)');

const snap = await db.collection('users').get();
const todo = snap.docs.filter((d) => {
  const u = d.data();
  return typeof u.email === 'string' || typeof u.phone === 'string';
});

console.log(`users scanned:        ${snap.size}`);
console.log(`with contact data:    ${todo.length}  (email: ${todo.filter((d) => d.data().email).length}, phone: ${todo.filter((d) => d.data().phone).length})`);
console.log(`nothing to migrate:   ${snap.size - todo.length}`);

if (!APPLY) {
  const mask = (s) => (s ? String(s).slice(0, 2) + '***' : '(none)');
  console.log('\nSample of what would be written:');
  for (const d of todo.slice(0, 3)) {
    const u = d.data();
    console.log(`  users/${d.id}/private/contact  ←  { email: ${mask(u.email)}, phone: ${mask(u.phone)} }`);
  }
  console.log('\nDry run complete. Nothing was written.');
  process.exit(0);
}

let written = 0;
for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  const chunk = todo.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const d of chunk) {
    const u = d.data();
    // Never write undefined to Firestore — build the payload conditionally.
    const payload = {};
    if (typeof u.email === 'string') payload.email = u.email;
    if (typeof u.phone === 'string') payload.phone = u.phone;
    batch.set(d.ref.collection('private').doc('contact'), payload, { merge: true });
  }
  await batch.commit();
  written += chunk.length;
  console.log(`  committed ${written}/${todo.length}`);
}

console.log(`\n✅ backfilled ${written} contact docs. Parent users/* fields left intact — DEPLOY 2 strips them.`);
process.exit(0);
