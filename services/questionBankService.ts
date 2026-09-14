import { db, storage } from "@/lib/firebase";
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  startAfter, where, type QueryDocumentSnapshot,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { normalizeQuestion, toQuestionV1 } from "@/lib/questionSchema";
import { cacheQuestion, getCachedQuestion, invalidateQuestionCache } from "@/lib/questionCache";
import type { LocalizedText } from "@/types/Math";
import {
  CREATION_METHODS, DIFFICULTY_ID_BY_NAME,
  type CreationMethod, type DifficultyName, type NormalizedQuestion,
  type QuestionStatus, type QuestionType,
} from "@/types/question";

/**
 * The teacher question bank — `teacher_questions`, written in the canonical v1
 * schema (types/question.ts). Every creator ends up here; see docs/QUESTIONS.md.
 *
 * Cost shape: creating a question is exactly ONE document write (plus one
 * Storage upload per image actually attached). No stats doc, no counters, no
 * fan-out — `question_stats` is aggregated offline, never on the write path.
 */

/** Letters handed out to options, in order. */
export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export const MAX_INCORRECT_OPTIONS = OPTION_LETTERS.length - 1;

/** An image already uploaded to Storage (null-filled when there is none). */
export interface ImageRef {
  imageUrl: string | null;
  imageStoragePath: string | null;
}

/** One answer option: text (inline LaTeX as `$...$`), an image, or both. */
export interface OptionDraft extends ImageRef {
  text: string;
}

export const emptyOption = (): OptionDraft => ({ text: "", imageUrl: null, imageStoragePath: null });

/** What the builder page collects. */
export interface QuestionDraft {
  questionText: string;
  imageUrl: string | null;
  imageStoragePath: string | null;

  subjectId: string; subjectName: string;
  topicId: string; topicName: string;
  subtopicId: string; subtopicName: string;

  type: QuestionType;
  status: QuestionStatus;
  /** `single`/`multi` types collect options; text types collect a typed answer. */
  correctOption: OptionDraft;
  incorrectOptions: OptionDraft[];
  /** multiple_select: which of the options (correct + incorrect) are also correct. */
  extraCorrectKeys: string[];
  acceptedAnswers: string[];
  caseSensitive: boolean;

  explanation: string;
  hint: string;
  difficulty: DifficultyName;
  points: number;
  estimatedTime: number;
  tags: string[];
  curriculum: string[];
}

const tri = (uz: string): LocalizedText => ({ uz: uz.trim(), ru: "", en: "" });

/** An option counts as filled when it has text, an image, or both. */
export const isOptionFilled = (opt: OptionDraft) => !!opt.text.trim() || !!opt.imageUrl;

/** Fisher–Yates — keeps the correct answer off a predictable letter. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Reserve a Firestore ID up front so images can be filed under it. */
export function newQuestionId(): string {
  return `tq_${doc(collection(db, "teacher_questions")).id}`;
}

/**
 * @param slot `prompt` | `correct` | `opt0`… — keeps one question's images apart.
 */
export async function uploadQuestionImage(
  uid: string,
  questionId: string,
  slot: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ImageRef> {
  const ext = file.name.slice(file.name.lastIndexOf(".")) || ".png";
  const path = `teacher_questions/${uid}/${questionId}_${slot}_${Date.now()}${ext}`;
  const task = uploadBytesResumable(ref(storage, path), file);

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => resolve({ imageUrl: await getDownloadURL(task.snapshot.ref), imageStoragePath: path }),
    );
  });
}

export interface ValidationResult {
  ok: boolean;
  /** Translation key the page maps to a localized toast. */
  errorKey?: "noPrompt" | "noTopic" | "noAnswer" | "noOptions" | "duplicateOption";
}

/** True for the types that offer pickable options (vs a typed answer). */
export const hasOptions = (type: QuestionType) =>
  type === "mcq" || type === "multiple_select" || type === "true_false";

export function validateDraft(draft: QuestionDraft): ValidationResult {
  if (!draft.questionText.trim() && !draft.imageUrl) return { ok: false, errorKey: "noPrompt" };
  if (!draft.subjectId || !draft.topicId || !draft.subtopicId) return { ok: false, errorKey: "noTopic" };
  if (!isOptionFilled(draft.correctOption)) return { ok: false, errorKey: "noAnswer" };

  if (hasOptions(draft.type)) {
    const filled = draft.incorrectOptions.filter(isOptionFilled);
    if (filled.length < 1) return { ok: false, errorKey: "noOptions" };

    // Image-only options can't collide; only compare the ones that carry text.
    const texts = [draft.correctOption, ...filled].map((o) => o.text.trim().toLowerCase()).filter(Boolean);
    if (new Set(texts).size !== texts.length) return { ok: false, errorKey: "duplicateOption" };
  }

  return { ok: true };
}

/**
 * Builder draft → the loose in-memory question shape `toQuestionV1` consumes.
 * Options are shuffled here so the correct answer never lands on a predictable
 * letter (a test rendered with `shuffle: false` would otherwise leak it).
 */
function draftToSource(draft: QuestionDraft) {
  const optionsMap: Record<string, LocalizedText & ImageRef> = {};
  const correctLetters: string[] = [];

  if (hasOptions(draft.type)) {
    const extras = new Set(draft.extraCorrectKeys);
    const pool = shuffled([
      { opt: draft.correctOption, correct: true },
      ...draft.incorrectOptions
        .filter(isOptionFilled)
        .map((opt, i) => ({ opt, correct: draft.type === "multiple_select" && extras.has(String(i)) })),
    ]);

    pool.forEach((entry, i) => {
      const letter = OPTION_LETTERS[i];
      optionsMap[letter] = { ...tri(entry.opt.text), imageUrl: entry.opt.imageUrl, imageStoragePath: entry.opt.imageStoragePath };
      if (entry.correct) correctLetters.push(letter);
    });
  }

  const isMulti = draft.type === "multiple_select";
  const typedAnswer = draft.correctOption.text.trim();

  return {
    question: tri(draft.questionText),
    imageUrl: draft.imageUrl,
    imageStoragePath: draft.imageStoragePath,

    type: draft.type,
    options: optionsMap,
    correctAnswer: {
      value: hasOptions(draft.type) ? (isMulti ? correctLetters.sort() : correctLetters[0] || "") : typedAnswer,
      acceptedAnswers: hasOptions(draft.type) ? [] : draft.acceptedAnswers.map((a) => a.trim()).filter(Boolean),
      caseSensitive: hasOptions(draft.type) ? false : draft.caseSensitive,
    },

    subject: { id: draft.subjectId, name: draft.subjectName },
    topic: { id: draft.topicId, name: draft.topicName },
    subtopic: { id: draft.subtopicId, name: draft.subtopicName },
    chapter: { id: "", name: "" },

    difficulty: { id: DIFFICULTY_ID_BY_NAME[draft.difficulty] ?? 2, name: draft.difficulty, rasch: null, estimatedAbility: null },
    difficultyId: DIFFICULTY_ID_BY_NAME[draft.difficulty] ?? 2,

    explanation: tri(draft.explanation),
    hint: tri(draft.hint),
    tags: draft.tags.map((t) => t.trim()).filter(Boolean),
    curriculum: draft.curriculum,
    language: ["uz"],
    solutions: [],
  };
}

/** Writes `teacher_questions/{id}` — doc key === `id` field. One write, nothing else. */
export async function saveQuestion(
  draft: QuestionDraft,
  id: string,
  creatorId: string,
  creatorName: string,
  creationMethod: CreationMethod = "teacher_created",
) {
  const payload = toQuestionV1(draftToSource(draft), {
    id,
    creatorId,
    creatorName,
    creationMethod,
    status: draft.status,
    points: draft.points,
    estimatedTime: draft.estimatedTime,
    curriculum: draft.curriculum,
    timestamp: serverTimestamp(),
  });

  await setDoc(doc(db, "teacher_questions", id), payload);
  invalidateQuestionCache(id); // a stale bank right after a save is worse than one read
  return payload;
}

export interface QuestionPage {
  questions: NormalizedQuestion[];
  /** Pass back as `cursor` to get the next page; null when the bank is exhausted. */
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * ONE page of the teacher's questions, newest first. Nothing calls this on mount
 * — the builder page only fetches when the teacher presses the button, so simply
 * opening the form costs zero reads. Uses the existing `creatorId + createdAt
 * desc` index; v1 and legacy docs both match it.
 *
 * `methods` narrows by provenance (`AI_CREATION_METHODS` /
 * `MANUAL_CREATION_METHODS` …). It is done **server-side**, so a filtered page
 * still bills 10 documents and every one of them is shown — and it rides the
 * `creationMethod + creatorId + createdAt` index `create/my_questions` already
 * uses, so no new index. ⚠️ Firestore caps an `in` list at 30 values.
 *
 * `subjectSlug` narrows to one `data/question_topics.json` subject (`biologiya`,
 * `algebra`…) and is what the Milliy sertifikat subject builder pages on
 * (docs/MILLIY_QUIZ.md). Also **server-side**, on its own composite index
 * `creatorId + subject.id + createdAt desc`. ⚠️ It had to be server-side: a
 * teacher whose bank is mostly maths would otherwise page through it 10 documents
 * at a time hunting for a biology question, paying for every one.
 */
export async function fetchMyQuestionsPage(
  creatorId: string,
  pageSize = 10,
  cursor: QueryDocumentSnapshot | null = null,
  methods?: string[],
  subjectSlug?: string,
): Promise<QuestionPage> {
  const snap = await getDocs(
    query(
      collection(db, "teacher_questions"),
      where("creatorId", "==", creatorId),
      ...(methods?.length ? [where("creationMethod", "in", methods)] : []),
      ...(subjectSlug ? [where("subject.id", "==", subjectSlug)] : []),
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize),
    ),
  );

  return {
    // Normalized at the boundary: the list renders v1 and legacy docs identically.
    questions: snap.docs.map((d) => normalizeQuestion({ id: d.id, ...d.data() })),
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
}

/**
 * One question by id. **Usually costs ZERO reads**: the list that routed to the
 * editor already put it in the cache (`cacheQuestion`), so only a cold deep link
 * (a pasted `?edit=…` URL, or an expired 60s TTL) actually hits Firestore.
 */
export async function fetchQuestionById(id: string): Promise<NormalizedQuestion | null> {
  const cached = getCachedQuestion(id);
  if (cached) return cached;

  const snap = await getDoc(doc(db, "teacher_questions", id));
  if (!snap.exists()) return null;

  const q = normalizeQuestion({ id: snap.id, ...snap.data() });
  cacheQuestion(q);
  return q;
}

/**
 * Rebuilds a stored question into the form's draft shape, so the builder can
 * edit it. Works on legacy docs too (that is the point — they are the ones most
 * likely to need fixing), which is why it reads the normalized view, not raw.
 *
 * The correct option is lifted out of the option list; the rest become the
 * "other options" the form shows. Round-tripping through `saveQuestion` reshuffles
 * the letters, which is fine — nothing references a question by option letter.
 */
export function draftFromQuestion(q: NormalizedQuestion): QuestionDraft {
  const correctKeys = Array.isArray(q.correctAnswer.value)
    ? q.correctAnswer.value
    : [String(q.correctAnswer.value || q.answer)];

  const toOption = (id: string): OptionDraft => {
    const o = q.options[id];
    return {
      text: o?.uz || o?.ru || o?.en || "",
      imageUrl: o?.imageUrl ?? null,
      imageStoragePath: storagePathOfOption(q, id),
    };
  };

  const optionIds = q.optionList.map((o) => o.id);
  const primaryCorrect = correctKeys.find((k) => optionIds.includes(k)) || optionIds[0] || "";
  const others = optionIds.filter((id) => id !== primaryCorrect);

  const isTextAnswer = optionIds.length === 0;

  return {
    questionText: q.question.uz || q.question.ru || q.question.en || "",
    imageUrl: q.imageUrl,
    imageStoragePath: promptStoragePath(q),

    subjectId: q.subjectId, subjectName: q.subject,
    topicId: q.topicId, topicName: q.topic,
    subtopicId: q.subtopicId, subtopicName: q.subtopic,

    type: q.type,
    status: q.status,
    correctOption: isTextAnswer
      ? { text: String(q.correctAnswer.value || ""), imageUrl: null, imageStoragePath: null }
      : toOption(primaryCorrect),
    incorrectOptions: others.length ? others.map(toOption) : [emptyOption()],
    // Which of the "other options" are ALSO correct (multiple_select).
    extraCorrectKeys: others.map((id, i) => (correctKeys.includes(id) ? String(i) : "")).filter(Boolean),
    acceptedAnswers: q.correctAnswer.acceptedAnswers,
    caseSensitive: !!q.correctAnswer.caseSensitive,

    explanation: q.explanation.uz || q.explanation.ru || q.explanation.en || "",
    hint: q.hint.uz || q.hint.ru || q.hint.en || "",
    difficulty: q.difficulty,
    points: q.points,
    estimatedTime: q.estimatedTime,
    tags: q.tags,
    curriculum: Array.isArray((q.raw as Record<string, unknown>)?.curriculum)
      ? ((q.raw as Record<string, string[]>).curriculum as string[])
      : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawOf = (q: NormalizedQuestion) => q.raw as Record<string, any>;

/** v1 stores the path under image.storagePath; older shapes under imageStoragePath. */
const promptStoragePath = (q: NormalizedQuestion): string | null =>
  rawOf(q)?.image?.storagePath ?? rawOf(q)?.imageStoragePath ?? null;

function storagePathOfOption(q: NormalizedQuestion, id: string): string | null {
  const raw = rawOf(q);
  const opt = Array.isArray(raw?.options)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? raw.options.find((o: any) => o?.id === id)
    : raw?.options?.[id];
  return opt?.image?.storagePath ?? opt?.imageStoragePath ?? null;
}

/**
 * Overwrites an existing question. `createdAt` is carried over from the original
 * (an edit is not a new question), `metadata.updatedAt` moves, and any Storage
 * image the edit replaced is deleted so it doesn't leak.
 *
 * `creationMethod` is preserved by default: a question the AI wrote stays
 * AI-authored even after a human fixes it. Pass `"corrected"` to record that a
 * human repaired it.
 */
export async function updateQuestion(
  draft: QuestionDraft,
  original: NormalizedQuestion,
  creatorId: string,
  creatorName: string,
  creationMethod?: CreationMethod,
) {
  const raw = rawOf(original);

  const payload = toQuestionV1(draftToSource(draft), {
    id: original.id,
    creatorId,
    creatorName,
    creationMethod: creationMethod
      ?? (CREATION_METHODS.includes(original.creationMethod as CreationMethod)
        ? (original.creationMethod as CreationMethod)
        : "corrected"),
    status: draft.status,
    points: draft.points,
    estimatedTime: draft.estimatedTime,
    curriculum: draft.curriculum,
    aiModel: raw?.metadata?.aiModel,
    timestamp: serverTimestamp(),
    // An edit must not reset the question's age (it drives `orderBy createdAt`).
    createdAt: raw?.createdAt ?? raw?.metadata?.createdAt ?? serverTimestamp(),
    // Whoever fixed it owns the fix — surfaced in the UI as "Tuzatgan: {name}".
    correctedBy: creatorName,
    correctedById: creatorId,
  });

  await setDoc(doc(db, "teacher_questions", original.id), payload);
  invalidateQuestionCache(original.id);

  // Images the edit dropped or replaced are now unreferenced — clean them up.
  const keptPaths = new Set(
    [payload.image.storagePath, ...payload.options.map((o) => o.image?.storagePath)].filter(Boolean) as string[],
  );
  const oldPaths = [
    promptStoragePath(original),
    ...original.optionList.map((o) => storagePathOfOption(original, o.id)),
  ].filter((p): p is string => !!p);

  await Promise.all(
    oldPaths
      .filter((p) => !keptPaths.has(p))
      .map((p) => deleteObject(ref(storage, p)).catch(() => undefined)),
  );

  return payload;
}

/** Removes the doc and every image it owns (Storage objects would otherwise leak). */
export async function deleteQuestion(question: NormalizedQuestion): Promise<void> {
  // The stored doc, whichever shape it is in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = question.raw as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storagePathOf = (o: any): unknown => o?.image?.storagePath ?? o?.imageStoragePath;

  // v1 keeps paths under image.storagePath / options[].image.storagePath; older
  // shapes kept them as imageStoragePath. Collect whatever is there.
  const paths: string[] = [
    storagePathOf(raw),
    ...Object.values(raw?.options || {}).map(storagePathOf),
  ].filter((p): p is string => typeof p === "string" && !!p);

  await Promise.all(
    // A missing object must not block the doc delete.
    paths.map((p) => deleteObject(ref(storage, p)).catch(() => undefined)),
  );
  await deleteDoc(doc(db, "teacher_questions", question.id));
  invalidateQuestionCache(question.id);
}
