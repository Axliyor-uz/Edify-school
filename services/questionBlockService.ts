import { db } from "@/lib/firebase";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { toQuestionV1 } from "@/lib/questionSchema";
import { invalidateQuestionCache } from "@/lib/questionCache";
import type { LocalizedText } from "@/types/Math";
import {
  DIFFICULTY_ID_BY_NAME,
  type CreationMethod, type DifficultyName, type NormalizedQuestion, type QuestionStatus, type QuestionType,
} from "@/types/question";
import { OPTION_LETTERS, type ImageRef, type OptionDraft, emptyOption, isOptionFilled } from "./questionBankService";

/**
 * BLOCKS — one stem, several sub-questions, **one Firestore document**.
 *
 * Two real exam shapes:
 *   • `multi_part`     — "39. Tenglamalar sistemasi …" + a) … b) …, each part
 *                        answered on its own (typed answer or its own options).
 *   • `shared_options` — "33-35 testlar" + a diagram + ONE printed A–F pool that
 *                        all three sub-questions pick from.
 *
 * Why a block is a type and not N linked questions — this is the whole point:
 *   • 1 write instead of N. A 3-question block = 1 document.
 *   • 1 read instead of N when a runner loads it, and the stem + diagram travel
 *     with it instead of being duplicated into every sub-question.
 *   • The shared option pool is stored EXACTLY ONCE (parts keep `options: []`
 *     and read the block's pool), so a 6-option pool isn't copied 3×.
 *   • The stem image is uploaded once, not once per sub-question.
 *
 * See docs/QUESTIONS.md.
 */

export type BlockType = "multi_part" | "shared_options";
/** What a sub-question may be. Blocks never nest. */
export type PartType = "mcq" | "open" | "numeric";

export const MAX_PARTS = 8;
export const MAX_POOL = OPTION_LETTERS.length; // A–F

export interface PartDraft {
  /** Stable client key (React lists) — not persisted. */
  key: string;
  /** The label the teacher gives it: "a", "b", "33"… Persisted as the part id. */
  label: string;
  prompt: string;
  type: PartType;
  /** `mcq` inside a `multi_part` block: the part's own options. */
  options: OptionDraft[];
  /** Index of the correct option — into `options`, or into the shared pool. */
  correctIndex: number;
  /** `open`/`numeric`: the typed answer + alternatives. */
  correctText: string;
  acceptedAnswers: string[];
  points: number;
  explanation: string;
}

export interface BlockDraft {
  stemText: string;
  imageUrl: string | null;
  imageStoragePath: string | null;

  subjectId: string; subjectName: string;
  topicId: string; topicName: string;
  subtopicId: string; subtopicName: string;

  type: BlockType;
  /** `shared_options` only: the ONE pool every part picks from. */
  sharedOptions: OptionDraft[];
  parts: PartDraft[];

  difficulty: DifficultyName;
  status: QuestionStatus;
  estimatedTime: number;
  hint: string;
  tags: string[];
  curriculum: string[];
}

let partKeySeq = 0;

export const newPart = (label: string): PartDraft => ({
  key: `part-${partKeySeq++}`,
  label,
  prompt: "",
  type: "open",
  options: [emptyOption(), emptyOption()],
  correctIndex: 0,
  correctText: "",
  acceptedAnswers: [],
  points: 1,
  explanation: "",
});

/** a, b, c … — the labels the first shape uses. */
export const LETTER_LABELS = "abcdefgh".split("");

const tri = (uz: string): LocalizedText => ({ uz: uz.trim(), ru: "", en: "" });

export function newQuestionId(): string {
  return `tq_${doc(collection(db, "teacher_questions")).id}`;
}

/** `mcq` parts pick a letter; `open`/`numeric` parts take a typed answer. */
export const partUsesOptions = (block: BlockType, part: PartDraft) =>
  block === "shared_options" || part.type === "mcq";

export interface BlockValidation {
  ok: boolean;
  errorKey?: "noStem" | "noTopic" | "noParts" | "noPartPrompt" | "noPool" | "noPartAnswer";
}

export function validateBlock(draft: BlockDraft): BlockValidation {
  if (!draft.stemText.trim() && !draft.imageUrl) return { ok: false, errorKey: "noStem" };
  if (!draft.subjectId || !draft.topicId || !draft.subtopicId) return { ok: false, errorKey: "noTopic" };
  if (draft.parts.length === 0) return { ok: false, errorKey: "noParts" };

  if (draft.type === "shared_options") {
    // The pool is printed once beside the block — it needs at least two entries.
    if (draft.sharedOptions.filter(isOptionFilled).length < 2) return { ok: false, errorKey: "noPool" };
  }

  for (const part of draft.parts) {
    if (!part.prompt.trim()) return { ok: false, errorKey: "noPartPrompt" };

    if (partUsesOptions(draft.type, part)) {
      const pool = draft.type === "shared_options" ? draft.sharedOptions : part.options;
      const filled = pool.filter(isOptionFilled);
      if (filled.length < 2) return { ok: false, errorKey: "noPool" };
      if (part.correctIndex < 0 || part.correctIndex >= filled.length) return { ok: false, errorKey: "noPartAnswer" };
    } else if (!part.correctText.trim()) {
      return { ok: false, errorKey: "noPartAnswer" };
    }
  }

  return { ok: true };
}

/** OptionDraft[] → the letter-keyed map `normalizeQuestion` reads. */
function optionsToMap(options: OptionDraft[]): Record<string, LocalizedText & ImageRef> {
  const map: Record<string, LocalizedText & ImageRef> = {};
  options.filter(isOptionFilled).forEach((o, i) => {
    map[OPTION_LETTERS[i]] = { ...tri(o.text), imageUrl: o.imageUrl, imageStoragePath: o.imageStoragePath };
  });
  return map;
}

/**
 * ⚠️ Block options are NEVER shuffled — unlike a single question. The pool is
 * printed once next to the block ("A) 72  B) 4  C) 108 …") and several parts
 * reference the same letters, so reordering would scramble the answer key.
 */
function blockToSource(draft: BlockDraft) {
  const isShared = draft.type === "shared_options";
  const pool = draft.sharedOptions.filter(isOptionFilled);

  const parts = draft.parts.map((part) => {
    const usesOptions = partUsesOptions(draft.type, part);
    const own = usesOptions && !isShared ? part.options.filter(isOptionFilled) : [];
    const letters = isShared ? pool : own;

    return {
      id: part.label.trim() || part.key,
      prompt: tri(part.prompt),
      type: part.type as QuestionType,
      // shared_options parts store NO options — they read the block's pool.
      options: isShared ? {} : optionsToMap(own),
      correctAnswer: {
        value: usesOptions
          ? OPTION_LETTERS[Math.min(part.correctIndex, Math.max(letters.length - 1, 0))] ?? "A"
          : part.correctText.trim(),
        acceptedAnswers: usesOptions ? [] : part.acceptedAnswers.map((a) => a.trim()).filter(Boolean),
        caseSensitive: false,
      },
      points: part.points,
      explanation: tri(part.explanation),
    };
  });

  return {
    type: draft.type,
    question: tri(draft.stemText),
    imageUrl: draft.imageUrl,
    imageStoragePath: draft.imageStoragePath,

    // The shared pool lives at the TOP level — stored once for the whole block.
    options: isShared ? optionsToMap(pool) : {},
    correctAnswer: { value: "", acceptedAnswers: [] },
    parts,

    subject: { id: draft.subjectId, name: draft.subjectName },
    topic: { id: draft.topicId, name: draft.topicName },
    subtopic: { id: draft.subtopicId, name: draft.subtopicName },
    chapter: { id: "", name: "" },

    difficulty: { id: DIFFICULTY_ID_BY_NAME[draft.difficulty] ?? 2, name: draft.difficulty, rasch: null, estimatedAbility: null },
    difficultyId: DIFFICULTY_ID_BY_NAME[draft.difficulty] ?? 2,

    // The block is worth the sum of its parts.
    points: parts.reduce((sum, p) => sum + (p.points || 1), 0),
    estimatedTime: draft.estimatedTime,
    hint: tri(draft.hint),
    explanation: tri(""),
    tags: draft.tags,
    curriculum: draft.curriculum,
    language: ["uz"],
    solutions: [],
  };
}

/**
 * A stored block → the builder's draft, so it can be EDITED.
 *
 * ⚠️ A block must never be opened in the single-question builder: that one lifts
 * one option out of `optionList` as "the answer" and drops `parts` entirely, so
 * saving would destroy every sub-question. `draftFromQuestion` (the single
 * builder) and this function are not interchangeable — route on `q.isBlock`.
 */
export function blockDraftFromQuestion(q: NormalizedQuestion): BlockDraft {
  // shared_options: normalizeQuestion hands every part the SAME optionList array
  // as the block, which is exactly how we tell the two block shapes apart.
  const isShared =
    q.optionList.length > 0 && q.parts.length > 0 && q.parts.every((p) => p.optionList === q.optionList);

  const toOptionDraft = (o: { text: LocalizedText; imageUrl: string | null }): OptionDraft => ({
    text: o.text.uz || o.text.ru || o.text.en || "",
    imageUrl: o.imageUrl,
    imageStoragePath: null,
  });

  const pool = isShared ? q.optionList.map(toOptionDraft) : [emptyOption(), emptyOption()];

  const parts: PartDraft[] = q.parts.map((part) => {
    const correct = Array.isArray(part.correctAnswer.value)
      ? part.correctAnswer.value
      : [String(part.correctAnswer.value ?? "")];
    const options = part.optionList.map(toOptionDraft);
    const correctIndex = Math.max(0, part.optionList.findIndex((o) => correct.includes(o.id)));

    return {
      key: `part-${partKeySeq++}`,
      label: part.id,
      prompt: part.prompt.uz || part.prompt.ru || part.prompt.en || "",
      type: (part.optionList.length > 0 ? "mcq" : part.type === "numeric" ? "numeric" : "open") as PartType,
      options: options.length >= 2 ? options : [emptyOption(), emptyOption()],
      correctIndex,
      correctText: part.optionList.length === 0 ? String(part.correctAnswer.value ?? "") : "",
      acceptedAnswers: part.correctAnswer.acceptedAnswers,
      points: part.points,
      explanation: part.explanation.uz || "",
    };
  });

  const raw = q.raw as Record<string, { storagePath?: string } | undefined>;

  return {
    stemText: q.question.uz || q.question.ru || q.question.en || "",
    imageUrl: q.imageUrl,
    imageStoragePath: raw?.image?.storagePath ?? null,

    subjectId: q.subjectId, subjectName: q.subject,
    topicId: q.topicId, topicName: q.topic,
    subtopicId: q.subtopicId, subtopicName: q.subtopic,

    type: isShared ? "shared_options" : "multi_part",
    sharedOptions: pool,
    parts: parts.length ? parts : [newPart("a")],

    difficulty: q.difficulty,
    status: q.status,
    estimatedTime: q.estimatedTime,
    hint: q.hint.uz || "",
    tags: q.tags,
    curriculum: [],
  };
}

/** ONE document for the whole block — one write, however many sub-questions. */
export async function saveBlock(
  draft: BlockDraft,
  id: string,
  creatorId: string,
  creatorName: string,
  creationMethod: CreationMethod = "teacher_created",
  /** Set when EDITING: preserves the age and stamps who fixed it. */
  original?: NormalizedQuestion | null,
) {
  const raw = (original?.raw ?? {}) as Record<string, unknown> & { metadata?: Record<string, unknown> };

  const payload = toQuestionV1(blockToSource(draft), {
    id,
    creatorId,
    creatorName,
    creationMethod,
    status: draft.status,
    estimatedTime: draft.estimatedTime,
    curriculum: draft.curriculum,
    timestamp: serverTimestamp(),
    ...(original
      ? {
          // An edit must not reset the block's age (it drives `orderBy createdAt`),
          // and whoever fixed it owns the fix — same rules as a single question.
          createdAt: raw.createdAt ?? raw.metadata?.createdAt ?? serverTimestamp(),
          correctedBy: creatorName,
          correctedById: creatorId,
        }
      : {}),
  });

  await setDoc(doc(db, "teacher_questions", id), payload);
  invalidateQuestionCache(id);
  return payload;
}
