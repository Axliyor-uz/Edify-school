// lib/SatDefaultPaper.ts
//
// The SAMPLE SAT Math paper — the questions the builder's "Namunaviy variant"
// button drops onto an empty test, so a teacher can publish a complete
// adaptive test (or edit one into their own) without hand-picking every
// question for all three modules. Same idea as `lib/RASCHdefaultPaper.ts` /
// `lib/MilliyDefaultPaper.ts`, adapted to SAT's module shape. Contract:
// docs/SAT_QUIZ.md ("No sample/starter test" under Known issues — this is
// that addition).
//
// ⚠️ **The content is DATA, not code.** It lives in
// `data/sat-math-default-paper.json` and that file is the ONLY place to edit
// questions — this module just validates it and turns it into `SatQuizItem`s.
//
// Why a bundled JSON rather than a seeded Firestore document (same reasons the
// other two sample papers give): it costs ZERO reads and the builder stores a
// test as an embedded snapshot anyway, so a ref would buy nothing; it is
// edited in a reviewable diff instead of a console; and it cannot drift per
// environment. The cost is the same freeze every stored quiz item already
// has: these items are in nobody's question bank, so the picker never lists
// them and editing the JSON does not touch a test a teacher already saved.

import { SAT_MATH_DOMAINS, findSatMathDomain } from './SatMathQuiz';
import type { Lang, LocalizedText } from '@/types/Math';
import type { SatMathDomain, SatQuizItem } from '@/types/SatQuiz';

// ─── the authoring shape (what data/sat-math-default-paper.json holds) ───────

/** Any user-facing string: trilingual, or one string used for all three. */
export type SatSampleText = string | Partial<Record<Lang, string>>;

export interface SatSampleEntry {
  /** One of `SAT_MATH_DOMAINS`' ids — `lib/SatMathQuiz.ts`. */
  domainId: SatMathDomain;
  question: SatSampleText;
  /** Present ⇒ `mcq` (A–D); absent ⇒ `numeric`. Mirrors the closed/typed rule
   *  `MilliyDefaultPaper.ts` uses — one fewer field that could contradict itself. */
  options?: Partial<Record<'A' | 'B' | 'C' | 'D', SatSampleText>>;
  /** `mcq`: the correct option letter. `numeric`: the literal expected text. */
  answer: string;
  /** `numeric` only — other spellings/forms that also grade correct. */
  acceptedAnswers?: string[];
  explanation?: SatSampleText;
  /** 0–5, College Board style (0–1 easy, 2–3 medium, 4–5 hard). Defaults to 2. */
  difficultyId?: number;
  /** A root-relative path under `public/` (e.g. `/sat/<id>.png`) — bundled as a
   *  static file, never a Firebase Storage URL, matching the rest of this file's
   *  "zero reads" contract. Absent for a text-only question. */
  imageUrl?: string;
}

type ModuleKey = 'module1' | 'module2Easier' | 'module2Harder';
const MODULE_KEYS: ModuleKey[] = ['module1', 'module2Easier', 'module2Harder'];

export interface SatSamplePaperFile {
  title?: SatSampleText;
  module1Minutes?: number;
  module2Minutes?: number;
  routingThreshold?: number;
  module1: SatSampleEntry[];
  module2Easier: SatSampleEntry[];
  module2Harder: SatSampleEntry[];
}

/**
 * Id prefix for a sample item.
 *
 * ⚠️ Must not collide with a `teacher_questions` id, because the builder
 * de-duplicates on `id` (`satPickedIds` / `checkSatAdd`) — a collision would
 * make a real question un-addable. Firestore ids are 20 random chars, so a
 * readable slug can never be one.
 */
export const SAT_SAMPLE_ITEM_PREFIX = 'sat-sample-';

const OPTION_KEYS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

/** A bare string fills all three languages. */
export function toSampleText(text: SatSampleText | undefined): LocalizedText {
  if (typeof text === 'string') return { uz: text, ru: text, en: text };
  const uz = text?.uz ?? text?.ru ?? text?.en ?? '';
  return { uz, ru: text?.ru ?? uz, en: text?.en ?? uz };
}

/** What the builder gets back: the three modules, plus anything wrong with the file. */
export interface SatSamplePaperBuild {
  module1: SatQuizItem[];
  module2Easier: SatQuizItem[];
  module2Harder: SatQuizItem[];
  title: LocalizedText;
  module1Minutes: number;
  module2Minutes: number;
  routingThreshold: number;
  /**
   * Human-readable faults, in file order. NON-EMPTY ⇒ do not load the paper —
   * a silently-wrong sample is worse than none: it would publish with items
   * filed under a domain the results page cannot group, or a "mcq" with no
   * valid correct letter.
   */
  problems: string[];
}

/** Validates and converts the whole file. */
export function buildSatSamplePaper(file: SatSamplePaperFile): SatSamplePaperBuild {
  const problems: string[] = [];
  const modules: Record<ModuleKey, SatQuizItem[]> = { module1: [], module2Easier: [], module2Harder: [] };

  for (const key of MODULE_KEYS) {
    const entries = Array.isArray(file?.[key]) ? file[key] : [];
    if (entries.length === 0) problems.push(`data/sat-math-default-paper.json: "${key}" is empty.`);

    entries.forEach((entry, index) => {
      const where = `${key} #${index + 1} (${entry?.domainId ?? '?'})`;

      const domain = findSatMathDomain(entry?.domainId);
      if (!domain) {
        problems.push(`${where}: unknown domainId — use one of ${SAT_MATH_DOMAINS.map((d) => d.id).join(', ')}.`);
        return;
      }

      const answer = String(entry.answer ?? '').trim();
      if (!answer) {
        problems.push(`${where}: "answer" is empty.`);
        return;
      }

      const keys = OPTION_KEYS.filter((k) => entry.options?.[k] !== undefined);
      const closed = keys.length > 0;

      if (closed) {
        if (keys.length < 2) {
          problems.push(`${where}: an mcq item needs at least two options.`);
          return;
        }
        if (!keys.includes(answer as 'A' | 'B' | 'C' | 'D')) {
          problems.push(`${where}: "answer" is "${answer}" but the options are ${keys.join(', ')}.`);
          return;
        }
      }

      modules[key].push(buildItem({ entry, index, key, domain, closed, keys, answer }));
    });
  }

  const slots = modules.module1.length + modules.module2Easier.length + modules.module2Harder.length;
  if (problems.length === 0 && slots === 0) {
    problems.push('data/sat-math-default-paper.json: the paper came to 0 questions.');
  }

  return {
    module1: modules.module1,
    module2Easier: modules.module2Easier,
    module2Harder: modules.module2Harder,
    title: toSampleText(file?.title),
    module1Minutes: file?.module1Minutes && file.module1Minutes > 0 ? file.module1Minutes : 35,
    module2Minutes: file?.module2Minutes && file.module2Minutes > 0 ? file.module2Minutes : 35,
    routingThreshold: file?.routingThreshold && file.routingThreshold > 0
      ? file.routingThreshold
      : Math.ceil(modules.module1.length / 2),
    problems,
  };
}

function buildItem(args: {
  entry: SatSampleEntry;
  index: number;
  key: ModuleKey;
  domain: { id: SatMathDomain; name: LocalizedText };
  closed: boolean;
  keys: Array<'A' | 'B' | 'C' | 'D'>;
  answer: string;
}): SatQuizItem {
  const { entry, index, key, domain, closed, keys, answer } = args;

  const options = closed
    ? Object.fromEntries(keys.map((k) => [k, toSampleText(entry.options?.[k])]))
    : {};

  // ⚠️ Every optional field is spread conditionally — an `undefined` anywhere
  // here reaches Firestore through `saveSatMathTest` and the whole write throws.
  const item: SatQuizItem = {
    id: `${SAT_SAMPLE_ITEM_PREFIX}${key}-${String(index + 1).padStart(2, '0')}`,
    qType: closed ? 'mcq' : 'numeric',
    domain: domain.id,
    domainLabel: domain.name,
    difficultyId: entry.difficultyId ?? 2,
    question: toSampleText(entry.question),
    imageUrl: entry.imageUrl ?? null,
    optionKeys: closed ? keys : [],
    options,
    answer,
  };

  if (!closed && entry.acceptedAnswers?.length) item.acceptedAnswers = entry.acceptedAnswers;
  const explanation = toSampleText(entry.explanation);
  if (explanation.uz || explanation.ru || explanation.en) item.explanation = explanation;

  return item;
}

// ─── loading it ─────────────────────────────────────────────────────────────

/**
 * Reads the bundled file and builds the paper.
 *
 * ⚠️ A DYNAMIC import on purpose — the same reason `RASCHdefaultPaper.ts`
 * gives: every teacher who opens the builder would otherwise download the
 * sample content, including the majority who never press the button. This way
 * webpack splits it into its own chunk, fetched on the first click and cached
 * after.
 */
export async function loadSatSamplePaper(): Promise<SatSamplePaperBuild> {
  const mod = await import('@/data/sat-math-default-paper.json');
  return buildSatSamplePaper((mod.default ?? mod) as unknown as SatSamplePaperFile);
}
