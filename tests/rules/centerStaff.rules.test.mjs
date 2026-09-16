/**
 * Office-staff (director / buxgalter) rules tests — docs/OFFICE.md.
 * Run with: npm run test:rules
 *
 * The thing under test is the boundary: `center_staff/{uid}` is the ONLY thing
 * that grants a director or an accountant read access to a center's money, and
 * nothing a client can write may produce that grant. So the suite covers
 *
 *   1. the happy path (office staff read their own center's finance),
 *   2. cross-center isolation (they see NOTHING of another center),
 *   3. the escalation attempts that would break the model — self-writing a
 *      center_staff link, or painting `role: 'director'` onto one's own user doc,
 *   4. the collections staying WRITE-CLOSED to office staff (money is API-only),
 *   5. the manager's ability to see (but never create) their center's office staff.
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

// manager1 owns ACTIVE centerA. director1 + accountant1 are office staff of
// centerA; directorB is office staff of centerB (managerB's). outsider has an
// office-shaped USER doc but NO center_staff link — the attacker case.
const SEED = {
  "users/manager1": { uid: "manager1", role: "manager", username: "manager1", centerId: "centerA" },
  "users/managerB": { uid: "managerB", role: "manager", username: "managerb", centerId: "centerB" },
  "users/director1": { uid: "director1", role: "director", username: "director1", centerId: "centerA" },
  "users/accountant1": { uid: "accountant1", role: "accountant", username: "accountant1", centerId: "centerA" },
  "users/directorB": { uid: "directorB", role: "director", username: "directorb", centerId: "centerB" },
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  // The attacker: claims the role on their own (client-writable) user doc, but
  // has no center_staff link. Must be treated as a nobody.
  "users/outsider": { uid: "outsider", role: "director", username: "outsider", centerId: "centerA" },

  "centers/centerA": { id: "centerA", ownerUid: "manager1", status: "active", name: "Center A" },
  "centers/centerB": { id: "centerB", ownerUid: "managerB", status: "active", name: "Center B" },

  "center_staff/director1": { uid: "director1", centerId: "centerA", staffRole: "director", name: "Director One", email: "d1@edify.uz", username: "director1" },
  "center_staff/accountant1": { uid: "accountant1", centerId: "centerA", staffRole: "accountant", name: "Buxgalter One", email: "a1@edify.uz", username: "accountant1" },
  "center_staff/directorB": { uid: "directorB", centerId: "centerB", staffRole: "director", name: "Director B", email: "db@edify.uz", username: "directorb" },

  "center_teachers/teacher1": { centerId: "centerA", teacherId: "teacher1", teacherName: "Teacher One", teacherEmail: "t1@x.uz" },

  // One document in every money collection, for both centers where it matters.
  "center_finance_settings/centerA": { centerId: "centerA", billingAnchor: "calendar", percentBase: "collected", expenseCategories: ["rent"] },
  "center_charges/c1": { centerId: "centerA", classId: "class1", studentId: "student1", amount: 400000, paidAmount: 0, status: "pending", dueDate: "2026-09-05", periodKey: "2026-09" },
  "center_charges/cB": { centerId: "centerB", classId: "classB", studentId: "studentB", amount: 500000, paidAmount: 0, status: "pending", dueDate: "2026-09-05", periodKey: "2026-09" },
  "center_payments/p1": { centerId: "centerA", studentId: "student1", amount: 400000, type: "payment", status: "confirmed", paidAt: "2026-09-03" },
  "center_payments/pB": { centerId: "centerB", studentId: "studentB", amount: 100000, type: "payment", status: "confirmed", paidAt: "2026-09-03" },
  "center_expenses/e1": { centerId: "centerA", category: "rent", amount: 2000000, date: "2026-09-01", status: "active" },
  "center_payouts/teacher1_2026-09": { centerId: "centerA", teacherId: "teacher1", periodKey: "2026-09", finalAmount: 3000000, status: "approved" },
  "center_student_finance/centerA_student1": { centerId: "centerA", studentId: "student1", balance: -400000, financeStatus: "active" },
};

before(async () => {
  // node --test runs test FILES in parallel; a distinct projectId keeps this
  // suite's clearFirestore() from wiping another file's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-office",
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
describe("OFFICE — the link doc is the boundary", () => {
  it("lets office staff read their OWN link (the layout's guard)", async () => {
    await assertSucceeds(getDoc(doc(as("director1"), "center_staff/director1")));
    await assertSucceeds(getDoc(doc(as("accountant1"), "center_staff/accountant1")));
  });

  it("denies reading SOMEONE ELSE'S link", async () => {
    await assertFails(getDoc(doc(as("director1"), "center_staff/directorB")));
    await assertFails(getDoc(doc(as("teacher1"), "center_staff/director1")));
  });

  it("lets the center's manager see who has office access", async () => {
    await assertSucceeds(getDoc(doc(as("manager1"), "center_staff/director1")));
    await assertSucceeds(
      getDocs(query(collection(as("manager1"), "center_staff"), where("centerId", "==", "centerA"))),
    );
  });

  it("denies a manager listing ANOTHER center's office staff", async () => {
    await assertFails(
      getDocs(query(collection(as("manager1"), "center_staff"), where("centerId", "==", "centerB"))),
    );
  });

  it("denies an unfiltered center_staff list to everyone", async () => {
    await assertFails(getDocs(collection(as("manager1"), "center_staff")));
    await assertFails(getDocs(collection(as("director1"), "center_staff")));
  });
});

describe("OFFICE — nobody can mint themselves access (escalation)", () => {
  it("denies a user creating their OWN center_staff link", async () => {
    await assertFails(
      setDoc(doc(as("outsider"), "center_staff/outsider"), {
        uid: "outsider",
        centerId: "centerA",
        staffRole: "director",
        name: "Outsider",
      }),
    );
  });

  it("denies even the center MANAGER creating an office link (super-admin only)", async () => {
    await assertFails(
      setDoc(doc(as("manager1"), "center_staff/teacher1"), {
        uid: "teacher1",
        centerId: "centerA",
        staffRole: "director",
        name: "Teacher One",
      }),
    );
  });

  it("denies updating or deleting an existing link", async () => {
    await assertFails(updateDoc(doc(as("director1"), "center_staff/director1"), { staffRole: "accountant" }));
    await assertFails(deleteDoc(doc(as("manager1"), "center_staff/director1")));
  });

  it("`role: director` on one's OWN user doc grants nothing", async () => {
    // outsider's seeded user doc already claims role 'director' + centerId
    // centerA. Every finance read must still be denied — this is the whole
    // reason authorization is anchored on center_staff and not users.role.
    await assertFails(getDoc(doc(as("outsider"), "center_charges/c1")));
    await assertFails(
      getDocs(query(collection(as("outsider"), "center_payments"), where("centerId", "==", "centerA"))),
    );
    await assertFails(getDoc(doc(as("outsider"), "center_finance_settings/centerA")));
  });

  it("denies a student writing role:'director' onto their own user doc", async () => {
    // The privileged-field denylist already covers `role`; asserted here too so
    // the office roles can never be reached through the create/update path.
    await assertFails(updateDoc(doc(as("student1"), "users/student1"), { role: "director" }));
  });

  it("denies the credentials collection to every client", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "center_staff_credentials/director1"), {
        uid: "director1",
        centerId: "centerA",
        password: "Secret123",
      });
    });
    await assertFails(getDoc(doc(as("director1"), "center_staff_credentials/director1")));
    await assertFails(getDoc(doc(as("manager1"), "center_staff_credentials/director1")));
  });
});

describe("OFFICE — money READS for the director and the buxgalter", () => {
  for (const uid of ["director1", "accountant1"]) {
    it(`${uid} reads their center's finance settings, charges, payments, expenses, payouts, profiles`, async () => {
      const db = as(uid);
      await assertSucceeds(getDoc(doc(db, "center_finance_settings/centerA")));
      await assertSucceeds(getDoc(doc(db, "center_charges/c1")));
      await assertSucceeds(getDoc(doc(db, "center_payments/p1")));
      await assertSucceeds(getDoc(doc(db, "center_expenses/e1")));
      await assertSucceeds(getDoc(doc(db, "center_payouts/teacher1_2026-09")));
      await assertSucceeds(getDoc(doc(db, "center_student_finance/centerA_student1")));
    });

    it(`${uid} can LIST each money collection filtered on their centerId`, async () => {
      const db = as(uid);
      for (const col of [
        "center_charges",
        "center_payments",
        "center_expenses",
        "center_payouts",
        "center_student_finance",
      ]) {
        await assertSucceeds(getDocs(query(collection(db, col), where("centerId", "==", "centerA"))));
      }
    });

    it(`${uid} can list their center's teacher roster`, async () => {
      await assertSucceeds(
        getDocs(query(collection(as(uid), "center_teachers"), where("centerId", "==", "centerA"))),
      );
    });
  }

  it("an unfiltered money list is still denied (iron rule #5 holds for office staff too)", async () => {
    await assertFails(getDocs(collection(as("director1"), "center_payments")));
    await assertFails(getDocs(collection(as("accountant1"), "center_charges")));
  });
});

describe("OFFICE — cross-center isolation", () => {
  it("denies centerA office staff every centerB money document", async () => {
    const db = as("director1");
    await assertFails(getDoc(doc(db, "center_charges/cB")));
    await assertFails(getDoc(doc(db, "center_payments/pB")));
    await assertFails(getDoc(doc(db, "center_finance_settings/centerB")));
  });

  it("denies centerA office staff a centerB-filtered list", async () => {
    await assertFails(
      getDocs(query(collection(as("director1"), "center_payments"), where("centerId", "==", "centerB"))),
    );
    await assertFails(
      getDocs(query(collection(as("accountant1"), "center_charges"), where("centerId", "==", "centerB"))),
    );
  });

  it("denies centerB's director everything in centerA", async () => {
    await assertFails(getDoc(doc(as("directorB"), "center_charges/c1")));
    await assertFails(
      getDocs(query(collection(as("directorB"), "center_expenses"), where("centerId", "==", "centerA"))),
    );
  });
});

describe("OFFICE — money stays WRITE-CLOSED to every client", () => {
  // The accountant's ability to record a payment comes from the API route
  // (Admin SDK + requireCenterOffice), never from rules. If these ever start
  // passing, the client can write money directly and FINANCE.md iron rule #4
  // is broken.
  it("denies the accountant creating a payment document directly", async () => {
    await assertFails(
      setDoc(doc(as("accountant1"), "center_payments/hack"), {
        centerId: "centerA",
        studentId: "student1",
        amount: 999999,
        type: "payment",
        status: "confirmed",
        paidAt: "2026-09-15",
      }),
    );
  });

  it("denies the accountant creating an expense document directly", async () => {
    await assertFails(
      setDoc(doc(as("accountant1"), "center_expenses/hack"), {
        centerId: "centerA",
        category: "rent",
        amount: 1,
        date: "2026-09-15",
        status: "active",
      }),
    );
  });

  it("denies office staff editing or cancelling existing money docs", async () => {
    await assertFails(updateDoc(doc(as("accountant1"), "center_charges/c1"), { amount: 1 }));
    await assertFails(updateDoc(doc(as("director1"), "center_payments/p1"), { status: "cancelled" }));
    await assertFails(deleteDoc(doc(as("accountant1"), "center_expenses/e1")));
    await assertFails(updateDoc(doc(as("director1"), "center_payouts/teacher1_2026-09"), { status: "paid" }));
    await assertFails(setDoc(doc(as("accountant1"), "center_finance_settings/centerA"), { centerId: "centerA" }));
  });
});

describe("OFFICE — everyone else is unaffected", () => {
  it("still denies a teacher and a student the center's money", async () => {
    await assertFails(getDoc(doc(as("teacher1"), "center_payments/p1")));
    await assertFails(getDoc(doc(as("student1"), "center_charges/c1")));
    await assertFails(
      getDocs(query(collection(as("teacher1"), "center_expenses"), where("centerId", "==", "centerA"))),
    );
  });

  it("still denies anonymous callers everything", async () => {
    await assertFails(getDoc(doc(anon(), "center_charges/c1")));
    await assertFails(getDoc(doc(anon(), "center_staff/director1")));
  });

  it("the MANAGER's own finance access is untouched", async () => {
    const db = as("manager1");
    await assertSucceeds(getDoc(doc(db, "center_charges/c1")));
    await assertSucceeds(getDoc(doc(db, "center_finance_settings/centerA")));
    await assertSucceeds(
      getDocs(query(collection(db, "center_payments"), where("centerId", "==", "centerA"))),
    );
  });

  it("a teacher can still read their OWN center_teachers link", async () => {
    await assertSucceeds(getDoc(doc(as("teacher1"), "center_teachers/teacher1")));
  });
});
