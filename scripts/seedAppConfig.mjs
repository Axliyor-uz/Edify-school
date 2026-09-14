// Seeds/updates appConfig/<client> — an Android app's update gate
// (docs/DATA_MODEL.md). Run this after every Play release to bump the version
// thresholds; the Android app compares BuildConfig.VERSION_CODE against them:
//   < minRequiredVersionCode (or in blockedVersionCodes) → hard-blocked
//   < latestVersionCode                                  → dismissible dialog
//
// ONE DOC PER APP — the APKs have independent versionCodes, so never point two
// of them at the same document:
//   androidStudent  EdifyStudent
//   androidTeacher  EdifyTeacher
//   androidManager  EdifyManager  (self-update gate today; reserved here)
//
// DRY-RUN by default. Apply with:
//   node --env-file=.env.local scripts/seedAppConfig.mjs --client androidTeacher --apply --latest 13 --min 1
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

// Fallback `latest` used only when the document does not exist yet — the
// versionCode each app was shipping when it was first gated.
const CLIENTS = { androidStudent: 8, androidTeacher: 13, androidManager: 3 };

function strArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

function intArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  const n = Number.parseInt(process.argv[i + 1], 10);
  if (Number.isNaN(n)) throw new Error(`--${name} must be an integer`);
  return n;
}

// Defaults to androidStudent so the pre-existing invocation keeps working.
const client = strArg('client', 'androidStudent');
if (!(client in CLIENTS)) {
  throw new Error(`--client must be one of ${Object.keys(CLIENTS).join(', ')} (got "${client}")`);
}

const ref = db.collection('appConfig').doc(client);
const existing = (await ref.get()).data();
console.log(`appConfig/${client} current:`, existing ?? '(missing)');

const payload = {
  latestVersionCode: intArg('latest', existing?.latestVersionCode ?? CLIENTS[client]),
  minRequiredVersionCode: intArg('min', existing?.minRequiredVersionCode ?? 1),
  blockedVersionCodes: existing?.blockedVersionCodes ?? [],
};

// A min above latest hard-blocks even the newest build on Play — an
// unrecoverable lockout, because there is nothing left to update to.
if (payload.minRequiredVersionCode > payload.latestVersionCode) {
  throw new Error(
    `refusing to write: minRequiredVersionCode (${payload.minRequiredVersionCode}) > ` +
      `latestVersionCode (${payload.latestVersionCode}) would lock every user out`,
  );
}

console.log(APPLY ? 'writing:' : 'DRY-RUN, would write:', payload);

if (APPLY) {
  await ref.set(payload, { merge: true });
  console.log('done.');
}

// The admin SDK keeps its gRPC channel open, so node never exits on its own
// after a write — the script would hang forever looking like a failed write.
// The set() above is already acked, so exiting here loses nothing.
process.exit(0);
