/**
 * scripts/analyzeItems.ts
 *
 * Item analysis and quality control over real student responses. Runs OFFLINE
 * with the Admin SDK, so no student ever pays a read for it.
 *
 *   npx tsx scripts/analyzeItems.ts                  # report only, writes nothing
 *   npx tsx scripts/analyzeItems.ts --write          # write calibration onto questions1
 *   npx tsx scripts/analyzeItems.ts --write --quarantine   # …and bench suspect keys
 *   npx tsx scripts/analyzeItems.ts --restore a1234        # un-bench a reviewed item
 *
 * ── WHY THIS COSTS THE APP NOTHING ──────────────────────────────────────────
 * Results are written back ONTO THE QUESTION DOCUMENT (questions1), not into a
 * separate stats collection. The exam already reads those 45 documents, so the
 * calibrated difficulty `b` arrives free with data the client is already paying
 * for: zero extra reads, zero extra writes, no summary doc to fetch, no lookup.
 *
 * Quarantining a miskeyed item uses the same trick in reverse. The sampler finds
 * questions through `orderBy('rand')`, and a document with NO `rand` field is
 * absent from that index entirely — so deleting `rand` makes a broken question
 * vanish from every future exam, with no client change and no query cost.
 *
 * ── WHAT IT COMPUTES ────────────────────────────────────────────────────────
 * 1. CALIBRATED DIFFICULTY (b), by joint estimation. The naive approach — turn
 *    the p-value into a logit — is biased: an item is not "easy" merely because
 *    strong students happened to draw it. JMLE alternates between estimating
 *    each student's ability from the items they saw, and each item's difficulty
 *    from the students who saw it, until both settle. That separates the two.
 *
 * 2. MISKEYED ITEMS (the point). With ~48,000 bulk-imported questions, some
 *    answer keys are simply wrong — a statistical certainty at that scale. A
 *    miskeyed item is invisible from the inside: it just quietly drags down the
 *    level of every student who meets it. From the outside it is obvious — it is
 *    the item the STRONG students get "wrong" while the weak ones "pass". That
 *    is a negative point-biserial, and it is the single most valuable number here.
 *
 * 3. DISTRACTOR ANALYSIS. Which wrong option gets picked is a misconception
 *    fingerprint: "of those who missed it, 68% chose C".
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

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

const WRITE = process.argv.includes('--write');
const QUARANTINE = process.argv.includes('--quarantine');
const RESTORE_ID = process.argv[process.argv.indexOf('--restore') + 1];
const DO_RESTORE = process.argv.includes('--restore');

/** Below this many responses, nothing can be said with a straight face. */
const MIN_RESPONSES = 5;

/**
 * TWO TIERS, on purpose.
 *
 * REVIEW (loose): worth a human glance. False positives here are cheap — someone
 * reads the question and moves on.
 *
 * QUARANTINE (strict): pulls the item out of every future exam. A false positive
 * here silently deletes a GOOD question from the bank, which is worse than
 * leaving a bad one in — a bad item costs a little accuracy, a wrongly benched
 * one costs content forever. So the bar is deliberately higher: more responses,
 * a stronger signal, and it never happens without --quarantine.
 *
 * Simulation is blunt about the limits: a very HARD miskeyed item is close to
 * undetectable, because almost nobody knows the real answer, so there is no
 * signal to find. This screens; it does not certify.
 */
const MIN_RESPONSES_TO_REVIEW = 8;
const MIN_RESPONSES_TO_QUARANTINE = 12;

/** Item-total correlation below this = strong students are failing it. */
const REVIEW_RPB = -0.15;
const QUARANTINE_RPB = -0.2;

/** A DISTRACTOR correlating this positively with ability is acting like the key. */
const REVIEW_DISTRACTOR_RPB = 0.15;
const QUARANTINE_DISTRACTOR_RPB = 0.25;
/**
 * Safety valve. If a run wants to bench more than this share of the analysed
 * items, something is wrong with the ANALYSIS, not the bank — refuse and report.
 */
const MAX_QUARANTINE_SHARE = 0.05;

const DIFFICULTY_ANCHOR: Record<number, number> = { 1: -1.0, 2: 0.0, 3: 1.2 };

interface Response {
  itemId: string;
  studentId: string;
  correct: boolean;
  chosen: string;
  difficultyId: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Joint estimation of student ability and item difficulty (JMLE).
 *
 * Alternates: hold items fixed, fit each student; hold students fixed, fit each
 * item. Both are 1-D Newton steps on the Rasch likelihood. The scale is fixed by
 * centring item difficulties at 0 each round (Rasch is identified only up to a
 * shift — without this, θ and b drift together forever).
 */
function calibrate(responses: Response[], rounds = 12) {
  const byStudent = new Map<string, Response[]>();
  const byItem = new Map<string, Response[]>();
  for (const r of responses) {
    (byStudent.get(r.studentId) ?? byStudent.set(r.studentId, []).get(r.studentId)!).push(r);
    (byItem.get(r.itemId) ?? byItem.set(r.itemId, []).get(r.itemId)!).push(r);
  }

  const theta = new Map<string, number>([...byStudent.keys()].map((k) => [k, 0]));
  // Start each item at its human-labelled difficulty — a sane prior, and it
  // means items with thin data barely move from where the bank put them.
  const b = new Map<string, number>(
    [...byItem.entries()].map(([id, rs]) => [id, DIFFICULTY_ANCHOR[rs[0].difficultyId] ?? 0]),
  );

  const newton = (
    rows: Response[],
    get: (r: Response) => number,
    sign: 1 | -1,
    current: number,
  ): number => {
    // score = Σ(x - p) for ability; Σ(p - x) for difficulty (hence `sign`)
    let score = 0;
    let info = 0;
    for (const r of rows) {
      const p = sigmoid(sign === 1 ? current - get(r) : get(r) - current);
      score += sign * ((r.correct ? 1 : 0) - p);
      info += p * (1 - p);
    }
    if (info < 1e-6) return current;
    // Damped, and clamped: a student who got everything right would otherwise
    // walk off to +∞.
    const step = Math.max(-1, Math.min(1, score / info));
    return Math.max(-4, Math.min(4, current + step));
  };

  for (let round = 0; round < rounds; round++) {
    for (const [sid, rows] of byStudent) {
      theta.set(sid, newton(rows, (r) => b.get(r.itemId) ?? 0, 1, theta.get(sid) ?? 0));
    }
    for (const [iid, rows] of byItem) {
      b.set(iid, newton(rows, (r) => theta.get(r.studentId) ?? 0, -1, b.get(iid) ?? 0));
    }
    // Re-centre: fixes the scale so θ and b can't drift together.
    const mean = [...b.values()].reduce((a, v) => a + v, 0) / Math.max(1, b.size);
    for (const [iid, v] of b) b.set(iid, v - mean);
    for (const [sid, v] of theta) theta.set(sid, v - mean);
  }

  return { theta, b, byItem };
}

/**
 * CORRECTED item–total correlation: does getting THIS item right go with doing
 * well on EVERYTHING ELSE?
 *
 * The "rest score" — the student's accuracy on all their OTHER items — is what
 * makes this work, and leaving it out is a trap I walked into first. Correlating
 * against an ability estimate that was itself fitted USING this item lets a
 * miskeyed question hide: the calibration simply decides the item is "very hard",
 * ability absorbs the rest, and the correlation is dragged back toward zero. In
 * simulation a deliberately miskeyed item scored −0.14 that way — under the
 * detection threshold, i.e. invisible. Scored against the rest, it is
 * unmistakable.
 */
function pointBiserial(
  rows: Response[],
  rest: (r: Response) => number | null,
): number {
  const usable = rows
    .map((r) => ({ correct: r.correct, score: rest(r) }))
    .filter((x): x is { correct: boolean; score: number } => x.score !== null);

  const n = usable.length;
  if (n < 3) return 0;

  const scores = usable.map((x) => x.score);
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(scores.reduce((a, s) => a + (s - mean) ** 2, 0) / n);
  if (sd === 0) return 0;

  const right = usable.filter((x) => x.correct);
  const wrong = usable.filter((x) => !x.correct);
  if (!right.length || !wrong.length) return 0;

  const mr = right.reduce((a, x) => a + x.score, 0) / right.length;
  const mw = wrong.reduce((a, x) => a + x.score, 0) / wrong.length;
  const p = right.length / n;
  return ((mr - mw) / sd) * Math.sqrt(p * (1 - p));
}

/**
 * The smoking gun for a miskeyed item.
 *
 * Correlate each OPTION (was it chosen?) with the student's rest score. On a
 * healthy question every distractor correlates NEGATIVELY — the better you are,
 * the less likely you are to pick a wrong answer. If some distractor correlates
 * POSITIVELY, then the strong students are converging on it: it is behaving like
 * the right answer, because it probably IS the right answer and the stored key
 * is wrong.
 *
 * This is far more specific than a low item-total correlation, which merely says
 * "this item doesn't discriminate" — true of a miskeyed item, but equally true of
 * a confusing or broken one.
 */
function optionCorrelations(
  rows: Response[],
  rest: (r: Response) => number | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  const options = [...new Set(rows.map((r) => r.chosen))].filter((o) => ['A', 'B', 'C', 'D'].includes(o));

  for (const option of options) {
    const usable = rows
      .map((r) => ({ picked: r.chosen === option, score: rest(r) }))
      .filter((x): x is { picked: boolean; score: number } => x.score !== null);
    if (usable.length < 3) continue;

    const scores = usable.map((x) => x.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length);
    if (sd === 0) continue;

    const yes = usable.filter((x) => x.picked);
    const no = usable.filter((x) => !x.picked);
    if (!yes.length || !no.length) continue;

    const my = yes.reduce((a, x) => a + x.score, 0) / yes.length;
    const mn = no.reduce((a, x) => a + x.score, 0) / no.length;
    const p = yes.length / usable.length;
    out[option] = Math.round(((my - mn) / sd) * Math.sqrt(p * (1 - p)) * 100) / 100;
  }
  return out;
}

/** Each student's accuracy on every item EXCEPT the one being judged. */
function restScorer(responses: Response[]) {
  const seen = new Map<string, { n: number; correct: number }>();
  for (const r of responses) {
    const s = seen.get(r.studentId) ?? { n: 0, correct: 0 };
    s.n += 1;
    if (r.correct) s.correct += 1;
    seen.set(r.studentId, s);
  }
  return (r: Response): number | null => {
    const s = seen.get(r.studentId);
    if (!s || s.n < 2) return null; // one item is no basis for a "rest" score
    return (s.correct - (r.correct ? 1 : 0)) / (s.n - 1);
  };
}

async function restore(itemId: string) {
  const ref = db.collection('questions1').doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`✗ questions1/${itemId} does not exist.`);
    return;
  }
  await ref.update({
    rand: Math.random(), // back into the sampler's index
    suspect: FieldValue.delete(),
    quarantinedAt: FieldValue.delete(),
  });
  console.log(`✅ Restored ${itemId} — it can be drawn in exams again.`);
}

async function main() {
  if (DO_RESTORE) {
    if (!RESTORE_ID) {
      console.log('Usage: --restore <questionId>');
      return;
    }
    await restore(RESTORE_ID);
    return;
  }

  console.log('Reading RASCH_attempts …');
  const snap = await db.collection('RASCH_attempts').get();
  console.log(`${snap.size} attempts.`);

  const responses: Response[] = [];
  let legacy = 0;

  snap.forEach((doc) => {
    const data = doc.data() as { items?: Array<Record<string, unknown>>; userId?: string };
    if (!data.items?.length) {
      legacy += 1;
      return;
    }
    // One student's ability is estimated per SITTING, not per person: ability
    // moves between exams, and pretending otherwise would smear it.
    const studentId = `${data.userId ?? 'anon'}#${doc.id}`;
    for (const item of data.items) {
      if (!item.chosen) continue; // unanswered says nothing about the item
      responses.push({
        itemId: String(item.id),
        studentId,
        correct: Boolean(item.correct),
        chosen: String(item.chosen),
        difficultyId: Number(item.difficultyId ?? 2),
      });
    }
  });

  if (legacy > 0) {
    console.log(`⚠️  ${legacy} attempt(s) carry no item detail (pre-dating item capture) — unanalysable.`);
  }
  if (responses.length === 0) {
    console.log('\nNo item-level responses yet. Sit an exam and run this again.');
    return;
  }

  const students = new Set(responses.map((r) => r.studentId)).size;
  const items = new Set(responses.map((r) => r.itemId)).size;
  console.log(`${responses.length} responses · ${items} distinct questions · ${students} sittings\n`);

  const { b, byItem } = calibrate(responses);
  // Scored against the REST of each student's answers, so an item cannot
  // contaminate the yardstick used to judge it.
  const rest = restScorer(responses);

  interface Stat {
    itemId: string;
    n: number;
    correct: number;
    p: number;
    b: number;
    rpb: number;
    difficultyId: number;
    distractors: Record<string, number>;
    /** Per-option correlation with the rest score. */
    optionRpb: Record<string, number>;
    /** Loose signal — worth a human look. */
    suspect: boolean;
    /** Strict signal — safe to pull from exams pending review. */
    quarantine: boolean;
    reason: string;
  }

  const stats: Stat[] = [];
  for (const [itemId, rows] of byItem) {
    if (rows.length < MIN_RESPONSES) continue;

    const correct = rows.filter((r) => r.correct).length;
    const rpb = pointBiserial(rows, rest);
    const optionRpb = optionCorrelations(rows, rest);

    const distractors: Record<string, number> = {};
    for (const r of rows.filter((x) => !x.correct)) {
      distractors[r.chosen] = (distractors[r.chosen] ?? 0) + 1;
    }

    // Two independent signals, at two strengths.
    const wrongOptions = Object.entries(optionRpb).filter(([opt]) => distractors[opt] !== undefined);
    const rogueReview = wrongOptions.find(([, r]) => r > REVIEW_DISTRACTOR_RPB);
    const rogueHard = wrongOptions.find(([, r]) => r > QUARANTINE_DISTRACTOR_RPB);

    const review =
      rows.length >= MIN_RESPONSES_TO_REVIEW && (rpb < REVIEW_RPB || !!rogueReview);

    // Quarantine needs more data AND a stronger signal. The rogue-distractor
    // route additionally requires that the KEYED answer isn't itself
    // discriminating — otherwise a merely hard item with one attractive
    // distractor would get benched.
    const quarantine =
      rows.length >= MIN_RESPONSES_TO_QUARANTINE &&
      (rpb < QUARANTINE_RPB || (!!rogueHard && rpb < 0.05));

    const reason = rogueReview
      ? `option ${rogueReview[0]} correlates +${rogueReview[1]} with ability — it behaves like the key`
      : rpb < REVIEW_RPB
        ? `item-total correlation ${rpb.toFixed(2)} — strong students miss it`
        : '';

    stats.push({
      itemId,
      n: rows.length,
      correct,
      p: Math.round((correct / rows.length) * 100) / 100,
      b: Math.round((b.get(itemId) ?? 0) * 100) / 100,
      rpb: Math.round(rpb * 100) / 100,
      difficultyId: rows[0].difficultyId,
      distractors,
      optionRpb,
      suspect: review,
      quarantine,
      reason,
    });
  }

  if (stats.length === 0) {
    console.log(`No question has ${MIN_RESPONSES}+ responses yet — nothing can be said reliably.`);
    console.log('This sharpens on its own as more exams are sat. Come back later.');
    return;
  }

  console.log(`── ${stats.length} question(s) with ${MIN_RESPONSES}+ responses ──\n`);

  const suspects = stats.filter((s) => s.suspect).sort((a, b2) => a.rpb - b2.rpb);
  const strict = stats.filter((s) => s.quarantine);
  if (suspects.length > 0) {
    console.log(`🚩 ${suspects.length} question(s) FOR REVIEW (${strict.length} strong enough to auto-bench):`);
    for (const s of suspects.slice(0, 25)) {
      const top = Object.entries(s.distractors).sort((a, b2) => b2[1] - a[1])[0];
      console.log(
        `   ${s.itemId.padEnd(10)} n=${String(s.n).padStart(3)} p=${s.p.toFixed(2)} rpb=${String(s.rpb).padStart(6)}` +
          (top ? `   most-picked wrong: ${top[0]} (${top[1]}×)` : ''),
      );
      console.log(`      ↳ ${s.reason}`);
    }
    console.log('   → REVIEW THESE BY HAND. A negative rpb usually means the stored answer is wrong.\n');
  } else {
    console.log('✅ No suspect answer keys at this sample size.\n');
  }

  const drifted = stats
    .filter((s) => Math.abs(s.b - (DIFFICULTY_ANCHOR[s.difficultyId] ?? 0)) > 1.2)
    .sort((a, b2) => Math.abs(b2.b) - Math.abs(a.b));
  console.log(`📏 ${drifted.length} question(s) whose MEASURED difficulty disagrees with their label:`);
  for (const s of drifted.slice(0, 10)) {
    console.log(`   ${s.itemId.padEnd(10)} labelled ${s.difficultyId} (${(DIFFICULTY_ANCHOR[s.difficultyId] ?? 0).toFixed(1)}) but measured b=${s.b} (p=${s.p.toFixed(2)}, n=${s.n})`);
  }

  if (!WRITE) {
    console.log('\n(dry run — nothing written. Pass --write to store b/rpb on questions1,');
    console.log(' and --write --quarantine to also bench the suspect keys.)');
    return;
  }

  // ── write-back ────────────────────────────────────────────────────────────
  const toBench = QUARANTINE ? stats.filter((s) => s.quarantine) : [];
  const share = toBench.length / stats.length;
  if (share > MAX_QUARANTINE_SHARE) {
    console.log(
      `\n⛔ Refusing to quarantine: ${toBench.length}/${stats.length} (${(share * 100).toFixed(1)}%) exceeds the ${MAX_QUARANTINE_SHARE * 100}% safety cap.`,
    );
    console.log('   That many bad keys is implausible — suspect the analysis, not the bank.');
    console.log('   Calibration will still be written; quarantine is skipped.');
  }
  const benching = share <= MAX_QUARANTINE_SHARE ? toBench : [];

  const writer = db.bulkWriter();
  let calibrated = 0;

  for (const s of stats) {
    const ref = db.collection('questions1').doc(s.itemId);
    const bench = benching.some((x) => x.itemId === s.itemId);

    const payload: Record<string, unknown> = {
      b: s.b,
      rpb: s.rpb,
      responses: s.n,
      distractors: s.distractors,
      optionRpb: s.optionRpb,
      calibratedAt: Date.now(),
    };

    if (bench) {
      payload.suspect = true;
      payload.quarantinedAt = Date.now();
      // The kill switch: no `rand` ⇒ absent from the sampler's index ⇒ never
      // drawn into another exam. Reversible with --restore.
      payload.rand = FieldValue.delete();
    }

    void writer.update(ref, payload);
    calibrated += 1;
  }

  await writer.close();
  console.log(`\n✅ Calibrated ${calibrated} question(s) — b now rides along with the question, free of extra reads.`);
  if (benching.length > 0) {
    console.log(`🚫 Quarantined ${benching.length} suspect question(s): ${benching.map((s) => s.itemId).join(', ')}`);
    console.log('   They can no longer be drawn. After review: npx tsx scripts/analyzeItems.ts --restore <id>');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
