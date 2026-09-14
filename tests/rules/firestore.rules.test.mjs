/**
 * Security-rules tests (docs/AUTH.md). Run with: npm run test:rules
 *
 * Two halves, and BOTH matter:
 *   1. "attack" blocks — each one reproduces a real privilege-escalation path.
 *   2. "legit flow" blocks — regression guards proving the lockdown did not
 *      break anything the live app actually does. Never tighten a rule without
 *      adding the corresponding legit-flow test first.
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

// Seed identities. manager1 owns centerA; attacker is a plain student.
const SEED = {
  "users/student1": { uid: "student1", role: "student", username: "student1", totalXP: 100 },
  "users/teacher1": { uid: "teacher1", role: "teacher", username: "teacher1", verifiedTeacher: false },
  "users/manager1": { uid: "manager1", role: "manager", username: "manager1", centerId: "centerA" },
  "users/attacker": { uid: "attacker", role: "student", username: "attacker", totalXP: 0 },
  "centers/centerA": { id: "centerA", ownerUid: "manager1", status: "active", name: "Center A" },
  "classes/class1": { teacherId: "teacher1", title: "Class 1", studentIds: ["student1"] },
  "usernames/student1": { uid: "student1" },
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules",
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
describe("CRITICAL 1 — self-promotion to manager of someone else's center", () => {
  it("denies a student writing role+centerId onto their own user doc", async () => {
    await assertFails(
      updateDoc(doc(as("attacker"), "users/attacker"), {
        role: "manager",
        centerId: "centerA",
      }),
    );
  });

  it("denies the same escalation via delete-then-recreate", async () => {
    const db = as("attacker");
    await assertSucceeds(deleteDoc(doc(db, "users/attacker")));
    await assertFails(
      setDoc(doc(db, "users/attacker"), {
        uid: "attacker",
        role: "manager",
        centerId: "centerA",
        subscription: { planId: "premium" },
      }),
    );
  });

  it("denies a non-owner writing center_teachers for a center they don't own", async () => {
    await assertFails(
      setDoc(doc(as("attacker"), "center_teachers/attacker"), {
        centerId: "centerA",
        teacherId: "attacker",
      }),
    );
  });

  it("denies a center owner self-approving a pending center", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "centers/centerB"), {
        id: "centerB",
        ownerUid: "attacker",
        status: "pending",
      });
    });
    await assertFails(
      updateDoc(doc(as("attacker"), "centers/centerB"), { status: "active" }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("CRITICAL 2 — teacher self-granting a paid plan / unlimited AI", () => {
  it("denies raising your own AI limit", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "users/teacher1"), {
        currentLimits: { monthlyAiQuestions: 999999 },
      }),
    );
  });

  it("denies resetting your own AI usage counter", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "users/teacher1"), {
        usage: { aiQuestionsUsed: 0 },
      }),
    );
  });

  it("denies granting yourself a paid subscription", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "users/teacher1"), {
        subscription: { planId: "premium", status: "active" },
      }),
    );
  });

  it("denies self-verifying as a teacher", async () => {
    await assertFails(
      updateDoc(doc(as("teacher1"), "users/teacher1"), { verifiedTeacher: true }),
    );
  });

  it("denies creating an account that is born verified/premium", async () => {
    await assertFails(
      setDoc(doc(as("newuser"), "users/newuser"), {
        uid: "newuser",
        role: "teacher",
        verifiedTeacher: true,
        currentLimits: { monthlyAiQuestions: 999999 },
      }),
    );
  });

  it("denies un-banning yourself after moderation", async () => {
    await assertFails(
      updateDoc(doc(as("student1"), "users/student1"), { isActive: true }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("LEGIT FLOWS — must keep working after the lockdown", () => {
  it("allows student signup: user doc + username reservation", async () => {
    const db = as("newstudent");
    await assertSucceeds(
      setDoc(doc(db, "users/newstudent"), {
        uid: "newstudent",
        email: "s@x.uz",
        username: "newstudent",
        displayName: "New Student",
        role: "student",
        grade: "school_9",
        phone: "",
        location: { country: "Uzbekistan", region: "", district: "" },
        totalXP: 0,
        currentStreak: 0,
        level: 1,
        dailyHistory: {},
        progress: { completedTopicIndex: 0 },
        createdAt: new Date().toISOString(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "usernames/newstudent"), { uid: "newstudent" }),
    );
  });

  it("allows Google signup: same batch shape plus photoURL on create", async () => {
    const db = as("googleuser");
    await assertSucceeds(
      setDoc(doc(db, "users/googleuser"), {
        uid: "googleuser",
        email: "g@gmail.com",
        username: "googleuser",
        displayName: "Google User",
        photoURL: "https://lh3.googleusercontent.com/a/abc123",
        role: "student",
        grade: "school_9",
        totalXP: 0,
        currentStreak: 0,
        level: 1,
        dailyHistory: {},
        createdAt: new Date().toISOString(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "usernames/googleuser"), { uid: "googleuser" }),
    );
  });

  it("allows teacher signup (verifiedTeacher:false is fine)", async () => {
    await assertSucceeds(
      setDoc(doc(as("newteacher"), "users/newteacher"), {
        uid: "newteacher",
        role: "teacher",
        username: "newteacher",
        subject: "Math",
        grade: "Teacher",
        verifiedTeacher: false,
        experience: 0,
      }),
    );
  });

  it("allows manager signup: user doc + pending center", async () => {
    const db = as("newmanager");
    await assertSucceeds(
      setDoc(doc(db, "users/newmanager"), {
        uid: "newmanager",
        role: "manager",
        username: "newmanager",
        centerId: "centerNew",
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "centers/centerNew"), {
        id: "centerNew",
        name: "New Center",
        slug: "new-center",
        ownerUid: "newmanager",
        status: "pending",
      }),
    );
  });

  it("allows editing your own profile (displayName, bio, photoURL)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("student1"), "users/student1"), {
        displayName: "Renamed",
        bio: "hello",
        photoURL: null,
      }),
    );
  });

  it("allows setting your own dailyGoal", async () => {
    await assertSucceeds(
      updateDoc(doc(as("student1"), "users/student1"), { dailyGoal: 50 }),
    );
  });

  it("allows the XP submit transaction's user-doc write", async () => {
    // Mirrors app/(student)/classes/[classId]/test/[assignmentId]/page.tsx
    await assertSucceeds(
      setDoc(
        doc(as("student1"), "users/student1"),
        {
          totalXP: 150,
          currentStreak: 3,
          dailyHistory: { "2026-07-13": 50 },
          lastActiveDate: "2026-07-13",
          displayName: "Student One",
          email: "s1@x.uz",
          recentActivity: [{ id: "a1", score: 5 }],
        },
        { merge: true },
      ),
    );
  });

  it("allows the social follow ±1 counter write by another user", async () => {
    await assertSucceeds(
      updateDoc(doc(as("teacher1"), "users/student1"), { followersCount: 1 }),
    );
  });

  it("allows a center owner to edit name/slug/size", async () => {
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "centers/centerA"), { name: "Renamed Center" }),
    );
  });

  it("allows the real owner of an active center to add a teacher", async () => {
    await assertSucceeds(
      setDoc(doc(as("manager1"), "center_teachers/teacher1"), {
        centerId: "centerA",
        teacherId: "teacher1",
        teacherName: "Teacher One",
      }),
    );
  });

  // ⚠️ The real signup flows commit ONE ATOMIC writeBatch, and batched writes
  // change rules semantics: exists()/get() see the batch's post-commit state.
  // These tests mirror the app's exact batches — the per-setDoc tests above
  // cannot catch a rule that only breaks inside a batch.
  it("allows the student signup writeBatch (user + username + private contact)", async () => {
    const db = as("batchstudent");
    const batch = writeBatch(db);
    batch.set(doc(db, "users/batchstudent"), {
      uid: "batchstudent",
      email: "bs@x.uz",
      username: "batchstudent",
      displayName: "Batch Student",
      photoURL: "https://lh3.googleusercontent.com/a/abc123",
      role: "student",
      grade: "school_9",
      phone: "",
      birthDate: "",
      gender: "",
      institution: "",
      location: { country: "Uzbekistan", region: "", district: "" },
      totalXP: 0,
      currentStreak: 0,
      level: 1,
      dailyHistory: {},
      progress: { completedTopicIndex: 0, completedChapterIndex: 0, completedSubtopicIndex: 0 },
      createdAt: new Date().toISOString(),
    });
    batch.set(doc(db, "usernames/batchstudent"), { uid: "batchstudent" });
    batch.set(doc(db, "users/batchstudent/private/contact"), { email: "bs@x.uz", phone: "" });
    await assertSucceeds(batch.commit());
  });

  it("allows the teacher signup writeBatch", async () => {
    const db = as("batchteacher");
    const batch = writeBatch(db);
    batch.set(doc(db, "users/batchteacher"), {
      uid: "batchteacher",
      email: "bt@x.uz",
      username: "batchteacher",
      displayName: "Batch Teacher",
      photoURL: "https://lh3.googleusercontent.com/a/abc123",
      role: "teacher",
      subject: "matematika",
      phone: "",
      birthDate: "",
      gender: "",
      institution: "",
      location: { country: "Uzbekistan", region: "", district: "" },
      grade: "Teacher",
      verifiedTeacher: false,
      experience: 0,
      createdAt: new Date().toISOString(),
    });
    batch.set(doc(db, "usernames/batchteacher"), { uid: "batchteacher" });
    batch.set(doc(db, "users/batchteacher/private/contact"), { email: "bt@x.uz", phone: "" });
    await assertSucceeds(batch.commit());
  });

  it("allows the manager signup writeBatch (center + user + username + contact)", async () => {
    const db = as("batchmanager");
    const batch = writeBatch(db);
    batch.set(doc(db, "centers/centerBatch"), {
      id: "centerBatch",
      name: "Batch Center",
      slug: "batch-center",
      ownerUid: "batchmanager",
      size: "1-50",
      status: "pending",
      subscription: { plan: "free_trial", validUntil: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    });
    batch.set(doc(db, "users/batchmanager"), {
      uid: "batchmanager",
      email: "bm@x.uz",
      username: "batchmanager",
      displayName: "Batch Manager",
      phone: "+998901112233",
      role: "manager",
      centerId: "centerBatch",
      createdAt: new Date().toISOString(),
    });
    batch.set(doc(db, "usernames/batchmanager"), { uid: "batchmanager" });
    batch.set(doc(db, "users/batchmanager/private/contact"), { email: "bm@x.uz", phone: "+998901112233" });
    await assertSucceeds(batch.commit());
  });

  it("still denies the signup batch when the username is already taken", async () => {
    const db = as("batchthief");
    const batch = writeBatch(db);
    batch.set(doc(db, "users/batchthief"), {
      uid: "batchthief",
      username: "student1", // seeded as taken
      role: "student",
      totalXP: 0,
    });
    batch.set(doc(db, "usernames/student1"), { uid: "batchthief" });
    await assertFails(batch.commit());
  });

  it("keeps usernames readable (signup availability check) and immutable", async () => {
    await assertSucceeds(getDoc(doc(anon(), "usernames/student1")));
    await assertFails(
      updateDoc(doc(as("attacker"), "usernames/student1"), { uid: "attacker" }),
    );
  });

  it("still lets a super admin do anything (god mode)", async () => {
    const admin = testEnv
      .authenticatedContext("admin1", { super_admin: true })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(admin, "users/teacher1"), {
        verifiedTeacher: true,
        subscription: { planId: "premium" },
        isActive: false,
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PHASE 2 — class roster vandalism", () => {
  it("denies adding SOMEONE ELSE to a class you don't teach", async () => {
    await assertFails(
      updateDoc(doc(as("attacker"), "classes/class1"), {
        studentIds: ["student1", "victim"],
      }),
    );
  });

  it("denies wiping a class roster", async () => {
    await assertFails(
      updateDoc(doc(as("attacker"), "classes/class1"), { studentIds: [] }),
    );
  });

  it("denies kicking another student out while adding yourself", async () => {
    // The add half is legal on its own; the remove half is not. Both halves of
    // the diff are checked, so the whole write must fail.
    await assertFails(
      updateDoc(doc(as("attacker"), "classes/class1"), { studentIds: ["attacker"] }),
    );
  });

  it("allows a student to JOIN a class themselves (self-add)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("attacker"), "classes/class1"), {
        studentIds: ["student1", "attacker"],
      }),
    );
  });

  it("allows a student to LEAVE a class themselves (self-remove)", async () => {
    await assertSucceeds(
      updateDoc(doc(as("student1"), "classes/class1"), { studentIds: [] }),
    );
  });

  it("allows the class teacher to add and remove any student", async () => {
    await assertSucceeds(
      updateDoc(doc(as("teacher1"), "classes/class1"), {
        studentIds: ["student1", "attacker"],
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as("teacher1"), "classes/class1"), { studentIds: [] }),
    );
  });

  it("allows the center manager to manage a CENTER group's roster (centerId-anchored)", async () => {
    // Membership is classes.centerId (2026-07-15) — a linked teacher's
    // personal class1 (no centerId) is deliberately NOT manageable.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "center_teachers/teacher1"), {
        centerId: "centerA",
        teacherId: "teacher1",
      });
      await setDoc(doc(ctx.firestore(), "classes/centerClass"), {
        teacherId: "teacher1",
        title: "Center Group",
        studentIds: ["student1"],
        centerId: "centerA",
      });
    });
    await assertSucceeds(
      updateDoc(doc(as("manager1"), "classes/centerClass"), {
        studentIds: ["student1", "attacker"],
      }),
    );
    // The same teacher's personal class stays out of the manager's reach.
    await assertFails(
      updateDoc(doc(as("manager1"), "classes/class1"), {
        studentIds: ["student1", "attacker"],
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PHASE 2 — notification phishing", () => {
  it("denies sending an off-site (absolute URL) link to another user", async () => {
    await assertFails(
      setDoc(doc(as("attacker"), "notifications/n1"), {
        userId: "student1",
        type: "alert",
        title: "Your account is locked",
        message: "Sign in again",
        link: "https://evil.example/login",
        read: false,
      }),
    );
  });

  it("denies a protocol-relative //host link", async () => {
    await assertFails(
      setDoc(doc(as("attacker"), "notifications/n2"), {
        userId: "student1",
        type: "alert",
        title: "x",
        message: "x",
        link: "//evil.example/login",
        read: false,
      }),
    );
  });

  it("denies creating a notification pre-marked as read", async () => {
    await assertFails(
      setDoc(doc(as("attacker"), "notifications/n3"), {
        userId: "student1",
        type: "alert",
        title: "x",
        message: "x",
        link: null,
        read: true,
      }),
    );
  });

  it("allows the real in-app notifications (assignment + follow)", async () => {
    // teacher assigns a test -> notifies a student (AssignTestModal)
    await assertSucceeds(
      setDoc(doc(as("teacher1"), "notifications/n4"), {
        userId: "student1",
        type: "assignment",
        title: "New Test Assigned",
        message: "You have a new test",
        link: "/classes/class1",
        read: false,
      }),
    );
    // student follows someone -> notifies the followee (lib/social.ts)
    await assertSucceeds(
      setDoc(doc(as("student1"), "notifications/n5"), {
        userId: "teacher1",
        type: "request",
        title: "New Follower!",
        message: "Someone just started following you.",
        link: "/profile/student1",
        read: false,
      }),
    );
    // a notification with no link at all
    await assertSucceeds(
      setDoc(doc(as("student1"), "notifications/n6"), {
        userId: "teacher1",
        type: "submission",
        title: "Submitted",
        message: "done",
        link: null,
        read: false,
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PHASE 3 — private contact details (email/phone)", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/student1/private/contact"), {
        email: "student1@school.uz",
        phone: "+998901234567",
      });
    });
  });

  it("denies a stranger reading another user's contact details", async () => {
    await assertFails(getDoc(doc(as("attacker"), "users/student1/private/contact")));
  });

  it("denies even a TEACHER reading it directly (they must use /api/directory/contact)", async () => {
    await assertFails(getDoc(doc(as("teacher1"), "users/student1/private/contact")));
  });

  it("denies a stranger WRITING to someone's contact doc", async () => {
    await assertFails(
      setDoc(doc(as("attacker"), "users/student1/private/contact"), {
        email: "attacker@evil.example",
      }),
    );
  });

  it("allows the owner to read and update their own contact details", async () => {
    await assertSucceeds(getDoc(doc(as("student1"), "users/student1/private/contact")));
    await assertSucceeds(
      setDoc(doc(as("student1"), "users/student1/private/contact"), {
        email: "student1@school.uz",
        phone: "+998900000000",
      }),
    );
  });

  it("still lets a super admin read it (support / god mode)", async () => {
    const admin = testEnv
      .authenticatedContext("admin1", { super_admin: true })
      .firestore();
    await assertSucceeds(getDoc(doc(admin, "users/student1/private/contact")));
  });

  it("keeps the PUBLIC profile doc readable (rosters, leaderboards, explore)", async () => {
    await assertSucceeds(getDoc(doc(as("attacker"), "users/student1")));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PHASE 2 — quota + dead collections", () => {
  it("denies anonymous and authed clients touching ai_usage (Admin SDK only)", async () => {
    await assertFails(setDoc(doc(anon(), "ai_usage/x_2026-07-13"), { count: 0 }));
    await assertFails(
      setDoc(doc(as("teacher1"), "ai_usage/teacher1_2026-07-13"), {
        count: 0,
        userId: "teacher1",
      }),
    );
    await assertFails(getDoc(doc(as("teacher1"), "ai_usage/teacher1_2026-07-13")));
  });

  it("denies anonymous writes to error_logs", async () => {
    await assertFails(setDoc(doc(anon(), "error_logs/e1"), { msg: "spam" }));
  });

  it("denies writes to the dead questions collection", async () => {
    await assertFails(setDoc(doc(as("attacker"), "questions/q1"), { junk: true }));
  });
});
