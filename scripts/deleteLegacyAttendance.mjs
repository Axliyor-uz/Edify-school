// One-off cleanup: delete ALL legacy `center_attendance` documents so the new
// (richer) session shape starts from a clean slate. See the attendance upgrade plan.
//
// ⚠️ DESTRUCTIVE. Run only after the new schema/rules are ready and you've
// accepted losing old attendance data (per the "clean slate" decision).
//
// Usage (Node 20.6+, loads Admin creds from .env.local):
//   node --env-file=.env.local scripts/deleteLegacyAttendance.mjs --confirm
//
// Without --confirm it does a DRY RUN (counts only, deletes nothing).

import admin from "firebase-admin";

const CONFIRMED = process.argv.includes("--confirm");
const COLLECTION = "center_attendance";
const BATCH = 400;

function initAdmin() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.");
    console.error("Run with:  node --env-file=.env.local scripts/deleteLegacyAttendance.mjs --confirm");
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin.firestore();
}

async function main() {
  const db = initAdmin();
  const col = db.collection(COLLECTION);

  let deleted = 0;
  // Loop: grab a page of doc refs and batch-delete until the collection is empty.
  // (Paging by document id keeps memory flat even for large collections.)
  while (true) {
    const snap = await col.limit(BATCH).get();
    if (snap.empty) break;

    if (!CONFIRMED) {
      console.log(`[DRY RUN] would delete ${snap.size} docs (pass --confirm to actually delete).`);
      // Only report the first page in dry-run so we don't loop forever.
      const total = (await col.count().get()).data().count;
      console.log(`[DRY RUN] total ${COLLECTION} docs: ${total}. Nothing deleted.`);
      return;
    }

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    console.log(`Deleted ${deleted} so far...`);
  }

  console.log(CONFIRMED ? `✅ Done. Deleted ${deleted} ${COLLECTION} docs.` : "Dry run complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
