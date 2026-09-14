# IELTS Platform Upgrade Plan

> **Status: IMPLEMENTED (historical).** The core loop shipped 2026-07-27 and the feedback-loop
> upgrade (AI writing estimate, self-check, teacher drill-down/queue, test metas) 2026-07-29.
> [IELTS.md](IELTS.md) is the spec of record — this file is kept for design/product rationale only.
> Based on: (a) a full audit of the current IELTS code, (b) competitive research of world-class
> IELTS platforms (official IDP/British Council CD-IELTS, IELTS Online Tests, TestGlider, E2,
> BestMyTest, GlobalExam, Road to IELTS, Magoosh, Mini-IELTS, SmallTalk2Me, IELTS Arena, and the
> teacher-brand content sites), July 2026.

---

## 1. Executive summary

Today the IELTS subsystem is **two disconnected halves**:

1. **Groups** (`ielts_groups`) — working: teacher creates groups, `I-XXXX` join codes, join
   requests with approve/reject, roster.
2. **Reading authoring** (`ielts_reading_tests`) — a genuinely strong builder covering **13
   official reading question types**, plus a teacher-only simulator with a 903-line renderer.

**Nothing connects them.** There is no student test-taking (the simulator's Submit button has no
`onClick`), no attempts, no grading, no band conversion, no listening/writing/speaking, and every
band number shown in the UI is hardcoded mock data. The answer key ships inside the test document
readable by any signed-in user, and the join-requests subcollection rules are wide open.

**The upgrade** turns this into a complete teacher-led IELTS practice platform:

- Teacher authors **Reading AND Listening** tests (full official question-type taxonomy).
- Teacher **assigns tests to groups** with deadlines, modes, and attempt limits.
- Students take tests in a **faithful computer-delivered-IELTS runner** (split screen, 40-question
  palette, review flags, highlighter, red-flash timer, play-once audio).
- **Server-side grading** with exam-grade answer checking and official raw→band conversion.
- **Review mode** with "locate in passage" and per-question explanations.
- **Real analytics**: per-question class stats, question-type weakness, band trajectory vs target.
- Later phases: AI Writing/Speaking scoring via the existing Gemini + credit infrastructure, and
  gamification (XP/streaks) — which **no serious IELTS platform has**, and we already own.

**The market opening is real.** Research conclusion in one line: *interface fidelity, instant AI
scoring, and a teacher/class layer exist today only on three different platforms — nobody bundles
them.* We already have the teacher/group infrastructure and an AI stack; the missing middle is the
student runner + grading engine.

---

## 2. Current state audit (what exists, what's broken)

### 2.1 Assets to keep

| Asset | Verdict |
|---|---|
| Reading builder (`app/teacher/ielts/reading/manual/`) — 13 question types, gap-token grammar `[0]`, word-bank vs free-text mode, smart paste, localStorage draft | **Keep as-is**, extend |
| Question renderer (`reading/view/[id]/_components/question_renderer.tsx`, 903 lines) | **Reuse** as the base of the student runner (needs student-ui kit pass) |
| `ielts_groups` + join codes + requests + roster | **Keep**, fix security + add uniqueness |
| Firestore rules for `ielts_groups/{id}/assignments` and `ielts_attempts` (written but never used) | **Activate** — the original architecture anticipated exactly this |
| Regular runner patterns (session resilience in localStorage, tab-switch anti-cheat, deadline enforcement in rules, deterministic attempt IDs) | **Clone the patterns** into the IELTS runner |
| `types/ielts.ts` dead types (`IeltsMasterTest`, `IeltsAttempt`, …) | **Replace** with real types matching the new model |

### 2.2 Defects to fix (independent of new features)

1. **Answer-key leak** — `correct_answer` is stored inline in `ielts_reading_tests`, readable by
   any authenticated user. Must be split out before any student can open a test.
2. **`ielts_groups/{id}/requests` rules are `read, write: if isAuth()`** — any user can read every
   join request (PII) and forge/delete any request.
3. **Any signed-in user can list all `ielts_groups`** and harvest join codes.
4. **Join code uniqueness** — none. `JoinIeltsModal` takes `snap.docs[0]` blindly; duplicate codes
   route students into the wrong group.
5. **Approve request = two non-atomic writes** (arrayUnion then deleteDoc) — use a batch.
6. `saveIeltsReadingTest` uses `setDoc` without merge → **`createdAt` is reset on every save**; it
   also reads `auth.currentUser` directly (race before hydration).
7. Edit flow is a localStorage hack that clobbers any in-progress draft (fix: draft key per test id).
8. Mock components shipping fake data: `IeltsPulseDashboard` (band 6.4), `IeltsRosterTab`
   (`currentBand: 6.5`), `IeltsUnifiedFeed` (5 fake assignments), `DATABASE_TESTS` fake row,
   no-op "Assign Mock" button, 404 hub links for listening/writing/speaking.
9. `ielts_attempts` rules exist but have **no field validation** — a student could write any band
   they like. (Solved structurally: attempts become server-written only.)

---

## 3. What world-class looks like (research digest)

### 3.1 The ground truth: official computer-delivered IELTS interface

The market-leading feature is literally *faithful simulation* (~62% of first-time CBT takers
report being tripped up by the interface itself). What the real thing does:

- **Countdown timer** that turns red/flashes at 10 and 5 minutes; auto-submit at zero.
- **Bottom palette with all 40 question numbers**, free navigation, answered state shown; a
  **Review checkbox** turns a question's palette square into a circle so you can return to it.
- **Reading = split screen**: passage left, questions right, independent scrolling.
- **Highlight + Notes** via select/right-click on the passage; persists across navigation.
- **Listening protocol**: volume-check step → audio **plays once, no pause** → questions visible
  and navigable during playback → **2 minutes of "check your answers"** at the end (not the paper
  test's 10-minute transfer — most clones get this wrong).
- Drag-and-drop for matching headings / features / sentence endings / word-bank summary.
- Adjustable font size; Writing editor with live word count and no spellcheck.

### 3.2 The three-pillar gap (our opening)

| Pillar | Who owns it today | Us |
|---|---|---|
| CBT interface fidelity | IELTS Online Tests, IELTS Arena | Build (runner) |
| Instant AI scoring (W/S) | TestGlider, SmallTalk2Me | Phase 4 — Gemini stack already exists |
| Teacher/class layer | Road to IELTS + GlobalExam (weakly) | **Already have groups**; add assignment + analytics |

Nobody bundles all three. Additional confirmed gaps nobody serves well: **per-question class
analytics** ("40% of my group failed Q23"), **band trajectory vs target per student**, transparent
**exam-grade answer checking**, and **gamification** (absent category-wide — we have XP/streaks
/leaderboards already built).

### 3.3 Features adopted into this plan (from the ranked top-20)

Must-have (Phases 1–3): faithful exam mode; correct listening protocol; full question-type engine;
exam-grade answer checker; official raw→band tables (Academic vs GT Reading differ); "Locate &
Explain" review; simulation-vs-practice dual mode; question-type analytics; assign-to-group with
deadlines; class dashboards; target-band tracking.

Later (Phases 4–5): AI Writing scoring on TA/CC/LR/GRA with sentence-level feedback quoting the
student's own text; 3-part Speaking simulator (cue card, prep/talk timers, transcript, FC/LR/GRA/P
bands); diagnostic entry test; study-plan generator; model-answer library; strategy micro-lessons
linked from failures; XP/streak integration; social proof (taken-counts, per-question difficulty).

---

## 4. Product design

### 4.1 Teacher experience

**Hub (`/teacher/ielts`)** — real cards: Reading (exists), **Listening (new)**, Writing (Phase 4),
Speaking (Phase 5), Groups.

**Listening builder (`/teacher/ielts/listening/manual`)** — same two-step, split-pane pattern as
reading, but:
- Left pane = **4 sections** (Part 1–4), each with an **audio file** (MP3/M4A upload to Firebase
  Storage under `ielts_audio/{testId}/…`) — one audio per part (real IELTS structure), plus an
  optional transcript textarea per part (powers "locate in transcript" review).
- Right pane = the same question-block editors, reusing the reading editors 1:1 for: note/form/
  table completion (`table_completion` covers form/note via headers), MCQ (single + multi),
  matching (`matching_features`), sentence completion, short answer, flowchart completion, and
  **plan/map/diagram labelling** (existing `diagram_completion` with image upload — already built).
- 40 questions / 10 per part convention (advisory, like reading's 40).

**Reading builder upgrades** (small):
- `test_category: 'academic' | 'general'` field (different band tables).
- Optional `word_limit` per question block (e.g. 2 = "NO MORE THAN TWO WORDS AND/OR A NUMBER") —
  enforced by the grader and shown to students.
- Answer alternates syntax documented in the UI: `(the) library`, `taxi/cab` — grader parses it.
- Optional `explanation` field per question row (powers review mode; can be AI-generated later).
- Draft key becomes `ielts_reading_draft_{testId}` (fixes the edit-clobber hack).

**Assign to group** — the "Assign Mock" button becomes real. From a group page (or from the test
library), the teacher picks a test (own library; reading or listening), then:
`mode` (simulation | practice), `openAt`, `dueAt`, `allowedAttempts`, `resultsVisibility`
(`always` | `after_due` | `never` — same vocabulary as regular assignments), assigned students
(`all` or subset). Creates a doc in `ielts_groups/{groupId}/assignments` (rules already exist).

**Group dashboard becomes real**:
- **Pulse tab**: real group average band, band trend vs `targetBand`, recent submissions feed,
  "needs attention" (students below target / not submitted) — all derived from `ielts_attempts`.
- **Assignments tab**: real assignment list with completion counts, average band, and a
  **per-question analytics drill-down**: % correct per question, worst question types.
- **Students tab**: real `currentBand` (latest/average from attempts), per-student band trajectory
  sparkline vs target (charts via `components/ChartFrame.tsx`).

### 4.2 Student experience

**`/ielts` hub** — group cards become **clickable** → `/ielts/[groupId]`.

**Group page (`/ielts/[groupId]`)** — new: assignment list (open / due / completed, with band
result chips), my band trajectory vs group target, question-type weakness summary ("You miss
T/F/NG most — 45% accuracy").

**Test runner (`/ielts/[groupId]/test/[assignmentId]`)** — the centerpiece. Faithful CD-IELTS:
- Split-pane (passage | questions) for reading; for listening, audio player + questions with the
  official protocol in simulation mode (volume check screen → play once, no pause/seek → 2-minute
  check screen at the end). Practice mode allows replay/seek and pause.
- Bottom **1–40 palette** with answered/unanswered states + **review flag** (square→circle).
- Countdown timer, red at 10 and 5 minutes, **auto-submit at zero**.
- Select-to-highlight on the passage (existing simulator behavior), font-size control.
- All 13+ question types rendered via the ported `question_renderer` (rebuilt on the student-ui
  kit, trilingual instructions chrome, kit tokens only).
- **Session resilience** cloned from the regular runner: `localStorage` session with `endTime`
  clamped to `dueAt`, restored on reload, cleared only after successful submit; tab-switch
  counting.
- Submit → server grades → result screen: raw score /40, **band score**, per-type breakdown.

**Review mode** (gated by `resultsVisibility`): your answer vs correct answer per question,
**"Locate" button highlighting the evidence** in the passage (we already store
`passage_reference` per question!) or the transcript excerpt for listening, plus the teacher's
`explanation` if present. This is IOT's most-loved feature and we get it nearly free.

### 4.3 Modes

- **Simulation** — strict: full timer, play-once audio, no reveal until submitted.
- **Practice** — configurable: optional timer, replayable audio, same grading. (Per-assignment
  choice by the teacher; a student self-practice library can come in Phase 3.)

---

## 5. Data architecture

### 5.1 Collections (additive; existing shapes untouched)

```
ielts_reading_tests/{testId}        # EXISTS — kept; new saves stop embedding correct_answer
  ... existing fields ...
  test_category : 'academic' | 'general'      # NEW (default 'academic')
  answers_split : true                        # NEW marker — doc contains no correct_answer
  # per question block, NEW optional: word_limit: number
  # per question row,  NEW optional: explanation: string
  # correct_answer REMOVED from new/re-saved docs (see ielts_answer_keys)

ielts_listening_tests/{testId}      # NEW — parallel shape to reading
  test_id, test_title, module: 'listening', total_time_minutes (default 30+2 check),
  total_questions, teacherId, createdAt, updatedAt, status, answers_split: true
  parts: [                          # exactly 1–4 parts (real IELTS: 4)
    { part_number: 1..4,
      audio_url: string,            # Firebase Storage download URL
      audio_duration_seconds: number,
      transcript: string,           # optional; powers locate-in-transcript review
      questions: QuestionBlock[]    # same block shapes as reading
    }
  ]

ielts_answer_keys/{testId}          # NEW — the split key, one doc per test (either skill)
  testId, teacherId, skill: 'reading' | 'listening'
  keys: {                           # flat map keyed by global question_number
    "1": { answer: string | string[],   # supports "(the) library", "taxi/cab" alternates
           type: string,                # question type (for per-type analytics)
           word_limit?: number },
    ...
  }
  # Rules: read/write only when ielts_(reading|listening)_tests/{testId}.teacherId == uid.
  # The grading API route reads it with the Admin SDK.

ielts_groups/{groupId}              # EXISTS — kept; requests/roster flows kept
ielts_groups/{groupId}/assignments/{assignmentId}    # ACTIVATED (rules already exist)
  testId, skill: 'reading' | 'listening',
  testTitle, questionCount, totalTimeMinutes,        # snapshots for listing without a test read
  mode: 'simulation' | 'practice',
  openAt: Timestamp | null, dueAt: Timestamp | null,
  allowedAttempts: number,          # default 1
  resultsVisibility: 'always' | 'after_due' | 'never',
  assignedTo: 'all' | string[],
  teacherId, createdAt, status: 'active',
  completedBy: string[]             # server-written arrayUnion on submit

ielts_attempts/{uid}_{groupId}_{assignmentId}        # ACTIVATED — deterministic id (regular-runner pattern)
  userId, userName, groupId, assignmentId, testId, skill,
  mode, answers: Record<questionNumber, string | string[]>,
  rawScore: number, totalQuestions: number,
  bandScore: number,                # e.g. 6.5
  perQuestion: Record<qn, { correct: boolean, type: string }>,   # analytics fuel
  typeStats:  Record<type, { correct: number, total: number }>,
  tabSwitches: number, timeSpentSeconds: number,
  attemptsTaken: number,            # increment, like regular attempts
  startedAt, submittedAt: Timestamp
  # WRITTEN ONLY BY THE SERVER (Admin SDK). Client create/update/delete: denied.
```

Notes:
- **No migration needed**: old reading test docs still work in the teacher simulator; the *student
  runner refuses tests without `answers_split`* and the teacher UI shows a one-click
  "Secure & publish" re-save that strips answers into `ielts_answer_keys`. (Old docs leak keys
  only as much as they already do today; the leak stops the moment a test is assigned.)
- `studentIds` stays an array on the group doc (fine at this scale; per-member metadata like
  current band is *derived from attempts*, not stored on membership).

### 5.2 API routes (first IELTS server boundary — `app/api/ielts/*`)

All verify the Firebase ID token (same pattern as existing server guards).

| Route | Does |
|---|---|
| `POST /api/ielts/submit` | Verify: member of group, assignment open (`openAt`/`dueAt`), attempts remaining. Load `ielts_answer_keys/{testId}` via Admin SDK, grade with the normalizer, compute band, write `ielts_attempts` doc + `arrayUnion` into `completedBy`, return `{rawScore, band, perQuestion}` (perQuestion withheld if `resultsVisibility` says so). |
| `GET /api/ielts/review?attemptId=` | Return graded detail + correct answers + locate data, gated by `resultsVisibility` (or requester is the teacher). |
| `POST /api/ielts/join` | Join by code server-side: exact-match on unique code, create request (or direct-join if group setting allows). Closes the "list all groups / harvest codes" hole so group `read` rules can be tightened to members+teacher. |

Client SDK keeps handling: authoring (teacher-owned docs), group snapshots, assignment reads.

### 5.3 Rules changes (`firestore.rules`)

1. `ielts_groups`: `read` → teacher, members (`request.auth.uid in resource.data.studentIds`), or
   super admin. (Join goes through the API now.)
2. `requests` subcollection: create → only `request.auth.uid == studentId` via API or validated
   client write; read/delete → group teacher only (+ the student may delete their own).
3. `ielts_answer_keys`: read/create/update/delete → owning teacher only.
4. `ielts_listening_tests`: same as reading tests (authenticated read of the *public* doc is now
   safe because it contains no answers; tighten later if tests should be teacher+assignee only).
5. `ielts_attempts`: `create, update, delete: false` for clients (server-only writes); read →
   owner or group teacher (rule already exists, keep).
6. Deploy with `npx firebase-tools deploy --only firestore:rules,firestore:indexes`.

New composite indexes: `ielts_attempts (groupId ASC, submittedAt DESC)`,
`ielts_attempts (userId ASC, submittedAt DESC)`, plus
`ielts_listening_tests (teacherId ASC, createdAt DESC)` if we add ordering to the list page.

### 5.4 Grading engine (`lib/ielts/grading.ts` — server-imported; band tables also client-safe in `lib/ielts/bands.ts`)

**Answer normalization pipeline** (the "exam-grade checker" almost nobody implements properly):
1. Trim, collapse internal whitespace, casefold.
2. Word-limit check if `word_limit` set — **hyphenated words count as one word**; a number
   (digits, `5,000`, `12:00pm`, `10-06-2019`) counts as one "number".
3. Alternates: key `taxi/cab` → either accepted; `(the) library` → optional token; arrays of
   alternates supported.
4. UK/US spelling equivalence (curated map: colour/color, centre/center, programme/program, …).
5. Digit↔word number equivalence (`2` = `two`, up to 100).
6. Singular/plural is **strict** (matches official marking).
7. Letter answers (A–H, i–viii, T/F/NG) case-insensitive; multi-selects order-insensitive;
   `list_selection` graded per-slot against the answer set.
8. No negative marking; 1 mark per question number.

**Band conversion** (`lib/ielts/bands.ts`), published as "indicative":

| Band | Listening | Academic Reading | GT Reading |
|---|---|---|---|
| 9.0 | 39–40 | 39–40 | 40 |
| 8.5 | 37–38 | 37–38 | 39 |
| 8.0 | 35–36 | 35–36 | 37–38 |
| 7.5 | 32–34 | 33–34 | 36 |
| 7.0 | 30–31 | 30–32 | 34–35 |
| 6.5 | 26–29 | 27–29 | 32–33 |
| 6.0 | 23–25 | 23–26 | 30–31 |
| 5.5 | 18–22 | 19–22 | 27–29 |
| 5.0 | 16–17 | 15–18 | 23–26 |
| 4.5 | 13–15 | 13–14 | 19–22 |
| 4.0 | 10–12 | 10–12 | 15–18 |

Partial-test grading (a 13-question single passage in practice mode) shows raw + % and an
*extrapolated* indicative band, clearly labelled.

---

## 6. UI plan

### 6.1 New/changed routes

| Route | Role | Status |
|---|---|---|
| `/teacher/ielts/listening` (+ `/manual`, `/manual/[id]`, `/view/[id]`) | teacher | NEW (mirrors reading) |
| `/teacher/ielts/groups/[groupId]` — assign modal, real Pulse/Assignments/Students tabs, per-question analytics | teacher | REWIRE |
| `/ielts/[groupId]` | student | NEW group page |
| `/ielts/[groupId]/test/[assignmentId]` | student | NEW runner (chrome-suppressed full-screen, like the regular test runner) |
| `/ielts/[groupId]/review/[attemptId]` | student | NEW review mode |

### 6.2 Kit compliance (hard rules)

- Everything under `app/(student)/ielts/**` uses **`@/components/student-ui` only** + kit tokens
  (no hardcoded colors/radii/shadows), `useStudentLanguage()` trilingual dicts, `sToast`.
  The ported question renderer gets a student-ui pass (it currently imports teacher kit).
- Teacher pages stay on `@/components/ui` + `useTeacherLanguage()`.
- Charts (band trajectory, per-question bars) go through `components/ChartFrame.tsx`.
- Never write `undefined` to Firestore — optional fields built conditionally.

### 6.3 Reuse map

| Existing | Reused for |
|---|---|
| `question_renderer.tsx` (903 lines, all 13 types) | Student runner + listening rendering (same block shapes) |
| Regular runner session/anti-cheat/submit patterns | IELTS runner |
| `diagram_completion` editor + Storage upload | Listening map/plan labelling |
| `preview.tsx`, `passsage.tsx` (keep the typo — load-bearing) | Listening builder panes |
| Teacher simulator (`reading/view/[id]`) | Becomes "preview as student" using the same runner internals |

---

## 7. Phased implementation

**Phase 1 — The core loop (Reading, assign → take → grade → review).** The answer-key split +
"Secure & publish", grading engine + band tables, `/api/ielts/submit|review|join`, rules + indexes
deploy, assignment creation UI (real "Assign Mock"), student group page, the full CD-IELTS reading
runner with session resilience, result screen, review mode with Locate. *This alone makes the
platform usable end-to-end.*

**Phase 2 — Listening.** Listening builder (4 parts, audio upload, transcripts), listening runner
protocol (volume check, play-once, 2-min check screen; replay in practice mode), listening band
table, locate-in-transcript review.

**Phase 3 — Analytics & polish.** Real Pulse dashboard, per-question class analytics, per-student
band trajectory vs target, student question-type weakness card, per-test question-type breakdown
chips on library cards, group defect fixes not needed earlier (unique join codes retrofit,
batched approve), student self-practice library (teacher publishes tests as open practice).

**Phase 4 — AI Writing (uses existing Gemini + credit gatekeeper).** Writing task authoring
(Task 1 image/prompt + Task 2), CD-IELTS writing editor (word count, tabs, no spellcheck), Gemini
scoring on TA/TR·CC·LR·GRA quoting the student's own sentences, model answer generation, teacher
override of AI band. Follows the check-permission → generate → deduct pattern from docs/AI.md.

**Phase 5 — Speaking + gamification.** MediaRecorder 3-part speaking simulator (Part 2 cue card
with 1-min prep / 2-min talk), Gemini multimodal transcript + FC/LR/GRA/P bands; XP/streak
integration for submitted attempts, leaderboard surface, diagnostic entry test, study-plan
generator.

Each phase: update `docs/IELTS.md` in the same commit; append to `ANDROID_STUDENT_IMPACT.md`
(all student pages/flows + Firestore shapes) and `ANDROID_IMPACT.md` where shared contracts move;
Firestore shape changes are **additive-only** (Android clients lag web deploys).

---

## 8. CONFIRMED decisions (user, 2026-07-27)

1. **Scope this round**: Phases 1 + 2 + the **admin platform dataset** (below). Analytics next.
2. **Server-graded submissions** via `/api/ielts/submit` — confirmed.
3. **XP/streaks from day one** — IELTS submissions award XP via the existing gamification stack.
4. **Group read tightening** after `/api/ielts/join` — confirmed.
5. **Separate `ielts_listening_tests` collection** — confirmed.
6. **Uzbek-first trilingual** UI — confirmed.
7. **Design: super-minimalistic and fully responsive.** Phone-first; the runner uses a
   **Passage/Questions tab toggle** on mobile (sticky toggle, two full-screen panes).
8. **Platform dataset** (ready practices for all 4 skills, managed in the admin panel):
   - Platform tests live in the same collections with `source: 'platform'` (admin-written via
     god-mode rules; `teacherId: null`).
   - Admin gets the full Reading/Listening builders at `/admin/ielts` (reused components), can
     **promote** any teacher test into the dataset, and can **import tests by pasting JSON** —
     the JSON is schema-validated against the test structure before anything is written.
   - **Teachers** can assign platform tests to groups exactly like their own tests.
   - **Students** get a Practice Library on `/ielts`: take any platform test anytime in practice
     mode, **unlimited retakes with full attempt history** (band trajectory stays honest).
9. **Writing & Speaking now, teacher-graded; AI later.**
   - Admin/teachers author Writing tasks (`ielts_writing_tests`: Task 1 prompt + optional image,
     Task 2 prompt, optional model answers) and Speaking sets (`ielts_speaking_tests`: Part 1
     questions, Part 2 cue card with 1-min prep / 2-min talk, Part 3 questions).
   - Students submit essays (CD-IELTS editor: word count, no spellcheck) / record audio
     (MediaRecorder → Storage). Group teacher grades with band + comments.
   - Self-practice W/S submissions outside a group are stored ungraded, with model answers shown.
   - Attempts for W/S: `status: 'pending_review' | 'graded'`, `teacherGrade: {band, comments}`.

---

## 9. What this gives you that competitors don't (the pitch)

1. **The bundle**: CBT-faithful runner + instant scoring + teacher/group layer in one product.
2. **Teacher-authored content engine** — every competitor is either a content site with no engine
   or an engine with fixed content; you let every learning center author its own bank.
3. **Per-question class analytics + band trajectory vs target** — genuinely unserved.
4. **Exam-grade answer marking** with transparent rules — sloppy everywhere else, and students
   notice.
5. **Locate & Explain review** — the single most-loved review feature in the market, nearly free
   for us because `passage_reference` is already authored per question.
6. **Gamification runway** — XP, streaks, leaderboards already exist in the platform; no IELTS
   competitor has them.
7. **AI runway** — Gemini + credit limits already built; AI Writing/Speaking scoring is a phase,
   not a project.
8. **An explicit question-type coverage matrix** — even official products only market "all
   question types" vaguely; test cards showing the exact type mix (e.g. "7 × T/F/NG, 6 × Summary")
   à la Mini-IELTS, computable for free from our block structure, plus a published 13+7-type
   coverage checklist, is itself a credibility feature.
9. **The official scored-mock void**: IELTS Progress Check (the only examiner-marked official
   mock, $49.99) shut down June 2024 with no replacement — teacher-graded mock results with band
   scores from a real teacher is exactly what a learning-center platform can offer.
