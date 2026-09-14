# ATTENDANCE — Student & Staff Attendance

> **Agent workflow:** read this BEFORE touching anything attendance-related; update it in the same change whenever you alter behavior described here. It captures the data model, the non-obvious rules, and the traps that have already caused bugs. Trust this doc + the code over any older notes. Index: [README.md](README.md).

**Last verified:** 2026-09-04 (uncommitted working tree on top of `7c31a96`) — added the Hikvision face
terminal (§2.4, §3, §7 Phase 4); rest of the doc re-checked against code and still accurate.

The attendance system covers **student attendance** (per class, per lesson) and **staff/teacher
attendance** (per teacher, per day) for learning centers. It was rebuilt in phases to be
production-ready. Roles: **teacher** and **manager** mark attendance; **manager** owns analytics
and staff attendance.

---

## 0. Six rules you must not violate

1. **Never write `undefined` to Firestore.** It throws `Unsupported field value: undefined`.
   Build optional fields conditionally (`if (x) payload.x = x`), never `{ note: maybeUndefined }`.
   This already bit us via `normalizeRecord` writing `note: undefined`.
2. **`list` (range query) rules must NOT call `get()` per document.** Firestore caps document-access
   calls per query (~10–20); a per-doc `get()` in a `read`/`list` rule throws *"Missing or
   insufficient permissions"* once enough docs match. Pattern: split `allow get` (strict, cheap) from
   `allow list: if isAuth();`, keep **writes** strict. See `center_attendance` / `center_staff_attendance`.
3. **Date keys are `YYYY-MM-DD` in Asia/Tashkent.** Always use `lib/dateUtils.ts`
   (`getTodayKey`, `formatDateKey`, `parseDateKey`). Never `new Date().toISOString()` device-local.
4. **`records` maps are keyed by student uid; values are objects** `{ status, method, markedBy, markedAt, ... }`.
   Tolerate the legacy flat-string shape (`"present"`) on read via `normalizeRecord`/`normalizeRecords`.
5. **Range queries need composite indexes** (`classId+date`, `centerId+date`). They're in
   `firestore.indexes.json`. Add + deploy an index before shipping a new range query.
6. **Attendance rate = `(present + late) / (present + late + absent)`. Excused is excluded** from the
   denominator (a sick day doesn't lower the %). Only `held`/`makeup` lessons in the past/today count.

---

## 1. File map

| File | Purpose |
|------|---------|
| `types/attendance.ts` | **Single source of truth** for all attendance types. Import from here; don't re-declare `AttendanceStatus`/`ScheduleEntry`. |
| `lib/dateUtils.ts` | Asia/Tashkent date-key helpers. |
| `services/attendanceService.ts` | Analytics + fetch helpers (`tallyStudent`, `rateOfSessions`, `fetchCenterSessions`, `fetchStaffSessions`, `hoursBetween`, `normalizeRecords`). Put data logic here, not in components. |
| `services/checkInService.ts` | **Walk-in / front-desk check-in** — the engine-agnostic capture core: `buildCenterRoster` (center-wide student search list), `resolveTodayLessons` (a student's lessons today), `checkInStudent` (**surgical** single-student merge into a day-doc — preserves everyone else). Reused as-is by the future face kiosk (Phase 4). |
| `app/manager/attendance/_components/WalkInCheckIn.tsx` | Student-centric marking UI (search a student → confirm today's lessons → mark present/late for all in one action). A tab on `app/manager/attendance/page.tsx`, alongside the group grid. |
| `components/attendance/AttendanceGrid.tsx` | **The** student attendance spreadsheet (marking, statuses, notes, lesson lifecycle, makeup days, autosave, per-student % + timeline drawer). Shared by teacher + manager. **Responsive (2026-07-29)**: a `matchMedia('(max-width: 639px)')` compact mode swaps the column geometry (`COLS.wide` 44/208/80 → `COLS.compact` 0/146/62 — the `#` column and the avatar are dropped) so phones show ~3 lesson columns instead of ~1; the toolbar puts search+save on their own full-width row. Optional `flush` prop = edge-to-edge host (no card rounding/side borders, height from `100dvh` instead of `70vh`). Column widths are inline styles, not Tailwind classes — they're computed, and the sticky `left` offsets must agree with them. |
| `components/attendance/StudentAttendanceView.tsx` | 🟢 **THE student self-view** (2026-07-20, center groups only; extracted here 2026-07-29): `center_attendance where classId== + date range` (last ~92 days; classId+date index), own rate via `tallyStudent` + per-day status list. Read-only — allowed by the existing `list: if isAuth()` rule; no rules change was needed. Two thin wrappers consume it: the class page tab and the student IELTS group's Davomat tab (which passes the linked `classId`). |
| `app/(student)/classes/[classId]/_components/AttendanceTab.tsx` | Thin wrapper → `StudentAttendanceView`. |
| `components/attendance/StaffAttendanceGrid.tsx` | Staff attendance month board (teachers × days, check-in/out, hours, autosave). |
| `app/teacher/classes/[classId]/_components/AttendanceTab.tsx` | Thin wrapper → `AttendanceGrid` (passes `recordedBy = teacher uid`). |
| `app/teacher/ielts/groups/[groupId]/page.tsx` | 🟢 Third `AttendanceGrid` consumer (2026-07-29): the "Davomat" tab on center-managed IELTS groups marks the linked class (`group.classId`) — the twin class is hidden from `/teacher/classes`, so this is where the teacher marks those lessons. |
| `app/manager/attendance/[classId]/_components/AttendanceTab.tsx` | Thin wrapper → `AttendanceGrid` (passes `recordedBy = managerId`). |
| `components/center/TeacherTodayLessons.tsx` | 🟢 **Read-only** (2026-07-29): today's lessons for a center teacher, on the teacher dashboard + center hub. ONE live `centerId + date == today` listener covers every group; "Davomat olish" deep-links to `…?tab=attendance`. Never a per-doc `get()` (rule #2). |
| `app/teacher/center/_components/AttendanceTab.tsx` | 🟢 **Read-only** month overview (2026-07-29): one `centerId+date` range query per month → overall rate, per-group bars (`rateOfSessions`), recent sessions, month nav. Marking still happens in each group's own grid. |
| `app/manager/attendance/page.tsx` · `[classId]/page.tsx` | Manager attendance: group grid + walk-in tab → class detail. The class-detail "Dars jadvali" tab is **read-only** (a link to the group page); schedule **editing** moved to the group. |
| `app/manager/groups/[classId]/_components/ScheduleTab.tsx` | **Schedule + room editor** (moved here from attendance). Group detail's "Jadval & xona" tab. Writes `classes/{id}.schedule` directly. |
| `app/manager/staff-attendance/page.tsx` | Staff attendance page (resolves centerId, feeds teachers into `StaffAttendanceGrid`). |
| `app/manager/dashboard/page.tsx` | Real analytics dashboard (today rate, monthly rate, chronic absentees, per-group bars, today's lessons). |
| `app/manager/students/page.tsx` | **Consumer** of today's `records` — reads `.status` (tolerant of legacy string); also shows the `FaceTerminalStatus` badge + Face ID config link. |
| `firestore.rules` | Security rules (flat file, no numbered sections; attendance blocks are near the bottom, after `center_teachers`; face terminal block is at the very end). |
| `firestore.indexes.json` | Composite indexes for attendance range queries. |
| `firebase.json` | Wires `firestore.rules` + `firestore.indexes.json` + (now) `functions`. |
| `scripts/deleteLegacyAttendance.mjs` | One-off clean-slate deletion of `center_attendance` (dry-run by default). |
| `services/notificationService.ts` | `sendNotification(...)`; `NotificationType` includes `'attendance'` (not yet used — notifications deferred). |
| `functions/hikvision.js`, `functions/index.js` | 🟢 **Cloud Functions** (Admin SDK, callable + scheduled/webhook) bridging Hikvision HikCentral Connect: `hikSaveConfig`, `hikStatus`, `hikTest`, `hikEnrollFace`, `hikDevices` (callable) + `hikPollAttendance`/`hikWebhook` (write `face_events`). AK/SK secrets live server-side only, in `_private/hik`. |
| `services/hikvisionService.ts` | Thin `httpsCallable` wrappers around the functions above — the ONLY way the client ever talks to Hikvision config/devices. |
| `services/faceEventService.ts` | `listenFaceEvents(centerId)` (live query on `face_events`), `processFaceEvent`/`processAllFaceEvents` (turns an event into a `center_staff_attendance` write, or a `checkInStudent({..., method:'face'})` call for student events), `markFaceEventsProcessed`. |
| `components/attendance/FaceTerminalStatus.tsx` | Live online/offline badge (polls `hikDevices` every 60s). Shown on **Staff attendance**, **Attendance** (groups tab), and **Students**. |
| `app/manager/face-config/page.tsx` | Manager settings page: AK/SK form, connection test, and face enrollment for both staff and students (tabbed roster picker over `useCenterClasses` + `buildCenterRoster`). |

---

## 2. Data model

### `center_attendance/{classId}_{YYYY-MM-DD}` — student sessions
One doc per class per day. Doc id = `` `${classId}_${date}` ``.
```ts
{
  id, classId, centerId,
  date: "YYYY-MM-DD",                       // Asia/Tashkent
  weekday: 0-6,
  lessonStatus: "held"|"cancelled"|"holiday"|"makeup",
  cancelReason?: string,
  records: {                                // keyed by student uid
    [uid]: {
      status: "present"|"late"|"absent"|"excused",
      method: "manual"|"face",              // pluggable capture source
      markedBy: string,                     // uid or "system:face"
      markedAt: Timestamp,                  // client Timestamp, preserved on partial edits
      note?: string,
      confidence?: number                   // face only
    }
  },
  recordedBy: string,                       // last editor uid
  createdAt, updatedAt: Timestamp
}
```
- Writes are **full-doc** `setDoc` per dirty date. Per-cell `markedAt` is preserved because unchanged
  records are carried in React state and re-written verbatim (not merged).
- `lessonStatus` `cancelled`/`holiday` → column greys out, excluded from stats. `makeup` = an ad-hoc
  lesson outside the class `schedule`; the grid unions schedule-derived dates with any persisted doc dates.

### `center_staff_attendance/{staffUid}_{YYYY-MM-DD}` — staff/teacher attendance
Doc id = `` `${staffUid}_${date}` ``. Manager-only writes.
```ts
{
  id, centerId, staffUid, staffName,
  date, weekday,
  status: "present"|"late"|"absent"|"leave"|"holiday",
  checkIn?: "HH:MM", checkOut?: "HH:MM", hoursWorked?: number,   // hours derived via hoursBetween()
  method: "manual"|"face", markedBy: string, note?: string,
  createdAt, updatedAt
}
```
Clearing a cell **deletes** the doc (via `deleteDoc`).

### `center_attendance_summary/{classId}_{YYYY-MM}` — monthly rollup (DEFERRED)
Type defined in `types/attendance.ts` (`AttendanceSummaryDoc`) and rules exist, but **nothing writes it yet**.
The dashboard currently queries `center_attendance` directly. Only build the rollup if those queries get
slow at scale (then write it on save, or via a Cloud Function — note `functions/` source isn't in the repo).

### `face_enrollments/{uid}` — SUPERSEDED, still not built
The originally-planned on-device/pluggable-matcher path. Type + rules still defined (`FaceEnrollmentDoc`:
`{ uid, centerId, role, descriptor: number[], photoPath?, active, version, enrolledBy, enrolledAt }`) but
**Phase 4 shipped via the Hikvision terminal instead (below), not this collection.** Don't build against
`face_enrollments` without a deliberate decision to revive it.

### 2.4 Face terminal (Hikvision) — PHASE 4, BUILT
A physical Hikvision face-recognition terminal (HikCentral Connect API) replaces manual check-in for
enrolled staff/students. Cloud Functions (`functions/hikvision.js`) own all Hikvision API calls — the
client never talks to Hikvision directly, only to these functions and to `face_events`.

**`face_events/{id}`** — one doc per raw terminal scan, written by `hikPollAttendance`/`hikWebhook`:
```ts
{
  id, centerId,
  staffUid: string,          // the enrolled user's uid (staff OR student — field name is legacy)
  staffName: string,
  role: string,              // "teacher" | "student" | ...
  at: string,                // 'YYYY-MM-DDTHH:mm:ss', Asia/Tashkent local (NOT UTC — see rule #3)
  kind: "checkin" | "checkout",
  source: string,
  processed: boolean,        // flipped true once the manager-panel listener processes it
}
```
`app/manager/layout.tsx` runs a global `listenFaceEvents(centerId)` listener (active on every manager
page, per `FaceEventDoc` in `types/attendance.ts`) that processes unprocessed events into the **existing**
collections — no new attendance record shape:
- **staff** (`role !== 'student'`) → `center_staff_attendance/{staffUid}_{date}`, same shape as manual
  entries but `method: 'face'`, `markedBy: 'system:face'`.
- **student** → `checkInStudent({ ..., method: 'face', markedBy: 'system:face' })` per scheduled class
  today (reuses the walk-in check-in engine verbatim, per Phase 3.5's design intent).

**`_private/{configId}`** (doc id `hik`) — the Hikvision AK/SK secrets + poll/subscribe state. **Never
readable or writable by any client** — Cloud Functions (Admin SDK) only.

**`att_day/{dayId}`** — per-staff-per-day in/out scan-state tracker used internally by
`hikPollAttendance` to dedupe rapid re-scans. **Never readable or writable by any client.**

### `classes/{id}.schedule` — the lesson calendar source
`{ dayOfWeek: 0-6, startTime: "HH:MM", endTime: "HH:MM" }[]`. Student lesson dates are **derived** from this
(not stored per-day) over a ±31-day window, unioned with persisted docs (for makeup days). Edited by
`ScheduleTab` (now under `app/manager/groups/[classId]/_components/`). Do not confuse with `app/admin/students/[id]/_components/ClassesTab.tsx` which treats
`schedule` as a legacy string.

### centerId / role resolution (needed for every attendance surface)
- **Manager** centerId ← `getUserProfile(uid).centerId`. Manager == center **owner** (`centers/{id}.ownerUid`).
- **Teacher** centerId ← query `center_teachers` where `teacherId == uid` (doc id = teacher uid).
- Teachers list for a center ← `useCenterClasses(centerId).teachers` (`center_teachers` where `centerId ==`).

---

## 3. Security model (rules)

Attendance blocks live near the bottom of `firestore.rules` (after `center_teachers`). Helpers: `isCenterManager(centerId)` (reads
`centers/{id}.ownerUid`), `isTeacherOfCenter(centerId)`, `isTeacherInMyCenter(teacherUid)`.

| Collection | read | write |
|-----------|------|-------|
| `center_attendance` | `get`: manager / class teacher / self-in-records / null. **`list`: `isAuth()`** | create/update: class teacher or center manager; delete: manager |
| `center_staff_attendance` | `get`: staff-self / manager. **`list`: `isAuth()`** | create/update/delete: center manager only |
| `center_attendance_summary` | `isAuth()` | class teacher or center manager |
| `face_enrollments` | self / center manager / center teacher | center manager or center teacher |
| `face_events` | `get`: manager / teacher-of-center / null. **`list`: `isAuth()`** | create/delete: `false` (Cloud Functions only); update (mark processed): center manager only |
| `_private` | `false` | `false` — Cloud Functions (Admin SDK) only |
| `att_day` | `false` | `false` — Cloud Functions (Admin SDK) only |

**Why `list: if isAuth()`** — see rule #2 above. It's consistent with this app's existing posture
(`users` and `classes` are already `read: if isAuth()`). If you ever need strict scoped list, denormalize
`teacherId` + center `ownerUid` onto each doc and authorize on those fields (zero `get()` = no limit).

---

## 4. Deploy & ops

The `firebase` CLI is not installed locally — use `npx`. Project: `scanqr-64512` (`.firebaserc`).
Admin env vars (`FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`) are in `.env.local`.

```bash
npx firebase-tools login                                             # once
npx firebase-tools deploy --only firestore:rules,firestore:indexes  # deploy rules + indexes
npx firebase-tools deploy --only functions                          # deploy the Hikvision bridge (functions/)
```
- ⚠️ **Still always use `--only`.** `functions/` now exists (Hikvision bridge, added 2026-09-04) — this
  supersedes the older "no `functions/` dir" trap in `CLAUDE.md`/this doc's history. A bare `firebase
  deploy` will attempt a functions deploy too; keep deploys scoped and explicit regardless.
- Deploying **rules** replaces the whole file (which contains the full ruleset — nothing lost).
- Deploying **indexes** is additive (never deletes existing/auto indexes). Indexes take minutes to
  build — watch Console → Firestore → Indexes until **Enabled** before testing range queries.
- **Any rules edit requires a redeploy** to take effect.

Clean-slate delete of legacy student attendance (optional — code is backward-compatible):
```bash
node --env-file=.env.local scripts/deleteLegacyAttendance.mjs            # dry run (counts)
node --env-file=.env.local scripts/deleteLegacyAttendance.mjs --confirm  # delete
```

---

## 5. How to extend

- **Add a student status** → extend `AttendanceStatus` in `types/attendance.ts`, then the `STATUS` map +
  `STATUS_ORDER` in `AttendanceGrid.tsx`. Decide its effect on `tallyStudent`/`rateOfSessions`
  (numerator? denominator? excluded like `excused`?).
- **Add a capture method** (QR, self, face) → set `method` on the written record. The grid/model already
  carry `method`; add the capture UI and, for anything untrusted, a **token-verified Admin API route**
  (pattern: `app/teacher/create/ai/api/route.ts` + `adminAuth.verifyIdToken`).
- **Add an analytic** → add a pure helper to `attendanceService.ts` (operates on `CenterSession[]`),
  then consume it in the dashboard/grid. Keep logic in the service, not inline.
- **Add a new attendance collection with range queries** → add its composite index to
  `firestore.indexes.json` AND write rules with the split `get`/`list` pattern.

---

## 6. Verification (no test suite)

Run the dev server and exercise the flow (per `CLAUDE.md`):
- **Student**: open a class as **teacher** and as **manager** → mark present/late/absent/excused with a
  note → mark a lesson cancelled → add a makeup day → check the % pill + name-drawer timeline → reload
  and confirm persistence + autosave (edit, navigate away, come back).
- **Staff**: manager → **Xodimlar davomati** → mark a teacher, set check-in/out, flip months, reload.
- **Dashboard**: manager dashboard shows real KPIs, today's lessons with `marked/total`, chronic
  absentees, per-group bars.
- Confirm no `undefined`-write errors and no permission errors after deploying rules.

---

## 7. Roadmap

| Phase | Status |
|-------|--------|
| 0 — schema, dateUtils, indexes, rules, `NotificationType`, delete-script | ✅ Done |
| 1 — shared `AttendanceGrid` (new record shape, excused, notes, lesson lifecycle, makeup, autosave, Tashkent keys) | ✅ Done |
| 2 — analytics (`attendanceService`, % + timeline drawer, real manager dashboard) | ✅ Done |
| 3 — staff attendance (grid + page + nav + query-safe rules) | ✅ Done |
| 3.5 — walk-in / front-desk check-in (student-centric marking, `checkInService`) | ✅ Done — the manual precursor to the face kiosk; already exercises the face-ready `method` field. No new rules/indexes (manager already has `create`/`update` on `center_attendance`). |
| 4 — face recognition (originally: on-device kiosk + `face_enrollments`) | ⏳ Still not started — superseded by the Hikvision terminal below before it was built. |
| 4′ — Hikvision face terminal (§2.4): Cloud Functions bridge, `face_events`, manager enrollment UI, live status badge, staff + student check-in | ✅ Done (2026-09-04) |

**Deferred by choice:** absence notifications (would use the existing `parents` collection + `sendNotification`
with type `'attendance'`); monthly summary rollup docs.

**Resolved:** the old `react-hooks/static-components` lint error in `app/manager/layout.tsx` is gone —
the sidebar was extracted into a proper top-level `Sidebar` component during the 2026-07 nav redesign.
