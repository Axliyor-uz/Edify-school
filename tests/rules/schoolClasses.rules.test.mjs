/**
 * School Classes rules tests (docs/MANAGER.md "School Classes"). Run with: npm run test:rules
 *
 * Covers: doc-id-uniqueness (the deterministic `${centerId}_${grade}_${section}`
 * id doubles as a uniqueness constraint via `create`), centerId/grade/section
 * immutability, the approval gate (pending center can't write), and the
 * cross-center hijack denial (same shape as the classes.rules regression test).
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";

let testEnv;

// manager1 owns ACTIVE centerA. managerB owns ACTIVE centerB. pendingMgr owns
// PENDING centerP. school_classes/centerA_5_A already exists ("5-A").
const SEED = {
  "users/manager1": { uid: "manager1", role: "manager", username: "manager1", centerId: "centerA" },
  "users/managerB": { uid: "managerB", role: "manager", username: "managerb", centerId: "centerB" },
  "users/pendingMgr": { uid: "pendingMgr", role: "manager", username: "pendingmgr", centerId: "centerP" },
  "centers/centerA": { id: "centerA", ownerUid: "manager1", status: "active", name: "Center A" },
  "centers/centerB": { id: "centerB", ownerUid: "managerB", status: "active", name: "Center B" },
  "centers/centerP": { id: "centerP", ownerUid: "pendingMgr", status: "pending", name: "Center P" },
  "school_classes/centerA_5_A": {
    centerId: "centerA", grade: "5", section: "A", displayName: "5-A", studentIds: [], createdAt: 0, createdBy: "manager1",
  },
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-schoolclasses",
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

describe("SCHOOL_CLASSES — create", () => {
  it("allows an active manager to create a School Class with a matching doc id", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager1"), "school_classes/centerA_6_B"), {
        centerId: "centerA", grade: "6", section: "B", displayName: "6-B", studentIds: [], createdAt: 0, createdBy: "manager1",
      }),
    );
  });

  it("denies create when the doc id doesn't match centerId_grade_section", async () => {
    await assertFails(
      setDoc(doc(as("manager1"), "school_classes/wrong_id"), {
        centerId: "centerA", grade: "6", section: "B", displayName: "6-B", studentIds: [], createdAt: 0, createdBy: "manager1",
      }),
    );
  });

  it("routes a setDoc on an already-existing doc through the update rule, not create — grade/section still immutable", async () => {
    // Once a doc exists, Firestore rules evaluate ANY write (setDoc included)
    // as `update`, never `create` — so doc-id uniqueness alone can't block a
    // same-manager "recreate"; it's the update rule's immutable-keys guard
    // that must hold even for a full-document setDoc, not just updateDoc.
    // (The actual race-safety for concurrent creates is a client-side
    // transaction in schoolClassService.ts, not something rules can express.)
    await assertFails(
      setDoc(doc(as("manager1"), "school_classes/centerA_5_A"), {
        centerId: "centerA", grade: "9", section: "Z", displayName: "9-Z", studentIds: [], createdAt: 0, createdBy: "manager1",
      }),
    );
  });

  it("denies a pending center's manager from creating a School Class", async () => {
    await assertFails(
      setDoc(doc(as("pendingMgr"), "school_classes/centerP_1_A"), {
        centerId: "centerP", grade: "1", section: "A", displayName: "1-A", studentIds: [], createdAt: 0, createdBy: "pendingMgr",
      }),
    );
  });

  it("denies a foreign manager stamping another center's centerId", async () => {
    await assertFails(
      setDoc(doc(as("managerB"), "school_classes/centerA_7_A"), {
        centerId: "centerA", grade: "7", section: "A", displayName: "7-A", studentIds: [], createdAt: 0, createdBy: "managerB",
      }),
    );
  });
});

describe("SCHOOL_CLASSES — update", () => {
  it("allows the owning manager to update studentIds", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "school_classes/centerA_5_A"), { studentIds: ["student1"] }),
    );
  });

  it("denies changing grade/section/centerId (immutable after create)", async () => {
    await assertFails(
      updateDoc(doc(as("manager1"), "school_classes/centerA_5_A"), { section: "B" }),
    );
    await assertFails(
      updateDoc(doc(as("manager1"), "school_classes/centerA_5_A"), { grade: "6" }),
    );
    await assertFails(
      updateDoc(doc(as("manager1"), "school_classes/centerA_5_A"), { centerId: "centerB" }),
    );
  });

  it("SECURITY: denies a foreign manager updating another center's School Class", async () => {
    await assertFails(
      updateDoc(doc(as("managerB"), "school_classes/centerA_5_A"), { studentIds: ["hijacked"] }),
    );
  });
});

describe("SCHOOL_CLASSES — delete", () => {
  it("allows the owning manager to delete", async () => {
    await assertSucceeds(deleteDoc(doc(as("manager1"), "school_classes/centerA_5_A")));
  });

  it("denies a foreign manager from deleting another center's School Class", async () => {
    await assertFails(deleteDoc(doc(as("managerB"), "school_classes/centerA_5_A")));
  });
});

describe("SCHOOL_CLASSES — read", () => {
  it("allows any authenticated user to read (matches classes' own read rule)", async () => {
    await assertSucceeds(getDoc(doc(as("managerB"), "school_classes/centerA_5_A")));
  });
});
