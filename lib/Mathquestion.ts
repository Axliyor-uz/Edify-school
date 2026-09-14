// lib/Mathquestion.ts
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { QuestionDoc, DifficultyId } from '@/types/Math';

const QUESTIONS_COLLECTION = 'questions1';
const DEFAULT_PAGE_SIZE = 20;

/**
 * Fetches ONE page of questions from the master bank.
 *
 * Filter fields mirror the live, working path in services/quizService.ts:
 *   topicId    — "1" (Algebra) | "2" (Geometriya), UNPADDED
 *   chapterId  — "01".."18", padded to 2 chars
 *   subtopicId — "01".."14", padded to 2 chars (optional: omit for whole chapter)
 *   difficultyId — 1 | 2 | 3 (optional: omit for all difficulties)
 * ordered by `uploadedAt` desc. Needs the questions1 composite index in
 * firestore.indexes.json. Never scans more than `pageSize` documents.
 */
export async function getChapterQuestions(params: {
  topicId: string;
  chapterId: string;
  subtopicId?: string;
  difficultyId?: DifficultyId;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}) {
  const {
    topicId,
    chapterId,
    subtopicId,
    difficultyId,
    pageSize = DEFAULT_PAGE_SIZE,
    cursor,
  } = params;

  const constraints: QueryConstraint[] = [
    where('topicId', '==', topicId),
    where('chapterId', '==', chapterId),
    ...(subtopicId ? [where('subtopicId', '==', subtopicId)] : []),
    ...(difficultyId ? [where('difficultyId', '==', difficultyId)] : []),
    orderBy('uploadedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];

  const snap = await getDocs(query(collection(db, QUESTIONS_COLLECTION), ...constraints));

  return {
    questions: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuestionDoc),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === pageSize,
  };
}
