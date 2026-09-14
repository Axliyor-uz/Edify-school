// lib/RASCHtopics.ts
import type { Lang } from '@/types/Math';

/**
 * The seven topics a student is levelled on.
 *
 * The exam blueprint has 13 rows, but several are the same subject at a
 * different test type — Geometriya is drawn three times (Y-1, Y-2 and O), and
 * Funksiyalar twice. A student thinks in subjects, not test types ("what's my
 * level in geometry?"), so every blueprint row maps onto one of these keys and
 * the scores are pooled.
 */
export type TopicKey =
  | 'numbers'
  | 'algebraic'
  | 'equations'
  | 'functions'
  | 'geometry'
  | 'analysis'
  | 'probability';

export interface RASCHTopic {
  key: TopicKey;
  label: Record<Lang, string>;
  /** Tailwind classes for the chart line + level chip. */
  color: string;
  hex: string;
}

export const RASCH_TOPICS: RASCHTopic[] = [
  {
    key: 'numbers',
    label: { uz: 'Sonlar va amallar', ru: 'Числа и действия', en: 'Numbers and operations' },
    color: 'text-sky-600 bg-sky-50 border-sky-200',
    hex: '#0284c7',
  },
  {
    key: 'algebraic',
    label: {
      uz: 'Algebraik shakl almashtirishlar',
      ru: 'Алгебраические преобразования',
      en: 'Algebraic transformations',
    },
    color: 'text-violet-600 bg-violet-50 border-violet-200',
    hex: '#7c3aed',
  },
  {
    key: 'equations',
    label: {
      uz: 'Tenglama va tengsizliklar',
      ru: 'Уравнения и неравенства',
      en: 'Equations and inequalities',
    },
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    hex: '#059669',
  },
  {
    key: 'functions',
    label: { uz: 'Funksiyalar', ru: 'Функции', en: 'Functions' },
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    hex: '#d97706',
  },
  {
    key: 'geometry',
    label: { uz: 'Geometriya', ru: 'Геометрия', en: 'Geometry' },
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    hex: '#e11d48',
  },
  {
    key: 'analysis',
    label: {
      uz: 'Matematik analiz asoslari',
      ru: 'Основы математического анализа',
      en: 'Foundations of calculus',
    },
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    hex: '#4f46e5',
  },
  {
    key: 'probability',
    label: {
      uz: "To'plam va ehtimollar nazariyasi",
      ru: 'Множества и теория вероятностей',
      en: 'Sets and probability',
    },
    color: 'text-teal-600 bg-teal-50 border-teal-200',
    hex: '#0d9488',
  },
];

export const TOPIC_KEYS: TopicKey[] = RASCH_TOPICS.map((t) => t.key);

export function topicLabel(key: TopicKey, lang: Lang): string {
  return RASCH_TOPICS.find((t) => t.key === key)?.label[lang] ?? key;
}

export function topicColor(key: TopicKey): RASCHTopic {
  return RASCH_TOPICS.find((t) => t.key === key) ?? RASCH_TOPICS[0];
}
