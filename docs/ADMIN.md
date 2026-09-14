# ADMIN — Super-Admin Panel

> **Agent workflow:** read this BEFORE touching `app/admin/*`, `app/api/admin/*`, `services/centerAdminService.ts`, or `lib/server/verifySuperAdmin.ts`. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).
>
> This doc supersedes the historical plan in [ADMIN_CENTERS_PLAN.md](ADMIN_CENTERS_PLAN.md) wherever they disagree.

**Last verified:** 2026-07-15.

## Auth

- Gate = Firebase custom claim `super_admin`. **Nothing in this repo sets it** (no `setCustomUserClaims` anywhere; no `functions/` dir) — provisioned out-of-band.
- Client: `app/admin/layout.tsx` — `getIdTokenResult(true)` → `claims.super_admin`, fail-closed to `/`.
- Server: `requireSuperAdmin(request)` (`lib/server/verifySuperAdmin.ts`) — Bearer → `verifyIdToken` → `decoded.super_admin === true`; 401/403 via `AdminAuthError`. **Every `/api/admin/*` route must call it first.**
- Rules: god-mode `match /{document=**} { allow read, write: if isSuperAdmin(); }` — this is what makes all the client-side admin writes below legal.
- Client fetch: `lib/adminApi.ts` `adminApiFetch` (Bearer attach, JSON error unwrap).

## The two write paths (deliberate split)

- **Client SDK via god-mode rules**: everything expressible as a plain Firestore doc write — all directory/detail reads (`centerAdminService.ts`), center `status` approve/suspend, center `name/slug/size/adminNotes` edits, `adminStatus` archive, `center_teachers` add/remove, manager `displayName/phone/isActive`, teacher/student `isActive`, membership/limits edits, class student removal, test/assignment deletes.
- **Admin-SDK API routes** (`requireSuperAdmin` + `adminDb`/`adminAuth`): anything needing Auth-user mutation, cascade, or link generation — `POST /api/admin/centers` (create center + Auth user + username), `POST /api/admin/centers/[id]/manager` (reset-password link, transfer-ownership), `DELETE /api/admin/centers/[id]` (cascade delete).
- **Cloud Functions NOT in this repo** (`httpsCallable`): `deleteAccountAPI` (teacher & student deletion), `deleteClassAPI`. External dependency — failures surface as auth-sounding errors.

## Sections

### Centers (`app/admin/centers/`)
- **Directory**: `fetchAllCenters()` reads `centers` + whole `center_teachers` + chunked `classes`/`users`; counts teachers/groups/unique students; pending-first sort. Status normalization: only `active`/`suspended` kept, anything else → `pending`. Inline approve/suspend = **client `updateDoc(centers,{status})`**.
- **Detail** (`fetchCenterDetailData`): tabs Overview / Teachers / Groups / Manager / Danger.
  - Overview: edit `name/slug/size/adminNotes` (slug regex `^[a-z0-9-]+$`); a **second copy** of the approve/suspend status write — keep both sites in sync. Subscription plan/validUntil shown read-only (nothing enforces it).
  - Teachers: add by email; if linked to another center → conflict banner with **"Move Anyway"** override (admin can steal across centers; the old center's manager gets no signal). Write `setDoc(center_teachers/{uid}, {...})`. Remove = `deleteDoc` (classes untouched).
  - Manager: client edits `displayName/phone/isActive`; API for reset-password + transfer-ownership.
  - Danger: archive (client `adminStatus:'archived'` — admin-only bookkeeping) and Delete (API, type-"DELETE" gate, three option checkboxes: groups / center-created teacher accounts / manager account — all default on).
- **Create** (`centers/new` → `POST /api/admin/centers`): validates (`USERNAME ^[a-zA-Z][a-zA-Z0-9_]{4,}$`, phone, `SLUG ^[a-z0-9]+(?:-[a-z0-9]+)*$`), `adminAuth.createUser`, Admin batch writing `centers` (**`status:'active'`** — unlike public signup's `pending`), `users` (manager), `usernames`. Rollback: `deleteUser` on batch failure.
- **Cascade delete** (`DELETE /api/admin/centers/[id]`), idempotent, center doc last (2026-07-15 full rewrite — covers EVERY center-owned store): attendance (`center_attendance` → `center_staff_attendance` → `center_attendance_summary`) → `face_enrollments` → `rooms` → `crm_leads` → **finance** (`center_student_finance`, `center_charges`, `center_payments`, `center_expenses`, `center_payouts`, `center_finance_settings/{id}`) → `classes` (**by `classes.centerId`**, the membership anchor; `deleteClasses:true` → `recursiveDelete` each incl. subcollections, else strip `centerId`) → **center-managed IELTS twins** (`ielts_groups where centerId==`, 2026-07-29 — without this they'd be orphaned AND unmanageable, since the rules lock the teacher out of managed-group docs; `deleteClasses:true` → recursiveDelete incl. assignments/requests [`ielts_attempts` kept], else strip `centerId`+`managed` so the group reverts to a personal teacher group) → **center-created teacher accounts** (`users where accountType=='center-managed' && centerId==` — classes-per-account follow `deleteClasses`; recursiveDelete of `users/{uid}` takes `private/contact`; + `usernames` + Auth user; **self-signup teachers never touched**) → `center_teacher_credentials` → `center_teachers` → `center_students` + `center_student_credentials` (2026-07-29 — roster links/passwords no longer linger; student ACCOUNTS are never deleted here) → optionally manager (same account teardown, personal classes untouched) → `centers`. Flags `{deleteManagerAccount, deleteClasses, deleteCreatedTeacherAccounts}` all default **true**; returns `deletedCounts` per bucket.
- **Transfer ownership**: target found by email; blocked if they own or teach at another center. `oldOwnerAction` ∈ `demote-teacher` | `demote-student` | `keep`. ⚠️ `demote-teacher` sets `role:'teacher'` but does **NOT** create a `center_teachers` link — the ex-owner ends up as a teacher with no center.

### Membership (`app/admin/membership/`)
Edits **teacher** users' `subscription.planId` + `currentLimits.{maxClasses,maxStudents,monthlyAiQuestions}` via client `updateDoc`. ⚠️ Overlaps with `admin/teachers/[id]/_components/MembershipTab.tsx`, which writes a **wider** field set (`subscription.{billingCycle,status,expiresAt}`, `includedFeatures[]`, `usage.aiLimitResetDate`, "Refund AI Usage" → `usage.aiQuestionsUsed=0`) — two editors, last-writer-wins, different coverage. Plan defaults from `app/teacher/subscription/plansData.ts`.

### Teachers / Students (`app/admin/teachers/`, `app/admin/students/`)
Directories query `users where role==...`; detail pages with lazy-paged tabs. Suspend/activate = `isActive` client write. **Delete = external Cloud Function `deleteAccountAPI`.**

### Classes (`app/admin/classes/`)
Server-paginated `classes orderBy(studentCount|createdAt)` — hard dependency on the `studentCount` field + composite index (surfaces an index-error toast). Detail: hydrate roster, remove student (`arrayRemove`), delete assignment, **delete class via `deleteClassAPI`** Cloud Function. ⚠️ Dark slate theme, inconsistent with the light admin shell.

## Invariants & traps

- Admin-created centers are born `active`; public-signup centers are born `pending` — the only two legal creators of `status`.
- `center_teachers` doc ID == teacher uid (one center per teacher) — preserved even by the admin steal path.
- Timestamp mix: `centers.createdAt` is an ISO string; `classes.createdAt` is a Timestamp. `centerAdminService.toMillis()` tolerates both, but `GroupsTab.formatDate` and classes-detail (`createdAt.seconds`) assume Timestamp → render "—"/NaN for ISO (known minor bug).
- Nav has Dashboard/Centers/Teachers/Memberships only — `/admin/students` and `/admin/classes` exist but are unlisted (dashboard "Active Classes" card is still a dead `#` despite `/admin/classes` being built).
- `CopyIdButton` is copy-pasted in ≥4 files with divergent styling (never extracted).
- `membership/page.tsx` uses `alert()` instead of toasts.

## How to verify changes

`npm run dev` with a super-admin account; exercise: approve a pending center (check `centers.status`), create a center via the API route, add/steal a teacher, then build a throwaway center with real fixtures (group, walk-in attendance day, a finance charge, a **center-created teacher account** via the manager panel) and run cascade delete — verify `deletedCounts` covers each bucket, the created teacher can no longer log in, and a self-signup teacher's account + personal classes survive. Remember `deleteAccountAPI`/`deleteClassAPI` need the deployed Cloud Functions.
