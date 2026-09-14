// Phase 3 / DEPLOY 2 — remove contact details from the world-readable user doc.
//
//   users/{uid}.{email,phone}  ──DELETE──>  (they now live only in users/{uid}/private/contact)
//
// ⚠️ DESTRUCTIVE. Run ONLY after ALL of these are true:
//   1. scripts/backfillPrivateContact.mjs --apply has run successfully.
//   2. The app writing to prod is the DEPLOY-1 build (dual-writes contact details
//      to the subcollection, reads them via /api/directory/contact).
//   3. You have verified in prod that a teacher can still see a student's phone
//      and a manager can still add a teacher by email.
//
// The --verify pass below refuses to strip any user whose contact details are not
// already safely in the subcollection, so a half-finished backfill cannot cause
// data loss.
//
// DRY-RUN by default. Apply with:
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/stripPublicContact.mjs --apply
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
const BATCH_SIZE = 400;

console.log(APPLY ? '⚠️  APPLY MODE — DELETING email/phone from users/*' : '🔍 DRY RUN — no writes (pass --apply to commit)');

const snap = await db.collection('users').get();
const candidates = snap.docs.filter((d) => {
  const u = d.data();
  return u.email !== undefined || u.phone !== undefined;
});

// Safety gate: only strip a user once their details are provably in the subcollection.
const safe = [];
const unsafe = [];
for (let i = 0; i < candidates.length; i += 50) {
  const chunk = candidates.slice(i, i + 50);
  const privs = await Promise.all(
    chunk.map((d) => d.ref.collection('private').doc('contact').get()),
  );
  chunk.forEach((d, j) => {
    const parent = d.data();
    const priv = privs[j].exists ? privs[j].data() : null;
    const emailOk = !parent.email || priv?.email === parent.email;
    const phoneOk = !parent.phone || priv?.phone === parent.phone;
    (emailOk && phoneOk ? safe : unsafe).push(d);
  });
}

console.log(`users scanned:                 ${snap.size}`);
console.log(`carry email/phone on the doc:  ${candidates.length}`);
console.log(`✅ safe to strip (backed up):   ${safe.length}`);
console.log(`⛔ NOT backed up — will SKIP:   ${unsafe.length}`);

if (unsafe.length) {
  console.log('\nThese users would LOSE data if stripped. Re-run backfillPrivateContact.mjs --apply first:');
  unsafe.slice(0, 10).forEach((d) => console.log(`   users/${d.id}`));
  if (unsafe.length > 10) console.log(`   … and ${unsafe.length - 10} more`);
}

if (!APPLY) {
  console.log('\nDry run complete. Nothing was written.');
  process.exit(0);
}

if (unsafe.length) {
  console.log('\n⛔ Refusing to run: some users are not backed up. Fix the backfill first.');
  process.exit(1);
}

let stripped = 0;
for (let i = 0; i < safe.length; i += BATCH_SIZE) {
  const chunk = safe.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const d of chunk) {
    batch.update(d.ref, {
      email: admin.firestore.FieldValue.delete(),
      phone: admin.firestore.FieldValue.delete(),
    });
  }
  await batch.commit();
  stripped += chunk.length;
  console.log(`  committed ${stripped}/${safe.length}`);
}

console.log(`\n✅ stripped email/phone from ${stripped} user docs. The PII leak is closed.`);
process.exit(0);
