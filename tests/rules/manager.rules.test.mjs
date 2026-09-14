/**
 * Manager-permission rules tests (docs/MANAGER.md). Run with: npm run test:rules
 *
 * Covers the full manager surface: the add-teacher FLOW (existence-check get
 * before create — the read that used to be denied and broke the whole flow),
 * viewing classes (teacher-anchored membership queries), group editing /
 * teacher reassignment (including the fixed cross-center hijack hole), and
 * the approval gate (pending centers can read but never write).
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

// manager1 owns ACTIVE centerA (teacher1 linked). managerB owns ACTIVE centerB
// (teacherB linked). pendingMgr owns PENDING centerP. freeTeacher is linked
// nowhere. class1 belongs to centerA via teacher1; classFree to freeTeacher.
const SEED = {
  "users/manager1": { uid: "manager1", role: "manager", username: "manager1", centerId: "centerA" },
  "users/managerB": { uid: "managerB", role: "manager", username: "managerb", centerId: "centerB" },
  "users/pendingMgr": { uid: "pendingMgr", role: "manager", username: "pendingmgr", centerId: "centerP" },
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1" },
  "users/teacher2": { uid: "teacher2", role: "teacher", username: "teacher2" },
  "users/teacherB": { uid: "teacherB", role: "teacher", username: "teacherb" },
  "users/freeTeacher": { uid: "freeTeacher", role: "teacher", username: "freeteacher" },
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 0 },
  "centers/centerA": { id: "centerA", ownerUid: "manager1", status: "active", name: "Center A" },
  "centers/centerB": { id: "centerB", ownerUid: "managerB", status: "active", name: "Center B" },
  "centers/centerP": { id: "centerP", ownerUid: "pendingMgr", status: "pending", name: "Center P" },
  "center_teachers/teacher1": { centerId: "centerA", teacherId: "teacher1", teacherName: "Teacher One", teacherEmail: "t1@x.uz" },
  "center_teachers/teacher2": { centerId: "centerA", teacherId: "teacher2", teacherName: "Teacher Two", teacherEmail: "t2@x.uz" },
  "center_teachers/teacherB": { centerId: "centerB", teacherId: "teacherB", teacherName: "Teacher B", teacherEmail: "tb@x.uz" },
  "classes/class1": { teacherId: "teacher1", teacherName: "Teacher One", title: "Class 1", studentIds: ["student1"], centerId: "centerA" },
  "classes/classFree": { teacherId: "freeTeacher", teacherName: "Free Teacher", title: "Independent", studentIds: [], centerId: "" },
  // teacher1 is LINKED to centerA, but this group is personal (no centerId) —
  // under centerId-anchored membership it must stay outside the center.
  "classes/personal1": { teacherId: "teacher1", teacherName: "Teacher One", title: "Personal Group", studentIds: [] },
  // A center group whose teacher was later removed from the center (orphan).
  "classes/orphan1": { teacherId: "formerTeacher", teacherName: "Former Teacher", title: "Orphan Group", studentIds: [], centerId: "centerA" },
};

before(async () => {
  // NOTE: node --test runs test FILES in parallel; a distinct projectId keeps
  // this suite's clearFirestore() from wiping the other file's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-manager",
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

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — add teacher (the exact page flow: existence-check get, then create)", () => {
  it("allows the existence-check GET on a not-yet-linked teacher (resource == null)", async () => {
    // This read used to be DENIED (rule dereferenced resource.data on a missing
    // doc), which killed the whole add-teacher flow before the write.
    await assertSucceeds(getDoc(doc(as("manager1"), "center_teachers/freeTeacher")));
  });

  it("allows the full add-teacher flow: get (missing) then create the link", async () => {
    const db = as("manager1");
    const ref = doc(db, "center_teachers/freeTeacher");
    const snap = await getDoc(ref); // membership check
    await assertSucceeds(
      setDoc(ref, {
        centerId: "centerA",
        teacherId: "freeTeacher",
        teacherName: "Free Teacher",
        teacherEmail: "free@x.uz",
      }),
    );
    if (snap.exists()) throw new Error("seed error: freeTeacher should start unlinked");
  });

  it("denies GET on a teacher linked to ANOTHER center (client maps this to 'linked elsewhere')", async () => {
    await assertFails(getDoc(doc(as("manager1"), "center_teachers/teacherB")));
  });

  it("denies creating a link whose doc id ≠ teacherId field", async () => {
    await assertFails(
      setDoc(doc(as("manager1"), "center_teachers/freeTeacher"), {
        centerId: "centerA",
        teacherId: "someoneElse",
      }),
    );
  });

  it("denies stealing a teacher already linked to another center (overwrite = update path)", async () => {
    await assertFails(
      setDoc(doc(as("manager1"), "center_teachers/teacherB"), {
        centerId: "centerA",
        teacherId: "teacherB",
      }),
    );
  });

  it("allows the manager to UPDATE their teacher's link doc (edit teacher info / salary)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "center_teachers/teacher1"), {
        teacherName: "Renamed Teacher",
        salary: { type: "fixed", amount: 3000000 },
      }),
    );
  });

  it("allows the manager to REMOVE a teacher from the center", async () => {
    await assertSucceeds(deleteDoc(doc(as("manager1"), "center_teachers/teacher1")));
  });

  it("denies a foreign manager updating/deleting centerA's teacher link", async () => {
    await assertFails(
      updateDoc(doc(as("managerB"), "center_teachers/teacher1"), { teacherName: "x" }),
    );
    await assertFails(deleteDoc(doc(as("managerB"), "center_teachers/teacher1")));
  });

  it("APPROVAL GATE: a pending-center manager cannot add a teacher", async () => {
    await assertFails(
      setDoc(doc(as("pendingMgr"), "center_teachers/freeTeacher"), {
        centerId: "centerP",
        teacherId: "freeTeacher",
      }),
    );
  });

  it("allows a teacher to read their own link doc", async () => {
    await assertSucceeds(getDoc(doc(as("teacher1"), "center_teachers/teacher1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — viewing classes (centerId-anchored membership)", () => {
  it("allows listing center_teachers filtered by own centerId (teachers roster)", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("manager1"), "center_teachers"), where("centerId", "==", "centerA"))),
    );
  });

  it("denies listing ANOTHER center's teachers", async () => {
    await assertFails(
      getDocs(query(collection(as("managerB"), "center_teachers"), where("centerId", "==", "centerA"))),
    );
  });

  it("allows querying classes by centerId (useCenterClasses)", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("manager1"), "classes"), where("centerId", "==", "centerA"))),
    );
  });

  it("PENDING center can still READ (list its teachers) — gate blocks writes only", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("pendingMgr"), "center_teachers"), where("centerId", "==", "centerP"))),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — groups (create / edit / roster / reassign / delete)", () => {
  it("allows creating a group (CreateGroupModal shape)", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager1"), "classes/newClass"), {
        title: "New Group",
        description: "",
        joinCode: "ABC123",
        centerId: "centerA",
        teacherId: "teacher1",
        teacherName: "Teacher One",
        studentIds: [],
        studentCount: 0,
        isLocked: false,
      }),
    );
  });

  it("allows editing title / monthlyFee / schedule of an own-center class", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/class1"), {
        title: "Renamed",
        monthlyFee: 500000,
        schedule: [{ dayOfWeek: 1, startTime: "10:00", endTime: "11:30" }],
      }),
    );
  });

  it("allows roster management: add and remove arbitrary students", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/class1"), { studentIds: ["student1", "student2"] }),
    );
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/class1"), { studentIds: [] }),
    );
  });

  it("allows reassigning the class to another teacher WITHIN the center", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/class1"), {
        teacherId: "teacher2",
        teacherName: "Teacher Two",
      }),
    );
  });

  it("denies reassigning the class to an OUT-OF-CENTER teacher", async () => {
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/class1"), {
        teacherId: "teacherB",
        teacherName: "Teacher B",
      }),
    );
  });

  it("SECURITY: denies a foreign manager hijacking a class by assigning their own teacher", async () => {
    // Reproduces the old hole: branch 3 checked only the NEW teacher, so any
    // active manager could graft their teacher onto ANY class and own it.
    await assertFails(
      updateDoc(doc(as("managerB"), "classes/class1"), {
        teacherId: "teacherB",
        teacherName: "Teacher B",
      }),
    );
    await assertFails(
      updateDoc(doc(as("managerB"), "classes/classFree"), {
        teacherId: "teacherB",
        teacherName: "Teacher B",
      }),
    );
  });

  it("denies a manager editing a class whose teacher is NOT linked to their center", async () => {
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/classFree"), { title: "grabbed" }),
    );
  });

  it("allows deleting an own-center class; denies deleting a foreign one", async () => {
    await assertSucceeds(deleteDoc(doc(as("manager1"), "classes/class1")));
    await assertFails(deleteDoc(doc(as("managerB"), "classes/classFree")));
  });

  it("teacher can edit their PERSONAL group but NOT the center group doc (2026-07-19 lock)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("teacher1"), "classes/personal1"), { title: "Teacher edit" }),
    );
    // Center group: name/roster/code/lock are manager-only now.
    await assertFails(
      updateDoc(doc(as("teacher1"), "classes/class1"), { title: "Teacher edit" }),
    );
  });

  it("APPROVAL GATE: pending-center manager cannot edit even their own center's class", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "center_teachers/pTeacher"), {
        centerId: "centerP",
        teacherId: "pTeacher",
      });
      await setDoc(doc(ctx.firestore(), "classes/pClass"), {
        teacherId: "pTeacher",
        title: "P Class",
        studentIds: [],
        centerId: "centerP",
      });
    });
    await assertFails(
      updateDoc(doc(as("pendingMgr"), "classes/pClass"), { title: "nope" }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — centerId-anchored membership (a teacher's personal groups stay OUT)", () => {
  it("KEY: denies the manager editing a LINKED teacher's personal group", async () => {
    // teacher1 is in centerA, but personal1 has no centerId — not the center's.
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/personal1"), { title: "grabbed" }),
    );
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/personal1"), { studentIds: ["student1"] }),
    );
    await assertFails(deleteDoc(doc(as("manager1"), "classes/personal1")));
  });

  it("denies a teacher stamping a centerId onto their personal group", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "classes/personal1"), { centerId: "centerA" }),
    );
  });

  it("denies the manager moving a group to another center or clearing centerId", async () => {
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/class1"), { centerId: "centerB" }),
    );
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/class1"), { centerId: "" }),
    );
  });

  it("CREATE: manager and linked teacher may stamp their centerId; strangers may not", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager1"), "classes/newCenterClass"), {
        title: "New", teacherId: "teacher1", teacherName: "Teacher One",
        studentIds: [], centerId: "centerA",
      }),
    );
    await assertSucceeds(
      setDoc(doc(as("teacher1"), "classes/newTeacherClass"), {
        title: "New", teacherId: "teacher1", teacherName: "Teacher One",
        studentIds: [], centerId: "centerA",
      }),
    );
    await assertFails(
      setDoc(doc(as("student1"), "classes/injected"), {
        title: "Injected", teacherId: "student1", studentIds: [], centerId: "centerA",
      }),
    );
    await assertFails(
      setDoc(doc(as("managerB"), "classes/injectedB"), {
        title: "Injected", teacherId: "teacherB", studentIds: [], centerId: "centerA",
      }),
    );
  });

  it("CREATE: a personal class without centerId stays open to any teacher (unchanged)", async () => {
    await assertSucceeds(
      setDoc(doc(as("freeTeacher"), "classes/newPersonal"), {
        title: "Mine", teacherId: "freeTeacher", studentIds: [],
      }),
    );
  });

  it("ORPHAN: manager keeps managing a center group after its teacher left the center", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/orphan1"), { title: "Still ours" }),
    );
    // …including reassigning it to a CURRENT center teacher…
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/orphan1"), {
        teacherId: "teacher2", teacherName: "Teacher Two",
      }),
    );
    // …but not to an out-of-center teacher.
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/orphan1"), {
        teacherId: "teacherB", teacherName: "Teacher B",
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — center_teacher_credentials (manager-visible passwords)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "center_teacher_credentials/teacher1"), {
        centerId: "centerA",
        teacherId: "teacher1",
        password: "Karimov4821",
      });
    });
  });

  it("allows the owning center's manager to read the password", async () => {
    await assertSucceeds(getDoc(doc(as("manager1"), "center_teacher_credentials/teacher1")));
  });

  it("allows GET on a missing credentials doc (link-only teacher, no throw)", async () => {
    await assertSucceeds(getDoc(doc(as("manager1"), "center_teacher_credentials/teacher2")));
  });

  it("denies a FOREIGN manager reading another center's credentials", async () => {
    await assertFails(getDoc(doc(as("managerB"), "center_teacher_credentials/teacher1")));
  });

  it("denies the TEACHER reading their own credentials doc", async () => {
    await assertFails(getDoc(doc(as("teacher1"), "center_teacher_credentials/teacher1")));
  });

  it("denies a student/stranger reading credentials", async () => {
    await assertFails(getDoc(doc(as("student1"), "center_teacher_credentials/teacher1")));
  });

  it("denies ALL client writes — even by the owning manager (API-only)", async () => {
    await assertFails(
      updateDoc(doc(as("manager1"), "center_teacher_credentials/teacher1"), { password: "NewPass123" }),
    );
    await assertFails(
      setDoc(doc(as("manager1"), "center_teacher_credentials/freeTeacher"), {
        centerId: "centerA",
        teacherId: "freeTeacher",
        password: "Whatever123",
      }),
    );
    await assertFails(deleteDoc(doc(as("manager1"), "center_teacher_credentials/teacher1")));
  });

  it("allows the manager to LIST credentials filtered by own centerId", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("manager1"), "center_teacher_credentials"), where("centerId", "==", "centerA"))),
    );
  });

  it("denies listing another center's credentials", async () => {
    await assertFails(
      getDocs(query(collection(as("managerB"), "center_teacher_credentials"), where("centerId", "==", "centerA"))),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — center_students roster (multi-center student links)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "center_students/centerA_student1"), {
        centerId: "centerA",
        studentId: "student1",
        studentName: "Student One",
      });
    });
  });

  it("allows the manager to link a student (doc id = centerId_studentId)", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager1"), "center_students/centerA_newkid"), {
        centerId: "centerA",
        studentId: "newkid",
        studentName: "New Kid",
      }),
    );
  });

  it("denies a link whose doc id doesn't match centerId_studentId", async () => {
    await assertFails(
      setDoc(doc(as("manager1"), "center_students/wrongid"), {
        centerId: "centerA",
        studentId: "newkid",
      }),
    );
  });

  it("denies a foreign manager creating/deleting centerA links", async () => {
    await assertFails(
      setDoc(doc(as("managerB"), "center_students/centerA_victim"), {
        centerId: "centerA",
        studentId: "victim",
      }),
    );
    await assertFails(deleteDoc(doc(as("managerB"), "center_students/centerA_student1")));
  });

  it("MULTI-CENTER: two centers may link the SAME student independently", async () => {
    await assertSucceeds(
      setDoc(doc(as("managerB"), "center_students/centerB_student1"), {
        centerId: "centerB",
        studentId: "student1",
      }),
    );
  });

  it("allows the manager to list their roster and remove a student", async () => {
    await assertSucceeds(
      getDocs(query(collection(as("manager1"), "center_students"), where("centerId", "==", "centerA"))),
    );
    await assertSucceeds(deleteDoc(doc(as("manager1"), "center_students/centerA_student1")));
  });

  it("allows the student to read their own links (get + 'my centers' list)", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "center_students/centerA_student1")));
    await assertSucceeds(
      getDocs(query(collection(as("student1"), "center_students"), where("studentId", "==", "student1"))),
    );
  });

  it("denies a stranger listing a center's roster or reading another's link", async () => {
    await assertFails(
      getDocs(query(collection(as("teacherB"), "center_students"), where("centerId", "==", "centerA"))),
    );
    await assertFails(getDoc(doc(as("teacherB"), "center_students/centerA_student1")));
  });

  it("allows GET on a missing link (existence probe before add)", async () => {
    await assertSucceeds(getDoc(doc(as("manager1"), "center_students/centerA_ghost")));
  });

  it("APPROVAL GATE: pending-center manager cannot link students", async () => {
    await assertFails(
      setDoc(doc(as("pendingMgr"), "center_students/centerP_student1"), {
        centerId: "centerP",
        studentId: "student1",
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — center_student_credentials (manager-visible passwords)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "center_student_credentials/student1"), {
        centerId: "centerA",
        studentId: "student1",
        password: "Aliyev7412",
      });
    });
  });

  it("allows only the owning center's manager to read; missing doc doesn't throw", async () => {
    await assertSucceeds(getDoc(doc(as("manager1"), "center_student_credentials/student1")));
    await assertSucceeds(getDoc(doc(as("manager1"), "center_student_credentials/ghost")));
  });

  it("denies the student, a foreign manager, and ALL client writes", async () => {
    await assertFails(getDoc(doc(as("student1"), "center_student_credentials/student1")));
    await assertFails(getDoc(doc(as("managerB"), "center_student_credentials/student1")));
    await assertFails(
      updateDoc(doc(as("manager1"), "center_student_credentials/student1"), { password: "Hacked123" }),
    );
    await assertFails(deleteDoc(doc(as("manager1"), "center_student_credentials/student1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("MANAGER — attendance page membership check (orphaned class)", () => {
  it("allows the single-doc GET on a missing center_teachers link (orphan check)", async () => {
    // app/manager/attendance/[classId]/page.tsx getDoc's the class teacher's
    // link doc; for an orphaned class the doc is missing → must not throw.
    await assertSucceeds(getDoc(doc(as("manager1"), "center_teachers/freeTeacher")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-07-19: center groups are MANAGER-RUN on the teacher side. The teacher
// keeps subcollections (assignments/exams/materials) but cannot touch the
// class DOC itself: no roster changes, no rename/lock/joinCode, no delete.
// Students cannot self-join a center group (join requests blocked at create),
// but self-LEAVE stays allowed — the account-deletion flow arrayRemoves the
// uid from every class and must not break.
describe("TEACHER — center groups are manager-run (roster/settings/delete lock)", () => {
  it("denies the teacher ADDING a student to their center group (AddStudentModal path)", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "classes/class1"), { studentIds: ["student1", "student2"] }),
    );
  });

  it("denies the teacher REMOVING a student from their center group (RosterTab path)", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "classes/class1"), { studentIds: [] }),
    );
  });

  it("allows the teacher to manage the roster of their PERSONAL group (unchanged)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("teacher1"), "classes/personal1"), { studentIds: ["student1"] }),
    );
    await assertSucceeds(
      updateDoc(doc(as("teacher1"), "classes/personal1"), { studentIds: [] }),
    );
  });

  it("denies the teacher changing joinCode / isLocked / title on a center group", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "classes/class1"), { joinCode: "HAX123" }),
    );
    await assertFails(
      updateDoc(doc(as("teacher1"), "classes/class1"), { isLocked: true }),
    );
  });

  it("denies the teacher DELETING their center group; personal delete still works", async () => {
    await assertFails(deleteDoc(doc(as("teacher1"), "classes/class1")));
    await assertSucceeds(deleteDoc(doc(as("teacher1"), "classes/personal1")));
  });

  it("manager still fully manages the center group roster (control)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/class1"), { studentIds: ["student1", "student2"] }),
    );
  });

  it("denies a student SELF-JOINING a center group; personal self-join still allowed", async () => {
    await assertFails(
      updateDoc(doc(as("student1"), "classes/class1"), { studentIds: ["student1", "student1b"] }),
    );
    // (fixture note: student1 is already in class1 — try a fresh student)
    await assertFails(
      updateDoc(doc(as("student2"), "classes/class1"), { studentIds: ["student1", "student2"] }),
    );
    await assertSucceeds(
      updateDoc(doc(as("student1"), "classes/classFree"), { studentIds: ["student1"] }),
    );
  });

  it("allows a student SELF-LEAVING a center group (account-deletion flow must survive)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("student1"), "classes/class1"), { studentIds: [] }),
    );
  });

  it("denies creating a join REQUEST under a center group; personal group still open", async () => {
    await assertFails(
      setDoc(doc(as("student2"), "classes/class1/requests/req1"), {
        studentId: "student2", studentName: "S2",
      }),
    );
    await assertSucceeds(
      setDoc(doc(as("student2"), "classes/classFree/requests/req1"), {
        studentId: "student2", studentName: "S2",
      }),
    );
  });

  it("allows the teacher to GET their own center_teachers link (useTeacherCenter hook)", async () => {
    // The hook does getDoc(center_teachers/{ownUid}) — docId == teacherId, so
    // the get branch proves it without a query (the old where('teacherId'==)
    // list was NOT provable and failed silently).
    await assertSucceeds(getDoc(doc(as("teacher1"), "center_teachers/teacher1")));
    await assertSucceeds(getDoc(doc(as("freeTeacher"), "center_teachers/freeTeacher")));
  });
});
