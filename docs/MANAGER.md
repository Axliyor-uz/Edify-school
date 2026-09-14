# MANAGER — Learning-Center Core (Groups, Teachers, Students)

> **Agent workflow:** read this BEFORE touching `app/manager/*` (outside attendance/rooms/finance, which have their own docs), `hooks/useCenterClasses.ts`, `services/checkInService.ts`, or center-related rules. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).
>
> Subsystem docs: attendance → [ATTENDANCE.md](ATTENDANCE.md) · rooms/timetable → [ROOMS.md](ROOMS.md) · finance → [FINANCE.md](FINANCE.md) + [FINANCE_DATABASE.md](FINANCE_DATABASE.md) · **parent QR access → [PARENTS.md](PARENTS.md)**.

**Last verified:** 2026-07-15.

## Purpose & scope

Everything a learning-center manager does outside the attendance/rooms/finance subsystems: center lifecycle & approval, groups (classes), teacher links, student enrollment, walk-in check-in, and the manager API pattern.

## Key files

| File | Responsibility |
|---|---|
| `app/manager/layout.tsx` | Role gate (`role==='manager'`, fail-closed), resolves center name + `status`, wraps pages in `ApprovalGate`; since 2026-07-23 also renders the switchboard-driven shell (nav variants, dark toggle) — see [MANAGER_UI.md](MANAGER_UI.md); trilingual uz/ru/en via `_components/ManagerLanguage.tsx` (`useManagerLanguage()`, localStorage `edify-manager-lang`, flag switcher in the profile popover) — pages carry per-file `TRANSLATIONS` dicts |
| `app/manager/_components/ApprovalGate.tsx` | pending/suspended notice + click-blocking overlay (UX only — rules are the boundary) |
| `hooks/useCenterClasses.ts` | **THE center-membership derivation**: `classes where centerId==X` (+ `center_teachers where centerId==X` for the teachers roster) |
| `app/manager/groups/**` | Group list, create modal, detail tabs (roster / schedule / oversight / settings) |
| `app/manager/teachers/page.tsx` | `center_teachers` link management |
| `app/manager/students/page.tsx` | Center-wide unique-student view (uses attendance `fetchCenterSessions` for today's status) |
| `services/checkInService.ts` | Walk-in / front-desk check-in engine (writes the same `center_attendance` docs as the grid) |
| `lib/managerApi.ts` | `managerApiFetch` = re-export of `adminApiFetch` (Bearer token attach) |
| `lib/server/verifyCenterManager.ts` | `requireActiveCenterManager` — gates all `/api/manager/*` |
| `app/api/manager/user-photo/route.ts` | Manager sets/deletes teacher/student photos (Admin SDK + Storage) |
| `app/api/manager/teachers/create/route.ts` | Manager provisions a full teacher account (Auth + profile + link + credentials) |
| `app/api/manager/teachers/[uid]/route.ts` | Manager edits teacher profile fields / resets center-managed passwords |
| `lib/teacherProvision.ts` | Isomorphic email/username/password generation (translit) — client preview + server share it |
| `app/manager/teachers/_components/CreateTeacherModal.tsx` | Create-account form + credentials success card |

## Center lifecycle

Signup (see [AUTH.md](AUTH.md)) creates `centers/{id}` with `status:'pending'`. Status mapping in the layout: `active` → normal; `suspended` → gate; anything else/missing → `pending` → gate. What each status can do:
- **All statuses can READ** (rules allow reads via plain `isCenterManager`), so a pending manager sees their (empty) panel.
- **Only `active` can WRITE** — enforced by `isActiveCenterManager()` in rules AND `requireActiveCenterManager` on every `/api/manager/*` route. The `ApprovalGate` overlay (admin contact: phone/telegram in the component) is UX only.
- Owner can self-edit only `name/slug/size` on the center doc; `status`/`subscription`/`ownerUid` are admin-only.

## ⚠️ THE core invariant: center membership is `classes.centerId`-anchored (since 2026-07-15)

**A class belongs to a center iff `classes.centerId == centerId`.** Center groups are born ONLY in the manager panel (`CreateGroupModal.tsx` stamps `centerId`); linking an existing teacher (`center_teachers`) brings **the teacher, not their groups** — their personal / other-center classes never appear in the center. This replaced the old teacher-anchored derivation (center_teachers → classes by teacherId), which leaked every class a linked teacher had ever created into the center (and its billing). All derivations agree now: `useCenterClasses`, group-detail + attendance-detail authz, `resolveCenterClasses` (finance), the user-photo/directory student checks, `centerAdminService`, the admin cascade-delete, and the rules' manager write branch (`isActiveCenterManager(resource.data.centerId)`).

Rules enforcement (all regression-tested in `tests/rules/manager.rules.test.mjs`):
- **create**: stamping a `centerId` requires being that center's active manager or one of its linked teachers; a class without `centerId` is a personal teacher class (unchanged open create).
- **update/delete**: manager writes require the class to carry THEIR centerId; **`centerId` is immutable client-side on every branch** — a teacher can't push a personal group into a center, a manager can't move a group between centers (god mode / Admin SDK only).
- **Reassignment must stay in-center**: changing `teacherId`/`teacherName` on a center group requires the NEW teacher in `center_teachers`. The old teacher does NOT need to still be linked — orphaned center groups (teacher removed) remain manageable/reassignable by the manager.
- **Teacher-side lock (2026-07-19)**: on a center group the TEACHER cannot touch the class doc at all — no roster changes, no title/lock/joinCode edits, no delete (rules branch 1 now requires `centerId == ''`; delete's teacher arm too). Students cannot self-JOIN a center group (join-request create is rules-blocked; the studentIds self-diff branch allows only removals when `centerId != ''` — self-LEAVE stays legal at the RULES level for the deletion flow, but the student class-page UI hides/guards the Leave button on center groups since 2026-07-20, so in practice only the manager or account deletion removes a center student). Account deletion (`POST /api/account/delete`) also deletes the student's `center_students` links and `center_student_credentials` doc; finance docs are kept. Teacher subcollections (assignments/exams/materials/attendance) are untouched. Teacher UI: view-only roster, no Add-Student/Settings/Requests, center-name chip instead of join code (see [TEACHER.md](TEACHER.md)).

Consequences:
- Removing a teacher from `center_teachers` **no longer removes their center groups** — those keep `centerId` and stay in the panel (reassign or delete them explicitly). Their personal groups were never in.
- A teacher may work with a center while keeping personal groups completely separate; one *employment* per teacher still holds (`center_teachers` doc ID **must equal teacher uid**, rules + UI checks).
- ⚠️ **Legacy data**: center groups created via the manager panel always carried `centerId` and keep working. Any class a center used purely via the old teacher-anchored view (created from the teacher panel, no `centerId`) disappears from the panel — stamp `centerId` on it via admin/god mode if it genuinely belongs to the center.

## Groups (classes)

- **Create** (client `addDoc`): `{title, description, joinCode (6-char random), centerId, teacherId, teacherName, studentIds:[], studentCount:0, isLocked:false, createdAt}`. Teacher must be picked from `center_teachers`. ⚠️ `studentCount` is written 0 and never maintained — all UI uses `studentIds.length`.
- **IELTS groups (2026-07-29)**: the create modal has a group-type toggle (Ordinary / IELTS + target band). IELTS creation goes through `POST /api/manager/ielts-groups` (Admin SDK batch) which writes the class **plus** a linked `ielts_groups` twin (`classes.ieltsGroupId` ↔ `ielts_groups.classId`, `managed: true`). Timetable/rooms/attendance/walk-in/finance all ride the class unchanged; tests/grading ride the IELTS group (teacher-controlled). **Every roster write must mirror `ielts_groups.studentIds`** — client surfaces use `managedRosterBatch` (ieltsService), the students/create and account-delete APIs batch it server-side. Group detail gains an **IELTS tab** (read-only overview via `GET /api/manager/ielts-groups/{id}/overview`); Settings syncs title/desc/teacher/targetBand to the twin and has an IELTS-only danger-zone **pair delete** (`DELETE /api/manager/ielts-groups/{id}` — attempts + finance kept). Join-by-code is refused (`CENTER_MANAGED`); the teacher's IELTS panel shows the group view-only roster-wise (no Requests/add/remove). Full model: [IELTS.md](IELTS.md); rules tests: `tests/rules/ieltsCenter.rules.test.mjs`.
- **Detail authz**: `class.centerId === managerCenterId`; mismatch → redirect (same check in attendance `[classId]`).
- **Roster tab**: remove = `arrayRemove(uid)` on `studentIds`. ⚠️ No finance cleanup on removal (add DOES stamp `enrollmentDates` — asymmetry).
- **Schedule tab**: edits `classes.schedule` = `[{dayOfWeek, startTime, endTime, roomId?, roomName?}]`. Room/teacher conflict + capacity checks (`roomService.findScheduleConflicts`) are **advisory** — manager can save over them.
- **Settings tab**: title/description, `monthlyFee` (integer so'm; 0/empty = not billed — finance seam), teacher reassignment (sets `teacherId`+`teacherName` only).

## Teachers

- Link doc `center_teachers/{teacherUid}`: `{centerId, teacherId, teacherName, teacherEmail, addedAt}`.
- **Add existing**: lookup by email (server-side `/api/directory/lookup`), require `role=='teacher'`; if already linked to a *different* center → blocked with "must be removed first" (manager UI never steals; admin UI can). The teachers-page "+" button opens a chooser: create new account (below) vs link existing.
- **Add-flow rules contract** (2026-07-15): the page `getDoc`s `center_teachers/{teacherUid}` as an existence check BEFORE the create. The `get` rule therefore allows `resource == null` — without it the flow dies with permission-denied on a not-yet-linked teacher (this was a live bug: add-teacher failed, so `center_teachers` stayed empty and the manager saw zero classes). A **denied** get now means exactly "linked to another center", and the page maps `permission-denied` to that message. `list` stays scoped: `centerId ==` filtered queries only (the constant-path `isCenterManager` pattern).
- **Remove**: `deleteDoc` — see the core invariant above for the fallout.
- Center teachers get center-scoped read on rooms/attendance via rules helper `isTeacherOfCenter`.
- **What the teacher sees of the center (2026-07-29)**: a read-only hub at `app/teacher/center/` —
  center name, their groups (links only), a merged weekly timetable, a monthly attendance overview,
  and their **own** salary. No manager capability is exposed: rosters, schedules, prices and payroll
  stay manager-only in both UI and rules. `salary` set via `/teacher-salary` and any payout the
  manager **approves** become visible to that teacher immediately ([FINANCE.md](FINANCE.md) §9.1);
  un-approved/live-calculated amounts are never exposed. Details: [TEACHER.md](TEACHER.md).

## Manager-created teacher accounts (2026-07-15)

The manager can provision a full teacher account (`CreateTeacherModal.tsx` → `POST /api/manager/teachers/create`, Admin SDK, gated by `requireActiveCenterManager`):

- **Required**: full name, subject, password (≥8; a friendly `Surname####` is pre-generated, editable). **Auto-generated, editable before submit**: email `f.surname@edify.uz` (short form, fixed domain — `TEACHER_EMAIL_DOMAIN`) and username (first name; both transliterated via [lib/teacherProvision.ts](../lib/teacherProvision.ts) — same functions client + server so preview == reality). Collisions: auto-generated emails walk a fallback chain (`a.karimov` → `alisher.karimov` → `a.karimov2`…), usernames get numeric suffixes; explicit overrides 409. The form live-checks availability of both **signup-style** (`checkUsernameUnique` / `/api/directory/lookup` — 404 = free; 800ms debounce + in-memory cache, spinner → green ✓ / amber ✗ inside the input, fails open on network errors; explicitly-typed taken values block submit, auto-generated ones just show "variant tanlanadi").
- **Writes** (atomic batch; Auth user rolled back on failure): `users/{uid}` (exact TeacherSignupFlow shape + `centerId` + `accountType:'center-managed'`), `users/{uid}/private/contact`, `usernames/{username}` (batch.create → race-safe), `center_teachers/{uid}` (member from birth), `center_teacher_credentials/{uid}` (see [DATA_MODEL.md](DATA_MODEL.md)).
- ⚠️ **The synthetic email has no inbox** — password-reset emails can never arrive. The manager IS the recovery path: the password is stored in `center_teacher_credentials` (manager-read-only, API-written-only) and shown in the teacher info panel (reveal/copy + "Yangi parol"). Do not add self-service password change for `accountType:'center-managed'` accounts without deciding the recovery story deliberately.
- **Info dialog** (`ManagerTeacherInfoPanel.tsx`): mobile-first M3 dialog (bottom sheet on phones, centered card ≥sm) — profile blocks, credentials card (center-managed only), edit mode, photo management, and a **Guruhlar section** listing the teacher's center groups with student counts + schedule chips (day/time/room, `classes` passed in from the page — no extra reads; each links to the group detail).
- **Edit teacher info**: `PATCH /api/manager/teachers/[uid]` — allowlist `displayName, subject, phone (→ private/contact ONLY — never the public doc), birthDate, gender, experience, institution, bio, region`; works for ANY teacher linked to the center (same trust level as the photo route). A `displayName` change also updates `center_teachers.teacherName` + every `classes.teacherName`. **`password` is stricter**: requires `accountType=='center-managed'` && `users.centerId == centerId` — resetting a self-signup teacher's password would be account takeover. Auth password updates BEFORE the credentials doc (the visible password must never claim something that doesn't work).
- Login works via username (`/api/auth/login`) or the synthetic email — nothing new; the account is indistinguishable from a signed-up teacher everywhere else in the app.

## Students (2026-07-15 rewrite — roster is `center_students`-anchored)

- **Roster source**: `center_students/{centerId}_{studentId}` link docs (doc-id composition rules-enforced). A student may belong to SEVERAL centers (unlike teachers), and may be in a center with **zero groups** ("Guruhsiz"). `students/page.tsx` lists links (live `onSnapshot`) UNION class-derived students, and **lazily backfills** missing link docs for legacy class-enrolled students (idempotent fire-and-forget), so the roster converges to `center_students`.
- **Add flows** (the page "+" chooser):
  - **Create account** (`CreateStudentModal` → `POST /api/manager/students/create`): the student twin of teacher creation — name + password required, email/username auto (`f.surname@edify.uz`, signup-style live checks), optional immediate group enroll (`classId`, must be a center group), optional grade/phone. Writes the exact StudentSignupFlow shape (incl. gamification zeros) + `centerId` + `accountType:'center-managed'` + link doc (`source:'created'`) + `center_student_credentials/{uid}` (manager-visible password, see [DATA_MODEL.md](DATA_MODEL.md)).
  - **Add existing** (`AddExistingStudentModal`): email (via `/api/directory/lookup`) or @username (public `usernames` read) → `role=='student'` check → client `setDoc` of the link (`source:'linked'`) — class-free; never touches other centers' links.
- **Group enroll** (`ManagerAddStudentModal` / create-with-classId): `arrayUnion(uid)` on `classes.studentIds` + link doc merge (`source:'enrolled'`) + fire-and-forget `patchStudentFinanceApi(uid, {enrollmentDates:{[classId]: today}})` (billing proration stamp). The modal's pickable list is **`center_students`-anchored** (2026-07-29): links ∪ class rosters, group-less ("Guruhsiz") students badged and sorted first — a class-rosters-only union used to hide exactly the students just added via "Add existing". The list is **multi-select**: tapping rows toggles selection and a sticky "Add N" bar commits them in ONE `writeBatch` (`arrayUnion(...uids)` on the class + the IELTS twin when present + link-doc merges), then per-student finance stamps best-effort; the exact-search result keeps its single-add button. On IELTS groups all roster writes mirror `ielts_groups.studentIds` (see the IELTS groups bullet above).
- **Edit / password**: `PATCH /api/manager/students/[uid]` — allowlist `displayName (syncs studentName on EVERY center's link), grade, phone (→ private/contact only), birthDate, gender, institution, bio, region`; target must be linked OR class-enrolled in the center. `password` strictly `accountType=='center-managed' && users.centerId == centerId` (only the HOME center that provisioned the account).
- **Parent access (2026-08-03)**: `/manager/parents` (**Ota-onalar**, a nav item beside Students) issues a per-child **QR** a parent scans — no parent account exists anywhere. The manager picks what each link shows (results / levels / attendance / finance), sees its view count, and can revoke it. The student info dialog carries the same issue button. Everything is Admin-SDK-only; `parent_links` is denied to every client. Full contract: [PARENTS.md](PARENTS.md).
- **Info dialog** (`ManagerStudentInfoPanel`): mobile-first M3 dialog (bottom sheet on phones) — identity + XP/streak chips, credentials card (center-created only), edit mode, groups with schedule chips, finance (`StudentFinanceSection`), **parent QR access**, photo management, and **remove-from-center** (deletes the link + `arrayRemove` from every center group; the account itself survives).
- Rules: the `studentIds`-only self-diff branch lets a user add/remove ONLY their own uid — and on center groups (`centerId != ''`) additions are blocked entirely (2026-07-19), so manager adds ride the manager branch, never the self-join one.
- Today's status comes from one `fetchCenterSessions(centerId, today, today)` list query (per-doc `get` would be denied for stale-centerId docs — deliberate).

## Walk-in check-in (`services/checkInService.ts`)

Engine-agnostic front-desk capture used by the "Tez davomat" tab (`WalkInCheckIn.tsx`), designed for a future face kiosk:
- `buildCenterRoster(classes)` — dedupe union of studentIds → hydrate from `users`.
- `computeTodayLessons` (pure, uses pre-fetched sessions map — the one actually used) vs `resolveTodayLessons` (async variant).
- `checkInStudent` — **surgical merge** of one student's record into `center_attendance/{classId}_{date}` (update `records.{uid}` if doc exists, else create full day-doc with `lessonStatus:'held'`). Writes the SAME docs the attendance grid reads — see [ATTENDANCE.md](ATTENDANCE.md) for shapes. Omits `confidence` when undefined (Firestore rejects `undefined`).

## API pattern

Client: `managerApiFetch(url, {method, body})` attaches the ID token. Server: every `/api/manager/*` route calls `requireActiveCenterManager(request)` first → `{uid, centerId}`. Example: `user-photo` route (POST base64 ≤3MB → Storage `profile_images/{uid}.jpg` + `users.photoURL`; DELETE reverses) — its `assertTargetInCenter` mirrors the centerId-anchored membership derivation (teacher via `center_teachers`, student via `classes.centerId`).

## Known issues / dead code (verified 2026-07-12)

- `classes.studentCount` — never maintained.
- Username-uniqueness race at signup (debounced check only; batch has no create-guard on `usernames`).
- `ManagerOversightTab` relies on a `|| true` in the assignments read rule (world-readable to any authed user).
- Social-follow-style negative-counter risks don't apply here, but conflict checks being advisory means double-booked rooms can exist in data — don't assume schedule data is conflict-free.

## How to verify changes

**Rules:** `npm run test:rules` — `tests/rules/manager.rules.test.mjs` covers the whole manager surface (add-teacher flow incl. the existence-check get, class visibility queries, group edit/roster/reassign/delete, approval gate, hijack attacks). **App:** `npm run dev`; log in as a manager; exercise: **create a teacher account** (name → watch email/username auto-fill → create → copy credentials → log in as that teacher with the username; check `users` doc has `accountType:'center-managed'`, creds doc exists, teacher appears in the list) → edit teacher info in the panel (name change should rename their classes too) → "Yangi parol" then log in with it → create group → add existing teacher → enroll student (check `enrollmentDates` stamp) → edit schedule with a deliberate room clash (warning but saveable) → walk-in check-in (check the `center_attendance` doc) → remove a teacher and observe their center groups STAY (orphaned but manageable) while their personal groups never appeared; open a linked teacher's personal group URL directly → redirect.
