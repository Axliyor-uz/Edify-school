/**
 * Parent QR access rules (docs/PARENTS.md). Run: npm run test:rules
 *
 * There is exactly ONE property to pin here, and it is a negative one:
 * **`parent_links` is unreachable from any client, in any direction.**
 *
 * Why that deserves its own test file rather than a line in a bigger one: the
 * document id of a parent link IS the parent's credential, and a parent has no
 * Firebase account at all. So unlike every other collection in this codebase,
 * there is no "correct" rule that opens it a little — the manager reaches it
 * through /api/manager/parent-links (Admin SDK, requireActiveCenterManager) and
 * the parent through /api/parent/{token} (Admin SDK, no auth). If a future change
 * "helpfully" opens a read here to save an API call, these tests fail and the
 * reviewer is told why.
 *
 * ⚠️ The legacy `parents/{uid}` collection (an account-based parent model nothing
 * implements) is asserted separately, so the two are never confused.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, query, where,
} from "firebase/firestore";

let testEnv;

const TOKEN = "23456789ABCDEFGHJKMNPQR";

const LINK = {
  token: TOKEN,
  centerId: "center1",
  studentId: "student1",
  studentName: "Student One",
  label: "Onasi",
  status: "active",
  scope: { results: true, levels: true, attendance: true, finance: true },
  createdAt: 1_780_000_000_000,
  createdBy: "manager1",
  viewCount: 3,
  // The device claim — one link, one person (docs/PARENTS.md).
  deviceHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  claimedAt: 1_780_000_100_000,
  claimedDevice: "iPhone · Safari",
};

const SEED = {
  "users/manager1": { uid: "manager1", role: "manager", centerId: "center1" },
  "users/manager2": { uid: "manager2", role: "manager", centerId: "center2" },
  "users/student1": { uid: "student1", role: "student", totalXP: 0 },
  "centers/center1": { id: "center1", name: "Center One", ownerUid: "manager1", status: "active" },
  [`parent_links/${TOKEN}`]: LINK,
};

before(async () => {
  // Its own projectId — node --test runs suites in parallel and clearFirestore
  // would otherwise wipe another suite's seed mid-test.
  testEnv = await initializeTestEnvironment({
    projectId: "demo-edify-rules-parentlinks",
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

describe("PARENT LINKS — no client may read them", () => {
  it("denies the OWNING center's manager a direct get", async () => {
    // Not a bug: the manager panel reads this list through the API, which proves
    // center ownership off `centers.ownerUid` with the Admin SDK.
    await assertFails(getDoc(doc(as("manager1"), `parent_links/${TOKEN}`)));
  });

  it("denies the owning manager a scoped list query", async () => {
    await assertFails(getDocs(query(
      collection(as("manager1"), "parent_links"),
      where("centerId", "==", "center1"),
    )));
  });

  it("denies another center's manager", async () => {
    await assertFails(getDoc(doc(as("manager2"), `parent_links/${TOKEN}`)));
  });

  it("denies the student the link is about", async () => {
    await assertFails(getDoc(doc(as("student1"), `parent_links/${TOKEN}`)));
  });

  it("denies a signed-OUT visitor — the parent's own browser", async () => {
    // The parent holds the token and is signed out. They still cannot read the
    // document: the report comes from /api/parent/{token}, which never exposes
    // the link doc itself.
    await assertFails(getDoc(doc(anon(), `parent_links/${TOKEN}`)));
  });
});

describe("PARENT LINKS — no client may write them", () => {
  it("denies the owning manager a create", async () => {
    await assertFails(setDoc(doc(as("manager1"), "parent_links/NEWTOKEN0000000000000000"), LINK));
  });

  it("denies the owning manager a revoke (status update)", async () => {
    await assertFails(updateDoc(doc(as("manager1"), `parent_links/${TOKEN}`), { status: "revoked" }));
  });

  it("denies widening the scope from a browser", async () => {
    // The one that would matter most: a client-side scope write would let anyone
    // who can reach the doc turn on the finance block for a link they hold.
    await assertFails(updateDoc(doc(as("student1"), `parent_links/${TOKEN}`), {
      scope: { results: true, levels: true, attendance: true, finance: true },
    }));
  });

  it("denies a signed-out visitor bumping their own view counter", async () => {
    await assertFails(updateDoc(doc(anon(), `parent_links/${TOKEN}`), { viewCount: 99 }));
  });

  it("denies clearing the device claim from a browser", async () => {
    // ⚠️ The one that would break the whole one-person rule: a client able to
    // delete `deviceHash` could hand the link to a second phone at will. Only
    // PATCH …/{token} {unbind:true}, behind requireActiveCenterManager, may.
    await assertFails(updateDoc(doc(as("manager1"), `parent_links/${TOKEN}`), { deviceHash: "" }));
    await assertFails(updateDoc(doc(anon(), `parent_links/${TOKEN}`), { deviceHash: "" }));
  });

  it("denies claiming an unclaimed link directly", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `parent_links/${TOKEN}`), { ...LINK, deviceHash: null });
    });
    await assertFails(updateDoc(doc(anon(), `parent_links/${TOKEN}`), { deviceHash: "abc" }));
  });

  it("denies every delete", async () => {
    await assertFails(deleteDoc(doc(as("manager1"), `parent_links/${TOKEN}`)));
    await assertFails(deleteDoc(doc(anon(), `parent_links/${TOKEN}`)));
  });
});

describe("PARENT LINKS — the legacy `parents/{uid}` collection is a different thing", () => {
  it("still lets a user own their own parents/{uid} doc (unused, but unchanged)", async () => {
    // Nothing in the app reads or writes this; the assertion exists so a future
    // change to the account-free feature is not mistaken for a change to it.
    await assertSucceeds(setDoc(doc(as("manager1"), "parents/manager1"), { children: [] }));
  });

  it("denies writing somebody else's parents doc", async () => {
    await assertFails(setDoc(doc(as("manager2"), "parents/manager1"), { children: ["student1"] }));
  });
});
