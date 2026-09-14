// lib/Mathstructure.ts
import rawSyllabus from '@/data/syllabus.json';
import type { SyllabusCategory, TopicStructure } from '@/types/Math';

/** questions1 pads chapterId/subtopicId to 2 chars; topicId is left unpadded. */
export const padId = (n: number): string => String(n).padStart(2, '0');

/**
 * The Algebra / Geometriya tree, read straight out of data/syllabus.json.
 *
 * This costs ZERO Firestore reads: the syllabus is bundled at build time, and
 * the ids it carries are exactly the ones questions1 is keyed by — the same
 * ones the teacher question-database page navigates with (see
 * services/quizService.ts + app/teacher/create/database).
 *
 * There deliberately are no question counts here. The chapter rows used to show
 * per-difficulty totals, which meant 3 COUNT aggregations per chapter — 87 in
 * all — every time the cache went cold, for a number nobody acted on. Rendering
 * only the chapter name makes the whole page free.
 */
export function getMathTopics(): TopicStructure[] {
  return (rawSyllabus as SyllabusCategory[]).map((cat) => ({
    topicId: String(cat.index),
    name: cat.category,
    chapters: cat.chapters.map((ch) => ({
      chapterId: padId(ch.index),
      name: ch.chapter,
      subtopics: ch.subtopics.map((s) => ({
        subtopicId: padId(s.index),
        name: s.name,
      })),
    })),
  }));
}
