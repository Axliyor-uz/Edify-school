# RASCH_SKILLS — the skill axis inside the seven dimensions

> **Agent workflow:** read this BEFORE touching `lib/RASCHskills.ts`, the skill
> rollups in `services/RASCHProgressService.ts`, or the skill UI in
> `app/(student)/raschmodel/{progress,exam}`. Update it in the same change
> whenever you alter behavior described here. Index: [README.md](README.md).
> The Rasch ability model itself (θ, levels, diagnostics, forecasting) is
> documented in [STUDENT.md](STUDENT.md).

**Last verified:** 2026-07-28 (teacher-built papers feed the same axis); subsystem introduced 2026-07-27 with skill/dimension question review, paging and targeted drills.

## Purpose & scope

The seven dimensions ([lib/RASCHtopics.ts](../lib/RASCHtopics.ts)) answer *which
mathematics*. They cannot answer *what can this student do*, because a dimension
is a bag of content — `algebraic` holds logarithms, trigonometry and absolute
value, so a student who can factorise but cannot solve an inequality gets one
averaged number for both.

The skill axis adds the missing question. Three axes now describe one item:

| Axis | Count | Source |
|---|---|---|
| **dimension** — which subject area | 7 | the blueprint (`topicForChapter`) |
| **skill** — which operation the student had to perform | 34 | `lib/RASCHskills.ts` |
| **content** — which syllabus chapter/subtopic | 29 / 210 | `data/syllabus.json`, the **tag** |

**A skill is content-free.** `eq-inequality` is "solving an inequality" whether
the inequality is rational, logarithmic, trigonometric or modular. That is the
inversion: content stops being the taxonomy and becomes a tag.

## Key files

| File | Responsibility |
|---|---|
| [lib/RASCHskills.ts](../lib/RASCHskills.ts) | The vocabulary (34 skills), the syllabus→skill map, `skillStats`/`skillCoverage`/`weakestSkills`. Pure — no Firestore. |
| [services/RASCHProgressService.ts](../services/RASCHProgressService.ts) | `dimensionSkills(levels, source)` → per-dimension listing; `skillPicture(levels, source)` → headline counters + weakest. |
| `app/(student)/raschmodel/progress/page.tsx` | `AbilityHeptagon` (each axis row expands to its skills), `SkillCoverageCard`. |
| `app/(student)/raschmodel/exam/page.tsx` | The `detected` memo + "Skills detected" results card. |
| `app/(student)/raschmodel/practice/page.tsx` | Targeted mode — reads `?skill=&dim=`, drills via `buildSkillPractice`, archives the drill. |
| `app/(student)/raschmodel/progress/_components/QuestionReview.tsx` | The shared question review: scope toggle, +5 paging, per-question explanation, practice link. |
| [lib/RASCHsolved.ts](../lib/RASCHsolved.ts) | `solvedForSkill()` — the per-skill question review, from the local archive. |
| [lib/Examquestions.ts](../lib/Examquestions.ts) | `buildSkillPractice()` — over-sample by chapter, filter to the skill. |

## Flows

### Tagging — no migration, no new field

An item's skill is a **pure function of the syllabus position it already
carries** (`topicId`/`chapterId`/`subtopicId`, present on every `ItemResponse`
since the model shipped). `skillFor()` reads a two-level table:

```
SUBTOPIC_OVERRIDE[`${topicId}:${chapterId}:${subtopicId}`]   // exact row
  ?? CHAPTER_DEFAULT[`${topicId}:${chapterId}`]              // chapter's usual skill
  ?? null
```

So "retag the bank" — the labour-heavy step of the usual migration plan — is done
**as code, not as 882 hand-edited documents**. Every response ever recorded is
re-tagged retroactively the moment the file ships, and a wrong call is fixed by
editing one line, not by a backfill. ⚠️ **Do not add a `skill` field to
Firestore.** Old Android clients would never write it (APK rollouts lag web
deploys), so a stored tag would be present on some items and absent on others,
while the derived one is always correct for every item.

### Measurement — two sources, deliberately

`skillStats({ diagnostics, recentItems })` combines the two things the levels
document already holds:

- **`diagnostics.subtopics`** — the LIFETIME accumulator (seen/correct/θ/mastery
  per subtopic). This is what makes "collected skills" a real count rather than a
  window artefact.
- **`recentItems`** — the 135-item rolling window. θ comes from here when it has
  anything to say, via `estimateAbility` over that skill's items only.

Fallback order for θ: recent-window estimate (`fresh: true`) → seen-weighted mean
of the subtopic θ values → `null`.

⚠️ **`level: null` means never measured, and is NOT zero.** The UI must render it
as "not met" (dimmed), never as a zero-length bar. `weakestSkills` excludes
unmeasured skills for the same reason — ranking them together would send every
student to drill whatever the blueprint happens to under-sample.

### Cross-dimension skills — derived, never declared

Each skill declares a **home** dimension. The dimensions it actually spans are
computed at module load by resolving every chapter that feeds it through
`topicForChapter` (the `SPAN` IIFE). Hand-declaring them would let the two drift.

⚠️ **The home is NOT forced into the span, and `skillsInDimension` keys off the
span, not the home.** Home says who conceptually owns a skill; span says where
its evidence comes from, and they genuinely differ — every chapter testing
`fn-parameter` (the "parametrli" subtopics of chapters 05–07) is in `equations`,
and the only chapter testing `pr-logic` is 17, which is in `algebraic`. An
earlier version forced the home in, which listed both under a dimension that can
never measure them: permanently "not met" no matter how much the student
practises, with their real evidence sitting elsewhere. **A dimension must never
list a skill none of its chapters can measure.**

**12 of the 34 skills span more than one dimension**, and this is not decorative —
it is the blueprint reporting a real fact. Chapters 12 (logarithmic/exponential),
13 (trigonometry) and 14 (absolute value) sit in the `algebraic` dimension, yet
their subtopics are equations, inequalities and function work. Consequences:

- `eq-inequality`, `eq-reduce`, `eq-systems`, `eq-constraints` each span
  `equations` + `algebraic` (chapter 07/08 and chapters 12–14).
- `fn-domain`, `fn-evaluate`, `fn-properties`, `fn-graph` each span `functions` +
  `algebraic` (chapter 11 and chapters 12–14).
- `num-forms` ⇄ `alg-simplify` cross `numbers` and `algebraic` in both directions
  (degree↔radian in chapter 13; "soddalashtirish" rows in chapter 04).
- **Two skills are homed where no chapter feeds them** and so appear only as
  visitors: `fn-parameter` (home `functions`, span `equations`) and `pr-logic`
  (home `probability`, span `algebraic`). This is the span-vs-home rule above
  doing its job — they are still labelled `↗ Functions` / `↗ Sets`.
- **`algebraic` lists 5 homed skills + 11 visiting.** That is the taxonomy saying
  out loud that `algebraic` is a content bag rather than a skill-coherent
  dimension. Don't "fix" it by re-homing skills — fix it, if ever, in the
  blueprint.

`skillsInDimension(dim)` returns homed skills first, then visitors; the UI marks
a visitor with `↗ <home dimension>`. Current listing: `algebraic` 5+11,
`equations` 6+2, `numbers` 4+1, `functions` 4, `geometry` 5, `analysis` 5,
`probability` 3.

### Reverse lookups — from a skill back to the syllabus

- `chaptersForSkill(key, dim?)` — the chapters that feed a skill, optionally
  narrowed to one dimension. This is what "the exact related dimension" means
  operationally: `eq-inequality` narrowed to `algebraic` gives Ko'rsatkichli va
  logarifmik / Trigonometriya / Modul, narrowed to `equations` gives Tengsizliklar
  / Irratsional. It keeps a non-empty fallback as a guard, but with the span fix
  above that fallback should never fire for a dimension in the skill's span —
  if it does, the map has drifted.
- `relatedSkills(key, limit)` — skills that share a **chapter** with this one.
  Deliberately not "skills in the same dimension": `algebraic` lists sixteen, and
  calling all of them related says nothing. Sharing a chapter is checkable and is
  what makes the cross-links useful.

### Reviewing the questions behind a skill

`solvedForSkill(key, { scope })` in [lib/RASCHsolved.ts](../lib/RASCHsolved.ts)
filters the per-device localStorage archive and splits it by outcome, newest
first. `scope: 'last'` keeps only the most recent sitting that touched the skill;
`'all'` spans the archive. It returns **full** lists — the UI pages through them
five at a time, so capping in the reader would make "show more" impossible to
implement honestly.

One component renders both places:
`progress/_components/QuestionReview.tsx`, used by each skill row inside the
heptagon and each weakest-skill row on the Skills card. It takes a `load(scope)`
callback and owns scope, paging and the per-question expansion. It exists once
because the two must agree; two copies would drift the moment one was touched.

> A dimension-level version of this panel existed briefly and was removed — a
> dimension is a bag of content, so "my work in Geometry" is a pile of unrelated
> questions. The review is only meaningful at the skill level.

Opening a question shows **what was chosen, what was right, and the
explanation** — a list of failed questions with no explanation is a scoreboard,
not a study tool. Option keys are rendered with their text (`B) 4π√3`), not bare
letters.

⚠️ **Practice drills are archived too** (`archivePractice`), since 2026-07-27.
Only exams used to be, which made the work done immediately after seeing a
weakness — the work most worth reviewing — invisible on the skill panel. The
practice page must call `setSolvedUser` before archiving or the drill lands in
the `'anon'` bucket. Entries carry `kind: 'exam' | 'practice'` (absent ⇒ exam).

⚠️ `CAP_PER_TOPIC` was raised 20 → **60**. Twenty per DIMENSION is two or three
questions per SKILL, which made every skill panel look empty. Sixty × 7 topics is
roughly 400–800 KB of localStorage worst case; `commit()` swallows a quota error
so a full store never breaks a submission.

⚠️ The archive is **per-device** (it always was — see the file header), so this
review is a convenience, not a record. `RASCH_levels` follows the account; this
does not.

⚠️ `SolvedQuestion` gained optional `topicId`/`chapterId`/`subtopicId`. They are
optional because entries archived before this carry only display NAMES;
`resolveSolvedPosition` recovers ids from those via a lazily-built name index, so
the review works on old archives too. **The store VERSION was deliberately not
bumped** — bumping it discards every existing archive.

### Drilling a skill

`buildSkillPractice` ([lib/Examquestions.ts](../lib/Examquestions.ts)) backs
`/raschmodel/practice?skill=<key>&dim=<dim>`; params are validated against
`SKILL_KEYS`/`TOPIC_KEYS` and a bad one degrades to the default weakest-chapters
mode rather than building an empty drill.

⚠️ **The bank cannot be queried by skill.** Every question carries a
`subtopicId`, but the exam's single composite index is
`(topicId, chapterId, difficultyId, rand)` and the sampler's contract is to vary
the *values*, never widen the filter — an added `subtopicId` equality silently
demands a second index. So `buildSkillPractice` **over-samples by chapter
(`OVERSAMPLE = 4`) and filters to the skill client-side**. The cost is real and
is surfaced through `docsRead`: a chapter feeding a skill through two of nine
subtopics returns roughly two useful questions in nine. If the skill's own
subtopics cannot fill the set, the remainder comes from the same chapters
unfiltered and `onSkill` reports how many actually hit — a short honest drill
beats a full dishonest one.

### Teacher-built papers feed the same axis

A paper a teacher assembled and shared by 6-digit code
([RASCH_QUIZ.md](RASCH_QUIZ.md)) is scored through the SAME `toItemResponses` →
`saveExamResult` path, so its questions are tagged, measured and archived exactly
like a drawn paper's. Nothing in this file is aware of the difference, and that is
the point: a skill is derived from the syllabus position, not from where the
question came from.

⚠️ The one thing that makes this work is `sectionId`. A hand-picked question gets
one from `sectionForChapter()`, resolved through the same blueprint table — an
invented id would credit the response to the wrong dimension.

### Detection by the 45-question paper

The exam draws by chapter, so skills fall out of the items with no extra
tagging. `skillCoverage(items)` returns `{ detected, counts, untouched }`.

⚠️ **One paper cannot measure 34 skills.** A simulated blueprint-shaped paper
detects **21 of 34**, most on n = 1–3 items. This is reported as *coverage*, never
as a verdict — coverage accumulates across sittings. The exam results card shows
`detected.length / SKILL_KEYS.length`; the progress page shows the lifetime
`collected / total`.

The `detected` memo rebuilds items with `toItemResponses` (not by iterating
`questions`) so a `multi_part` block contributes one measurement per
sub-question — counting the block once would undercount the skill.

## The 0–5 level scale

The model measures a **three-rung ladder**, because the bank has three difficulty
grades. A rung means you solve that grade **reliably (80%)**, not at a coin-flip:

| rung | θ | means |
|---|---|---|
| 0 | −2.50 | floor — barely above the 25% guess rate |
| 1 | 0.386 | reliably solves easy (difficultyId 1) |
| 2 | 1.386 | …medium (difficultyId 2) |
| 3 | 2.586 | …hard / olympiad (difficultyId 3) |

Those rungs are then **stretched onto a 0–5 display**: `level = rung × 5/3`. This
is a change of units and nothing else — the same ability reported out of five
instead of out of three, so `1.5/3 ⇔ 2.5/5` exactly. `STRETCH` is derived from
`MASTER_LEVEL / RUNGS`, never written as a literal, so widening the display range
stays a one-line edit that cannot leave the anchors behind.

| old | new | band |
|---|---|---|
| 0.5/3 | 0.83/5 | simple |
| 1.0/3 | 1.67/5 | simple |
| 1.5/3 | 2.50/5 | easy |
| 2.0/3 | 3.33/5 | medium |
| 2.5/3 | 4.17/5 | hard |
| 3.0/3 | 5.00/5 | olympiad |

Measured against real papers: 20/45 → 1.15, 28/45 → 1.77, 35/45 → 3.10,
40/45 → 4.24, 45/45 → 5.00.

⚠️ **Do NOT re-anchor each display level to its own difficulty grade** (`level L
= reliably solves difficultyId L−1`). That was implemented and reverted. The bank
has three grades, not five, so two of the five anchors landed on grades the
blueprint never draws: level 5 became **unreachable** (a perfect 45/45 measured
4.45), and every existing level silently changed meaning — a student at "medium"
became "easy" overnight with no change in ability. The stretch keeps the
measurement identical and only changes how it is reported.

⚠️ **Band → colour is ONE table, and no band is grey.**
`app/(student)/raschmodel/_components/LevelBadge.tsx` owns it, shared by the
navbar chip, the "My level" card and the hub summary — those three carried three
tables that had already drifted. `beginner` and `simple` used to paint with
`--m3-outline` / `--m3-on-surface-variant`, so the two bands most students start
in rendered identically to "not measured yet". Every band now owns a hue
(`error → tertiary → secondary → primary → success → gold`), with `error` only at
the literal floor. A dead `BAND_COLOR` table of RAW Tailwind colours used to sit
in `RASCHscale.ts`; it is gone — raw colours are what the student design system
forbids, since the tree re-skins from `design.config.ts`.

⚠️ **Band names are DISPLAY tiers, not difficulty grades.**
`beginner | simple | easy | medium | hard | olympiad`, entered at 0.25 below each
integer. They do not map one-to-one onto the three difficulty grades, and the
"what your level means" grid on the level card deliberately shows **three** cells
(difficultyId 1/2/3) rather than five — a "simple" or "olympiad" column would
report a chance on questions the blueprint never asks.

⚠️ **The rescale needed no migration and did NOT bump `MODEL_VERSION`.** Nothing
stores a level — `dimensions()`, `chapterLevels()`, `mathLevel()` and
`skillStats()` all call `thetaToLevel(θ)` at render time. The change reinterprets
θ; it does not touch it. (`TopicLevel.level` is a different quantity: a 0–100
percentage, unaffected.) `DEVELOPED_LEVEL` is `2 × (MASTER_LEVEL / 3)` = 3.33 —
the exact stretch of the old literal `2`, derived rather than rewritten, so
"developed" still means the same ability and not a softer one.

## Firestore budget

The whole skill axis is read-free. Where the reads actually are, and what bounds
them:

| Action | Firestore cost |
|---|---|
| Open any review panel (skill or weakest-skill), page "+5", read explanations | **0** — localStorage only |
| Render the heptagon, its skills, coverage, weakest list | **0** — derived from the one levels doc the page already read |
| `getRASCHLevels` on a warm cache (12h) | **0** |
| `getRASCHLevels` cold | **1 read**, shared by every concurrent caller |
| Submit an exam / finish a drill | 1 transaction (1 read + 2 writes) + 1 localStorage archive write |
| Skill drill of 10 questions | **≤ 30 reads**, hard-clamped |

⚠️ **`getRASCHLevels` is single-flighted** (`inFlight` map, keyed by uid). Four
components read that document independently (hub `MathLevelSummary`, progress,
diagnosis, practice) and do not coordinate; on a cold cache two mounting together
each issued their own `getDoc`, and React's dev double-mount doubled it again.
The map is cleared in a `finally` so a rejected promise is never pinned.

⚠️ **The drill read ceiling is clamped, not merely checked.**
`MAX_READS_PER_QUESTION = 3` with `OVERSAMPLE_STEPS = [1.5, 3, 6]`: each round's
per-chapter ask is capped to the remaining budget. Testing the ceiling only
*between* rounds lets the round that crosses it run at full width — that is how a
"30 read cap" bills 45. Modelled cost for a 10-question drill: 15 reads when the
skill is its chapter's default (was 42), 30 in every thinner case.

⚠️ **The trade is visible, not hidden.** A thin skill hits the ceiling before the
drill is full and is topped up with same-chapter questions; `buildSkillPractice`
returns `onSkill`, and the practice screen shows `6/10 on this skill` in warning
colour when it is short. Never present a part-filled set as a clean skill drill.

⚠️ **Answered questions are written to localStorage exactly once per sitting** —
`archiveExam` behind an `archivedRef` keyed on the paper's `endsAt`,
`archivePractice` inside the `savedRef`-guarded save effect, before the Firestore
transaction so a failed save still leaves the local record. Every review then
reads only from there. Do not add a Firestore read to a review path.

## Invariants & traps

- ⚠️ **Derived, not stored.** Nothing in this subsystem writes to Firestore. It
  reads `RASCH_levels/{uid}`, which the page already had. Adding a skill write is
  a schema change and needs the Android ledger + additive-only reasoning.
- ⚠️ **`null` level ≠ 0.** See above. `skillsCollected().developed` counts
  `level >= DEVELOPED_LEVEL` (3 = medium) among skills with evidence. That
  constant lives in `RASCHskills.ts` and is imported by the service — it used to
  be the literal `2` in both places, which meant "medium" on the old 0–3 scale
  and would have silently become "easy" on the 0–5 one.
- ⚠️ **`expected` is meaningless on a carried-over aggregate.** When θ falls back
  to the seen-weighted subtopic mean, `ability.expected` is set to `0` on
  purpose — it is not an expected score on a standard paper. Don't render it.
- ⚠️ **The map must stay total.** Every syllabus chapter needs a
  `CHAPTER_DEFAULT`; `skillFor` returns `null` for anything unmapped and those
  items silently leave the skill axis. `unmappedChapters()` exists to assert this
  — verified 29/29 chapters and 210/210 subtopics resolve.
- ⚠️ **Skill keys are content-free by contract.** Do not add a skill like
  "solving logarithmic inequalities" (that is content × skill) or "applying in
  word problems" (that is a presentation format). The test: *can a student be
  good at this independently of its siblings, on the same content?*
- The map is opinionated in places worth knowing: rational and logarithmic
  equations map to `eq-constraints` (the domain check is the skill actually being
  tested), "tengsizliklarni isbotlash" maps to `alg-identity`, and degree↔radian
  conversion maps to `num-forms` — which is why `num-forms` spans `numbers` and
  `algebraic`.

## Known issues / dead code (verified 2026-07-27)

- **Skill drills pay an over-fetch tax.** `buildSkillPractice` filters
  client-side because adding `subtopicId` to the sampler needs a second composite
  index. Adding that index would make drills exact and cheap; it is a
  `firestore.indexes.json` change plus a deploy.
- **`weakestSkills` does not yet drive anything automatically.** It is displayed
  on the progress page, but the default practice mode still builds from weakest
  *chapters*. Pointing it at the weakest skill instead is a one-line change once
  the drill cost above is acceptable.
- **Item difficulties are still mostly anchors, not calibrations.**
  `itemDifficulty()` falls back to `DIFFICULTY_LOGIT[difficultyId]` until
  `scripts/analyzeItems.ts` writes a `b`. Per-skill θ inherits that limitation;
  `MIN_RESPONSES = 5` in that script is far below what stabilises a logit.
- **No item/person fit statistics.** `analyzeItems.ts` computes point-biserial
  but not infit/outfit, so a mistagged item (a skill label that does not match
  what the item actually tests) is not yet detected statistically.

## How to verify changes

`npm run dev`, sign in as a student, `/raschmodel/exam` → sit a paper (or submit
a partial one). On the results screen the **"Skills detected"** card must list
~15–25 skills with `correct/seen` counts summing to 45 slots. Then
`/raschmodel/progress`:

1. Each heptagon dimension row shows `collected/total` and expands on click.
2. Inside `algebraic`, visiting skills are marked `↗` with their home dimension.
3. A skill fed by two dimensions shows the "Also in" cross-link.
4. Skills never met render dimmed with "not met" — **not** as level 0.
5. The Skills card shows lifetime coverage and the five weakest measured skills.
6. **Tap a skill row.** It expands to: the dimension chips it is also measured in
   (clicking one opens that dimension), the skills met alongside it, and the
   questions it was measured on — errors first, then correct, five each, with
   "Last exam" / "All" toggling scope and "+5" paging further back. Tapping a
   question opens the given answer, the correct answer and the explanation.
   Every weakest-skill row on the Skills card expands the same way with its own
   practice link.
8. **Watch the network tab while doing all of the above: it must stay silent.**
   Opening panels, paging, switching scope and reading explanations are
   localStorage-only. A read appearing here is a regression.
7. **"Practise this skill"** goes to
   `/raschmodel/practice?skill=<key>&dim=<dim>` and the intro must name the skill
   and list only the chapters of THAT dimension (e.g. Inequalities from Algebraic
   → Ko'rsatkichli / Trigonometriya / Modul, never Tengsizliklar). Ten questions.
   A bogus `?skill=` must fall back to the weakest-chapters mode, not error.

For the map itself, assert totality rather than eyeballing it: every chapter must
have a `CHAPTER_DEFAULT` and every subtopic must resolve (`unmappedChapters` +
`skillFor` over `getMathTopics()`).
