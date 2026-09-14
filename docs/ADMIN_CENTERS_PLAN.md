# Admin Panel — Center Management: Implementation Plan (HISTORICAL)

> ⚠️ **HISTORICAL DOCUMENT — superseded by [ADMIN.md](ADMIN.md) (2026-07-12).** Kept for design
> rationale and decision history only. Known drift vs current code (do NOT trust these parts):
> the `centerAdminService` API surface (actual exports are `fetchAllCenters` / `fetchCenterDetailData`,
> no `fetchCenterStats`/`fetchCenterTeachers`, no `getCountFromServer`); the create-center body
> (requires `centerSlug`); the delete cascade (selects classes by `classes.centerId`, contradicting
> §Data-model's "never queried" claim); nav/dashboard wiring (partial); `CopyIdButton` extraction
> (never done). **Read [ADMIN.md](ADMIN.md) first for current state.**

> **Status (2026-07-06): Phases 0–6 implemented.** Remaining unchecked-by-nature items: manual test script execution and manager-panel regression pass (require live Firebase login). See notes at the end of this file.

> This is the source-of-truth checklist for the learning-center management module in the
> super-admin panel (`app/admin/`).
> Read `docs/ATTENDANCE.md` and `docs/ROOMS.md` before touching attendance/rooms data.

## Scope decisions (confirmed with owner, 2026-07-06)

1. **Full control + creation** — admin can list/inspect/edit/delete centers, manage the
   manager account and center teachers, and **create new centers with a manager account**
   from the admin panel.
2. **No plan/limit system.** Centers work without any limits, forever. The existing
   `centers.subscription {plan, validUntil}` fields stay untouched and unenforced.
   Nothing is ever shown to or blocked for the manager/teachers/students — any
   status/notes live **only** in the admin panel as internal bookkeeping.
3. **No impersonation / embedded manager views.** Admin sees tables and stats only.
4. **Destructive & privileged ops via Next.js API routes** (`app/api/admin/*`) using the
   in-repo Admin SDK (`lib/firebaseAdmin.ts`), verifying the `super_admin` claim
   server-side from the caller's ID token. (Existing `deleteAccountAPI`/`deleteClassAPI`
   Cloud Functions stay as-is for their current uses.)
5. **Critical bug fixes are in scope** (security/correctness in the existing center code);
   cosmetic issues are logged in §7 but not part of this project.
6. **UI in English**, matching the existing admin light theme (slate-50 shell, white
   `rounded-2xl` cards, indigo accent, `react-hot-toast`, lucide icons).

## Data-model facts the implementation must respect

- `centers/{centerId}`: `{ id, name, slug, ownerUid, size, subscription{plan,validUntil}, createdAt }` (ISO strings).
- `center_teachers/{teacherUid}` — **doc ID must equal the teacher's uid** (security rules
  depend on it). Fields: `{ centerId, teacherId, teacherName, teacherEmail, addedAt }`.
  A teacher can belong to only one center (doc id = uid).
- A class belongs to a center **via its teacher** (`center_teachers.teacherId → classes.teacherId`),
  NOT via `classes.centerId` (that field is written on create but never queried — do not
  rely on it for filtering).
- Manager = `users/{uid}` with `role:"manager"` + `centerId`; also `centers.ownerUid == uid`.
  All manager rules key off `ownerUid`.
- `usernames/{lowercaseUsername}` = `{ uid }` uniqueness reservation — must be created on
  manager creation and cleaned on deletion.
- Attendance docs: `center_attendance/{classId}_{YYYY-MM-DD}`,
  `center_staff_attendance/{staffUid}_{YYYY-MM-DD}`; rooms: `rooms` where `centerId ==`.
- Super-admin god-mode rule (`firestore.rules:44-47`) already grants client-SDK read/write
  on everything → **no security-rule changes needed** for admin reads/edits. API routes use
  Admin SDK which bypasses rules entirely.

---

## Phase 0 — Server foundation

- [x] `lib/server/verifySuperAdmin.ts`: helper for API routes — extract Bearer ID token,
      `adminAuth.verifyIdToken()`, require `decoded.super_admin === true`, return uid or
      throw 401/403. All `app/api/admin/*` routes call this first.
- [x] `lib/adminApi.ts` (client): small fetch wrapper that attaches
      `await user.getIdToken()` as `Authorization: Bearer` and surfaces JSON errors for toasts.
- [x] `services/centerAdminService.ts` (client): shared read helpers for admin pages —
      `fetchAllCenters()`, `fetchCenterStats(centerId)` (teacher/group/student counts via
      `center_teachers` → chunked `classes where teacherId in` — reuse the chunking logic
      pattern from `hooks/useCenterClasses.ts`), `fetchCenterTeachers(centerId)` hydrated
      from `users`.

## Phase 1 — Centers directory (read)

- [x] `app/admin/centers/page.tsx`: table of all centers — name, slug, size, manager
      (displayName/email from `users/{ownerUid}`), teacher count, group count, student
      count (unique uids across rosters), createdAt. Client-side search (name/slug/manager
      email) + sort. Use `getCountFromServer` where a full fetch isn't needed.
- [x] Add **Centers** to the admin nav (`app/admin/layout.tsx` navLinks) and replace one
      dashboard "Coming Soon" card (or add a new live card) on `app/admin/page.tsx`.
- [x] Loading skeletons, empty state, error state consistent with `admin/teachers/page.tsx`.

## Phase 2 — Center detail page (read + non-destructive writes)

`app/admin/centers/[id]/page.tsx` with tabs (pattern: `admin/teachers/[id]/page.tsx`):

- [x] **Overview tab**: center fields (name, slug, size, createdAt, copy-ID), stat cards
      (teachers / groups / students / rooms), manager card (photo, name, email, phone,
      copy-UID, link-out). Inline edit of `name`, `slug`, `size` (client `updateDoc`,
      god-mode). Show `subscription.plan` / `validUntil` **read-only as info** + an
      admin-only free-text `adminNotes` field on the center doc (visible nowhere else).
- [x] **Teachers tab**: list `center_teachers` hydrated from `users` (subject, phone,
      group/student counts). *Add teacher by email*: validate `role === "teacher"`, then
      `getDoc(center_teachers/{uid})` — if the teacher already belongs to **another**
      center, block with an explicit warning (never silently overwrite; see bug fix 5.2).
      *Remove teacher*: confirm dialog explaining their classes disappear from the
      manager's views; `deleteDoc(center_teachers/{uid})`.
- [x] **Groups tab**: all center classes (via teacher linkage), columns title/teacher/
      students/schedule summary/created; row links to existing `/admin/classes/[id]`.
- [x] **Manager tab**: edit manager profile fields (displayName, phone) via `updateDoc`;
      suspend/activate (`isActive`) reusing the teacher-detail pattern;
      **password reset** button → API route (Phase 3) that generates a reset link via
      Admin SDK (`generatePasswordResetLink`) and shows it to copy;
      **transfer ownership** → API route that atomically updates `centers.ownerUid`,
      new user's `role:"manager"` + `centerId`, and demotes/clears the old manager
      (decide per-use: keep account with role cleared to `teacher`/`student` choice).
- [x] **Danger zone tab**: archive flag (admin-only `adminStatus: 'active'|'archived'` on
      the center doc — affects nothing outside admin; archived centers grouped/dimmed in
      the directory) and Delete Center (Phase 4).

## Phase 3 — Create center + manager (API)

- [x] `POST /api/admin/centers` (`app/api/admin/centers/route.ts`):
      body `{ centerName, size, managerEmail, managerPassword, managerDisplayName, username, phone }`.
      Steps: verify super_admin → check username free → `adminAuth.createUser` →
      Admin-SDK batch: `centers/{autoId}` (same shape as `ManagerSignupFlow`, incl.
      `subscription: {plan:'free_trial', validUntil:+14d}` for shape compatibility),
      `users/{uid}` (role manager, centerId), `usernames/{lower}` → on batch failure
      delete the created Auth user (mirror the signup rollback). Return `{centerId, uid}`.
- [x] `POST /api/admin/centers/[id]/manager` — actions `reset-password` | `transfer-ownership`
      (used by Phase 2 Manager tab).
- [x] `app/admin/centers/new/page.tsx`: creation form (center info + manager credentials,
      generate-password button, validation matching signup rules: password ≥ 8,
      `+998 XX XXX XX XX` phone, username uniqueness live-check against `usernames`).
      On success toast + redirect to the new center's detail page.

## Phase 4 — Delete center (cascade, API)

- [x] `DELETE /api/admin/centers/[id]` with options
      `{ deleteManagerAccount: boolean, deleteClasses: boolean }` (both surfaced as
      checkboxes in the confirm dialog; type-DELETE confirmation like existing admin deletes).
      Cascade order (Admin SDK, chunked `BulkWriter`/batches of ≤500):
      1. `center_attendance` where `centerId ==` (all day docs)
      2. `center_staff_attendance` where `centerId ==`
      3. `rooms` where `centerId ==`
      4. If `deleteClasses`: for each class of the center's teachers **that has
         `centerId == thisCenter`** (manager-created only — never touch teachers'
         personal classes): delete subcollections (`assignments`, `exams`, `materials`,
         `requests`, `leaderboard`) then the class doc. Otherwise just strip the classes'
         `centerId` field.
      5. `center_teachers` docs for the center
      6. If `deleteManagerAccount`: delete `usernames/{username}`, `users/{ownerUid}`,
         Auth user. Otherwise clear `centerId`/set role to `teacher`? → default: keep
         account, clear `centerId`, set `role:'student'`-safe fallback is wrong — keep
         `role:'manager'` with no centerId is dead weight; **decision: default checkbox ON**.
      7. `centers/{id}` doc last.
      Return a summary `{deletedCounts}` for the success toast. Idempotent — safe to re-run
      if a previous attempt partially failed.
- [x] Danger-zone UI wiring + double confirmation.

## Phase 5 — Critical hardening fixes (existing center code)

- [x] **5.1 Fail-open manager guard** — `app/manager/layout.tsx:140-167`: require
      `role === 'manager'` explicitly (currently any non-student/teacher role passes,
      including `admin`), and make the `catch` fail **closed** (redirect to login/home,
      show error toast) instead of `setIsAuthorized(true)`.
- [x] **5.2 Teacher-steal bug** — `app/manager/teachers/page.tsx:164-231`: before
      `setDoc(center_teachers/{uid})`, `getDoc` the doc by ID; if it exists with a
      different `centerId`, show an error ("this teacher already belongs to another
      center") instead of silently overwriting. Apply the same check in the new admin
      Teachers tab (admin gets an explicit "move anyway" override since it's super-admin).
- [x] **5.3 Missing center-membership check** — `app/manager/attendance/[classId]/page.tsx`:
      verify the class's `teacherId` is in this center's `center_teachers` (same check as
      `app/manager/groups/[classId]/page.tsx:61-67`); otherwise `notFound()`.
- [x] **5.4 Timezone bug** — `app/manager/students/page.tsx:31-36,75-76`: replace
      device-local `formatDate(new Date())`/`getDay()` with the Asia/Tashkent helpers
      (`getTodayKey()` / `parseDateKey` used by dashboard & walk-in), per
      ATTENDANCE.md rule #3.

## Phase 6 — Polish, verification, docs

- [x] Consistent copy-ID button (reuse the inline pattern from `admin/teachers/[id]`;
      optionally extract a shared `components/admin/CopyIdButton.tsx` since it's already
      duplicated 4×).
- [x] Composite indexes: check whether any new query needs one (`classes where teacherId in`
      is doc-ID-free and fine; `center_attendance centerId+date` already indexed). Add to
      `firestore.indexes.json` if the index-catcher toast fires during testing.
- [x] `npm run lint` + `npm run build` clean.
- [ ] **(pending — needs live Firebase login)** Manual test script (there is no test suite):
      create center from admin → log in as that manager → add teacher → create group →
      add student → mark attendance → verify all of it appears in admin center detail →
      transfer ownership → delete center with both checkbox combinations → confirm no
      orphaned docs (spot-check `center_attendance`, `rooms`, `center_teachers`, `usernames`).
- [ ] **(pending — needs live Firebase login)** Regression pass on manager panel after
      Phase 5 fixes (login as manager, teacher, student; near-midnight date handling
      sanity check for 5.4).
- [x] Update `CLAUDE.md` (admin section + new API routes) and add a short
      `docs/ADMIN_CENTERS.md` reference once built.

## 7. Known issues explicitly OUT of scope (logged, not fixed here)

- No group-deletion action in the manager panel; orphan classes accumulate.
- `joinCode` generated without collision check.
- `classes.centerId` vs teacher-linkage duality (dead denormalization).
- Broad `list: if isAuth()` rules on attendance/rooms (documented trade-off, ATTENDANCE.md §3).
- Every manager page re-fetches `centerId` instead of sharing context.
- Two overlapping teacher-membership editors in admin (`membership/page.tsx` vs
  `teachers/[id]/MembershipTab`); dark-themed `admin/classes` pages vs light shell.
- `center_finances` / `crm_leads` ruled but codeless; face recognition & attendance
  summaries deferred (ATTENDANCE.md §7).

---

## Addendum (2026-07-06): Center approval gate — IMPLEMENTED

Problem: anyone could sign up as a manager and immediately get full center powers
(add any teacher by email, create rooms/groups, write attendance) because rules
only checked `centers.ownerUid`.

Solution — `centers.status: 'pending' | 'active' | 'suspended'` (missing = pending):

- **Rules** ([firestore.rules](../firestore.rules)): new `isActiveCenterManager()` helper gates EVERY
  manager write (center_teachers, rooms, center_attendance manager path, staff attendance,
  summaries, finances, crm_leads, face_enrollments, classes update/delete via
  `isTeacherInMyCenter`). Reads keep plain ownership so pending managers see their empty panel.
  `centers` create now requires `status == 'pending'`; owner updates restricted to
  `name/slug/size` (self-approval impossible). Teacher attendance writes NOT gated (deliberate).
- **Signup** writes `status: 'pending'`; **admin create API** writes `status: 'active'`.
- **Manager UX** ([ApprovalGate.tsx](../app/manager/_components/ApprovalGate.tsx)): pages fully
  visible/navigable; big notice card above content (incl. dashboard) + any click on page content
  opens a contact dialog. Admin contact: +998 33 860 20 06, Telegram @umidjon0339.
- **Admin UX**: status badges + Pending/Active/Suspended filter + quick Approve in
  `/admin/centers`; Approve/Suspend card in detail Overview tab.

**Deploy checklist:**
1. `firebase deploy --only firestore:rules` — after this, ALL centers without `status` are locked.
2. Open `/admin/centers` → approve the legitimate existing centers (Pending filter shows them).
