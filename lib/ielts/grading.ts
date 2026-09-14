// Exam-grade IELTS answer checking. Pure functions — imported by the server grading route
// and by the teacher preview. Official marking conventions implemented:
// - 1 mark per question number, no negative marking
// - spelling matters, but UK and US spellings both accepted
// - singular/plural strict (no stemming)
// - word limits: hyphenated word = 1 word; a number (any format) = 1 "number"
// - key alternates: "taxi/cab" (either), "(the) library" (optional token), arrays of alternates
// - letter answers (A–H, i–viii, T/F/NG, Y/N/NG) case-insensitive; multi-select order-insensitive

import type { IeltsAnswerKeyDoc, IeltsKeyEntry, IeltsPerQuestionResult } from './types';

// ---------- normalization ----------

const UK_US: Record<string, string> = {
  colour: 'color', colours: 'colors', flavour: 'flavor', flavours: 'flavors',
  behaviour: 'behavior', behaviours: 'behaviors', labour: 'labor', neighbour: 'neighbor',
  neighbours: 'neighbors', harbour: 'harbor', humour: 'humor', favourite: 'favorite',
  favourites: 'favorites', honour: 'honor', centre: 'center', centres: 'centers',
  metre: 'meter', metres: 'meters', litre: 'liter', litres: 'liters', theatre: 'theater',
  theatres: 'theaters', fibre: 'fiber', fibres: 'fibers', programme: 'program',
  programmes: 'programs', catalogue: 'catalog', catalogues: 'catalogs', dialogue: 'dialog',
  dialogues: 'dialogs', defence: 'defense', licence: 'license', offence: 'offense',
  practise: 'practice', travelling: 'traveling', travelled: 'traveled', traveller: 'traveler',
  jewellery: 'jewelry', grey: 'gray', tyre: 'tire', tyres: 'tires', aeroplane: 'airplane',
  aluminium: 'aluminum', storey: 'story', storeys: 'stories', cheque: 'check',
  cheques: 'checks', kerb: 'curb', plough: 'plow', mould: 'mold', enrol: 'enroll',
  fulfil: 'fulfill', skilful: 'skillful',
};

const NUMBER_WORDS: Record<string, string> = (() => {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen'];
  const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const map: Record<string, string> = {};
  ones.forEach((w, i) => { map[w] = String(i); });
  tens.forEach((w, i) => {
    map[w] = String((i + 2) * 10);
    ones.slice(1, 10).forEach((o, j) => { map[`${w}-${o}`] = String((i + 2) * 10 + j + 1); });
  });
  map['hundred'] = '100'; map['thousand'] = '1000'; map['million'] = '1000000';
  return map;
})();

function canonicalToken(tok: string): string {
  let t = tok;
  if (UK_US[t]) t = UK_US[t];
  else {
    // generic UK→US suffix rules (safe subset)
    if (/isation$/.test(t)) t = t.replace(/isation$/, 'ization');
    else if (/isations$/.test(t)) t = t.replace(/isations$/, 'izations');
    else if (/ise$/.test(t) && t.length > 4) t = t.replace(/ise$/, 'ize');
    else if (/ised$/.test(t) && t.length > 5) t = t.replace(/ised$/, 'ized');
    else if (/ising$/.test(t) && t.length > 6) t = t.replace(/ising$/, 'izing');
    else if (/yse$/.test(t) && t.length > 4) t = t.replace(/yse$/, 'yze');
  }
  if (NUMBER_WORDS[t]) t = NUMBER_WORDS[t];
  // strip thousands separators inside digit groups: 5,000 -> 5000
  if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, '');
  return t;
}

export function normalizeAnswer(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,;:!?"']+$/g, '')
    .replace(/^["']+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(canonicalToken)
    .join(' ');
}

// Word counting per official convention: hyphenated = 1 word; any number/date/time token = 1.
export function countWordsForLimit(raw: string): number {
  const tokens = String(raw ?? '').trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

// "(the) library" -> ["library", "the library"]; "taxi/cab" -> ["taxi", "cab"].
export function expandKeyAnswer(key: string): string[] {
  const bases = String(key).split('/').map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const base of bases) {
    const optional = base.match(/\(([^)]+)\)/g) || [];
    if (!optional.length) { out.push(base); continue; }
    // with and without each parenthetical (single-level, applied jointly)
    const without = base.replace(/\(([^)]+)\)/g, '').replace(/\s+/g, ' ').trim();
    const withAll = base.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
    out.push(without, withAll);
  }
  return Array.from(new Set(out.filter(Boolean)));
}

const TFNG: Record<string, string> = {
  'true': 'true', 't': 'true', 'false': 'false', 'f': 'false',
  'not given': 'not given', 'ng': 'not given', 'notgiven': 'not given',
  'yes': 'yes', 'y': 'yes', 'no': 'no', 'n': 'no',
};

function normalizeLetter(raw: string): string {
  const n = normalizeAnswer(raw);
  return TFNG[n] || n;
}

// ---------- comparison ----------

const LETTER_TYPES = new Set([
  'matching_headings', 'matching_paragraph_information', 'matching_features',
  'matching_sentence_endings', 'true_false_not_given',
]);

function textMatches(student: string, accepted: string[], wordLimit?: number): boolean {
  if (wordLimit && countWordsForLimit(student) > wordLimit) return false;
  const s = normalizeAnswer(student);
  if (!s) return false;
  return accepted.some((k) => expandKeyAnswer(k).some((v) => normalizeAnswer(v) === s));
}

/** Grade one question number. `student` is string | string[] as stored by the runner. */
export function gradeQuestion(entry: IeltsKeyEntry, student: string | string[] | undefined): boolean {
  if (student == null || (Array.isArray(student) && !student.length) || student === '') return false;
  const key = entry.a;

  // multi-select (MCQ with several answers) — order-insensitive exact set
  if (Array.isArray(key) && entry.t === 'multiple_choice') {
    const st = (Array.isArray(student) ? student : [student]).map(normalizeLetter);
    const ky = key.map(normalizeLetter);
    return st.length === ky.length && ky.every((k) => st.includes(k));
  }

  if (LETTER_TYPES.has(entry.t) || (typeof key === 'string' && entry.t === 'summary_completion' && key.length <= 3 && /^[a-z]{1,3}$/i.test(key))) {
    // letter / roman-numeral / TFNG answers
    const keyStr = Array.isArray(key) ? key[0] : key;
    const st = Array.isArray(student) ? student[0] : student;
    return normalizeLetter(String(st)) === normalizeLetter(String(keyStr));
  }

  // free-text completion / short answer / sentence completion — alternates array or single string
  const accepted = Array.isArray(key) ? key : [key];
  const st = Array.isArray(student) ? student[0] : student;

  // single-letter bank answers stored as strings (word-bank mode) fall through here safely:
  if (accepted.every((k) => /^[a-z]$/i.test(String(k).trim()))) {
    return accepted.some((k) => normalizeLetter(String(st)) === normalizeLetter(String(k)));
  }
  return textMatches(String(st), accepted.map(String), entry.wl);
}

export interface GradeResult {
  rawScore: number;
  totalQuestions: number;
  perQuestion: Record<string, IeltsPerQuestionResult>;
  typeStats: Record<string, { correct: number; total: number }>;
}

/**
 * Grade a full attempt. `answers` is keyed by question number (string). list_selection entries
 * (span > 1) hold the student's letter array under the entry's own question number; each correct
 * letter earns one mark, capped at span.
 */
export function gradeAttempt(
  keyDoc: Pick<IeltsAnswerKeyDoc, 'keys'>,
  answers: Record<string, string | string[]>,
): GradeResult {
  let raw = 0;
  let total = 0;
  const perQuestion: Record<string, IeltsPerQuestionResult> = {};
  const typeStats: Record<string, { correct: number; total: number }> = {};

  const bump = (type: string, correct: boolean, qn: string) => {
    perQuestion[qn] = { correct, type };
    const t = (typeStats[type] ||= { correct: 0, total: 0 });
    t.total += 1;
    if (correct) { t.correct += 1; raw += 1; }
    total += 1;
  };

  for (const [qn, entry] of Object.entries(keyDoc.keys)) {
    if (entry.span && entry.span > 1 && Array.isArray(entry.a)) {
      // list_selection: N marks, one per correct letter chosen
      const chosen = (answers[qn] as string[] | undefined) ?? [];
      const chosenNorm = (Array.isArray(chosen) ? chosen : [chosen]).map(normalizeLetter);
      const keyNorm = entry.a.map(normalizeLetter);
      const hits = keyNorm.filter((k) => chosenNorm.includes(k)).length;
      const base = Number(qn);
      for (let i = 0; i < entry.span; i++) {
        bump(entry.t, i < hits, String(base + i));
      }
      continue;
    }
    bump(entry.t, gradeQuestion(entry, answers[qn]), qn);
  }

  return { rawScore: raw, totalQuestions: total, perQuestion, typeStats };
}
