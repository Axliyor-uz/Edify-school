// One-off migration: center_teachers docs MUST be keyed by the teacher's uid
// (firestore.rules isTeacherInMyCenter/isTeacherOfCenter look them up by doc id).
// Legacy docs were created with auto-ids, silently breaking every manager write
// on those teachers' classes. This re-keys them: copy → center_teachers/{teacherId},
// delete the old auto-id doc.
//
// DRY-RUN by default. Apply with:
//   NODE_PATH=./node_modules node --env-file=.env.local scripts/migrateCenterTeacherIds.mjs --apply
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

const snap = await db.collection('center_teachers').get();
let migrated = 0;
let skipped = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const teacherId = data.teacherId;

  if (!teacherId || typeof teacherId !== 'string') {
    console.log(`SKIP  ${doc.id} — no teacherId field, cannot re-key`);
    skipped++;
    continue;
  }
  if (doc.id === teacherId) continue; // already correct

  const targetRef = db.collection('center_teachers').doc(teacherId);
  const target = await targetRef.get();

  if (target.exists) {
    console.log(`${APPLY ? 'DELETE' : 'would DELETE'} duplicate ${doc.id} (correct doc ${teacherId} already exists)`);
    if (APPLY) await doc.ref.delete();
  } else {
    console.log(`${APPLY ? 'MOVE' : 'would MOVE'} ${doc.id} → ${teacherId} (${data.teacherName || '?'} @ center ${data.centerId})`);
    if (APPLY) {
      const batch = db.batch();
      batch.set(targetRef, data);
      batch.delete(doc.ref);
      await batch.commit();
    }
  }
  migrated++;
}

console.log(`\n${APPLY ? 'Done' : 'Dry-run'}: ${migrated} doc(s) ${APPLY ? 'migrated' : 'would migrate'}, ${skipped} skipped, ${snap.size} total.`);
process.exit(0);
