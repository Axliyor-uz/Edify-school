/**
 * Teacher-built Rasch paper rules (docs/RASCH_QUIZ.md). Run: npm run test:rules
 *
 * The two things worth pinning down here are the ones a refactor is most likely
 * to get wrong:
 *
 *  1. The student's lookup is a QUERY on `accessCode`, so the read rule cannot
 *     depend on matching the code. It has to be plain `isAuth()`, and the tests
 *     below assert that on purpose — including the known consequence that any
 *     signed-in user can read a paper they were never given the code for.
 *  2. A result row is deterministic-id and OVERWRITTEN by a retake, but it must
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
  id: "rq_1",
  title: "Yakuniy variant",
  description: "",
  teacherId: "teacher1",
  teacherName: "Teacher One",
  accessCode: "482913",
  questions: [],
  questionCount: 45,
  durationMinutes: 150,
  shuffle: true,
  showAnswers: true,
  status: "published",
};

const RESULT = {
  quizId: "rq_1",
  quizTitle: "Yakuniy variant",
  teacherId: "teacher1",
  studentId: "student1",
  studentName: "Student One",
  correct: 30,
  total: 45,
  percent: 67,
  durationSec: 4200,
  submittedAt: 1_780_000_000_000,
  examLang: "uz",
  topics: {},
  theta: 0.5,
};

const SEED = {
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/teacher2": { uid: "teacher2", role: "teacher", username: "teacher2" },
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  "users/student2": { uid: "student2", role: "student", username: "student2", totalXP: 0 },
  "teacher_rasch_quizzes/rq_1": QUIZ,
  "teacher_rasch_quizzes/rq_2": { ...QUIZ, id: "rq_2", teacherId: "teacher2", accessCode: "111222", status: "draft" },
  "teacher_rasch_results/rq_1_student1": RESULT,
};

before(async () => {
  // A distinct projectId: node --test runs files in parallel and clearFirestore
  // would otherwise wipe another suite's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-raschquiz",
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
describe("RASCH QUIZ — the paper document", () => {
  it("lets a student find a published paper by its access code (the whole feature)", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("student1"), "teacher_rasch_quizzes"),
      where("accessCode", "==", "482913"),
    )));
    assert.equal(snap.size, 1);
    assert.equal(snap.docs[0].id, "rq_1");
  });

  it("denies a signed-OUT visitor the lookup", async () => {
    await assertFails(getDocs(query(
      collection(anon(), "teacher_rasch_quizzes"),
      where("accessCode", "==", "482913"),
    )));
  });

  it("KNOWN TRAP: any signed-in user can read a paper without its code", async () => {
    // Documented in docs/RASCH_QUIZ.md, asserted so the limitation stays visible
    // rather than being discovered. The lookup is a query on accessCode, so the
    // rule cannot require the code to have been matched. If this ever starts
    // FAILING, the read path moved behind a server route — update the doc.
    await assertSucceeds(getDoc(doc(as("student2"), "teacher_rasch_quizzes/rq_1")));
  });

  it("allows a teacher to create a paper stamped with their own uid", async () => {
    await assertSucceeds(setDoc(doc(as("teacher1"), "teacher_rasch_quizzes/rq_new"), {
      ...QUIZ, id: "rq_new", accessCode: "999888",
    }));
  });

  it("denies creating a paper stamped with SOMEONE ELSE's uid", async () => {
    await assertFails(setDoc(doc(as("teacher1"), "teacher_rasch_quizzes/rq_new"), {
      ...QUIZ, id: "rq_new", teacherId: "teacher2", accessCode: "999888",
    }));
  });

  it("denies another teacher editing or deleting the paper", async () => {
    await assertFails(updateDoc(doc(as("teacher2"), "teacher_rasch_quizzes/rq_1"), { status: "closed" }));
    await assertFails(deleteDoc(doc(as("teacher2"), "teacher_rasch_quizzes/rq_1")));
  });

  it("denies a student editing or deleting a paper", async () => {
    await assertFails(updateDoc(doc(as("student1"), "teacher_rasch_quizzes/rq_1"), { status: "closed" }));
    await assertFails(deleteDoc(doc(as("student1"), "teacher_rasch_quizzes/rq_1")));
  });

  it("allows the owner to publish / close their own paper", async () => {
    await assertSucceeds(updateDoc(doc(as("teacher1"), "teacher_rasch_quizzes/rq_1"), { status: "closed" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("RASCH QUIZ — result rows", () => {
  it("lets a student write their own result", async () => {
    await assertSucceeds(setDoc(doc(as("student2"), "teacher_rasch_results/rq_1_student2"), {
      ...RESULT, studentId: "student2", studentName: "Student Two",
    }));
  });

  it("denies writing a result under someone else's uid", async () => {
    await assertFails(setDoc(doc(as("student2"), "teacher_rasch_results/rq_1_student9"), {
      ...RESULT, studentId: "student9",
    }));
  });

  it("denies an impossible percent (the doc must stay a real score)", async () => {
    await assertFails(setDoc(doc(as("student2"), "teacher_rasch_results/rq_1_student2"), {
      ...RESULT, studentId: "student2", percent: 250,
    }));
  });

  it("allows a RETAKE to overwrite the same row", async () => {
    await assertSucceeds(setDoc(doc(as("student1"), "teacher_rasch_results/rq_1_student1"), {
      ...RESULT, correct: 40, percent: 89,
    }));
  });

  it("denies a retake that re-points the row at another paper or another teacher", async () => {
    await assertFails(updateDoc(doc(as("student1"), "teacher_rasch_results/rq_1_student1"), { quizId: "rq_2" }));
    await assertFails(updateDoc(doc(as("student1"), "teacher_rasch_results/rq_1_student1"), { teacherId: "teacher2" }));
  });

  it("lets the paper's teacher LIST every result (the query the page actually runs)", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("teacher1"), "teacher_rasch_results"),
      where("quizId", "==", "rq_1"),
      where("teacherId", "==", "teacher1"),
    )));
    assert.equal(snap.size, 1);
  });

  it("denies the same list to a teacher who does not own the paper", async () => {
    await assertFails(getDocs(query(
      collection(as("teacher2"), "teacher_rasch_results"),
      where("quizId", "==", "rq_1"),
      where("teacherId", "==", "teacher1"),
    )));
  });

  it("denies an unfiltered list, which would leak every student's score", async () => {
    await assertFails(getDocs(collection(as("teacher1"), "teacher_rasch_results")));
  });

  it("lets a student read their own row but not another student's", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "teacher_rasch_results/rq_1_student1")));
    await assertFails(getDoc(doc(as("student2"), "teacher_rasch_results/rq_1_student1")));
  });

  // The "tests you have sat" list on /raschmodel/quiz (listMyQuizResults).
  it("lets a student LIST their own sittings, and only their own", async () => {
    const snap = await assertSucceeds(getDocs(query(
      collection(as("student1"), "teacher_rasch_results"),
      where("studentId", "==", "student1"),
    )));
    assert.equal(snap.size, 1);

    // The `studentId ==` clause is what makes it provable — filtered at somebody
    // else, or not filtered at all, it must be denied rather than come back thin.
    await assertFails(getDocs(query(
      collection(as("student2"), "teacher_rasch_results"),
      where("studentId", "==", "student1"),
    )));
    await assertFails(getDocs(collection(as("student1"), "teacher_rasch_results")));
  });

  it("denies DELETE to everyone — a result is neither withdrawable nor erasable", async () => {
    await assertFails(deleteDoc(doc(as("student1"), "teacher_rasch_results/rq_1_student1")));
    await assertFails(deleteDoc(doc(as("teacher1"), "teacher_rasch_results/rq_1_student1")));
  });
});
