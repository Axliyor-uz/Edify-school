# RASCH_QUIZ — teacher-built Rasch papers, opened by a 6-digit code

> **Agent workflow:** read this BEFORE touching `app/teacher/milliy-sertifikat/math/*`,
> `app/(student)/raschmodel/quiz/`, `lib/RASCHquiz.ts`,
> `services/teacherRaschQuizService.ts`, the shared runner components in
> `app/(student)/raschmodel/_components/`, or the `teacher_rasch_quizzes` /
> `teacher_rasch_results` collections. Update it in the same change whenever you
> alter behavior described here. Index: [README.md](README.md).
> The ability model itself (θ, levels, diagnosis) is in [STUDENT.md](STUDENT.md)
> and [RASCH_SKILLS.md](RASCH_SKILLS.md); the question schema is in
> [QUESTIONS.md](QUESTIONS.md).

**Last verified:** 2026-08-01 (the marking formula is now **base + difficulty bonus**, `B = Y + σ`); 2026-07-31: the question-builder round trip is closed — `?back=`/`?add=`; 2026-07-30: moved to `app/teacher/milliy-sertifikat/math`; full-screen exam lockdown; Milliy sertifikat hub is a second entry point to this same builder; dynamic per-question marks 2026-07-29.

## Purpose & scope

`/raschmodel/exam` draws a 45-question paper from the blueprint. That measures a
student against the national spec, but a teacher cannot say *which* 45. This
subsystem lets them: pick questions from either bank or write new ones, publish
the paper behind a private six-digit code, and see who sat it.

The paper is **not a second test system**. It is sat in the same runner, graded
by the same functions, and scored into the same `RASCH_levels/{uid}` document as
a mock exam — which is the whole reason it is 45 questions.

### 🟢 This IS the Milliy sertifikat maths paper (2026-07-30)

The name "Rasch paper" describes the ability model, not the exam. The exam is the
**Milliy sertifikat** maths paper: `EXAM_BLUEPRINT` encodes the DTM protocol's
own sections (Y-1 #1–32, Y-2 #33–40, O #41–45) and `RASCH_QUIZ_TOTAL` is its
length. Two entry points now reach this same builder, deliberately:

🟢 **The routes MOVED on 2026-07-30** and the create hub's card is gone:

| | Before | Now |
|---|---|---|
| Teacher | `/teacher/create/rasch/*` + a card in the create hub | **`/teacher/milliy-sertifikat/math/*`**, reached from the subject hub's **Matematika** card only |
| Student | `/raschmodel` as its own nav item | `/raschmodel` unchanged, but reached from the student's **Milliy sertifikat** hub |

⚠️ **The student suite was deliberately NOT moved** — `/raschmodel/*` is a whole
suite with many internal links; only the navigation changed. ⚠️ The static `math`
segment beats its sibling `[subject]` dynamic route, which is why
`genericSubject()` also refuses `'math'`.

⚠️ **Do not "fix" this by building a second maths paper system.** A separate
collection was proposed and rejected: it would mean two builders, two collections
and two student runners for one 45-question exam. If a Milliy sertifikat maths
paper ever has to differ from this one, change THIS subsystem — and read the quota
invariants below before you do. The non-maths subjects have their own subsystem:
[MILLIY_QUIZ.md](MILLIY_QUIZ.md).

## Key files

| File | Responsibility |
|---|---|
| [types/TeacherRaschQuiz.ts](../types/TeacherRaschQuiz.ts) | The document shapes: `TeacherRaschQuiz`, `RaschQuizItem`, `RaschQuizResult`. |
| [lib/RASCHquiz.ts](../lib/RASCHquiz.ts) | Pure layer — code generation, picked-question → stored item, `hydrateQuiz`, slot/topic/difficulty counts, the per-dimension quota rules (`checkQuizAdd`, `quizQuotaGaps`), size guard. No Firestore. |
| [lib/RASCHdefaultPaper.ts](../lib/RASCHdefaultPaper.ts) | The **default paper** — validates `data/rasch-default-paper.json` and turns it into 45 `RaschQuizItem`s. Pure; no Firestore. |
| [data/rasch-default-paper.json](../data/rasch-default-paper.json) | **The content of the default paper — the only file to edit to change it.** Its own `_readme` key documents the per-entry fields. |
| [services/teacherRaschQuizService.ts](../services/teacherRaschQuizService.ts) | Every read and write. Nothing else touches the two collections. |
| `app/teacher/milliy-sertifikat/math/page.tsx` | The teacher's papers: code, status, edit, results, delete. |
| `app/teacher/milliy-sertifikat/math/build/page.tsx` | The builder (`?id=` to edit). |
| `app/teacher/milliy-sertifikat/math/_components/QuestionPickers.tsx` | The two pools: `MyBankPicker` (own `teacher_questions`, default, with the closed/open filter) and `BankPicker` (`questions1`). |
| `app/teacher/milliy-sertifikat/math/_components/draft.ts` | The localStorage stash that survives leaving to write a question. |
| [app/teacher/create/_components/returnTo.ts](../app/teacher/create/_components/returnTo.ts) | The `?back=` / `?add=` contract — how a builder sends a teacher to write a question **and gets them back with it**. Shared with the subject papers. |
| `app/teacher/milliy-sertifikat/math/results/[quizId]/page.tsx` | Who sat it; per-dimension 0–5 levels, per class **and per student**. |
| [lib/RASCHmarks.ts](../lib/RASCHmarks.ts) | **Dynamic marks** — a guaranteed base per test type plus a share of the paper's difficulty budget, `B = Y + σ`, summing to exactly 100. Pure. ⚠️ **Shared with every Milliy sertifikat subject** since 2026-07-30 ([MILLIY_QUIZ.md](MILLIY_QUIZ.md)); the only maths-specific part is the `printed` display value, which is an argument to `paperMarks`. |
| [lib/RASCHband.ts](../lib/RASCHband.ts) | Band → colour/name, kit-agnostic. ⚠️ Read by BOTH UI kits — keep it free of component imports. |
| `app/(student)/raschmodel/quiz/page.tsx` | Code entry → intro → sitting → results, plus the student's own **sat-papers list** (`listMyQuizResults`). |
| `app/(student)/raschmodel/_components/ExamRunner.tsx` | **The paper**, shared with the mock exam. |
| `app/(student)/raschmodel/_components/ExamReview.tsx` | **The per-question review**, shared with the mock exam — a grid of slot numbers, one question per dialog. `outcomes` puts it in **replay mode** for a paper sat earlier. |

## Flows

### Building — one document, no refs

The builder has TWO pools and two ways to grow them.

1. **Mening savollarim** (the default tab) — the teacher's own
   `teacher_questions`, via `fetchMyQuestionsPage`, so blocks, images and typed
   answers arrive already normalized. A paper is normally built from questions a
   teacher wrote, which is why this tab comes first. Two filter rows, and they
   are applied in **different places on purpose**:
   - **Savol turi — Hammasi / Yopiq / Ochiq**, via `isClosedQuestion`
     ([types/question.ts](../types/question.ts)): a `shared_options` block counts
     as closed, a `multi_part` block only when every part carries options,
     exactly as `toExamItem` files them. ⚠️ **Client-side.** In Firestore it
     would need a `type in […]` equality beside `creatorId` +
     `orderBy createdAt` — a second composite index — and still could not
     express the per-part rule. So a filtered press walks up to **3 pages (30
     documents)** until something matches, and the picker prints what it read.
   - **Kim yozgan — Hammasi / AI / O'zim**, via `fetchMyQuestionsPage(…,
     methods)`: a `creationMethod in […]` on the *existing*
     `creationMethod + creatorId + createdAt` index, so it is **server-side** —
     a filtered page still bills 10 documents and shows all 10. The lists cover
     the legacy strings too (`general_ai`, `by_prompt`, `by_image`, `custom`…);
     **AI** includes image-read questions, since a machine wrote those as well.
     ⚠️ A document with no recognizable method appears **only** under Hammasi —
     guessing would file somebody's AI question under "written by me".
   Every row also carries the **quota badge of the dimension the question would
   land in** (`Geometriya 3/14`), and its Add button is disabled — reading
   *to'ldi* — once that dimension is at quota. `roomForItem` builds the item with
   the same `teacherQuizItem`/`bankQuizItem` the add uses, so the badge names the
   dimension the pick will actually move.
2. **Milliy baza** — `questions1` by chapter × difficulty, for topping up the
   sections the teacher has not written for yet. ⚠️ The query is exactly
   `topicId + chapterId + difficultyId` ordered by `rand`, the SAME single
   composite index the exam sampler rides. Adding a `subtopicId` equality, or
   ordering by anything else, silently demands a second index. The first page
   starts at a random `rand` threshold so two teachers building on the same
   chapter do not get the same ten questions; "load more" walks on from there. A
   pre-backfill document has no `rand` and is invisible here, exactly as in the
   exam. **Every chapter in the dropdown is labelled with its dimension's quota**
   (`05. Tenglama — 3/8`) and the selected one gets a banner saying how many are
   still needed — `topicForQuizChapter` resolves it through the same
   `sectionForChapter` the pick will use, so the teacher can see which sections
   are still open **before spending a single read**. ⚠️ Several chapters map to
   one dimension and therefore show the same numbers: they compete for the same
   slots, which is exactly what the label is there to say.

⚠️ **Both pools are needed.** The national bank was briefly removed on the
argument that a teacher's paper should hold only a teacher's questions; that put
a wall in front of the feature, because publishing needs 45 slots and a teacher
starting from an empty bank could not reach it. Own-questions-first plus a
top-up bank keeps the intent without the wall.

**Writing a new one leaves for the real builders**: two links, one per shape a
question can take — `/teacher/create/question` (single: mcq / written / numeric,
with images) and `/teacher/create/block` (several questions under one stem). An
embedded cut-down compose form shipped first and was removed too: a question is a
first-class bank document (images on the prompt AND on every option, blocks, the
validated topic path from `toQuestionV1`), and a second half-featured editor
would have drifted from the canonical one the moment either was touched. The new
question lands in `teacher_questions`, so pressing **Load** on return picks it up
newest-first.

### 🟢 The round trip is closed: save a question → back on the paper, with it (2026-07-31)

Leaving was safe (the stash below) but **arriving back was the teacher's problem**:
`/teacher/create/question` dropped them at the create hub, and the half-built
paper was something they had to find their own way back to. Both links now carry
`?back=<this builder>` ([app/teacher/create/_components/returnTo.ts](../app/teacher/create/_components/returnTo.ts)):

- the question builder's **back arrow** returns here instead of the create hub,
  a banner at the top says a paper is waiting and offers the way back at any
  time, and **a successful save returns here by itself**;
- the save carries `?add=<questionId>`, and the builder **puts that question on
  the paper on arrival** — writing a question and putting it on the paper are one
  act, not two.

⚠️ **The auto-add waits for `hydrated`** (the draft/server copy in state). Adding
against a paper that has not been restored yet would check the blueprint quota
against nothing and then **stash that empty paper over the real draft**.

⚠️ **It costs zero reads**: the question builder leaves the document it just
wrote in `questionCache`, which `fetchQuestionById` consults first. A cold reload
of the link pays one read. ⚠️ It then **re-stashes**, because the draft was
written on the way OUT and knows nothing of the new question — a refresh would
otherwise restore the paper without it. And ⚠️ **the blueprint still rules**: a
new question with no slot is refused here exactly as in the picker, by the same
`addItem` and with the same message. `?back=` is user input, so only an in-app
`/teacher/…` path is ever pushed.

⚠️ **Only a NEW question rides back.** An edited one is either already on the
paper (a duplicate) or was left off it on purpose; the return trip happens, the
`add` does not.

⚠️ **Those links navigate, so the paper is stashed to localStorage first**
(`_components/draft.ts`, `stash()` on click). Without it, clicking one would
silently destroy up to 45 hand-picked questions — the builder holds the paper in
component state. The draft also closes a hazard that was already there: a
back-swipe used to lose the paper. On mount the **draft wins over the server
copy** when it belongs to the same `quizId` — it is only ever written when the
teacher leaves, so it is strictly newer, and loading the stored paper over it
would throw away exactly what the stash was protecting. It is cleared once the
paper is safely saved, and the restore is announced with a banner carrying a
"start over" action rather than happening silently. One draft at a time, 24h TTL;
the `quizId` rides inside the record so the loader can refuse another paper's.

⚠️ **A restore ADOPTS the draft's `quizId`.** A fresh id is minted on mount, so a
paper that had already been saved once used to fork into a SECOND document —
carrying the first one's access code — as soon as the teacher came back from
writing a question. Harmless while the round trip was rare; not once saving a
question returns here by itself.

Every add goes through `bankQuizItem` / `teacherQuizItem` → `slimQuizItem`, and
the whole paper is written as **one document**.

⚠️ **Questions are EMBEDDED SNAPSHOTS, not refs.** A ref list would cost 45 reads
per student per sitting; the snapshot makes a whole paper **one read** however
many students sit it, and it freezes the question — editing the source later can
never re-key a paper somebody already answered. Same choice
`custom_tests.questions[]` makes. The cost: a fixed paper does not pick up a
correction, which is the intended trade.

⚠️ **A Firestore document is capped at 1 MiB and this one holds 45 questions.**
`slimQuizItem` drops `solutions[].steps` (by far the largest field; only
`final_answer` is ever read, and only to grade an open item), the builder shows
the live size against `QUIZ_MAX_BYTES` (900 KB), and `saveQuiz` refuses to write
past it. Failing at the moment of saving 45 hand-picked questions is the worst
thing this feature could do to a teacher, so the ceiling is visible while there
is still something they can do about it.

### The default paper — "Namunaviy variant" (2026-07-29)

The builder's third route to a paper, beside the two pickers: one button at the
top of the **Savol qo'shish** card that drops a complete, blueprint-balanced
45-question variant onto the builder. It exists because the quota rule is a HARD
one — a teacher must hit all 13 rows exactly, including the five O rows only a
typed question can fill — and "build 45 questions before you can publish
anything" is a wall in front of the first paper anyone tries to make.

- **The content is DATA**: [data/rasch-default-paper.json](../data/rasch-default-paper.json).
  That file is the only place to edit questions; its `_readme` key carries the
  per-entry field docs. A developer changes the default paper in a reviewable
  diff — not in a console, and not per environment.
- **[lib/RASCHdefaultPaper.ts](../lib/RASCHdefaultPaper.ts) owns every rule.**
  Each entry names only its blueprint **row** (`sectionId`) and a **chapter**;
  `topicId` comes from that row's `pools`, `testType` and `sectionId` from the
  row itself, and the chapter/topic names from `data/syllabus.json`. ⚠️ The JSON
  therefore **cannot invent a `sectionId`** or file a question under a chapter
  its row does not draw from — the two mistakes that silently credit the wrong
  dimension.
- ⚠️ **A file that does not balance is REFUSED, not loaded.** `buildDefaultPaper`
  returns `problems[]` and the builder aborts on the first one with a toast
  naming it. The whole-paper check runs `quizSlotCount` + `quizQuotaGaps` — the
  same two functions the publish gate uses — so a default paper that loads is one
  that can be published. Per-entry it also rejects a Y row with no options, an
  `answer` that is not one of its own option keys, and an O row that carries
  options (an O item is answered by typing; options on it would never render).
- **Items are `source: 'teacher'`** with `qType` `mcq` (closed rows) or
  `numeric`/`open` (O rows), which is what makes `examMode` render an O item as a
  typed input instead of A–D buttons. Their ids are `rasch-default-NN` —
  deliberately not Firestore-shaped, so they can never collide with a real
  question in `pickedIds`/`checkQuizAdd`.
- **It REPLACES the paper** (with a confirm when one is non-empty) rather than
  topping it up: every row is already exactly at quota, so appending could only
  overshoot. Afterwards the 45 are ordinary quiz items — remove, reorder, and mix
  in your own hand-picked questions freely.
- ⚠️ **The items are snapshots, not bank documents.** They are in nobody's
  question bank, the pickers never list them, and editing the JSON does not touch
  a paper a teacher already saved. That is the same freeze every stored quiz item
  has (see above), not a separate rule.
- The JSON is loaded with a **dynamic `import()`** so the 45 trilingual questions
  are a separate chunk fetched on the first click, not part of the builder route
  for the teachers who never press the button.

### Positions are derived, never stored

`RaschQuizItem = Omit<ExamQuestion, 'slotNumber' | 'sectionLabel'>`:

- **`slotNumber`** — a `shared_options` block occupies one slot *per
  sub-question*, so inserting or reordering one question renumbers every question
  after it. `hydrateQuiz` stamps them on load.
- **`sectionLabel`** — a trilingual label that would otherwise be repeated 45
  times. Rehydrated from `sectionId` through the bundled `EXAM_BLUEPRINT`.

⚠️ **`sectionId` IS stored, and must be a real blueprint id.**
`toItemResponses` maps it to the levelling dimension and `archiveExam` files the
question under it; an id no blueprint row carries falls back to `'numbers'` and
silently credits the wrong dimension. `sectionForChapter()`
([lib/Examblueprint.ts](../lib/Examblueprint.ts)) is the only way to produce one —
it resolves from the SAME table `topicForChapter` uses, so a hand-picked question
lands in the dimension a drawn one would.

⚠️ **A `questions1` item is never filed as test type `O`.** `examMode()` reads the
test type for a bank item (a teacher item goes by its own `qType`), so an `O`
would hide the A–D options the teacher picked the question *for* and demand a
typed answer graded against a `final_answer` they never saw. `testTypeFor()`
gives a bank item `Y-1`/`Y-2` by difficulty and reserves `O` for typed teacher
items — including an open **ko'p savolli** block, judged by `isClosedQuestion`
(see the invariant below). A block always renders as a block card (`examMode`
returns `'block'` before it ever looks at the test type), so its `O` changes only
the row and quota it is filed under and **what it is worth**, never how it is
answered. ⚠️ Since 2026-08-01 the test type IS money: it picks the question's
guaranteed base (`BASE_BALL` — 1.1 / 1.3 / 1.6), so a mis-typed item is no longer
only a quota error.

### 🟢 Dynamic marks — base + difficulty bonus, `B = Y + σ` (2026-08-01)

Every question keeps a **guaranteed base** for its test type, and whatever is
left of the paper's 100 is a **difficulty budget** shared out by how the cohort
answered:

```
Yᵢ = BASE_BALL[testType]          1.1 · Y-1     1.3 · Y-2     1.6 · O
p̂ᵢ = (correct + 1.5)/(seen + 3)   shrunk share correct
dᵢ = 1 − p̂ᵢ                       difficulty
wᵢ = dᵢ^BALL_CURVE = dᵢ²          difficulty weight
σᵢ = (100 − ΣY) · wᵢ/Σw           the bonus
Bᵢ = Yᵢ + σᵢ
```

On the DTM shape the blueprint enforces — **32 Y-1, 3 Y-2, 10 O** — the bases
come to `32(1.1) + 3(1.3) + 10(1.6)` = **55.1**, so the difficulty budget is
exactly **44.9** and the paper sums to **100 by construction**, with no scaling
pass anywhere.

| solved | 100 % | 90 % | 80 % | 70 % | 60 % | 50 % | 40 % | 30 % | 20 % | 10 % | 0 % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **weight `w`** | 0.00 | 0.01 | 0.04 | 0.09 | 0.16 | 0.25 | 0.36 | 0.49 | 0.64 | 0.81 | 1.00 |

- **The base is what a question is worth for being asked at all**, and the ladder
  is the protocol's own three types: an `O` must be *produced* (1.6), a `Y-2`
  needs adaptation (1.3), a `Y-1` is picked from four options (1.1). A question
  the whole class solved still earns its base — an easy paper does not collapse
  to nothing.
  ⚠️ **These are NOT the printed DTM values** (1.3 / 2.2 / 3.2, which sum to 100
  on their own). They are deliberately lower, because the gap between them and
  100 *is* the difficulty budget. The printed value is still carried
  (`SlotMark.printedBall`) — a mark that moved off it gets a dotted underline and
  the tooltip names it.
- **The bonus is convex in difficulty** (`BALL_CURVE = 2`). Linear would move the
  same budget between 90 %- and 80 %-solved as between 20 % and 10 % — noise
  dressed as a judgement at one end, a real distinction at the other. Squaring
  sends the 44.9 to the questions that actually separated the class. Measured on
  a 45-question paper sat by 100 students with a full 0–99 % spread: balls run
  **1.38 … 4.00**, and the section headers still add to exactly 100.00.
- ⚠️ **The bonus is RELATIVE; only the base is absolute.** σᵢ divides by Σw, so
  the same 30 %-solved question is worth more on a paper where everything else
  was easy (it takes a bigger slice of the same 44.9). That is the price of a
  paper that is exactly 100 without a cap — and the previous design, which chased
  an absolute ball, ended up scaled on nearly every real paper anyway (below).
- ⚠️ **A slot nobody has answered is priced, not skipped**: `p̂ = 0.5` from the
  prior alone → `w = 0.25`, the neutral weight. So an **unsat paper** reads
  Y-1 **2.10**, Y-2 **2.30**, O **2.60** — an even split of the budget on top of
  the bases — and still totals 100. It no longer falls back to the printed table.
- ⚠️ **The ends are asymptotes, because `p̂` is SHRUNK.** 20 of 20 solved reads
  p̂ = 0.93 and weighs 0.005, not 0; 0 of 20 weighs 0.88, not 1. One lucky answer
  must not move a mark, and the gap closes as the cohort grows.
- **Two decimals**, not one — the bonuses are continuous and one decimal collapses
  them onto a handful of values.
- ⚠️ **Every question always shows its CURRENT ball.** `MIN_RESPONSES = 5` is only
  a **label** (`SlotMark.provisional`, per slot): under it the card gets a dashed
  edge and a "still moving" tooltip, and nothing more.
- ⚠️ **A long paper is the one case where the base yields** (`baseBalls`). 100
  typed questions would carry 110 of base and leave the budget negative, so once
  the bases reach `BASE_SHARE` (0.551 — the DTM paper's own 55.1/44.9 split) they
  are scaled down by ONE factor to exactly that share. One factor, never a
  per-type clamp: the 1.1 : 1.3 : 1.6 ladder is the thing being preserved. A
  45-slot paper never reaches it.
- `SlotMark.sectionTotal` is **reported after the fact**, never reserved before
  it: what that blueprint row happened to come to under the marks in force. The
  results page shows it per row and labels it as such, and prints the paper's own
  split (`55.10 + 44.90 = 100.00`) under the section header.

#### The score — `Σ(balls earned) / Σ(balls) × 100`

`normalizedScore` is **the** number a student is judged on, and it is where
difficulty is rewarded. Measured on a 45-question paper sat by 100 students with
a full 0–99 % spread (`paperTotal` = 100.00):

| student | answered | balls earned = score |
|---|---|---|
| A | the **10 easiest** | **15.08** / 100 |
| B | the **10 hardest** | **34.59** / 100 |

⚠️ **A flat "10 of 45 correct" scores both the same**, and that is the single most
misleading number a maths dashboard can show.

⚠️ **The headline is the BALLS** — `58.43/100.00` on the student's row and on the
average tile alike. `scoreFor` (the sum of the balls of the questions they got
right) is what the per-question grid adds up to, so the two agree by
construction. Since `paperTotal` IS 100 by construction, the percentage is the
same number again and the page **no longer prints it** anywhere; `normalizedScore`
remains the value the subject page ranks and averages on.

#### Three earlier designs, and why they went

1. **A per-SECTION budget** (2026-07-29). Each blueprint row kept its printed
   total (3.5 across 2 questions, 20.6 across 11) and its questions only permuted
   the balls inside it. That capped a question at its own row's dearest printed
   value, so the hardest question on the paper could be worth less than an easy
   one in a richer row.
2. **Whole-paper allocation renormalised to exactly 100** (2026-07-29). Balls were
   priced against each other (`e^(0.35·logit)`) and rescaled by a water-filling
   solve. The rescaling pulled the values back onto a handful of near-duplicates.
3. **An absolute 1.30–6.00 curve, capped at 100** (2026-07-29 → 2026-08-01).
   `ball = 1.3 + 4.7·d²` per question, then `capBalls` scaled the whole paper down
   by one factor whenever the 45 would pass 100. The ball was comparable across
   papers *in principle* — but the cap bound on any paper the class did not find
   easy, so it was scaled in practice anyway, and a displayed ball could then sit
   **below its own documented 1.30 floor**, which a mark scheme may not do. It
   also gave a question everybody solved almost nothing. `BALL_MIN`, `BALL_MAX`,
   `BALL_SPAN`, `ballFor` and `capBalls` were removed with it; `difficultyWeight`
   is what replaced `ballFor`.

#### What this deliberately does NOT touch

⚠️ **Ability estimation.** θ and the 0–5 levels come from the 3PL EAP model in
[lib/RASCHtheta.ts](../lib/RASCHtheta.ts) — item difficulty anchored on
`difficultyId` (or the calibrated `b` when `scripts/analyzeItems.ts` has written
one), a guessing floor of 0.25 on multiple choice and 0.05 on open items, and an
N(0, 1.2) prior. The ball is a **display weight**; feeding it into the ability
estimate as well would count the same evidence twice. Keeping the statistical
layer (Rasch) and the marking layer (`B = Y + σ`) separate is the design.

#### Confidence shrinkage — ranking a student's strongest/weakest topic

`evidenceConfidence(n) = 1 − e^(−n/6)` in
[lib/RASCHscale.ts](../lib/RASCHscale.ts) — 0.28 at 2 items, 0.63 at 6, 0.90 at
14, which is the range the blueprint's dimensions actually span (1 item for
Funksiyalar O, 14 for Geometriya). `shrinkLevel` blends a dimension's level
toward the **cohort's own mean level for that dimension** by that confidence.

⚠️ **It ranks; it does not display.** The level on screen is already a shrunk
estimate — EAP with an N(0, 1.2) prior shrinks toward the population by
construction — so showing the blended value would shrink the same number twice
and understate every thin dimension. What EAP does not fix is the *comparison*:

```
2 of 2 correct,  level 5.00, class mean 2.40  →  ranks at 3.14
11 of 14 correct, level 4.10, class mean 2.40  →  ranks at 3.94   ← strongest
```

Before this, the 2-item dimension won "strongest" outright. The callout cards now
also print `(correct/total)` inline, so the evidence behind the claim is visible
without expanding anything.

⚠️ **Nothing is stored.** The marks are derived on every render from the sittings
that exist right now, which means **a question's ball moves when a classmate sits
the paper**. That is the feature, not a bug — the results page says so on screen.
Freezing them would need a snapshot per sitting and would answer a different
question ("what was it worth in March").

⚠️ **It is per COHORT, not global.** The statistics come from the sittings of
*this paper*, which is what makes them meaningful — the same question in another
teacher's paper has its own audience. A global item statistic (for the mock exam,
where every student draws different questions) would need its own collection and
server-side writes; deliberately not built.

The data behind it is `teacher_rasch_results.items` — `{ [slotKey]: 0|1 }`, keyed
by **`examSlotKeys`** ([lib/ExamTeacher.ts](../lib/ExamTeacher.ts)), the one place
that vocabulary is defined. ⚠️ The same strings are `ItemResponse.id` and what
`cohortStats` aggregates; two spellings would scatter a paper's statistics
silently. Results saved before the field existed are **excluded** from the
statistics rather than counted as wrong, and their own dynamic score reads "—".

The results page renders it grouped **by section, with what that section
currently adds up to in the header** (a flat grid of 45 is unreadable) — a
reported total, not a budget, since the paper is priced as a whole.

⚠️ **Inside a section it is a DENSE grid, up to 12 per row** (2026-08-01), three
tiny lines per cell: number, ball, solve rate. "Which questions did the class
miss" is a shape read across the whole paper, and the earlier six-wide cards
pushed the later sections below the fold. Everything the cell no longer prints —
the `base + bonus` split, the protocol's printed value, the raw `correct/seen`,
the provisional warning — is in the **tooltip**, and a mark that moved off its
printed value carries a **dotted underline** instead of a struck-through second
number. Each student's expanded row lists the ball they took on every question at
the same density. The card also carries the protocol's own
definitions: **Y-1** a closed item with one correct answer, **Y-2** a closed
matching item, **O** an open item with a short answer.

### The student's own sat-papers list (2026-07-29)

The code screen used to be a code box and nothing else: every result a student had
ever produced was visible **only to their teacher**, and the student had no way to
see what they had already done. `listMyQuizResults(uid)` now fills a list under
the box — title, **right / wrong counts**, score, 0–5 level, date, newest first.

- **One query, one index-free filter.** `where('studentId','==',uid)`, equality
  only — Firestore serves that without a composite index, and the sort is done in
  memory (`orderBy submittedAt` beside the filter would demand one). ⚠️ The
  `studentId ==` clause is also what makes the query **provable** against the read
  rule, exactly as `teacherId ==` is for the teacher's list: without it Firestore
  answers permission-denied, not "everyone's results". Pinned by
  `tests/rules/raschquiz.rules.test.mjs` — *"lets a student LIST their own
  sittings, and only their own"*, which also asserts that the same query aimed at
  another student, and an unfiltered one, are both denied.
- **Loaded only on the code screen** (a student mid-paper must not pay for it),
  and cached 60 s at module level like every other student page. ⚠️ Submitting a
  paper **patches** that cache rather than invalidating it — the student lands
  straight back on this screen, and a list missing the paper they just finished
  reads as data loss. A retake REPLACES its row, matching what the deterministic
  document id already does.
- ⚠️ **The score shown is `percent`, NOT the teacher's dynamic ball.** A ball is a
  property of the whole COHORT — `paperMarks` needs every sitting of the paper — and
  a student may not read their classmates' rows, correctly, and the rules enforce
  it. A ball computed from the student's own sitting alone would be a different
  number wearing the teacher's label. The 0–5 level beside it is the cohort-free
  measure and is the one to read.

**Reviewing the mistakes** — each row expands into **`ExamReview` in replay
mode**, the same grid-and-dialog the post-submit screen uses: which slots were
wrong, the question, the correct answer and the explanation.

- **`ExamReview` gained one optional prop, `outcomes`.** It takes
  `RaschQuizResult.items` and derives correctness from that instead of from live
  answers. A second review surface was the alternative and would have been the
  wrong call for the reason the component already documents: a block's answer
  lives under per-part keys, and any surface that forgets to branch on that
  renders `[object Object]`. One implementation, three callers.
- ⚠️ **Outcomes are keyed by `examSlotKeys` (`id#partId`)**, while the grid's
  React key is a different namespace (`id:partId`). Mixing them silently colours
  every block green.
- ⚠️ **There is no "your answer" line**, and replay mode says so instead of
  printing a dash. `items` is an outcome map, never an answer map (above) — a
  dash would read as "you left it blank".
- ⚠️ **A `multi_part` block is ONE slot**, so replay mode knows only whether the
  whole block was right; its per-part ticks are omitted rather than guessed. A
  `shared_options` block has one outcome per part and keeps them.
- ⚠️ **`hideAnswers` still holds.** It comes from the paper's own `showAnswers`
  flag, so a teacher who withheld the key keeps it withheld here months later —
  this screen must not become a way around that switch.
- **One document read per paper, the first time only** (`reviewCache`, tab
  lifetime). It is the whole 45-question array, the largest read in this
  subsystem, and a sat paper is an immutable snapshot so nothing can go stale.
- The toggle is offered **only when `items` exists**. A sitting saved before that
  field cannot say which question was wrong, and a review marking all 45 red
  would be a lie.
- ⚠️ **Slot numbers are the paper's canonical order.** On a `shuffle: true` paper
  the student saw a different order, so "question 7" in the review need not be
  the seventh question they answered. Outcomes are keyed by question id, not by
  position, so *which* questions were wrong is still exact.

### The access code

Six **digits** — typeable on a phone number pad and readable aloud, unlike the
alphanumeric `custom_tests.accessCode`. Minted on the **first save** and never
regenerated: a teacher who has already read it out must not have it change under
them.

`reserveAccessCode()` queries for the code and retries up to 5 times before
accepting one. ⚠️ **That is a check, not a constraint** — two teachers generating
the same code in the same instant both pass, and `findQuizByCode` takes the first
`published` match, so the loser's students would open the winner's paper. Making
it airtight needs a `rasch_quiz_codes/{code}` reservation document; deliberately
not done yet. It is still strictly better than `custom_tests`, which has no check
at all.

### Sitting it

`findQuizByCode` is **one document read**: `where accessCode == … limit 2`, with
the status checked client-side so a *closed* paper is reported as closed rather
than as a wrong code (a student told "wrong code" retypes it forever).

From there the page is the mock exam with a different source:

- `hydrateQuiz` → `ExamQuestion[]`, shuffled once at lookup if the teacher asked
  for it (⚠️ **once**, not per render — re-shuffling would reorder a paper the
  student is halfway through). Shuffling moves **cards**, so a block is never
  split apart.
- The clock starts when **Start** is pressed, not when the code is entered, and
  runs on the quiz's own `durationMinutes`.
- The sitting is persisted to its own localStorage store
  (`raschmodel:quiz:v1`). ⚠️ **Separate key from the mock exam.** One key would
  mean starting a teacher quiz silently discards an exam still running against
  its clock. The store logic is written once (`createSessionStore` in
  [lib/Examsession.ts](../lib/Examsession.ts)) and instantiated twice.
- A paper whose deadline passed with **nothing answered** is abandoned, not
  submitted — identical rule to the mock exam, and it must never reach the
  account *or the teacher* as a 0% result for a paper nobody sat.
- ⚠️ **The 2-a-day cap does NOT apply here** (2026-07-30). `/raschmodel/exam` is
  limited to one sitting per 12 hours ([lib/RASCHquota.ts](../lib/RASCHquota.ts),
  contract in [STUDENT.md](STUDENT.md)); a teacher's paper is never blocked, because
  a teacher handing a code to a class must not be defeated by a cooldown. **But it
  still starts one**: `saveExamResult` appends to the same `exams[]` and `ExamPoint`
  has no source field, so a code sitting delays the next self-serve draw. If that
  ever needs separating, the fix is an additive `src` on `ExamPoint` — not a second
  timestamp list.

### Two writes on submit, deliberately independent

| Write | What it is | If it fails |
|---|---|---|
| `saveQuizResult` | the teacher's copy — `teacher_rasch_results/{quizId}_{uid}` | logged; the student still gets their level |
| `saveExamResult` | the student's own Rasch levels + `RASCH_attempts` row | surfaced on screen; the teacher still got the result |

They are two different facts and neither should be lost because the other failed,
so the teacher's copy is written **first** (it is what the student was asked to
do) and the level save follows. `savingRef` closes the double-save window on the
client; `saveExamResult`'s own `examId` check (the paper's `endsAt`) closes it
across tabs and reloads.

The result id is deterministic, so a **retake overwrites** — the same rule
`attempts/{uid}_{assignmentId}` follows, and the same reason: "how did the class
do" is a per-student question that goes wrong the moment somebody sits twice.

### Reporting: everything is the 0–5 level

The results page reports on the **0–5 Rasch level**, not on percentages. A
percentage answers "how much of this paper did they get", which depends on the
paper; a level answers "how hard a problem can they solve", which does not — and
it is the same scale the student sees on their own progress page. `correct/total`
rides alongside as the evidence, never as the headline.

That needs per-dimension ability, so `saveQuizResult` writes **`topicTheta`** —
`estimateAbility()` over each dimension's items, the same function the student's
own heptagon uses, so the two can never disagree about one paper.

- ⚠️ **Logits, not levels.** `thetaToLevel` has already been restretched once
  (0–3 → 0–5); storing the level would let a second restretch silently re-label
  every saved result.
- ⚠️ **A dimension the paper never touched is ABSENT from the map, never `0`.**
  Zero is a real ability; "not measured" is not. Same rule as the student-side
  heptagon, where `level: null ≠ 0`.
- The field is **optional** — results written before 2026-07-28 have none, and
  those dimensions render as "not measured". They are deliberately NOT
  back-derived from the percentage: under Rasch that is a different quantity.
- The class row averages **in logits, then maps once**. The 0–5 scale is
  piecewise-linear in θ, so averaging levels and averaging abilities give
  different numbers and only the second is the class's ability.
- ⚠️ **Thin dimensions are marked, not hidden.** Under `THIN_EVIDENCE = 4` items
  the level is shown dimmed with a "few items" tag: Rasch does not stop working
  on four items, but the standard error explodes, and a dimension touched twice
  can read 4.2/5 off one lucky answer. A teacher acting on that is being misled
  by a number that looks precise.

Each student row expands to their own seven dimensions, with the weakest and
strongest named outright — a class average tells you which topic is weak, not who
to help.

### Withholding the key

`showAnswers: false` makes `ExamReview` show only whether each question was
right — no correct answer, no per-part expected value, no explanation button. It
is a real mode, not styling: a teacher reusing a paper across two groups depends
on it. Any new surface in that component must respect `hideAnswers`.

⚠️ **The review is a GRID, not a list** (2026-07-28). 45 expanded cards meant
scrolling past everything you got right to reach the one you wanted. It is now
the same geometry as the runner's navigator — green/red/grey slot numbers — and
a tap opens that question in a dialog with prev/next arrows. **Cells are SLOTS,
not documents**: a `shared_options` block gets one cell per part, each coloured
by `isExamPartCorrect` for its own part, all opening the same block. That is why
the student can look for "34" and find it where they left it.

## The shared runner (why the pages cannot drift)

⚠️ **`ExamRunner` is now a `fixed inset-0 z-[100]` full-screen overlay** and owns
the exam lockdown (full screen + an interruption warning with a live count), so
every sitting behaves identically. Callers must NOT wrap it in a `<Page>`, and a
page's Start handler must call `requestExamFullscreen()` **synchronously inside the
click**. Contract: [STUDENT.md](STUDENT.md#exam-lockdown--full-screen--interruption-warning-2026-07-30)
and [hooks/useExamLockdown.ts](../hooks/useExamLockdown.ts).


`ExamRunner` and `ExamReview` were extracted from `exam/page.tsx` when this
shipped. They own the timer bar, the navigator, the question card (closed / typed
/ `shared_options` pool / `multi_part` parts), the submit dialog and the
per-question review — plus their own uz/ru/en dictionaries, so the two papers
cannot end up differently worded.

They own **no** paper state. Answers, flags, position and the clock live in each
page, which is what persists them. The one exception is the submit confirmation,
which is never persisted.

⚠️ **Do not copy either component to add a variant.** A block's answers live
under per-part keys (`partKey(q.id, p.id)`); every surface that forgets to branch
on that renders `[object Object]`. That is exactly the bug two copies would
reintroduce.

## Firestore

```
teacher_rasch_quizzes/{rq_…}
  id, title, description, teacherId, teacherName,
  accessCode: "482913",            ← 6 digits, STRING (never parsed to a number)
  questions: RaschQuizItem[],      ← embedded snapshots
  questionCount: <slots>,          ← slots, not cards
  durationMinutes, shuffle, showAnswers,
  status: 'draft' | 'published' | 'closed',
  createdAt / updatedAt: serverTimestamp

teacher_rasch_results/{quizId}_{uid}
  quizId, quizTitle, teacherId, studentId, studentName,
  correct, total, percent, durationSec,
  submittedAt: <epoch ms>,         ← number, matching every other RASCH timestamp
  examLang, topics: Record<TopicKey, TopicScore>,
  topicTheta?: Partial<Record<TopicKey, number>>,   ← per-dimension ability, LOGITS
  items?: Record<slotKey, 0 | 1>,  ← per-SLOT outcome; keys are `examSlotKeys`,
                                     so a shared_options block has one entry per
                                     sub-question. Feeds the dynamic marks.
                                     OUTCOMES ONLY — never what was answered.
  theta: number | null
```

Rules (`firestore.rules`, section 12b):

- Quizzes: `read: if isAuth()`, write only by `teacherId`.
- Results: read by the student **or** the paper's teacher; create by the student;
  update only by the same student on the same paper; **delete never** — a result
  is not the teacher's to erase and not the student's to withdraw.

⚠️ **KNOWN TRAP, inherited from `custom_tests`: the paper embeds its questions,
and therefore their correct answers, behind `read: if isAuth()`.** A signed-in
student who enumerates the collection can read the key without ever entering a
code. **The 6-digit code is a convenience for sharing, not a security boundary.**
Do not present it as one, and do not use these papers for anything that must be
invigilated until the questions move behind an Admin-SDK route. The student
lookup is a *query* on `accessCode`, so a rule that matched the code could not
serve it; closing this means changing the read path, not the rule.

Index: `teacher_rasch_quizzes (teacherId ASC, createdAt DESC)`, for the teacher's
list. Nothing else needs one — every other query is equality-only, which
Firestore serves from single-field indexes.

## Firestore budget

| Action | Cost |
|---|---|
| Open the builder | **0** — both pickers are on-demand |
| One page of either picker | 10 reads — up to 30 when the own-bank **savol turi** filter is on Yopiq/Ochiq (client-side filtering; the count is shown on screen). The **kim yozgan** filter costs nothing extra: it is a server-side `creationMethod in […]` |
| Save a paper (any length) | 1 read (to keep `createdAt`) + 1 write |
| Mint a code | 1 query, 0 documents on the happy path |
| Student opens a paper by code | **1 read**, whatever its length |
| Student submits | 1 write (teacher's copy) + 1 transaction (1 read + 2 writes) |
| Teacher opens the results | 1 read + 1 query — **the dynamic marks add nothing**: they are computed from the result rows already fetched |

⚠️ **`listMyQuizzes` reads FULL documents**, so ten 45-question papers pull ten
embedded question arrays for a list that shows only titles. It is capped at 20
for that reason. If it ever needs paging, the fix is a summary mirror, not a
bigger limit.

## Invariants & traps

- ⚠️ **45 slots, counted with `examSlotCount`.** A `shared_options` block is worth
  one slot per sub-question, so a 45-slot paper can hold fewer than 45 documents.
  Publishing below 45 is refused; a draft may be any length.
- ⚠️ **The quota is per BLUEPRINT ROW — dimension × test type — and it is a HARD
  rule.** `BLUEPRINT_SECTION_TARGET` (the 13 rows: 2/11/6/2/7/2/2 at Y-1, 3 at
  Y-2, 2/1/2/4/1 at O) is enforced on every add by `checkQuizAdd`, and publishing
  calls `quizQuotaGaps` as well as the 45-slot check. A question whose row is
  full is refused with a toast naming it ("Geometriya · Y-2"), and a **block is
  refused whole** when it would overshoot — truncating it would break its shared
  pool.
  It was per DIMENSION first (2026-07-29 morning), which was not enough:
  Geometriya's 14 could be filled with 14 closed Y-1 questions, so the paper
  never asked a student to *produce* an answer and the O rows — the ones that do
  — stayed empty. The dimension totals are still shown, as the sum of their rows.
  ⚠️ **The five O rows can ONLY be filled by the teacher's own typed questions**
  (a flat typed question, or an open ko'p savolli block) — or by the default
  paper, whose ten O items are authored as typed items in the JSON:
  `testTypeFor` never files a `questions1` item as `O` (see above), so the
  builder says so on the coverage panel instead of letting a teacher hunt through
  a bank that cannot contain one.
- ⚠️ **The three types, as the protocol defines them** — and `testTypeFor`
  follows the definitions, not a difficulty ladder:
  - **O** — an OPEN item, answered by typing a short answer. **Every typed
    teacher question is O, whatever its difficulty**: "open" is a property of how
    it is answered, so an easy typed question is still an O and never a Y.
    ⚠️ **A ko'p savolli BLOCK is judged by the same rule** (since 2026-07-29):
    `testTypeFor` asks `isClosedQuestion`, so a `multi_part` block whose parts are
    typed — "Ko'p savolli ochiq test", the 39-masala shape — is an **O**, and only
    a block where every part picks an option (a `shared_options` pool, "Ko'p
    savolli yopiq test" / 33–35, or per-part option lists) stays a Y. Blocks were
    excluded outright before, which filed every open block under a Y row. It is
    also the rule behind the picker's own closed/typed badge and kind filter, so
    the badge and the row an add lands in can no longer disagree. An open
    `multi_part` block costs **1 slot** (`examSlotCount`), so it fits an O row
    (2/1/2/4/1) without overshooting.
  - **Y-2** — a CLOSED item, harder than Y-1 and requiring adaptation. There is
    exactly ONE Y-2 row — hard Geometriya, from the multi-step chapters — so a
    hard question anywhere else (and a hard geometry question from chapter 01,
    which the Y-2 pool excludes) is a **Y-1**. There is no row for it to be Y-2
    in.
  - **Y-1** — every other closed item.
- ⚠️ **An open question the protocol has no row for is REFUSED, not re-typed.**
  `sectionForItem` returns `null` when an `O` cannot be placed (Sonlar and
  Algebraik have no open row at all; `geometry-o` draws only from the multi-step
  chapters), and `checkQuizAdd` answers `noSlot`. The two fallbacks are
  deliberately asymmetric: a closed item that wanted `Y-2` just becomes the `Y-1`
  it always was, but filing an open item in a Y row would put a typed question in
  a closed slot, count it against a closed quota and pay it a closed item's base
  (1.1 instead of 1.6). The picker shows those rows greyed with "no slot" rather than
  letting the click bounce off a toast.
  ⚠️ The publish gate can therefore block a paper saved BEFORE this rule (45
  slots, wrong shares). That is intended: the fix is to rebalance it, and the
  toast names the first offending row with its `have/want`.
- ⚠️ **A section is resolved from the chapter AND the test type**
  (`sectionForChapter(topicId, chapterId, testType)`). Geometriya is drawn at
  Y-1, Y-2 and O from the same chapters, so resolving on the chapter alone —
  which is what shipped first — filed *every* open geometry question under
  `geometry-y1`: it landed in a Y-1 row's ball budget and `geometry-o` could
  never be filled. ⚠️ And the **section's** type is then authoritative, not the
  one derived from the question: an item may not print a type its own row does
  not have. Rendering is unaffected — a bank item is closed at either Y type, and
  a teacher item renders by its own `qType` (`examMode`).
  Papers saved before this keep the section they were stored with; they are
  embedded snapshots, and re-filing them would move marks under a class that has
  already sat them.
- ⚠️ **The paper moves the student's real levels** (`kind: 'exam'`). That is
  intended — it is 45 questions on the same scale — but it means a teacher can
  move a student's measured ability. A deliberately easy paper inflates it.
- ⚠️ **Never write `undefined` to Firestore.** `bankQuizItem`/`teacherQuizItem`
  spread documents that may lack optional fields (`b`, `imageUrl`, `parts`); keep
  the conditional-spread style already in `ExamTeacher.toExamItem`.
- ⚠️ The code is a **string**. `"048213"` parsed as a number loses its leading
  zero and stops matching.
- The teacher's papers list patches status in place after a flip rather than
  refetching — a refetch pays for every embedded question array again.

## Known issues / dead code (verified 2026-07-28)

- **The answer key is readable by any signed-in user** (above). The single
  largest limitation of this subsystem.
- **Code uniqueness is a check, not a constraint** (above).
- **No per-QUESTION review for the teacher.** Since 2026-07-29 `items` records
  whether each slot was right, so "who got question 12" and the class solve rate
  ARE answerable — but the raw answers still are not, so "what did this student
  PUT for question 12" is not. Adding that means an `answers` map on the result
  document: a bigger write per student, and a deliberate cost decision.
- **Dynamic marks are cohort-only.** The mock exam still marks flat (1 point per
  slot): every student draws a different 45 questions, so per-item statistics
  there would need a global collection written server-side on every submit.
- **A published paper can still be edited.** Nothing stops a teacher changing the
  questions after students have sat it, which makes those results incomparable.
  Locking a paper on first submission would need a read of the results on save.

## How to verify changes

**Rules first — `npm run test:rules`.** `tests/rules/raschquiz.rules.test.mjs`
pins both collections down: the code lookup, teacher ownership, the retake
overwrite (and that it cannot re-point at another paper or teacher), the
teacher's provable list query, and delete being denied to everyone. It also
asserts the answer-key leak *on purpose*, so the limitation stays visible — if
that test ever starts failing, the read path has moved behind a server route and
this doc should say so.

Then `npm run dev`, as a **teacher**:

1. Nav → **Milliy sertifikat** → **Matematika** → **Yangi test**. The builder opens
   with **zero** network activity (watch the network tab).
2. Press **Namunaviy variant** (top right of *Savol qo'shish*). One JS chunk is
   fetched — **no Firestore read** — the paper fills to **45/45**, every one of
   the 13 coverage rows goes green, the title fills in if it was empty, and
   **Saqlash va faollashtirish** unlocks immediately. Remove one question: the
   row it came from drops to `have/want` and publishing locks again. Press the
   button a second time — it must ask before replacing the paper. Then break
   `data/rasch-default-paper.json` on purpose (delete an entry, or give a Y-1
   entry an `answer` of `"E"`) and press it again: nothing loads and the toast
   names the offending row or entry.
3. Start over (**Tozalash**), name the paper, then press **Yuklash** on the **Yozgan savollaringiz** tab — 10 of
   your own questions, each row labelled *Yopiq* or *Ochiq* (and *AI* when a
   machine wrote it). Press **Yopiq** and Load again: only option-answered
   questions and `shared_options` blocks come back, and the read counter shows it
   may have walked more than one page. Press **AI**, then **O'zim**, loading
   after each: the first must return only machine-written questions, the second
   only hand-written ones, both at 10 documents a page. Add a
   few. Switch to **Milliy baza**, pick a chapter and
   difficulty, press Load (10 documents read, the count shown on screen) and add
   a few more; both sources must land in the same paper.
3. Press **Bitta savol yaratish**. It must leave for `/teacher/create/question`
   with a banner saying a paper is waiting. Write an **open, algebra** question
   and save it: **the browser returns to the builder by itself**, the paper is
   still there with a "saved" banner, the new question is **already on it** in an
   O row, and the network tab shows **no read** for it. Reload the page: the
   question is still on the paper (the stash was rewritten). Now press the link
   again and use the banner's **Variantga qaytish** without saving — the paper
   must come back untouched. Repeat the save trip with **Ko'p savolli test
   yaratish** → `/teacher/create/block`. Finally write a question the blueprint
   has no slot for; the return trip must refuse it with the same message the
   picker gives, not add it.
3. The coverage panel lists the **13 blueprint rows grouped by test type**
   (Y-1 32, Y-2 3, O 10), each reading `have/want` and green only when the two
   match. Fill one row — say **Funksiyalar Y-1 (2)** — then look at the pickers:
   every question that files there shows a green `Funksiyalar · Y-1 2/2` badge
   with its Add button reading *to'ldi*, and the **Milliy baza** chapter dropdown
   shows the same. Switch the difficulty to **Qiyin** on a geometry chapter and
   the dropdown must retarget to `Geometriya · Y-2` — the row a hard question
   actually lands in. The **O rows cannot be filled from the bank at all**: write
   an open question in `create/question`, come back, and it must land there.
   A block that would overshoot is still refused with the toast (its Add is live,
   because the row is not full — it just cannot fit a 3-slot block into 2 free
   slots). The size counter climbs, adding past 45 slots is refused, and
   **Save & publish** stays disabled until it is 45 slots **and** every section is
   exactly at quota. Saving a draft is never blocked.
4. Publish → the list shows a 6-digit code; tapping it copies it.

As a **student**, in another account:

5. `/raschmodel/quiz` (nav: **Kod**) → type the code → the intro names the paper,
   its teacher and its length. Watch the network tab: **one document read**.
6. Start it. The runner must be pixel-identical to `/raschmodel/exam` — the same
   navigator, flags, block pool and typed inputs. Answer a few, reload the page:
   the paper resumes with **no** further reads and the clock kept running.
7. Submit → the score card, the per-dimension level movement, the skills card and
   the per-question review with explanations. Now open `/raschmodel/exam`: it
   must still offer a **fresh** paper, not the quiz you just sat (separate
   localStorage stores).
8. A paper with `showAnswers: false` must show correctness only — no correct
   answers, no explanations.

Back as the **teacher**:

9. **Matematika** → **Natijalar**. **Before anybody has sat it** the split line
    under the marks card must read `55.10 + 44.90 = 100.00` and every Y-1 must
    read 2.10, every Y-2 2.30, every O 2.60 — the bases plus an even share of the
    budget. ⚠️ **All 45 questions must be readable without scrolling the card**
    — up to 12 cells a row, each three tiny lines (number, ball, solve rate).
    **After the FIRST sitting** every question must carry a live ball to two
    decimals, dashed while under 5 answers, colour-coded by its solve rate, with a
    **dotted underline** wherever the mark moved off the protocol's printed value;
    hover one and the tooltip must name the `base + bonus` split, the printed
    value and `correct/seen`. Sit the paper on five more accounts, failing one algebra
    question on all of them and passing another on all of them: the failed one
    climbs and the passed one falls back toward its base, the dashed edges clear
    as each slot passes 5 answers, few balls repeat, and every student's score is
    recomputed. ⚠️ **Add the section headers up: they must come to exactly
    100.00 — always**, easy paper or hard, since `B = Y + σ` prices to 100 by
    construction with no cap. ⚠️ **No ball may ever read below its base** (1.10 /
    1.30 / 1.60). Check the scoring too: a student who solved only hard questions
    must score above one who solved the same NUMBER of easy ones (expand both and
    compare their per-question grids). Expand a student:
    their ball on every question is listed, 0 where they got it wrong.
    Then check the rest: Every number is a 0–5 level: the
   average tile, the class section list, and each student's headline. **Tap a
   student row** — it expands to their own seven dimensions with weakest and
   strongest called out. A dimension the paper never asked about must read "not
   measured", NOT 0, and a dimension with fewer than 4 items must carry the "few
   items" tag. Sit the paper on a second account and the class averages must
   move.
10. Close the paper; the student's code entry must now say *closed*, not *not
    found*.
