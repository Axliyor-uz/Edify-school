/**
 * Milliy sertifikat SUBJECT paper rules (docs/MILLIY_QUIZ.md). Run: npm run test:rules
 *
 * These are the non-maths papers (`milliy_quizzes` / `milliy_quiz_results`).
 * Maths papers live in `teacher_rasch_quizzes` and are pinned by
 * raschquiz.rules.test.mjs — the two collections are deliberately parallel,
 * because the student types ONE code into ONE box and the lookup queries both.
 *
 * The things worth pinning down are the ones a refactor is most likely to break:
 *
 *  1. The student's lookup is a QUERY on `accessCode`, so the read rule cannot
 *     depend on matching the code. It has to be plain `isAuth()`, and the tests
 *     assert that on purpose — including the known consequence that any signed-in
 *     user can read a paper they were never given the code for.
 *  2. Both list queries must be PROVABLE: the teacher's filters `teacherId ==`,
 *     the student's `studentId ==`. Drop the clause and Firestore answers
 *     permission-denied, not "everyone's rows".
 *  3. A result row is deterministic-id and OVERWRITTEN by a retake, but it must
 *     stay the same student's row on the same paper, and nobody may delete it.
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

const QUIZ = {
  id: "ms_1",
  subject: "biologiya",
  title: "Biologiya — 1-variant",
  description: "",
  teacherId: "teacher1",
  teacherName: "Teacher One",
  accessCode: "482913",
  questions: [],
  questionCount: 30,
  questionTarget: 30,
  durationMinutes: 90,
  shuffle: true,
  showAnswers: true,
  status: "published",
};

const RESULT = {
  quizId: "ms_1",
  quizTitle: "Biologiya — 1-variant",
  subject: "biologiya",
  teacherId: "teacher1",
  studentId: "student1",
  studentName: "Student One",
  correct: 20,
  total: 30,
  percent: 67,
  durationSec: 3200,
  submittedAt: 1_780_000_000_000,
  examLang: "uz",
  items: {},
  topics: {},
};

const SEED = {
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/teacher2": { uid: "teacher2", role: "teacher", username: "teacher2" },
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  "users/student2": { uid: "student2", role: "student", username: "student2", totalXP: 0 },
  "milliy_quizzes/ms_1": QUIZ,
  "milliy_quizzes/ms_2": { ...QUIZ, id: "ms_2", teacherId: "teacher2", accessCode: "111222", status: "draft" },
  "milliy_quiz_results/ms_1_student1": RESULT,
};

before(async () => {
  // A distinct projectId: node --test runs files in parallel and clearFirestore
  // would otherwise wipe another suite's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-milliyquiz",
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
describe("MILLIY QUIZ — the paper document", () => {
  it("lets a student find a published paper by its access code (the whole feature)", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("student1"), "milliy_quizzes"),
      where("accessCode", "==", "482913"),
    )));
    assert.equal(snap.size, 1);
    assert.equal(snap.docs[0].id, "ms_1");
  });

  it("denies a signed-OUT visitor the lookup", async () => {
    await assertFails(getDocs(query(
      collection(anon(), "milliy_quizzes"),
      where("accessCode", "==", "482913"),
    )));
  });

  it("KNOWN TRAP: any signed-in user can read a paper without its code", async () => {
    // Documented in docs/MILLIY_QUIZ.md, asserted so the limitation stays visible
    // rather than being discovered. The lookup is a query on accessCode, so the
    // rule cannot require the code to have been matched. If this ever starts
    // FAILING, the read path moved behind a server route — update the doc.
    await assertSucceeds(getDoc(doc(as("student2"), "milliy_quizzes/ms_1")));
  });

  it("lets a teacher LIST their own papers for one subject, and only their own", async () => {
    const mine = await assertSucceeds(getDocs(query(
      collection(as("teacher1"), "milliy_quizzes"),
      where("teacherId", "==", "teacher1"),
      where("subject", "==", "biologiya"),
    )));
    assert.equal(mine.size, 1);
    assert.equal(mine.docs[0].id, "ms_1");
  });

  it("allows a teacher to create a paper stamped with their own uid", async () => {
    await assertSucceeds(setDoc(doc(as("teacher1"), "milliy_quizzes/ms_new"), {
      ...QUIZ, id: "ms_new", accessCode: "999888",
    }));
  });

  it("denies creating a paper stamped with SOMEONE ELSE's uid", async () => {
    await assertFails(setDoc(doc(as("teacher1"), "milliy_quizzes/ms_new"), {
      ...QUIZ, id: "ms_new", teacherId: "teacher2", accessCode: "999888",
    }));
  });

  it("denies another teacher editing or deleting the paper", async () => {
    await assertFails(updateDoc(doc(as("teacher2"), "milliy_quizzes/ms_1"), { status: "closed" }));
    await assertFails(deleteDoc(doc(as("teacher2"), "milliy_quizzes/ms_1")));
  });

  it("denies a student editing or deleting a paper", async () => {
    await assertFails(updateDoc(doc(as("student1"), "milliy_quizzes/ms_1"), { status: "closed" }));
    await assertFails(deleteDoc(doc(as("student1"), "milliy_quizzes/ms_1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MILLIY QUIZ — one sitting", () => {
  it("lets a student write their own sitting", async () => {
    await assertSucceeds(setDoc(doc(as("student2"), "milliy_quiz_results/ms_1_student2"), {
      ...RESULT, studentId: "student2", studentName: "Student Two",
    }));
  });

  it("denies writing a sitting under SOMEONE ELSE's studentId", async () => {
    await assertFails(setDoc(doc(as("student2"), "milliy_quiz_results/ms_1_student1x"), {
      ...RESULT, studentId: "student1",
    }));
  });

  it("denies a percent outside 0–100, and a non-integer total", async () => {
    await assertFails(setDoc(doc(as("student2"), "milliy_quiz_results/ms_1_student2"), {
      ...RESULT, studentId: "student2", percent: 140,
    }));
    await assertFails(setDoc(doc(as("student2"), "milliy_quiz_results/ms_1_student2"), {
      ...RESULT, studentId: "student2", total: "30",
    }));
  });

  it("lets the student read their own sitting, and the paper's teacher read it too", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "milliy_quiz_results/ms_1_student1")));
    await assertSucceeds(getDoc(doc(as("teacher1"), "milliy_quiz_results/ms_1_student1")));
  });

  it("denies another student and an unrelated teacher reading it", async () => {
    await assertFails(getDoc(doc(as("student2"), "milliy_quiz_results/ms_1_student1")));
    await assertFails(getDoc(doc(as("teacher2"), "milliy_quiz_results/ms_1_student1")));
  });

  it("lets the paper's teacher LIST every sitting (the provable query)", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("teacher1"), "milliy_quiz_results"),
      where("quizId", "==", "ms_1"),
      where("teacherId", "==", "teacher1"),
    )));
    assert.equal(snap.size, 1);
  });

  it("denies the teacher an UNFILTERED list (the rule is not provable without it)", async () => {
    await assertFails(getDocs(collection(as("teacher1"), "milliy_quiz_results")));
  });

  it("lets a student LIST their own sittings, and only their own", async () => {
    const mine = await assertSucceeds(getDocs(query(
      collection(as("student1"), "milliy_quiz_results"),
      where("studentId", "==", "student1"),
    )));
    assert.equal(mine.size, 1);

    // Aimed at somebody else, or unfiltered — both denied.
    await assertFails(getDocs(query(
      collection(as("student2"), "milliy_quiz_results"),
      where("studentId", "==", "student1"),
    )));
    await assertFails(getDocs(collection(as("student1"), "milliy_quiz_results")));
  });

  it("lets a RETAKE overwrite the same row", async () => {
    await assertSucceeds(updateDoc(doc(as("student1"), "milliy_quiz_results/ms_1_student1"), {
      ...RESULT, correct: 27, percent: 90,
    }));
  });

  it("denies a retake re-pointing the row at another paper, student or teacher", async () => {
    await assertFails(updateDoc(doc(as("student1"), "milliy_quiz_results/ms_1_student1"), {
      ...RESULT, quizId: "ms_2",
    }));
    await assertFails(updateDoc(doc(as("student1"), "milliy_quiz_results/ms_1_student1"), {
      ...RESULT, studentId: "student2",
    }));
    await assertFails(updateDoc(doc(as("student1"), "milliy_quiz_results/ms_1_student1"), {
      ...RESULT, teacherId: "teacher2",
    }));
  });

  it("denies EVERYONE the delete — including the student and the teacher", async () => {
    await assertFails(deleteDoc(doc(as("student1"), "milliy_quiz_results/ms_1_student1")));
    await assertFails(deleteDoc(doc(as("teacher1"), "milliy_quiz_results/ms_1_student1")));
    await assertFails(deleteDoc(doc(as("teacher2"), "milliy_quiz_results/ms_1_student1")));
  });
});
