// One-off: fetch the LIVE Firestore ruleset via the Rules REST API and diff-check
// it against the local file before a deploy that would carry uncommitted edits.
//   node --env-file=.env.local scripts/checkDeployedRules.mjs
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';

const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();
const proj = process.env.FIREBASE_PROJECT_ID;

const rel = await client.request({
  url: `https://firebaserules.googleapis.com/v1/projects/${proj}/releases/cloud.firestore`,
});
const rs = await client.request({
  url: `https://firebaserules.googleapis.com/v1/${rel.data.rulesetName}`,
});
const live = rs.data.source.files.map((f) => f.content).join('\n');
const local = readFileSync('firestore.rules', 'utf8');

console.log('live ruleset:', rel.data.rulesetName, 'updated:', rel.data.updateTime);
console.log('live has appConfig rule:        ', live.includes('match /appConfig/'));
console.log('live has ielts delete-fix:      ', /allow delete: if isAuth\(\) && \(resource == null \|\| resource\.data\.teacherId/.test(live));
console.log('local === live:                 ', live.trim() === local.trim());
