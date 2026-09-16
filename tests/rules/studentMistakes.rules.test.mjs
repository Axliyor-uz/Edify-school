/**
 * "My Mistakes" rules tests (docs/MISTAKES.md). Run with: npm run test:rules
 *
 * The bucket is entirely PRIVATE to one student — not shared with their
 * teacher, their centre manager, or anyone else. These tests pin that down
 * from both directions: the owner can do everything, and every other role
 * (including a teacher who set the paper) is refused on every path.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

let testEnv;

const mistake = (studentId, slotKey, extra = {}) => ({
  id: `${studentId}_${slotKey}`,
  studentId,
  slotKey,
  questionId: slotKey.split("#")[0],
  source: "sat-math",
  outcome: "wrong",
  testId: "t1",
  testTitle: "Mock",
  question: { uz: "", ru: "", en: "Q" },
  optionKeys: ["A", "B"],
  options: { A: { uz: "", ru: "", en: "a" }, B: { uz: "", ru: "", en: "b" } },
  answer: "B",
  examLang: "en",
  subjectId: "sat-matematika",
  subjectName: "SAT Matematika",
  topicId: "algebra",
  topicName: "Algebra",
  subtopicId: "",
  subtopicName: "",
  difficultyId: 2,
  timesWrong: 1,
  lastMissedAt: 1_700_000_000_000,
  resolved: false,
  ...extra,
});

const SEED = {
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  "users/student2": { uid: "student2", role: "student", username: "student2", totalXP: 0 },
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/manager1": { uid: "manager1", role: "manager", username: "manager1", centerId: "centerA" },
  "centers/centerA": { id: "centerA", ownerUid: "manager1", status: "active", name: "Center A" },

  "student_mistakes/student1_q1": mistake("student1", "q1"),
  "student_mistakes/student1_s1#p2": mistake("student1", "s1#p2", { outcome: "blank" }),
  "student_mistakes/student2_q1": mistake("student2", "q1"),
};

before(async () => {
  // node --test runs test FILES in parallel; a distinct projectId keeps this
  // suite's clearFirestore() from wiping another file's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-mistakes",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(SEED)) {
      await setDoc(doc(db, path), data);
    }
  });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// ─────────────────────────────────────────────────────────────────────────────
describe("MISTAKES — the owner has full control", () => {
  it("reads their own mistake", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "student_mistakes/student1_q1")));
  });

  it("lists their own bucket (studentId == filter, the only read path)", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("student1"), "student_mistakes"), where("studentId", "==", "student1"))),
    );
  });

  it("creates a mistake for themselves", async () => {
    await assertSucceeds(
      setDoc(doc(as("student1"), "student_mistakes/student1_q9"), mistake("student1", "q9")),
    );
  });

  it("creates one whose slot key contains a '#' (a shared_options sub-question)", async () => {
    await assertSucceeds(
      setDoc(doc(as("student1"), "student_mistakes/student1_s9#p1"), mistake("student1", "s9#p1")),
    );
  });

  it("resolves and un-resolves their own mistake", async () => {
    const ref = doc(as("student1"), "student_mistakes/student1_q1");
    await assertSucceeds(updateDoc(ref, { resolved: true, resolvedAt: 1 }));
    await assertSucceeds(updateDoc(ref, { resolved: false, resolvedAt: null }));
  });

  it("deletes their own mistake", async () => {
    await assertSucceeds(deleteDoc(doc(as("student1"), "student_mistakes/student1_q1")));
  });
});

describe("MISTAKES — the doc id must match the payload", () => {
  it("denies a create whose id field disagrees with the document id", async () => {
    await assertFails(
      setDoc(doc(as("student1"), "student_mistakes/student1_qX"), mistake("student1", "q1")),
    );
  });

  it("denies creating a mistake under someone else's uid", async () => {
    await assertFails(
      setDoc(doc(as("student1"), "student_mistakes/student2_q9"), mistake("student2", "q9")),
    );
  });

  it("denies re-assigning an existing mistake to another student", async () => {
    await assertFails(
      updateDoc(doc(as("student1"), "student_mistakes/student1_q1"), { studentId: "student2" }),
    );
  });
});

describe("MISTAKES — private to the student, full stop", () => {
  it("denies another student reading it", async () => {
    await assertFails(getDoc(doc(as("student2"), "student_mistakes/student1_q1")));
  });

  it("denies a TEACHER reading a student's bucket", async () => {
    // Deliberate: the teacher already has the authoritative per-question
    // outcomes in the result collections. This is a private study aid.
    await assertFails(getDoc(doc(as("teacher1"), "student_mistakes/student1_q1")));
    await assertFails(
      getDocs(query(collection(as("teacher1"), "student_mistakes"), where("studentId", "==", "student1"))),
    );
  });

  it("denies a MANAGER reading a student's bucket", async () => {
    await assertFails(getDoc(doc(as("manager1"), "student_mistakes/student1_q1")));
  });

  it("denies another student writing or deleting it", async () => {
    await assertFails(updateDoc(doc(as("student2"), "student_mistakes/student1_q1"), { resolved: true }));
    await assertFails(deleteDoc(doc(as("student2"), "student_mistakes/student1_q1")));
  });

  it("denies an unfiltered list to everyone", async () => {
    await assertFails(getDocs(collection(as("student1"), "student_mistakes")));
    await assertFails(getDocs(collection(as("teacher1"), "student_mistakes")));
  });

  it("denies a list filtered to SOMEONE ELSE's uid", async () => {
    await assertFails(
      getDocs(query(collection(as("student1"), "student_mistakes"), where("studentId", "==", "student2"))),
    );
  });

  it("denies anonymous callers everything", async () => {
    await assertFails(getDoc(doc(anon(), "student_mistakes/student1_q1")));
    await assertFails(setDoc(doc(anon(), "student_mistakes/x_q1"), mistake("x", "q1")));
  });
});
