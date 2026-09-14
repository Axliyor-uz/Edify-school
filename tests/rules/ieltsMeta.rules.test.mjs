/**
 * IELTS test-meta + answer-key rules tests (docs/IELTS.md). Run with: npm run test:rules
 *
 * Covers the ielts_test_meta collection (library-card summaries, answer-free) and the
 * delete-missing-doc guard on ielts_answer_keys/ielts_test_meta that keeps
 * deleteIeltsTest's batch working for legacy tests.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch } from "firebase/firestore";

let testEnv;

const SEED = {
  "users/student1": { uid: "student1", role: "student", username: "student1" },
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/teacher2": { uid: "teacher2", role: "teacher", username: "teacher2" },
  // teacher1's test with meta + key
  "ielts_reading_tests/testA": { test_id: "testA", teacherId: "teacher1", source: "teacher", answers_split: true },
  "ielts_answer_keys/testA": { testId: "testA", teacherId: "teacher1", skill: "reading", keys: { 1: { t: "short_answer", a: "cat" } } },
  "ielts_test_meta/testA": { testId: "testA", skill: "reading", teacherId: "teacher1", source: "teacher", test_title: "A", total_questions: 13, total_time_minutes: 20, typeBreakdown: { short_answer: 13 } },
  // legacy test: NO key doc, NO meta doc
  "ielts_reading_tests/legacy": { test_id: "legacy", teacherId: "teacher1", source: "teacher" },
  // platform meta (admin-owned)
  "ielts_test_meta/platformT": { testId: "platformT", skill: "reading", teacherId: null, source: "platform", test_title: "P", total_questions: 40, total_time_minutes: 60 },
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    // NOTE: deliberately NOT "demo-edify-rules" — node --test runs the *.test.mjs files
    // in parallel processes against one emulator, and clearFirestore() is project-wide.
    // A dedicated projectId isolates this file from the other suites' beforeEach wipes.
    projectId: "demo-edify-rules-ielts",
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

describe("ielts_test_meta — library summaries", () => {
  it("any signed-in user may read metas (they are answer-free)", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "ielts_test_meta/testA")));
    await assertSucceeds(getDoc(doc(as("student1"), "ielts_test_meta/platformT")));
  });

  it("anonymous users may not read metas", async () => {
    await assertFails(getDoc(doc(anon(), "ielts_test_meta/testA")));
  });

  it("a teacher may create their own meta but not one owned by someone else", async () => {
    await assertSucceeds(setDoc(doc(as("teacher1"), "ielts_test_meta/newT"), {
      testId: "newT", skill: "reading", teacherId: "teacher1", source: "teacher",
      test_title: "New", total_questions: 10, total_time_minutes: 20,
    }));
    await assertFails(setDoc(doc(as("teacher2"), "ielts_test_meta/spoof"), {
      testId: "spoof", skill: "reading", teacherId: "teacher1", source: "teacher",
    }));
  });

  it("a student may not touch metas they do not own", async () => {
    // (Creating a meta under one's OWN uid is allowed by the same ownership rule as the
    // test banks — roles are not distinguished there either. The guard that matters:
    // nobody can edit/delete someone else's meta.)
    await assertFails(updateDoc(doc(as("student1"), "ielts_test_meta/testA"), { test_title: "defaced" }));
    await assertFails(deleteDoc(doc(as("student1"), "ielts_test_meta/platformT")));
  });

  it("another teacher may not update/delete teacher1's meta", async () => {
    await assertFails(updateDoc(doc(as("teacher2"), "ielts_test_meta/testA"), { test_title: "defaced" }));
    await assertFails(deleteDoc(doc(as("teacher2"), "ielts_test_meta/testA")));
  });

  it("platform metas (teacherId null) are client-immutable", async () => {
    await assertFails(updateDoc(doc(as("teacher1"), "ielts_test_meta/platformT"), { test_title: "defaced" }));
    await assertFails(deleteDoc(doc(as("teacher1"), "ielts_test_meta/platformT")));
  });

  it("legit flow: saveIeltsTest batch (test + key + meta) commits for the owner", async () => {
    const db = as("teacher1");
    const batch = writeBatch(db);
    batch.set(doc(db, "ielts_reading_tests/testA"), { test_id: "testA", teacherId: "teacher1", source: "teacher", answers_split: true, status: "published" });
    batch.set(doc(db, "ielts_answer_keys/testA"), { testId: "testA", teacherId: "teacher1", skill: "reading", keys: {} });
    batch.set(doc(db, "ielts_test_meta/testA"), { testId: "testA", skill: "reading", teacherId: "teacher1", source: "teacher", test_title: "A2", total_questions: 13, total_time_minutes: 20 });
    await assertSucceeds(batch.commit());
  });

  it("legit flow: deleteIeltsTest batch works for a LEGACY test with no key/meta docs", async () => {
    const db = as("teacher1");
    const batch = writeBatch(db);
    batch.delete(doc(db, "ielts_reading_tests/legacy"));
    batch.delete(doc(db, "ielts_answer_keys/legacy")); // doc does not exist
    batch.delete(doc(db, "ielts_test_meta/legacy"));   // doc does not exist
    await assertSucceeds(batch.commit());
  });

  it("the delete-missing guard does NOT let outsiders delete existing docs", async () => {
    await assertFails(deleteDoc(doc(as("teacher2"), "ielts_answer_keys/testA")));
    await assertFails(deleteDoc(doc(as("student1"), "ielts_answer_keys/testA")));
  });
});

describe("ielts_answer_keys — still never student-readable", () => {
  it("student cannot read a key; owner can", async () => {
    await assertFails(getDoc(doc(as("student1"), "ielts_answer_keys/testA")));
    await assertSucceeds(getDoc(doc(as("teacher1"), "ielts_answer_keys/testA")));
  });
});
