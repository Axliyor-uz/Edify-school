// lib/Examanswers.ts
import type { Lang, QuestionDoc } from '@/types/Math';

/**
 * Open-answer (O block) grading.
 *
 * An O question is a normal questions1 doc — the bank has no open-ended items —
 * we just hide its options and ask the student to type the answer. Two forms of
 * the same answer therefore exist on the doc:
 *
 *   solutions[0].final_answer  plain text, e.g.  "9/(4π)"   "4π√3"   "952"
 *   options[answer][lang]      raw LaTeX, e.g.   "$\frac{9}{4\pi}$"
 *
 * Both are accepted: each is normalised to a canonical string (LaTeX macros
 * unwrapped, brackets/spaces/multiplication signs dropped, unicode folded), and
 * a typed answer matches if it normalises to either — or, when both sides are
 * numeric, if the numbers agree.
 */

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
  '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
};

export function normalizeAnswer(raw: string | null | undefined): string {
  let s = String(raw ?? '').toLowerCase().trim();
  if (!s) return '';

  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => SUPERSCRIPT[c]);
  s = s.replace(/\$/g, '');

  // Layout-only macros carry no meaning for grading.
  s = s.replace(/\\(left|right|displaystyle|textstyle|quad|qquad|,|;|!|:)/g, '');
  s = s.replace(/\\(text|mathrm|mathbf)\{([^{}]*)\}/g, '$2');

  // \frac{a}{b} → (a)/(b) — twice, so one level of nesting resolves.
  for (let i = 0; i < 2; i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  }
  s = s.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, 'root$1($2)');
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
  s = s.replace(/\\sqrt/g, 'sqrt').replace(/√/g, 'sqrt');
  s = s.replace(/\\pi/g, 'pi').replace(/π/g, 'pi');
  s = s.replace(/\\(cdot|times)/g, '*').replace(/[×·∙]/g, '*');
  s = s.replace(/\\div/g, '/').replace(/÷/g, '/');
  s = s.replace(/\\infty/g, 'inf').replace(/∞/g, 'inf');
  s = s.replace(/\\?(alpha|beta|gamma|theta|lambda|mu|sigma|omega)/g, '$1');
  s = s.replace(/\^\{([^{}]*)\}/g, '^$1');

  // Degrees: the bank writes "$135^\circ$", students type "135" or "135°".
  s = s.replace(/\^?\\circ/g, '').replace(/°/g, '');

  // "3,5" is a decimal comma in uz/ru — but "1,2,3" is a list, so only fold a
  // comma that sits between two digits and appears exactly once.
  if ((s.match(/,/g) ?? []).length === 1) s = s.replace(/(\d),(\d)/g, '$1.$2');

  // Coordinate pairs and interval bounds are written "(4; -6)" or "(4, -6)".
  s = s.replace(/;/g, ',');

  // Everything structural goes: brackets, braces, spaces, explicit ×, stray
  // backslashes. "4pi*sqrt(3)" and "4pisqrt3" must land on the same string.
  s = s.replace(/[\s(){}[\]*\\]/g, '');
  s = s.replace(/[.;]+$/, '');

  return s;
}

function asNumber(s: string): number | null {
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** The answer text shown to the student after submission. */
export function expectedAnswerText(q: QuestionDoc, lang: Lang): string {
  const final = q.solutions?.[0]?.final_answer;
  if (final) return final;
  return q.options?.[q.answer]?.[lang] ?? q.answer;
}

/** Every form of the correct answer we are willing to accept, normalised. */
function acceptedForms(q: QuestionDoc): string[] {
  const raw: Array<string | undefined> = [
    q.solutions?.[0]?.final_answer,
    q.options?.[q.answer]?.uz,
    q.options?.[q.answer]?.ru,
    q.options?.[q.answer]?.en,
  ];
  return [...new Set(raw.map(normalizeAnswer).filter(Boolean))];
}

/** Grades a typed answer for an O-block question. */
export function isOpenAnswerCorrect(input: string | undefined, q: QuestionDoc): boolean {
  const given = normalizeAnswer(input);
  if (!given) return false;

  const forms = acceptedForms(q);
  if (forms.includes(given)) return true;

  // Numeric equality, so "0.5" matches "0.50" and "16" matches "16.0".
  const givenNum = asNumber(given);
  if (givenNum === null) return false;
  return forms.some((f) => {
    const n = asNumber(f);
    return n !== null && Math.abs(n - givenNum) < 1e-9;
  });
}
