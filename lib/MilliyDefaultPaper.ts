// lib/MilliyDefaultPaper.ts
//
// The SAMPLE paper for a Milliy sertifikat subject — the questions the builder's
// "Namunaviy variant" button drops onto an empty paper, so a teacher can publish a
// complete variant (or edit one into their own) without hand-picking every
// question. The maths equivalent is `lib/RASCHdefaultPaper.ts`; this is the same
// idea, generalized over the subject registry.
//
// ⚠️ **The content is DATA, not code.** It lives in `data/<subject>-default-paper.json`
// and that file is the ONLY place to edit questions — this module just validates
// it and turns it into `MilliyQuizItem`s. Contract: docs/MILLIY_QUIZ.md.
//
// Why a bundled JSON rather than seeded Firestore documents (same three reasons
// the maths sample paper has): it costs ZERO reads and the builder stores papers
// as embedded snapshots anyway, so a ref would buy nothing; a developer changes it
// in a reviewable diff instead of in a console; and it cannot drift per
// environment. The cost is that the items are in nobody's question bank — the
// picker never lists them, and editing the JSON does not touch a paper a teacher
// already saved. That is the same freeze every stored quiz item has.

import { findSubject } from './questionTopics';
import { milliySlotCount } from './MilliyQuiz';
import type { DifficultyId, DifficultyKey, Lang, LocalizedText, OptionKey, QuestionDoc } from '@/types/Math';
import type { MilliyQuizItem } from '@/types/MilliyQuiz';

// ─── the authoring shape (what data/<subject>-default-paper.json holds) ──────

/** Any user-facing string: trilingual, or one string used for all three. */
export type SampleText = string | Partial<Record<Lang, string>>;

export interface SamplePaperEntry {
  /**
   * A TOPIC slug from this subject in `data/question_topics.json` — e.g.
   * `sitologiya-genetika-va-seleksiya-asoslari`. It becomes the item's
   * `sectionId`, which is what the results page groups by, so a slug the subject
   * does not have is rejected rather than silently filed under "".
   */
  topicId: string;
  /** Optional subtopic slug, for a more precise label. Validated if present. */
  subtopicId?: string;
  question: SampleText;
  /** CLOSED items only — A–F. A typed item must not carry options. */
  options?: Partial<Record<OptionKey, SampleText>>;
  /** Closed: the correct option key. Typed: the literal text the student writes. */
  answer: string;
  /** Typed only: other spellings graded correct. */
  acceptedAnswers?: string[];
  /**
   * Typed only. `true` ⇒ graded with the numeric comparison (commas, spaces and
   * brackets ignored); `false` ⇒ graded as text. ⚠️ Defaults to **false** here,
   * the opposite of the maths sample paper: most biology answers are words.
   */
  numeric?: boolean;
  explanation?: SampleText;
  /** 1 easy · 2 medium · 3 hard. Defaults to 2. ⚠️ Ids are not a clean ladder —
   *  see docs/QUESTIONS.md. */
  difficultyId?: DifficultyId;
}

export interface SamplePaperFile {
  title?: SampleText;
  durationMinutes?: number;
  questions: SamplePaperEntry[];
}

/**
 * Id prefix for a sample item.
 *
 * ⚠️ It must not collide with a `teacher_questions` id, because the builder
 * de-duplicates on `id` (`milliyPickedIds` / `checkMilliyAdd`) — a collision would
 * make a real question un-addable. Firestore ids are 20 random chars, so a
 * readable slug can never be one.
 */
export const SAMPLE_ITEM_PREFIX = 'milliy-sample-';

/**
 * ⚠️ **A–D only**, because `OptionKey` ([types/Math.ts](../types/Math.ts)) is
 * `'A'|'B'|'C'|'D'` — the shape `QuestionDoc.options` is keyed by. The maths
 * sample paper has the same limit. A–F pools do exist at runtime, but only on a
 * `shared_options` BLOCK, whose `optionKeys` is a plain `string[]`; a sample-paper
 * entry is a flat question, so four options is the ceiling. Widening this means
 * widening `OptionKey`, which touches the whole legacy bank.
 */
const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

const DIFF_KEY_BY_ID: Record<number, DifficultyKey> = {
  0: 'easy', 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard', 5: 'hard',
};

/** A bare string fills all three languages — see the `_readme` on uz-only content. */
export function toSampleText(text: SampleText | undefined): LocalizedText {
  if (typeof text === 'string') return { uz: text, ru: text, en: text };
  const uz = text?.uz ?? text?.ru ?? text?.en ?? '';
  return { uz, ru: text?.ru ?? uz, en: text?.en ?? uz };
}

/** What the builder gets back: the paper, plus anything wrong with the file. */
export interface SamplePaperBuild {
  items: MilliyQuizItem[];
  title: LocalizedText;
  durationMinutes: number;
  /** Slots the paper comes to — the builder sets its length target from this. */
  slots: number;
  /**
   * Human-readable faults, in file order. NON-EMPTY ⇒ do not load the paper. A
   * silently-wrong sample is worse than none: it would be published with items
   * filed under topics the subject does not have, and the results page would
   * group a class's weakest topic under an empty label.
   */
  problems: string[];
}

/**
 * Validates and converts the whole file for one subject.
 *
 * Everything positional is DERIVED, never authored: the topic and subtopic NAMES
 * come from `data/question_topics.json`, and `testType` from whether the entry has
 * options. The JSON therefore cannot invent a topic or mislabel a typed item as
 * closed — the two mistakes that would corrupt the results page's grouping and the
 * runner's rendering.
 */
export function buildSamplePaper(subjectSlug: string, file: SamplePaperFile): SamplePaperBuild {
  const problems: string[] = [];
  const items: MilliyQuizItem[] = [];
  const entries = Array.isArray(file?.questions) ? file.questions : [];
  const where0 = `data/${subjectSlug}-default-paper.json`;

  const taxonomy = findSubject(subjectSlug);
  if (!taxonomy) {
    return {
      items: [],
      title: toSampleText(file?.title),
      durationMinutes: 90,
      slots: 0,
      problems: [`${where0}: "${subjectSlug}" is not a subject in data/question_topics.json.`],
    };
  }

  if (entries.length === 0) problems.push(`${where0}: "questions" is empty.`);

  entries.forEach((entry, index) => {
    const where = `#${index + 1} (${entry?.topicId ?? '?'})`;

    const topic = taxonomy.topics.find((tp) => tp.id === entry?.topicId);
    if (!topic) {
      problems.push(
        `${where}: unknown topicId — use one of ${taxonomy.topics.map((tp) => tp.id).join(', ')}.`,
      );
      return;
    }

    const subtopic = entry.subtopicId
      ? topic.subtopics.find((st) => st.id === entry.subtopicId)
      : undefined;
    if (entry.subtopicId && !subtopic) {
      problems.push(`${where}: subtopicId "${entry.subtopicId}" is not in topic "${topic.id}".`);
      return;
    }

    const answer = String(entry.answer ?? '').trim();
    if (!answer) {
      problems.push(`${where}: "answer" is empty.`);
      return;
    }

    // Closed vs typed is decided by the PRESENCE of options, not by a flag — one
    // fewer field to get wrong, and it cannot contradict itself.
    const keys = OPTION_KEYS.filter((k) => entry.options?.[k] !== undefined);
    const closed = keys.length > 0;

    if (closed) {
      if (keys.length < 2) {
        problems.push(`${where}: a closed item needs at least two options.`);
        return;
      }
      if (!keys.includes(answer as OptionKey)) {
        problems.push(`${where}: "answer" is "${answer}" but the options are ${keys.join(', ')}.`);
        return;
      }
    }

    items.push(buildItem({
      entry, index, subjectSlug,
      topicId: topic.id, topicName: topic.name,
      subtopicId: subtopic?.id ?? '', subtopicName: subtopic?.name ?? '',
      closed, keys, answer,
      difficultyId: entry.difficultyId ?? 2,
      numeric: entry.numeric === true,
    }));
  });

  const slots = problems.length === 0 ? milliySlotCount(items) : 0;
  if (problems.length === 0 && slots === 0) {
    problems.push(`${where0}: the paper came to 0 questions.`);
  }

  return {
    items,
    title: toSampleText(file?.title),
    durationMinutes: file?.durationMinutes && file.durationMinutes > 0 ? file.durationMinutes : 90,
    slots,
    problems,
  };
}

function buildItem(args: {
  entry: SamplePaperEntry;
  index: number;
  subjectSlug: string;
  topicId: string;
  topicName: string;
  subtopicId: string;
  subtopicName: string;
  closed: boolean;
  keys: OptionKey[];
  answer: string;
  difficultyId: DifficultyId;
  numeric: boolean;
}): MilliyQuizItem {
  const {
    entry, index, subjectSlug, topicId, topicName, subtopicId, subtopicName,
    closed, keys, answer, difficultyId, numeric,
  } = args;

  const options = closed
    ? (Object.fromEntries(
        keys.map((k) => [k, toSampleText(entry.options?.[k])]),
      ) as QuestionDoc['options'])
    : ({} as QuestionDoc['options']);

  // ⚠️ Every optional field is spread conditionally — an `undefined` anywhere in
  // here reaches Firestore through `saveMilliyQuiz` and the whole write throws.
  return {
    id: `${SAMPLE_ITEM_PREFIX}${subjectSlug}-${String(index + 1).padStart(2, '0')}`,
    number: String(index + 1),
    subjectId: subjectSlug,
    subject: subjectSlug,
    // ⚠️ `topicId` IS the sectionId for these papers (see MilliyQuiz.slotMeta), so
    // the results page groups a sample item exactly like a hand-picked one.
    topicId,
    topic: topicName,
    subtopicId,
    subtopic: subtopicName,
    chapterId: '',
    chapter: topicName,
    difficultyId,
    difficulty: DIFF_KEY_BY_ID[difficultyId] ?? 'medium',
    question: toSampleText(entry.question),
    options,
    answer: answer as OptionKey,
    explanation: toSampleText(entry.explanation),
    solutions: [],
    tags: [],
    language: ['uz', 'ru', 'en'],

    sectionId: topicId,
    testType: closed ? 'Y-1' : 'O',
    // `source: 'teacher'` is what makes `examMode` render by `qType` rather than
    // by the test type — the only path on which a typed item shows an input box
    // instead of A–F buttons.
    source: 'teacher',
    qType: closed ? 'mcq' : numeric ? 'numeric' : 'open',
    ...(closed ? { optionKeys: keys } : {}),
    ...(!closed && entry.acceptedAnswers?.length ? { acceptedAnswers: entry.acceptedAnswers } : {}),
  };
}

// ─── loading it ─────────────────────────────────────────────────────────────

/**
 * Which subjects ship a sample paper, and the chunk each lives in.
 *
 * ⚠️ **DYNAMIC imports on purpose.** Each file is a full paper of trilingual
 * questions and every teacher who opens a builder would otherwise download all of
 * them, including the majority who never press the button — this way webpack
 * splits each into its own chunk, fetched on the first click and cached after.
 *
 * ⚠️ The keys must be literal so the bundler can see them; a computed
 * `import(`@/data/${slug}…`)` would pull EVERY json in the folder into one chunk.
 */
const SAMPLE_FILES: Record<string, () => Promise<unknown>> = {
  biologiya: () => import('@/data/biology-default-paper.json'),
  kimyo: () => import('@/data/chemistry-default-paper.json'),
  fizika: () => import('@/data/physics-default-paper.json'),
  'ona-tili': () => import('@/data/ona-tili-default-paper.json'),
};

/** Does this subject have a sample paper? Drives whether the button is rendered. */
export const hasSamplePaper = (subjectSlug: string): boolean => subjectSlug in SAMPLE_FILES;

/**
 * Reads the subject's sample file and builds the paper. Returns `null` when the
 * subject ships none — the caller hides the button rather than showing an error.
 */
export async function loadSamplePaper(subjectSlug: string): Promise<SamplePaperBuild | null> {
  const load = SAMPLE_FILES[subjectSlug];
  if (!load) return null;
  const mod = await load() as { default?: unknown };
  return buildSamplePaper(subjectSlug, (mod.default ?? mod) as SamplePaperFile);
}
