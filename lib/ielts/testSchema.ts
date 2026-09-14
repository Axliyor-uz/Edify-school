// Structure utilities shared by the builders, the admin JSON import, and the save path:
// global renumbering (same algorithm as the reading builder), answer-key extraction/stripping
// (the security split), and per-type breakdown for library cards.
//
// JSON-import validation lives in ./importValidation.ts (all four modules, error paths).

import {
  type IeltsAnswerKeyDoc,
  type IeltsKeyEntry,
  type IeltsListeningTest,
  type IeltsQuestionBlock,
  type IeltsReadingTest,
} from './types';

type AnyTest = IeltsReadingTest | IeltsListeningTest;

function blockContainers(test: AnyTest): IeltsQuestionBlock[][] {
  if (test.module === 'listening') return (test.parts || []).map((p) => p.questions || []);
  return (test.passages || []).map((p) => p.questions || []);
}

/** Global question numbering — mirrors the reading builder: one number per row, except
 * list_selection which consumes max(1, correct_answer.length) numbers. Mutates in place. */
export function renumberTest(test: AnyTest): number {
  let counter = 1;
  for (const blocks of blockContainers(test)) {
    for (const qb of blocks) {
      qb.start_question = counter;
      for (const row of qb.questions || []) {
        row.question_number = counter;
        if (qb.type === 'list_selection') {
          const n = Array.isArray(row.correct_answer) ? Math.max(1, row.correct_answer.length) : 1;
          counter += n;
        } else {
          counter += 1;
        }
      }
      qb.end_question = counter - 1;
    }
  }
  test.total_questions = counter - 1;
  return test.total_questions;
}

const FREE_TEXT_TYPES = new Set([
  'summary_completion', 'sentence_completion', 'short_answer',
  'table_completion', 'flowchart_completion', 'diagram_completion',
]);

/** Build the ielts_answer_keys payload from a fully-authored test (answers still inline). */
export function extractAnswerKey(test: AnyTest): IeltsAnswerKeyDoc['keys'] {
  const keys: Record<string, IeltsKeyEntry> = {};
  for (const blocks of blockContainers(test)) {
    for (const qb of blocks) {
      for (const row of qb.questions || []) {
        if (row.correct_answer == null) continue;
        const entry: IeltsKeyEntry = { t: qb.type, a: row.correct_answer };
        if (qb.type === 'list_selection' && Array.isArray(row.correct_answer)) {
          entry.span = Math.max(1, row.correct_answer.length);
        }
        if (qb.word_limit && FREE_TEXT_TYPES.has(qb.type) && qb.options == null) {
          entry.wl = qb.word_limit;
        }
        keys[String(row.question_number)] = entry;
      }
    }
  }
  return keys;
}

/** Deep-clone the test with every correct_answer removed and answers_split set. */
export function stripAnswers<T extends AnyTest>(test: T): T {
  const clone: T = JSON.parse(JSON.stringify(test));
  for (const blocks of blockContainers(clone)) {
    for (const qb of blocks) {
      for (const row of qb.questions || []) delete row.correct_answer;
    }
  }
  clone.answers_split = true;
  return clone;
}

/** Question-type mix for library cards, e.g. { true_false_not_given: 7, summary_completion: 6 }. */
export function typeBreakdown(test: AnyTest): Record<string, number> {
  const out: Record<string, number> = {};
  for (const blocks of blockContainers(test)) {
    for (const qb of blocks) {
      const n = Math.max(0, (qb.end_question || 0) - (qb.start_question || 0) + 1);
      out[qb.type] = (out[qb.type] || 0) + (n || (qb.questions || []).length);
    }
  }
  return out;
}
