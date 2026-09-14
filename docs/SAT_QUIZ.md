# SAT_QUIZ — the adaptive SAT Math test program

> **Agent workflow:** read this BEFORE touching `app/teacher/sat/*`,
> `app/(student)/sat/*`, `lib/SatMathQuiz.ts`, `lib/SATscore.ts`,
> `lib/SatSession.ts`, `types/SatQuiz.ts`, `services/satMathQuizService.ts`, or
> the `sat_math_tests` / `sat_math_results` collections. Also read
> [QUESTIONS.md](QUESTIONS.md) (the questions these tests embed). Update this
> doc in the same change whenever you alter behavior described here. Index:
> [README.md](README.md).

**Last verified:** 2026-09-11 (introduced).

## Purpose & scope

A teacher builds an **adaptive SAT Math test** — Module 1 (fixed, every
student answers the same one) and two Module 2 pools (**Easier** / **Harder**)
— by picking questions from their own bank and/or writing new ones, publishes
it behind a private 6-digit code, and a student sits it in an interface built
to resemble the real digital SAT (Bluebook): a hideable timer, a question
navigator, mark-for-review, answer elimination (cross-out), a calculator and a
reference-formulas panel. Which Module 2 pool a student is served depends on
their Module 1 score — the real digital SAT's own per-module (not
per-question) adaptivity.

Math ships first. **Reading & Writing is a registry entry only** (`kind:
'soon'`) — a 1,443-question bank exists at `questions.json` (repo root, 4
official R&W domains, Easy/Medium/Hard tagged) but is deliberately **not
imported or wired** in this pass. Adding it later is meant to be additive: a
taxonomy + an import script + a registry flip, the same shape every Milliy
sertifikat subject went from `soon` to `generic`.

### ⚠️ Why this is a NEW subsystem, not a Milliy sertifikat subject

SAT looks superficially like a fourth Milliy sertifikat paper (teacher owns a
paper behind a code, student sits it, one result doc), but three things make
it genuinely different, and each is why it does not reuse that machinery:

| | Milliy sertifikat (`milliy_quizzes`/`teacher_rasch_quizzes`) | SAT Math |
|---|---|---|
| Structure | one flat list of questions | **Module 1 + two Module 2 pools**, chosen by routing |
| Scoring | cohort-relative dynamic marks (`lib/RASCHmarks.ts`, `B = Y + σ`) | **per-student** approximate scaled score (`lib/SATscore.ts`) — the real SAT does not re-price a question by how the class did |
| Question shape | reuses `ExamQuestion`/`lib/ExamTeacher.ts` (blueprint `sectionId`, `testType` Y-1/Y-2/O, block expansion) | **its own small `SatQuizItem`** (`types/SatQuiz.ts`) — always a single `mcq` or `numeric`, never a block; forcing it through `toExamItem` would import DTM-protocol meaning that does not apply |
| Student UI | shared `ExamRunner`/`ExamReview` | **a new runner**, `SatRunner` — Bluebook-style visual language (hideable timer, cross-out, calculator, module transition screen), which is not a "variant" of the existing exam family |
| Code namespace | shared across `milliy_quizzes` + `teacher_rasch_quizzes` (one student code box resolves both) | **its own** — `reserveSatCode`/`findSatTestByCode` only ever look at `sat_math_tests` |

What IS reused, deliberately: the whole v1 question-authoring pipeline
(`toQuestionV1`/`normalizeQuestion`, `/teacher/create/question`, the
`?back=`/`?add=`/`?subject=` round trip via
[returnTo.ts](../app/teacher/create/_components/returnTo.ts)), the topic
taxonomy mechanism, `useExamLockdown` (full-screen + interruption detection,
unchanged), and the `createSessionStore` PATTERN (`lib/SatSession.ts` is a
sibling implementation of the same factory in
[lib/Examsession.ts](../lib/Examsession.ts), not a shared instantiation — SAT's
snapshot shape is different enough, and its own localStorage key, that
touching the shared module for one more caller was not worth the risk to the
three callers already depending on it).

## Key files

| File | Responsibility |
|---|---|
| [types/SatQuiz.ts](../types/SatQuiz.ts) | Document shapes: `SatQuizItem`, `SatMathTest`, `SatMathResult`, and the runner's own `SatExamSnapshot`. |
| [lib/SatMathQuiz.ts](../lib/SatMathQuiz.ts) | Pure layer — `SAT_MATH_DOMAINS` (the 4 domains), `SAT_SECTIONS` (the section registry, Math live / R&W soon), picked-question → `SatQuizItem`, the add check, the routing rule, grading (`isSatItemCorrect`). No Firestore. |
| [lib/SATscore.ts](../lib/SATscore.ts) | The 200–800 **approximate** scaled score. Pure. |
| [lib/SatSession.ts](../lib/SatSession.ts) | The browser-side sitting store — own localStorage key `sat:math:v1`. |
| [services/satMathQuizService.ts](../services/satMathQuizService.ts) | Every read and write, plus `reserveSatCode`/`findSatTestByCode`. Nothing else touches the two collections. |
| [scripts/addSATMathTopics.mjs](../scripts/addSATMathTopics.mjs) | How the `sat-matematika` taxonomy (4 official College Board Math domains) was appended to `data/question_topics.json`. |
| `app/teacher/sat/page.tsx` | The teacher's section hub — `SAT_SECTIONS` cards, Math live. |
| `app/teacher/sat/math/page.tsx` | The teacher's test list: code, status, edit, results, delete. |
| `app/teacher/sat/math/build/page.tsx` | The builder — three module pickers + settings (`?id=` to edit). |
| `app/teacher/sat/math/_components/{SatBankPicker,draft}.tsx/.ts` | The one pool (own bank, filtered to `sat-matematika` + `mcq`/`numeric`) and the localStorage stash for the "write a question" round trip. |
| `app/teacher/sat/math/results/[testId]/page.tsx` | Who sat it; scaled score, route taken, per-domain breakdown, per-question solve rate (plain %, not cohort-priced). |
| `app/(student)/sat/page.tsx` | The student's section hub. |
| `app/(student)/sat/math/page.tsx` | Code box, intro, the sitting, results, past sittings. |
| `app/(student)/sat/_components/SatRunner.tsx` | **The Bluebook-style runner** — module screens, timer, navigator, cross-out, flag, calculator, reference panel. |
| `app/(student)/sat/_components/{SatCalculator,SatReferenceSheet,SatReview}.tsx` | The on-screen calculator (NOT Desmos — see below), the reference-formulas panel, and the per-question review grid. |

## Flows

### The taxonomy: `sat-matematika`, a normal subject

`data/question_topics.json` gained a subject, `sat-matematika`, with the 4
official College Board digital SAT Math domains as topics (Algebra, Advanced
Math, Problem-Solving and Data Analysis, Geometry and Trigonometry), each with
the official published content-category subtopics. This is factual,
non-copyrightable test-specification vocabulary — not excerpted questions.

⚠️ **This is why `/teacher/create/question` needed ZERO new code** to author
SAT Math questions — it already reads `SUBJECTS` off `data/question_topics.json`,
exactly the mechanism biology/chemistry/physics/ona-tili each rode in for free
(docs/QUESTIONS.md). A SAT Math question is authored, stored and normalized
exactly like any other `teacher_questions` v1 document; only `mcq` and
`numeric` are meaningful here (a "student-produced response" grid-in answer
IS a `numeric` question — no new question type exists for it).

### Building — one document, three item arrays, no refs

The builder (`app/teacher/sat/math/build/page.tsx`) has three tabs, one per
module (`module1`, `module2Easier`, `module2Harder`), each backed by
`SatBankPicker` — the teacher's own bank, filtered server-side to
`subject.id == 'sat-matematika'` and client-side to `mcq`/`numeric`
(`isSatAuthorableType`). Writing a new question leaves for the real builder,
`/teacher/create/question?subject=sat-matematika&back=…&module=…`, and returns
with the question already added to **the module the teacher was on** (the
`?module=` query rides the same `?back=`/`?add=` round trip
[returnTo.ts](../app/teacher/create/_components/returnTo.ts) already defines —
see docs/MILLIY_QUIZ.md/[RASCH_QUIZ.md](RASCH_QUIZ.md) for the mechanism in
full; SAT is the third caller).

⚠️ **No blueprint, no quota, no sample paper.** A teacher builds each module to
whatever length they like; publishing only requires all three modules
non-empty. There is deliberately no "Namunaviy variant" sample paper (unlike
the Milliy sertifikat subjects) — no bundled SAT Math content exists yet to
ship one from; a future one is a `data/sat-math-default-paper.json` +
`SAMPLE_FILES`-style addition, not a structural change.

⚠️ **Questions are EMBEDDED SNAPSHOTS, not refs** — the same trade every
teacher-built paper in this repo makes. A whole test costs ONE read however
many students sit it, and freezes the questions so a later correction does not
re-key a test somebody already answered.

⚠️ **A Firestore document is capped at 1 MiB.** `satByteSize` sums all THREE
module arrays; the builder shows the size against `SAT_MAX_BYTES` (900 KB) and
`saveSatMathTest` refuses to write past it.

### The access code — its OWN namespace

Six **digits**, a string everywhere. `reserveSatCode` checks only
`sat_math_tests` — SAT is a separate program with its own code-entry screen
(`/sat`, not `/milliy-sertifikat`), so there is nothing to cross-check the way
`reserveMilliyCode` must check two collections for one shared code box. Still a
check, not a constraint (same accepted limitation the other two subsystems
have).

### The routing algorithm

`routingThreshold` (default `Math.ceil(module1.length / 2)`, teacher-editable)
is a raw correct-answer count. At the end of Module 1:

```
route = module1Correct >= routingThreshold ? 'harder' : 'easier'
```

The route is decided **the moment Module 1 is submitted** (or times out) and
is never re-decided; Module 2 is then served from `test.module2Harder` or
`test.module2Easier` accordingly. ⚠️ **The student is never shown their Module
1 score before or during the transition** — the real digital SAT never reveals
it either, and showing it here would let a student reverse-engineer the
threshold. The transition screen (`SatRunner`'s `'transition'` phase) says only
that Module 1 is complete.

### Sitting it — a NEW runner, not `ExamRunner`

`SatRunner` is a `fixed inset-0 z-[100]` overlay, the same convention
`ExamRunner` established (callers must not wrap it in a `<Page>`), and reuses
`useExamLockdown` unchanged for full-screen + interruption detection. Its own
state machine (`SatRunnerPhase`): `module1 → module1-review → transition →
module2 → module2-review → submitted`. Bluebook-format additions `ExamRunner`
has no equivalent of:

- **Hideable timer** — a toggle that swaps the countdown for `--:--` without
  pausing it (matches the real Bluebook's "hide time" button).
- **Cross-out** — a per-option toggle that strikes an `mcq` choice through
  without deselecting it if it was already chosen; purely a UI aid, never
  graded, never persisted server-side (it lives in the snapshot's
  `crossedOut` map only for reload-survival).
- **Mark for review** — a per-question flag (separately tracked per module —
  `module1Flagged`/`module2Flagged`), surfaced in both the inline flag button
  and the navigator grid.
- **Module review screen** — before a module can be finished, a grid of every
  question (answered/unanswered/flagged) with an explicit confirm dialog. On
  timeout this step is skipped entirely (matches the real test: a module ends
  when the clock does, with no extra step to click through).
- **Calculator** (`SatCalculator`) — ⚠️ **NOT the real Desmos graphing
  calculator** the actual digital SAT embeds. Desmos's embeddable API requires
  an API key registered to this domain under Desmos's own terms
  (desmos.com/api) — something only the account owner can obtain, so this ships
  a small self-built four-function calculator (classic value+pending-operator
  state machine, no `eval`/expression parsing of any kind) as a placeholder.
  Swap it for the real Desmos embed once a key exists; nothing else about the
  runner needs to change.
- **Reference panel** (`SatReferenceSheet`) — ⚠️ **NOT a reproduction of College
  Board's printed reference sheet** (a copyrighted graphic). It is an
  originally-written list of the same standard, public, factual geometry/algebra
  formulas (circle area, Pythagorean theorem, special right triangles, solid
  volumes…), not an image or a copied layout.

### Submit — exactly ONE write

`saveSatMathResult` writes `sat_math_results/{testId}_{uid}` once, at the end
of Module 2 (or its timeout). Deterministic id ⇒ a retake overwrites, the same
rule every exam-shaped result in this repo follows. Stored alongside the score:

- **`items`** — `{ [questionId]: 0 | 1 }`. No block sub-question namespace is
  needed (SAT items are never blocks), so this is keyed by plain question id,
  unlike `examSlotKeys` elsewhere in the repo.
- **`domains`** — raw `{correct, total}` per SAT Math domain, summed across
  both modules. A domain neither module touched is ABSENT, never `{0,0}`.

⚠️ **Unlike the mock exam / Milliy sertifikat papers, a mostly-unanswered
sitting is still saved** (not treated as "abandoned"). SAT here has no ability
model to protect from a distorting zero — a raw, low score is just informative
context for the teacher, the same way a real proctor would record whatever a
student actually did.

### Scoring — `lib/SATscore.ts`, an explicit approximation

`estimateScaledScore(route, correct, total)`: linear from 200 to a
route-dependent ceiling — **800 if routed harder, ~590 if routed easier**
(being routed to the easier module is itself evidence of a lower reachable
ceiling, mirroring the real test's own shape), rounded to the nearest 10.

⚠️ **This is NOT College Board's proprietary IRT-equated score.** No public
equating table exists to reproduce, so this is a transparent, documented
substitute — the same honesty pattern `MILLIY_SUBJECTS.fizika`/`.ona-tili`
already use for their un-encoded, this-repo's-own defaults
(docs/MILLIY_QUIZ.md). Never present `scaledScore` as an official SAT score
anywhere in the UI; both the results page and the student's own screen show it
next to the raw correct/total and a one-line disclaimer.

⚠️ **Scoring is per-student, not cohort-relative.** SAT deliberately does NOT
use `lib/RASCHmarks.ts` (`B = Y + σ`) — that formula re-prices a question by
how the whole class answered it, which is exactly how the real Milliy
sertifikat/DTM protocol is marked but is NOT how the real SAT works. A
student's score here never moves because of how classmates did.

### Reporting

The teacher's results page (`app/teacher/sat/math/results/[testId]/page.tsx`):
sat/average/best scaled-score tiles, a per-domain bar list (weakest first,
aggregated raw counts across every sitting), a dense per-question solve-rate
grid (plain percentage, colour-banded — NOT a cohort-priced ball, unlike the
Milliy sertifikat results pages), and a per-student expandable row (Module 1
score, route badge, Module 2 score, total, scaled score).

The student's own past-sittings list (under the code box) expands into
`SatReview` — a green/red grid per module, tap a cell to open the question in a
dialog. ⚠️ **No "your answer" line** — `items` is an outcome map, never an
answer map, the same cost decision `ExamReview`'s replay mode makes elsewhere
in this repo. `showAnswers` (the teacher's own toggle) still gates whether the
correct answer/explanation are shown.

## Firestore

```
sat_math_tests/{sat_…}
  id, title, description, teacherId, teacherName,
  accessCode: "482913",              ← 6 digits, STRING, OWN namespace
  module1: SatQuizItem[],            ← fixed for every student
  module2Easier: SatQuizItem[],      ← served only if routed "easier"
  module2Harder: SatQuizItem[],      ← served only if routed "harder"
  module1Minutes, module2Minutes,    ← default 35 / 35
  routingThreshold,                  ← module1 correct-count needed to route "harder"
  shuffle, showAnswers,
  status: 'draft' | 'published' | 'closed',
  createdAt / updatedAt: serverTimestamp

sat_math_results/{testId}_{uid}
  testId, testTitle, teacherId, studentId, studentName,
  module1Correct, module1Total, route: 'easier' | 'harder',
  module2Correct, module2Total, correct, total,
  scaledScore,                       ← 200-800 APPROXIMATION, never official
  durationSec, submittedAt: <epoch ms>, examLang,
  items?: Record<questionId, 0|1>,   ← outcomes only, plain question-id keys
  domains?: Record<domainSlug, {correct, total}>
```

Rules (`firestore.rules`, section **12d**) mirror 12b/12c exactly: tests
`read: if isAuth()`, written only by `teacherId`; results read by the student
or the test's teacher, created by the student, updated only by the same
student on the same test, **delete never**.

⚠️ **SAME KNOWN TRAP as `teacher_rasch_quizzes`/`milliy_quizzes`: the test
embeds its questions, and therefore their correct answers, behind
`read: if isAuth()`.** A signed-in student who enumerates the collection can
read the key without ever entering a code. The 6-digit code is a sharing
convenience, not a security boundary.

Index: `sat_math_tests (teacherId ASC, createdAt DESC)`. Every other query is
equality-only, served from single-field indexes.

## Invariants & traps

- ⚠️ **Never write `undefined` to Firestore** — `satQuizItem` spreads optional
  fields (`optionImages`, `acceptedAnswers`, `explanation`, `creatorId`…)
  conditionally, matching the style every other converter in this repo uses.
- ⚠️ **`SatQuizItem` is not `ExamQuestion`.** Do not thread SAT data through
  `lib/ExamTeacher.ts` — its blueprint/`testType`/block machinery encodes the
  Milliy sertifikat DTM protocol, which has no meaning here.
- ⚠️ **The calculator and reference panel are deliberate placeholders**, not
  bugs to "fix" by embedding a real Desmos widget without first obtaining a
  Desmos API key for this domain, and not by scraping/reproducing College
  Board's printed reference sheet graphic.
- ⚠️ **Do not copy `SatRunner` to add a variant.** If Reading & Writing is ever
  built, it will need passages/highlighting that Math does not — extend this
  component deliberately (a shared header/lockdown wrapper, a different body)
  rather than forking it wholesale, the same lesson RASCH_QUIZ.md draws for
  `ExamRunner`.
- ⚠️ **`SAT_SECTIONS` is the single source of truth for which sections exist**
  on both hubs (`app/teacher/sat/page.tsx`, `app/(student)/sat/page.tsx`). A
  section flipped live in one place and not the other is the bug this registry
  prevents — see `MILLIY_SUBJECTS` for the pattern being mirrored.

## Known issues / dead code (verified 2026-09-11)

- **The answer key is readable by any signed-in user** (above). The same
  largest limitation every teacher-built paper subsystem in this repo has.
- **Code uniqueness is a check, not a constraint** (above).
- **Reading & Writing is a registry entry only.** No taxonomy, no import of
  `questions.json`, no builder. `SAT_SECTIONS.reading-writing.kind === 'soon'`.
- **The scaled score is an approximation** (above) — there is no path to the
  real College Board equating without their proprietary data.
- **The calculator is not Desmos** (above) — a self-built substitute pending an
  API key.
- **No sample/starter test** — a teacher must build every test from their own
  bank or by writing new questions; there is no "Namunaviy variant" button.
- **The teacher cannot see what a student ANSWERED**, only whether each
  question was right. Same deliberate cost decision every result collection in
  this repo makes.

## How to verify changes

`npm run dev`, as a **teacher**:

1. `node scripts/addSATMathTopics.mjs` (idempotent; already run when this
   feature shipped) → `/teacher/create/question`: **Fan** offers **SAT
   Matematika** with 4 domains (Algebra, Advanced Math, Problem-Solving and
   Data Analysis, Geometry and Trigonometry). Write 2–3 `mcq` and one
   `numeric` question.
2. `/teacher/sat` → **Math** (Reading & Writing must be inert/unclickable) →
   new test. Build Module 1, Module 2 — Easier, Module 2 — Harder from the
   picker; also use "Create a new question" from inside a module tab and
   confirm the round trip returns to the SAME tab with the question already
   added, at zero extra reads. Publish → 6-digit code shown, copies on tap.
3. Set a low routing threshold on a throwaway test to make "easier" easy to
   trigger for testing.

As a **student**, in another account:

4. `/sat` → **Math** → enter the code → intro card (title, teacher, module
   lengths) → language pick → Start (full screen engages). Answer Module 1
   deliberately below the threshold → submit the module (review grid → confirm)
   → the transition screen shows NO score → Module 2 turns out to be the
   **Easier** pool. Submit → results show route "Easier" and a scaled score
   ≤ ~590. Repeat with a second account answering Module 1 well → routed to
   **Harder** → scaled score can reach the high 700s/800.
5. Exercise the Bluebook UI on a question: hide/show the timer, cross out an
   option (struck through, still selectable, toggle again to un-cross), flag a
   question and see it flagged in the navigator grid, open/close the
   calculator (basic arithmetic works) and the reference panel, reload
   mid-module and confirm it resumes with no extra reads, drop out of full
   screen and confirm the interruption overlay fires with a live count
   (`useExamLockdown`, unchanged behavior from the other exams).
6. Review the just-submitted result inline (per-module green/red grid, tap a
   cell) and again from "Tests I've taken" on the code screen.

Back as the **teacher**:

7. Open **Natijalar** for the test: sat/average/best tiles, per-domain bars
   weakest-first, the per-question solve-rate grid, and the student row
   expanding into Module 1/Module 2/route/total.
8. Close the test; the student's code entry must now say the test is closed,
   not "not found".
