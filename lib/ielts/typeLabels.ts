// Single source of display labels for the 13 IELTS question types (exam jargon —
// same in uz/ru/en). Short labels for chips, long labels for analytics rows.
// Consumers: student hub/group/runner/review, teacher library pages + group feed.

export const IELTS_TYPE_LABELS: Record<string, string> = {
  matching_headings: 'Headings',
  true_false_not_given: 'T/F/NG',
  multiple_choice: 'MCQ',
  summary_completion: 'Summary',
  matching_paragraph_information: 'Para info',
  list_selection: 'List',
  matching_features: 'Features',
  sentence_completion: 'Sentence',
  matching_sentence_endings: 'Endings',
  short_answer: 'Short answer',
  table_completion: 'Table',
  flowchart_completion: 'Flowchart',
  diagram_completion: 'Diagram',
};

export const IELTS_TYPE_LABELS_LONG: Record<string, string> = {
  matching_headings: 'Matching Headings',
  true_false_not_given: 'T/F/NG',
  multiple_choice: 'Multiple Choice',
  summary_completion: 'Summary Completion',
  matching_paragraph_information: 'Matching Information',
  list_selection: 'List Selection',
  matching_features: 'Matching Features',
  sentence_completion: 'Sentence Completion',
  matching_sentence_endings: 'Sentence Endings',
  short_answer: 'Short Answer',
  table_completion: 'Table Completion',
  flowchart_completion: 'Flowchart Completion',
  diagram_completion: 'Diagram Labelling',
};

export function typeLabel(type: string): string {
  return IELTS_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export function typeLabelLong(type: string): string {
  return IELTS_TYPE_LABELS_LONG[type] || type.replace(/_/g, ' ');
}

/** { true_false_not_given: 7 } → ["7 × T/F/NG"] */
export function breakdownChips(breakdown: Record<string, number>): string[] {
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} × ${typeLabel(type)}`);
}
