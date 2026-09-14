# PARENTS — account-free parent access by QR code

> **Agent workflow:** read this BEFORE touching `app/p/*`, `app/manager/parents/*`,
> `app/api/parent/*`, `app/api/manager/parent-links/*`, `lib/parentLinks.ts`,
> `lib/server/parentReport.ts`, `types/Parent.ts`, or the `parent_links`
> collection. Also read [DATA_MODEL.md](DATA_MODEL.md) for every collection the
> report reads, and [AUTH.md](AUTH.md) for why a parent is **not** a role.
> Update this doc in the same change whenever you alter behavior described here.
> Index: [README.md](README.md).

**Last verified:** 2026-08-03 (subsystem introduced; **one child ⇒ one connected device**, and Telegram/SMS delivery).

## Purpose & scope

A parent wants to know three things: *is my child improving, is my child turning
up, and what do I owe?* Everything needed to answer that already exists in this
codebase — it was just locked behind an account nobody was going to create.

So: **the manager issues a QR per child, the parent scans it, and that is the
whole onboarding.** No signup, no password, no app install, nothing to reset when
a phone is replaced. The manager keeps control: they choose the child, choose what
the link shows, see when it was last opened, and can revoke it in one tap.

### ⚠️ A parent is NOT a role — this is the core of the design

Every other actor here is a Firebase user with `users/{uid}.role` (student /
teacher / manager) or a `super_admin` custom claim ([AUTH.md](AUTH.md)). A parent
has **none of that**, deliberately:

| | An account-based parent | What shipped |
|---|---|---|
| Onboarding | signup, verify, remember a password | scan a QR |
| Recovery when they forget | reset email to an address that may not exist | scan the QR again |
| Who can see the child | whoever knows the password | whoever holds the link |
| Revocation | disable an account | revoke one link |
| Firestore rules | `isParentOf()` + a `parents/{uid}.children[]` doc | **not applicable — there is no `request.auth`** |

The last row is the one that shapes the code. **A security rule cannot authorize a
request that has no `request.auth`.** So the parent's data never comes from the
client SDK: it is assembled by the Admin SDK in one API route and returned as a
fixed JSON shape.

⚠️ **`parents/{uid}` and `isParentOf()` in `firestore.rules` are the OLD,
never-implemented model.** Nothing reads or writes them ([DATA_MODEL.md](DATA_MODEL.md)
says so too). They are left in place because removing a rules helper is a separate,
deliberate decision — but do not build on them, and do not confuse them with
`parent_links`.

### ⚠️ ONE CHILD ⇒ ONE CONNECTED PERSON

Two independent rules enforce it, and both matter:

| Rule | Where | What it stops |
|---|---|---|
| **One active link per student** | `POST /api/manager/parent-links` revokes the child's other active links **in the same batch** | two QR cards for one child, quietly both live |
| **One device per link** | the first browser to open it **claims** it (`deviceHash`); every other device gets **409** | a forwarded URL working for everyone who received it |

⚠️ **Issuing is therefore destructive** — the dialog warns when a live link
exists, and the toast says how many were revoked. That is deliberate: "issue a
new QR" is also the recovery path when a parent loses their phone, and it must
leave exactly one link alive.

⚠️ **Sharing does not weaken this.** Telegram / SMS / the native share sheet are
*delivery*: the manager sends the link to the one parent, and whoever opens it
first becomes the connected person. A forwarded link that has already been
claimed is a dead link.

⚠️ **`unbind` is the escape hatch, not a new QR.** A parent who changed phone,
cleared their browser or opened the link in a private window can no longer prove
themselves, and would be told "connected to another device" — *by their own
former self*. The manager presses **Qurilmani almashtirish**, which clears the
device fields and lets the SAME printed card be claimed again. Reprinting is
never required.

### ⚠️ The token is a bearer credential

24 characters from a 29-char alphabet ≈ **117 bits**, so it cannot be guessed.
Until it is claimed it *can* be forwarded — a parent may paste it into a family
chat — and everything around it is built for that reality:

- the **first device to open it claims it** (above), so a forwarded link is
  useful to exactly one person;
- the manager can **revoke** at any time (410 on the next load, and the parent
  page drops the child from the device list rather than looping on an error);
- **every view is counted** (`viewCount`, `lastViewedAt`) and shown in the panel;
- **`scope.finance`** exists precisely so a link that might be forwarded need not
  carry the family's debt;
- the public route is **rate-limited per token**, because a public URL is a
  refreshable one.

It is not, and does not pretend to be, a login. Do not add anything to the report
that would be unsafe in the hands of whoever the parent forwards it to.

## Key files

| File | Responsibility |
|---|---|
| [types/Parent.ts](../types/Parent.ts) | `ParentLink`, `ParentScope`, and **`ParentReport` — the exact JSON a parent receives**. Widening what a parent sees means widening this type; nothing else can leak a field. |
| [lib/parentLinks.ts](../lib/parentLinks.ts) | Pure: token alphabet/generation (`crypto.getRandomValues`), `isParentToken`, `normalizeParentToken` (accepts a pasted URL or a hand-typed grouped code), URL builders, `DEFAULT_PARENT_SCOPE`, the **device-secret** helpers (`PARENT_DEVICE_HEADER`, `generateParentDeviceSecret`, `describeParentDevice`), the **share-link builders** (`telegramShareUrl`, `smsShareUrl`), and the window/limit constants that bound a report's cost. No Firestore. |
| [lib/server/parentReport.ts](../lib/server/parentReport.ts) | **The whole read side, Admin SDK.** `loadParentLink` + `buildParentReport` (profile, groups, results + trend, levels, attendance, finance) + **`claimParentLink`** — the transaction that binds a link to one device, and `hashParentDevice`. |
| `app/api/parent/[token]/route.ts` | **The one public unauthenticated read in this codebase.** Shape check → rate limit → **device claim** → scope → report. Bumps the view counter fire-and-forget. |
| `app/api/manager/parent-links/route.ts` | Manager: `GET` list (whole center or one student), `POST` issue — **which revokes the child's previous active link in the same batch**. |
| `app/api/manager/parent-links/[token]/route.ts` | Manager: `PATCH` revoke / restore / re-label / re-scope / **`unbind`** (free the device so the same QR can be re-claimed). |
| [services/parentLinkService.ts](../services/parentLinkService.ts) | The manager panel's client — API only, never the client SDK. |
| `app/manager/parents/page.tsx` | **Ota-onalar** — every issued link, who has access, view counts, filters. |
| `app/manager/parents/_components/ParentQrDialog.tsx` | Issue → show → **share (Telegram / SMS / native)** → print → revoke → **unbind**, plus live scope editing and the connected-device line. Shared with the student info dialog. |
| `app/manager/students/_components/ManagerStudentInfoPanel.tsx` | The per-student entry point (an *Ota-ona kirishi* section). |
| `app/p/[token]/page.tsx` | **What the parent sees.** One `fetch`, no Firebase, no UI kit. |
| `app/p/page.tsx` | *Farzandlarim* — the device's list of scanned children + add-by-code. |
| [app/p/_lib/store.ts](../app/p/_lib/store.ts) | The parent's "account": tokens **and the per-token device secret** in localStorage. |
| [app/p/_lib/i18n.ts](../app/p/_lib/i18n.ts) | The parent's own uz/ru/en dictionary. |
| `tests/rules/parentLinks.rules.test.mjs` | Pins the collection as unreachable from every client. |

## Flows

### Issuing (manager)

1. **Ota-onalar** page → a student row → *QR yaratish*; or the student info dialog
   → *Ota-ona kirishi* → *QR yaratish*. Both open the same dialog.
2. The manager optionally types a **label** ("Onasi", "Otasi") and flips the four
   **scope** switches, then presses create.
3. `POST /api/manager/parent-links` mints a token, writes `parent_links/{token}`
   and returns it. The dialog renders the QR, the printable card and the
   hand-typeable code.

⚠️ **Every press mints a new link AND revokes the child's previous one** — one
child, one connected person (above). The dialog warns before doing it, and the
toast reports what died.

⚠️ **`studentId` and `centerId` are not patchable.** Re-pointing a live QR at
another child would silently show one family another family's report on a link
they already hold. The only route to a different student is a new QR that must be
physically handed over.

### Scanning (parent)

1. The camera opens `/p/{token}`.
2. The page calls `GET /api/parent/{token}` — the only request it ever makes —
   sending `x-parent-device: <secret>` if this browser has claimed the link
   before. **The first call has no header, and that is what claims it**: the
   server mints a secret, stores only its sha256, and returns the secret once.
3. On success the device **remembers** the child and the secret (`localStorage`),
   so the second QR a family scans adds a second child rather than replacing the
   first, and a switcher appears in the header.

Answers and what they mean to the parent:

| Status | Parent sees | Why it is its own answer |
|---|---|---|
| 200 | the report | |
| 404 | "link not found" | a typo, or a token that never existed |
| **409** | **"connected to another device"** | ⚠️ the claim. Also what a parent sees after clearing their browser — the copy says so and points them at the center, which can `unbind` |
| **410** | **"access was closed — contact the center"** | ⚠️ NOT "wrong code": a revoked link makes a parent phone the center, a "wrong code" makes them retype forever |
| 429 | "wait a moment" | the URL is public and refreshable |

### What the report contains

All four blocks are per-link (`scope`); a block the link excludes is **absent from
the JSON**, not empty — the section simply does not render, and "0 so'm" is never
shown to someone who was not meant to see money at all.

- **Results + improvement** — `attempts` (assignment + exam) for this center's
  classes, merged with `milliy_quiz_results` and `teacher_rasch_results`; a
  6-month trend of monthly averages, and one improvement number.
- **Levels** — the measured 0–5 maths level and the per-dimension breakdown from
  `RASCH_levels/{uid}`, plus Milliy sertifikat papers as **percentages only**.
- **Attendance** — present/late/absent/excused over the last 8 weeks + a recent
  strip.
- **Finance** — balance, open amount, next due date, recent charges and payments.

## Invariants & traps

- ⚠️ **`attempts` is polymorphic — branch on `type`.** An assignment scores
  `score/totalQuestions` (POINTS, not question counts); an exam scores
  `teacherScore/totalPoints` and is **pending until `status:'graded'`**. A pending
  exam is reported as *pending*, never as 0 — telling a parent their child failed
  a paper the teacher has not marked is the worst thing this page could do.
  ⚠️ An exam attempt also stores **no title**: it is resolved from
  `classes/{id}/exams/{id}` in one `getAll`, capped.
- ⚠️ **Center scoping is done in memory.** `classes` is queried by
  `studentIds array-contains` (no composite index for `centerId` + that), and a
  student may study at several centers — a link issued by center A must never
  show center B's groups, attempts or attendance.
- ⚠️ **Attendance is queried PER CLASS, never center-wide.** The manager panel's
  `fetchCenterSessions(centerId, …)` reads every class's day-doc in the window —
  fine behind a login, absurd behind a public URL. The `classId + date` index
  makes the per-class form exact.
- ⚠️ **The counting rule is `isCountedLesson` + `tallyStudent`** from
  `services/attendanceService.ts`, restated server-side: a lesson counts only once
  it has happened (`held`/`makeup`, date ≤ today), and `excused` is excluded from
  the denominator.
- ⚠️ **The 0–5 level math duplicates `mathLevel()`/`dimensions()`** from
  `services/RASCHProgressService.ts` on purpose — that module imports the CLIENT
  SDK at load time and must not be pulled into a Node API route. It is the mean θ
  over the dimensions that have actually been measured, never over all seven. If
  the ability model changes, change both ([RASCH_SKILLS.md](RASCH_SKILLS.md)).
- ⚠️ **No θ, no logits, no Milliy "level" on the parent page.** Milliy subjects
  have no calibrated difficulty, so a level there would be a confident-looking
  number with nothing behind it ([MILLIY_QUIZ.md](MILLIY_QUIZ.md)).
- ⚠️ **Improvement is `null` under 4 graded results.** Two points are a coin-flip,
  and "+40%" from one lucky test reads as a trend. Above that it is the newer half
  of the last ≤10 results minus the older half — **equal halves of what exists**
  (2v2 → 5v5), not a fixed last-5-vs-previous-5, which would print "not enough
  data" to a parent looking at four scores.
- ⚠️ **A month with no work is absent from the trend, not a zero bar.** "Nothing
  was set" is not "scored nothing".
- ⚠️ **`balance > 0` means the family OWES** (the `center_student_finance`
  convention, [FINANCE.md](FINANCE.md)). The label changes with the sign; the
  number is never silently flipped. Cancelled payments are filtered out — a
  cancelled payment is not a receipt.
- ⚠️ **The parent page uses NONE of the three UI kits.** They are role-scoped
  (student / teacher / manager) and a parent is none of the three; plain Tailwind
  keeps the page from inheriting a shell it has no role in.
- ⚠️ **It also lives outside `app/(public)`**, whose layout is the marketing shell
  with Log in / Sign up. A parent is not a lead to convert.
- ⚠️ **localStorage is per browser.** Mum's phone and dad's phone each hold their
  own list — correct for links handed out individually. Clearing browser data
  loses the list and nothing else; a re-scan restores it, which is why the printed
  card says to keep the QR.
- ⚠️ **The claim is a TRANSACTION.** Two phones opening a forwarded link in the
  same second would both see `deviceHash` empty and both write it; the loser
  would hold a secret that no longer matches and be locked out with no
  explanation. Inside a transaction exactly one wins and the other is told 409.
- ⚠️ **Only the HASH of the device secret is stored.** A plaintext secret in the
  document would be replayable by anyone who reads it — an operator, a backup, a
  support export. Plain unsalted sha256 is correct *here* because the input is
  156 bits of CSPRNG output; never reuse that reasoning for a human password.
- ⚠️ **The device secret travels in a HEADER**, never the URL. A query parameter
  would end up in server logs, browser history and every "copy link" the parent
  performs — and the whole point is that it does *not* travel with the URL.
- ⚠️ **A cache hit still proves the device.** The cached entry carries the
  `deviceHash` it was built under; serving a cached report to any device that
  asked would undo the claim for 60 seconds at a time.
- ⚠️ **The report cache and rate limiter are per server INSTANCE** (module-level
  Maps), not Firestore. A shared counter would cost a write per page view to
  defend against page views. It is a cost guard, not an access control.

## Firestore

```
parent_links/{token}                ← ⚠️ the DOCUMENT ID *is* the parent's credential
  token, centerId, studentId, studentName,
  label: "Onasi",                   ← free text, may be empty
  status: 'active' | 'revoked',
  scope: { results, levels, attendance, finance },   ← all booleans
  createdAt: <epoch ms>, createdBy: <manager uid>,
  revokedAt?: <epoch ms>,
  lastViewedAt?: <epoch ms>, viewCount: <number>,

  deviceHash?: <sha256 hex>,        ← ⚠️ the CLAIM: set by the first browser to open it
  claimedAt?: <epoch ms>,
  claimedDevice?: "iPhone · Safari" ← coarse on purpose; the full UA is a fingerprint
```

⚠️ The three `claimed*` fields are **absent** until the link is opened, and are
removed again by `unbind` (`FieldValue.delete()`) — "never opened" and "released"
are the same state, which is what lets one printed QR be re-handed to a parent.

Rules (`firestore.rules`, **section 1.6**): `allow read, write: if false` — for
every client, in every direction. The document id being the secret is what makes a
parent page cost **one `get()`** instead of a query; it is also why a client that
could `list` the collection would hold every family's link in the center.

⚠️ **No composite index**, including the replace query (`centerId ==` +
`studentId ==` + `status ==`), which Firestore serves by merging single-field
indexes — verified against the live project, not assumed. The manager list is
`centerId ==` (+ optional `studentId ==`), sorted in memory —
one QR per parent per student keeps it far below the 500 cap. Do not add an
`orderBy` without deploying the index first.

⚠️ **Storing the token in plaintext is deliberate**, and it is the same call
`center_teacher_credentials` / `center_student_credentials` make ([MANAGER.md](MANAGER.md)):
the manager is the recovery path and must be able to **re-print the same QR**. A
hash would mean every reprint is a new link and every previously printed card is
dead. The collection is unreachable from any client, which is what makes that safe.

## Firestore budget

| Action | Cost |
|---|---|
| Manager opens **Ota-onalar** | 1 roster query + 1 API list query |
| Issue a QR | 2 reads (roster/user check) + 1 write |
| Revoke / re-scope / unbind | 1 read + 1 write |
| First open (the claim) | +1 transactional read/write, once per device |
| **Parent opens the report (all four blocks)** | ~**60–80 reads**, bounded: 1 link + 1 user + 1 center + classes (array-contains) + ≤40 attempts + ≤20 Milliy + ≤20 Rasch + 1 levels + attendance per class over 8 weeks + ≤12 charges + ≤10 payments |
| Parent refreshes within 60 s | **0** — served from the route's cache |
| Parent hammers refresh | 429 after 30 requests/minute per token |

⚠️ Those windows (`PARENT_ATTENDANCE_DAYS`, `PARENT_RESULT_LIMIT`, …) live in
[lib/parentLinks.ts](../lib/parentLinks.ts) and are the only thing standing between
a public URL and an unbounded read bill. Widen them deliberately, not casually.

## Known issues / dead code

- **A forwarded link is claimed by whoever opens it first.** If the manager sends
  it to the wrong contact and that person opens it, the fix is `unbind` (same QR)
  or a new link. The window is real but small, and it is the price of having no
  accounts.
- **Clearing the browser locks a parent out of their own link** — they see 409
  and must ask the center to unbind. Deliberate: the alternative (trusting any
  device that presents the URL) is exactly the rule the center asked to remove.
- **The device secret is per browser, not per person.** A parent using Chrome and
  then Safari on the same phone is two devices to this system.
- **No push/SMS.** The parent must open the link; nothing notifies them of a new
  result. An obvious next step, and the reason `lastViewedAt` is recorded.
- **No teacher comments.** The report carries numbers only; there is no per-student
  free-text channel in the codebase to surface.
- **`parents/{uid}` + `isParentOf()`** — the unused account-based model (above).
- **The manager list caps at 500 links** and sorts client-side. If a center ever
  passes that, the fix is paging with a `centerId + createdAt` index, not a bigger
  limit.
- **`center_attendance_summary` is still unwritten** ([ATTENDANCE.md](ATTENDANCE.md)),
  so the attendance block reads day-docs. If that rollup is ever built, this is one
  of its first consumers.

## How to verify changes

**Rules first — `npm run test:rules`.** `tests/rules/parentLinks.rules.test.mjs`
asserts the collection is unreachable: no get, no list, no create, no update, no
delete — for the owning manager, another center's manager, the student themselves
and a signed-out visitor. ⚠️ If any of those start PASSING, someone opened a hole.

Then `npm run dev`, as a **manager**:

1. Nav → **Ota-onalar**. The roster lists every `center_students` link. Pick a
   student → **QR yaratish** → type "Onasi", leave all four switches on → create.
   A QR appears with a 24-character code under it in `ABCD-EFGH-…` groups.
2. **Chop etish** must open a print window containing ONLY the card (not the
   manager shell). **Havolani nusxalash** copies an absolute URL whose origin is
   the host you are on — check on `localhost:3000` that it is not a production URL.
3. Open the student info dialog for the same student: the *Ota-ona kirishi* section
   shows the "Onasi" chip. Tapping it opens the same dialog in show mode.
4. Press **Telegram** — the Telegram share sheet opens with the link and
   "<child>'s results" prefilled. Press **SMS** — the messaging app opens with the
   same text. On a phone, a **Ulashish** button appears too (`navigator.share`).
5. Issue a SECOND QR for the SAME student. ⚠️ The dialog warns first, and after
   issuing, the toast says the previous link was revoked and the list shows it
   struck through — **one child, one live link**.

As a **parent**, in a private window (signed out — this matters):

6. Open the copied URL. The report loads with no login: name, groups, level,
   results, attendance and payments. ⚠️ Watch the network tab: exactly ONE request
   to `/api/parent/…` and **no Firestore traffic at all**. In Application →
   Local Storage there is now an `edify:parent:device:<token>` entry.
7. Reload immediately — the response says `cached: true` and costs no reads, and
   the request carries the `x-parent-device` header.
8. **Open the same URL in a DIFFERENT browser** (or another private window). It
   must say *connected to another device* — not the report. Back in the manager
   panel the link shows **Ulangan · iPhone · Safari**.
9. Press **Qurilmani almashtirish** in the manager dialog, then reload that second
   browser: it now claims the link and works, while the FIRST browser starts
   getting 409. Exactly one device at a time, and the printed QR never changed.
7. Refresh ~30 times in a minute → the page shows *"wait a moment"* (429), not an
   error.
8. Type the code by hand at `/p` (with the `-` groups, and in lowercase) — it must
   normalize and open. Paste the full URL into the same box — same result.
9. Scan/open a SECOND child's link: `/p` lists both, and the report header shows a
   switcher chip for the other child.

Back as the **manager**, the controls:

10. Turn **To'lovlar** off on the first link. Reload the parent page: the whole
    finance section is gone (and the server never queried the finance collections).
11. **Bekor qilish** (revoke). The parent's next reload says *access was closed*,
    **not** "not found" — and that child disappears from their `/p` list.
12. **Qayta faollashtirish** restores it; the same QR (already printed) works
    again. This is the reason the token is stored in plaintext.
13. The Ota-onalar list shows the view count and last-opened date going up as you
    reload the parent page (they lag by the 60 s cache — that is expected).
