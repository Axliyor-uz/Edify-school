// types/Math.ts

export type Lang = 'uz' | 'ru' | 'en';

export type DifficultyKey = 'easy' | 'medium' | 'hard';

/** The full ladder is in types/question.ts (`DIFFICULTY_LEVELS`): beginner=0,
 *  easy=1, medium=2, hard=3, olympiad=4, expert=5. The ids are NOT in difficulty
 *  order — 1/2/3/4 were already burned into the bank and the indexes, so the two
 *  new levels took the free slots. `questions1` only ever uses 1|2|3. */
export type DifficultyId = 0 | 1 | 2 | 3 | 4 | 5;

/** The three levels `questions1` / the exam sampler are keyed by. */
export const DIFFICULTY_KEYS: DifficultyKey[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_IDS: Record<DifficultyKey, DifficultyId> = { easy: 1, medium: 2, hard: 3 };

// ─── Syllabus tree (0 Firestore reads — data/syllabus.json is bundled) ──────
// The ids here are exactly the ones questions1 is keyed by: topicId is the
// unpadded category index ("1" = Algebra, "2" = Geometriya); chapterId and
// subtopicId are the chapter/subtopic index zero-padded to 2 chars.

/** Raw shape of data/syllabus.json. */
export interface SyllabusCategory {
  category: string;
  index: number;
  chapters: Array<{
    chapter: string;
    index: number;
    subtopics: Array<{ name: string; index: number }>;
  }>;
}

export interface SubtopicStructure {
  subtopicId: string;
  name: string;
}

export interface ChapterStructure {
  chapterId: string;
  name: string;
  subtopics: SubtopicStructure[];
}

export interface TopicStructure {
  topicId: string;
  name: string;
  chapters: ChapterStructure[];
}

// ─── questions1 document shape ──────────────────────────────────────────────

export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface QuestionSolution {
  final_answer: string;
  method: string;
  steps: string[];
}

export interface QuestionDoc {
  id: string;
  number: string;
  subjectId: string;
  subject: string;
  topicId: string;
  topic: string;
  subtopicId: string;
  subtopic: string;
  chapterId: string;
  chapter: string;
  difficultyId: DifficultyId;
  difficulty: DifficultyKey;
  question: LocalizedText;
  options: Record<OptionKey, LocalizedText>;
  answer: OptionKey;
  explanation: LocalizedText;
  solutions: QuestionSolution[];
  tags: string[];
  language: Lang[];
  /** Uniform in [0, 1). Written by scripts/backfillrandfield.ts — powers the
   *  random sampling in lib/Examquestions.ts. Absent until backfilled.
   *
   *  DELETING this field quarantines a question: it vanishes from the sampler's
   *  index, so a miskeyed item can never appear in an exam again. That is how
   *  scripts/analyzeItems.ts benches suspect questions — no client change, no
   *  extra query, no read. */
  rand?: number;

  /** ── Written back by scripts/analyzeItems.ts (offline). ──────────────────
   *  These ride along with a question the app already reads, so using them
   *  costs ZERO extra reads. */

  /** Calibrated Rasch difficulty in logits, measured from real responses.
   *  When present it overrides the difficultyId anchor in lib/RASCHtheta.ts. */
  b?: number;
  /** Point-biserial. Negative = strong students miss it = suspect the key. */
  rpb?: number;
  /** Responses the calibration is based on. */
  responses?: number;
  /** Flagged as probably miskeyed and benched pending human review. */
  suspect?: boolean;
}
