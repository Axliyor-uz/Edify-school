/**
 * Center-managed IELTS group rules tests (docs/IELTS.md + docs/MANAGER.md).
 * Run with: npm run test:rules
 *
 * Covers the linked-pair model: ielts_groups docs with `centerId` are manager-
 * territory (limited-key updates, roster mirror batch), the TEACHER is locked out
 * of the group doc entirely (content control stays via assignments), and no
 * client can stamp/strip a centerId.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, arrayUnion, arrayRemove,
  collection, addDoc,
} from "firebase/firestore";

let testEnv;

const SEED = {
  "users/manager1": { uid: "manager1", role: "manager", centerId: "C1" },
  "users/manager2": { uid: "manager2", role: "manager", centerId: "C2" },
  "users/teacher1": { uid: "teacher1", role: "teacher" },
  "users/student1": { uid: "student1", role: "student" },
  "users/student2": { uid: "student2", role: "student" },
  "centers/C1": { ownerUid: "manager1", status: "active", name: "Everest" },
  "centers/C2": { ownerUid: "manager2", status: "active", name: "Other" },
  "center_teachers/teacher1": { centerId: "C1", teacherId: "teacher1", teacherName: "T One", teacherEmail: "t1@x.uz" },
  // The linked pair: center class + managed IELTS twin
  "classes/classM": {
    title: "IELTS B2", centerId: "C1", teacherId: "teacher1", teacherName: "T One",
    studentIds: ["student1"], studentCount: 0, isLocked: false, joinCode: "ABC123",
    ieltsGroupId: "gM",
  },
  "ielts_groups/gM": {
    title: "IELTS B2", targetBand: 6.5, joinCode: "I-MNGD01",
    teacherId: "teacher1", teacherName: "T One", studentIds: ["student1"],
    centerId: "C1", classId: "classM", managed: true,
  },
  // A personal (teacher-owned) group — old behavior must be untouched
  "ielts_groups/gP": {
    title: "My own", targetBand: 7, joinCode: "I-PERS01",
    teacherId: "teacher1", teacherName: "T One", studentIds: ["student1"],
  },
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    // Dedicated projectId — node --test runs files in parallel processes against
    // one emulator and clearFirestore() is project-wide (see ieltsMeta tests).
    projectId: "demo-edify-rules-ielts-center",
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

describe("ielts_groups — center-managed (linked pair)", () => {
  it("owning manager may read the managed group; another center's manager may not", async () => {
    await assertSucceeds(getDoc(doc(as("manager1"), "ielts_groups/gM")));
    await assertFails(getDoc(doc(as("manager2"), "ielts_groups/gM")));
  });

  it("member student and group teacher still read the managed group", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "ielts_groups/gM")));
    await assertSucceeds(getDoc(doc(as("teacher1"), "ielts_groups/gM")));
    await assertFails(getDoc(doc(as("student2"), "ielts_groups/gM")));
  });

  it("legit flow: managedRosterBatch (classes + ielts_groups arrayUnion) commits for the manager", async () => {
    const db = as("manager1");
    const batch = writeBatch(db);
    batch.update(doc(db, "classes/classM"), { studentIds: arrayUnion("student2") });
    batch.update(doc(db, "ielts_groups/gM"), { studentIds: arrayUnion("student2") });
    await assertSucceeds(batch.commit());
  });

  it("legit flow: settings batch (title/desc/teacher/targetBand sync) commits for the manager", async () => {
    const db = as("manager1");
    const batch = writeBatch(db);
    batch.update(doc(db, "classes/classM"), { title: "IELTS B2+", description: "x", teacherId: "teacher1", teacherName: "T One" });
    batch.update(doc(db, "ielts_groups/gM"), {
      title: "IELTS B2+", description: "x", teacherId: "teacher1", teacherName: "T One", targetBand: 7.0,
    });
    await assertSucceeds(batch.commit());
  });

  it("manager writes are limited-key: centerId/classId/managed/joinCode stay immutable", async () => {
    await assertFails(updateDoc(doc(as("manager1"), "ielts_groups/gM"), { centerId: "C2" }));
    await assertFails(updateDoc(doc(as("manager1"), "ielts_groups/gM"), { classId: "other" }));
    await assertFails(updateDoc(doc(as("manager1"), "ielts_groups/gM"), { managed: false }));
    await assertFails(updateDoc(doc(as("manager1"), "ielts_groups/gM"), { joinCode: "I-NEW999" }));
  });

  it("another center's manager cannot touch the managed group", async () => {
    await assertFails(updateDoc(doc(as("manager2"), "ielts_groups/gM"), { studentIds: arrayUnion("student2") }));
    await assertFails(deleteDoc(doc(as("manager2"), "ielts_groups/gM")));
  });

  it("the TEACHER cannot update or delete the managed group doc (roster is manager-owned)", async () => {
    await assertFails(updateDoc(doc(as("teacher1"), "ielts_groups/gM"), { studentIds: arrayUnion("student2") }));
    await assertFails(updateDoc(doc(as("teacher1"), "ielts_groups/gM"), { title: "renamed" }));
    await assertFails(deleteDoc(doc(as("teacher1"), "ielts_groups/gM")));
  });

  it("students cannot self-add to a managed group", async () => {
    await assertFails(updateDoc(doc(as("student2"), "ielts_groups/gM"), { studentIds: arrayUnion("student2") }));
  });

  it("nobody deletes a managed group client-side (manager pair-delete goes through the API)", async () => {
    await assertFails(deleteDoc(doc(as("manager1"), "ielts_groups/gM")));
  });
});

describe("ielts_groups — teacher-personal groups stay teacher territory", () => {
  it("teacher still creates/updates/deletes their own (non-center) groups", async () => {
    const db = as("teacher1");
    await assertSucceeds(setDoc(doc(db, "ielts_groups/gNew"), {
      title: "New", targetBand: 6, joinCode: "I-NEW001",
      teacherId: "teacher1", teacherName: "T One", studentIds: [],
    }));
    await assertSucceeds(updateDoc(doc(db, "ielts_groups/gP"), { studentIds: arrayRemove("student1") }));
    await assertSucceeds(deleteDoc(doc(db, "ielts_groups/gP")));
  });

  it("a teacher cannot stamp a centerId at create or via update (managed groups are API-born)", async () => {
    await assertFails(setDoc(doc(as("teacher1"), "ielts_groups/gSpoof"), {
      title: "Spoof", targetBand: 6, joinCode: "I-SPOOF1",
      teacherId: "teacher1", teacherName: "T One", studentIds: [],
      centerId: "C1", managed: true,
    }));
    await assertFails(updateDoc(doc(as("teacher1"), "ielts_groups/gP"), { centerId: "C1" }));
  });

  it("the manager has no access to personal groups (no centerId → no manager branch)", async () => {
    await assertFails(getDoc(doc(as("manager1"), "ielts_groups/gP")));
    await assertFails(updateDoc(doc(as("manager1"), "ielts_groups/gP"), { title: "grabbed" }));
  });
});

describe("ielts_groups/assignments — content control stays with the teacher", () => {
  it("the teacher of a managed group still creates assignments; the manager does not", async () => {
    await assertSucceeds(addDoc(collection(as("teacher1"), "ielts_groups/gM/assignments"), {
      testId: "t1", skill: "reading", testTitle: "Mock 1", questionCount: 40,
      totalTimeMinutes: 60, mode: "simulation", openAt: null, dueAt: null,
      allowedAttempts: 1, resultsVisibility: "always", assignedTo: "all",
      teacherId: "teacher1", status: "active", completedBy: [],
    }));
    await assertFails(addDoc(collection(as("manager1"), "ielts_groups/gM/assignments"), {
      testId: "t2", skill: "reading", testTitle: "Mock 2", teacherId: "manager1",
    }));
  });
});
