/**
 * SAT English (Reading & Writing) adaptive test rules (docs/SAT_QUIZ.md).
 * Run: npm run test:rules
 *
 * `sat_english_tests` / `sat_english_results` — a SIBLING of
 * satmathquiz.rules.test.mjs's contract in its own collections (§12e mirrors
 * §12d exactly). Same three things worth pinning down:
 *
 *  1. The student's lookup is a QUERY on `accessCode`, so the read rule cannot
 *     depend on matching the code. It has to be plain `isAuth()`, and the tests
 *     assert that on purpose — including the known consequence that any signed-in
 *     user can read a test they were never given the code for.
 *  2. Both list queries must be PROVABLE: the teacher's filters `teacherId ==`,
 *     the student's `studentId ==`. Drop the clause and Firestore answers
 *     permission-denied, not "everyone's rows".
 *  3. A result row is deterministic-id and OVERWRITTEN by a retake, but it must
 *     stay the same student's row on the same test, and nobody may delete it.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where,
} from "firebase/firestore";

let testEnv;

const TEST = {
  id: "sate_1",
  title: "SAT Reading & Writing — Practice 1",
  description: "",
  teacherId: "teacher1",
  teacherName: "Teacher One",
  accessCode: "482913",
  module1: [],
  module2Easier: [],
  module2Harder: [],
  module1Minutes: 32,
  module2Minutes: 32,
  routingThreshold: 14,
  shuffle: true,
  showAnswers: true,
  status: "published",
};

const RESULT = {
  testId: "sate_1",
  testTitle: "SAT Reading & Writing — Practice 1",
  teacherId: "teacher1",
  studentId: "student1",
  studentName: "Student One",
  module1Correct: 18,
  module1Total: 27,
  route: "harder",
  module2Correct: 15,
  module2Total: 27,
  correct: 33,
  total: 54,
  scaledScore: 650,
  durationSec: 3800,
  submittedAt: 1_780_000_000_000,
  examLang: "en",
  items: {},
  domains: {},
};

const SEED = {
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/teacher2": { uid: "teacher2", role: "teacher", username: "teacher2" },
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  "users/student2": { uid: "student2", role: "student", username: "student2", totalXP: 0 },
  "sat_english_tests/sate_1": TEST,
  "sat_english_tests/sate_2": { ...TEST, id: "sate_2", teacherId: "teacher2", accessCode: "111222", status: "draft" },
  "sat_english_results/sate_1_student1": RESULT,
};

before(async () => {
  // A distinct projectId: node --test runs files in parallel and clearFirestore
  // would otherwise wipe another suite's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-satenglishquiz",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(SEED)) await setDoc(doc(db, path), data);
  });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// ─────────────────────────────────────────────────────────────────────────────
describe("SAT ENGLISH — the test document", () => {
  it("lets a student find a published test by its access code (the whole feature)", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("student1"), "sat_english_tests"),
      where("accessCode", "==", "482913"),
    )));
    assert.equal(snap.size, 1);
    assert.equal(snap.docs[0].id, "sate_1");
  });

  it("denies a signed-OUT visitor the lookup", async () => {
    await assertFails(getDocs(query(
      collection(anon(), "sat_english_tests"),
      where("accessCode", "==", "482913"),
    )));
  });

  it("KNOWN TRAP: any signed-in user can read a test without its code", async () => {
    // Documented in docs/SAT_QUIZ.md, asserted so the limitation stays visible
    // rather than being discovered. The lookup is a query on accessCode, so the
    // rule cannot require the code to have been matched. If this ever starts
    // FAILING, the read path moved behind a server route — update the doc.
    await assertSucceeds(getDoc(doc(as("student2"), "sat_english_tests/sate_1")));
  });

  it("lets a teacher LIST their own tests, and only their own", async () => {
    const mine = await assertSucceeds(getDocs(query(
      collection(as("teacher1"), "sat_english_tests"),
      where("teacherId", "==", "teacher1"),
    )));
    assert.equal(mine.size, 1);
    assert.equal(mine.docs[0].id, "sate_1");
  });

  it("allows a teacher to create a test stamped with their own uid", async () => {
    await assertSucceeds(setDoc(doc(as("teacher1"), "sat_english_tests/sate_new"), {
      ...TEST, id: "sate_new", accessCode: "999888",
    }));
  });

  it("denies creating a test stamped with SOMEONE ELSE's uid", async () => {
    await assertFails(setDoc(doc(as("teacher1"), "sat_english_tests/sate_new"), {
      ...TEST, id: "sate_new", teacherId: "teacher2", accessCode: "999888",
    }));
  });

  it("denies another teacher editing or deleting the test", async () => {
    await assertFails(updateDoc(doc(as("teacher2"), "sat_english_tests/sate_1"), { status: "closed" }));
    await assertFails(deleteDoc(doc(as("teacher2"), "sat_english_tests/sate_1")));
  });

  it("denies a student editing or deleting a test", async () => {
    await assertFails(updateDoc(doc(as("student1"), "sat_english_tests/sate_1"), { status: "closed" }));
    await assertFails(deleteDoc(doc(as("student1"), "sat_english_tests/sate_1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("SAT ENGLISH — one sitting", () => {
  it("lets a student write their own sitting", async () => {
    await assertSucceeds(setDoc(doc(as("student2"), "sat_english_results/sate_1_student2"), {
      ...RESULT, studentId: "student2", studentName: "Student Two",
    }));
  });

  it("denies writing a sitting under SOMEONE ELSE's studentId", async () => {
    await assertFails(setDoc(doc(as("student2"), "sat_english_results/sate_1_student1x"), {
      ...RESULT, studentId: "student1",
    }));
  });

  it("denies a scaledScore outside 200-800, and a non-integer total", async () => {
    await assertFails(setDoc(doc(as("student2"), "sat_english_results/sate_1_student2"), {
      ...RESULT, studentId: "student2", scaledScore: 900,
    }));
    await assertFails(setDoc(doc(as("student2"), "sat_english_results/sate_1_student2"), {
      ...RESULT, studentId: "student2", total: "54",
    }));
  });

  it("lets the student read their own sitting, and the test's teacher read it too", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "sat_english_results/sate_1_student1")));
    await assertSucceeds(getDoc(doc(as("teacher1"), "sat_english_results/sate_1_student1")));
  });

  it("denies another student and an unrelated teacher reading it", async () => {
    await assertFails(getDoc(doc(as("student2"), "sat_english_results/sate_1_student1")));
    await assertFails(getDoc(doc(as("teacher2"), "sat_english_results/sate_1_student1")));
  });

  it("lets the test's teacher LIST every sitting (the provable query)", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("teacher1"), "sat_english_results"),
      where("testId", "==", "sate_1"),
      where("teacherId", "==", "teacher1"),
    )));
    assert.equal(snap.size, 1);
  });

  it("denies the teacher an UNFILTERED list (the rule is not provable without it)", async () => {
    await assertFails(getDocs(collection(as("teacher1"), "sat_english_results")));
  });

  it("lets a student LIST their own sittings, and only their own", async () => {
    const mine = await assertSucceeds(getDocs(query(
      collection(as("student1"), "sat_english_results"),
      where("studentId", "==", "student1"),
    )));
    assert.equal(mine.size, 1);

    // Aimed at somebody else, or unfiltered — both denied.
    await assertFails(getDocs(query(
      collection(as("student2"), "sat_english_results"),
      where("studentId", "==", "student1"),
    )));
    await assertFails(getDocs(collection(as("student1"), "sat_english_results")));
  });

  it("lets a RETAKE overwrite the same row", async () => {
    await assertSucceeds(updateDoc(doc(as("student1"), "sat_english_results/sate_1_student1"), {
      ...RESULT, correct: 40, scaledScore: 720,
    }));
  });

  it("denies a retake re-pointing the row at another test, student or teacher", async () => {
    await assertFails(updateDoc(doc(as("student1"), "sat_english_results/sate_1_student1"), {
      ...RESULT, testId: "sate_2",
    }));
    await assertFails(updateDoc(doc(as("student1"), "sat_english_results/sate_1_student1"), {
      ...RESULT, studentId: "student2",
    }));
    await assertFails(updateDoc(doc(as("student1"), "sat_english_results/sate_1_student1"), {
      ...RESULT, teacherId: "teacher2",
    }));
  });

  it("denies EVERYONE the delete — including the student and the teacher", async () => {
    await assertFails(deleteDoc(doc(as("student1"), "sat_english_results/sate_1_student1")));
    await assertFails(deleteDoc(doc(as("teacher1"), "sat_english_results/sate_1_student1")));
    await assertFails(deleteDoc(doc(as("teacher2"), "sat_english_results/sate_1_student1")));
  });
});
