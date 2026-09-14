import topicsJson from "@/data/question_topics.json";

/**
 * Fan → Mavzu → Ichki mavzu hierarchy for the question builder
 * (`/teacher/create/question`). Source: data/question_topics.json — a static
 * file, imported (not fetched through /api/structure) because it is small and
 * needed client-side by the form. Swap the JSON's `subjects` array to change
 * the taxonomy; the ids are persisted into `created_questions` docs, so keep
 * them stable.
 */

export interface TopicNode {
  id: string;
  name: string;
}
export interface Topic extends TopicNode {
  subtopics: TopicNode[];
}
export interface Subject extends TopicNode {
  topics: Topic[];
}

export const SUBJECTS: Subject[] = (topicsJson as { subjects: Subject[] }).subjects;

export const findSubject = (id: string) => SUBJECTS.find((s) => s.id === id);
export const findTopic = (subjectId: string, topicId: string) =>
  findSubject(subjectId)?.topics.find((t) => t.id === topicId);
export const findSubtopic = (subjectId: string, topicId: string, subtopicId: string) =>
  findTopic(subjectId, topicId)?.subtopics.find((s) => s.id === subtopicId);

/** "Algebra → Algebraik ifodalar → Ifodalarni soddalashtirish" */
export const topicPathLabel = (subjectName: string, topicName: string, subtopicName: string) =>
  [subjectName, topicName, subtopicName].filter(Boolean).join(" → ");

/** A subject/topic/subtopic triple, as stored on a question. */
export interface TopicPath {
  subjectId: string; subjectName: string;
  topicId: string; topicName: string;
  subtopicId: string; subtopicName: string;
}

/**
 * A question may only be filed under a path that EXISTS in question_topics.json.
 * This is the guard behind `toQuestionV1()` — every creator (AI or human) has to
 * produce a real path, so nothing lands in the bank under an invented topic like
 * "by_prompt" or a free-text subject an LLM made up.
 */
export function isValidTopicPath(subjectId: string, topicId: string, subtopicId: string): boolean {
  return !!findSubtopic(subjectId, topicId, subtopicId);
}

/** Ids → the full path with names, or null when the triple isn't in the taxonomy. */
export function resolveTopicPath(subjectId: string, topicId: string, subtopicId: string): TopicPath | null {
  const subject = findSubject(subjectId);
  const topic = findTopic(subjectId, topicId);
  const subtopic = findSubtopic(subjectId, topicId, subtopicId);
  if (!subject || !topic || !subtopic) return null;

  return {
    subjectId: subject.id, subjectName: subject.name,
    topicId: topic.id, topicName: topic.name,
    subtopicId: subtopic.id, subtopicName: subtopic.name,
  };
}
