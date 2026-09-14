// lib/RASCHskills.ts
import { topicForChapter } from './Examblueprint';
import { estimateAbility } from './RASCHtheta';
import { thetaToLevel, MASTER_LEVEL } from './RASCHscale';
import { TOPIC_KEYS, type TopicKey } from './RASCHtopics';
import type { ChapterRef } from '@/types/Exam';
import type { Lang } from '@/types/Math';
import type { Ability, Diagnostics, ItemResponse, SpotStat } from '@/types/RASCH';

/**
 * ── SKILLS: the second axis of the model ─────────────────────────────────────
 *
 * The seven dimensions answer "which mathematics?". They cannot answer "what
 * can this student DO?", because a dimension is a bag of content: 'algebraic'
 * holds logarithms, trigonometry and absolute value, and a student who can
 * factorise but cannot solve an inequality gets one averaged number for both.
 *
 * A SKILL is content-free. `eq-inequality` is "solving an inequality" whether
 * the inequality is rational, logarithmic, trigonometric or modular — the
 * content is carried by the syllabus chapter the item already names, as a TAG.
 * That inversion is the whole point:
 *
 *   dimension = which subject area the item belongs to   (7, from the blueprint)
 *   skill     = which operation the student had to perform (34, defined here)
 *   content   = the syllabus chapter/subtopic             (29 chapters, the tag)
 *
 * ── Why skills cross dimensions ──────────────────────────────────────────────
 *
 * This is not a design flourish, it is what the blueprint already does. Chapters
 * 12 (logarithmic/exponential), 13 (trigonometry) and 14 (absolute value) all
 * sit in the 'algebraic' dimension, yet their subtopics are equations,
 * inequalities, function properties and identities. So `eq-inequality` collects
 * evidence from BOTH 'equations' (chapter 07) and 'algebraic' (chapters 12–14),
 * and `pr-logic` collects from 'probability' (chapter 18) and 'algebraic'
 * (chapter 17, "Nostandart masalalar").
 *
 * A skill therefore lists a HOME dimension — where it is shown first — and the
 * dimensions it actually draws from are DERIVED from the map below (see
 * `skillDimensions`), never hand-declared, so the two can never drift apart.
 *
 * ── Why this needs no migration ──────────────────────────────────────────────
 *
 * Every `ItemResponse` already carries `topicId/chapterId/subtopicId`, and
 * `Diagnostics.subtopics` already accumulates lifetime seen/correct/θ per
 * subtopic. The skill of an item is a pure function of its syllabus position, so
 * the whole second axis is DERIVED from data already on disk — no new Firestore
 * field, no backfill, and old Android clients keep writing exactly the shape
 * they write today.
 */

// ─── The vocabulary ──────────────────────────────────────────────────────────

export type SkillKey =
  // numbers
  | 'num-structure' | 'num-arithmetic' | 'num-powers' | 'num-forms'
  // algebraic
  | 'alg-expand' | 'alg-factor' | 'alg-simplify' | 'alg-identity' | 'alg-absolute'
  // equations
  | 'eq-linear' | 'eq-reduce' | 'eq-systems' | 'eq-inequality' | 'eq-constraints' | 'eq-model'
  // functions
  | 'fn-domain' | 'fn-evaluate' | 'fn-properties' | 'fn-graph' | 'fn-parameter'
  // geometry
  | 'geo-figure' | 'geo-metric' | 'geo-measure' | 'geo-coordinate' | 'geo-spatial'
  // analysis
  | 'an-sequence' | 'an-derivative' | 'an-behaviour' | 'an-tangent' | 'an-integral'
  // probability
  | 'pr-count' | 'pr-probability' | 'pr-sets' | 'pr-logic';

export interface Skill {
  key: SkillKey;
  /** The dimension this skill is listed under. Evidence may come from others. */
  home: TopicKey;
  label: Record<Lang, string>;
  /** One line: what the student actually has to be able to do. */
  blurb: Record<Lang, string>;
}

export const SKILLS: Skill[] = [
  // ── numbers ────────────────────────────────────────────────────────────────
  {
    key: 'num-structure', home: 'numbers',
    label: { uz: 'Sonlar tuzilishi', ru: 'Структура чисел', en: 'Number structure' },
    blurb: {
      uz: "Bo'linish, tub sonlar, EKUB/EKUK, qoldiqlar bilan ishlash",
      ru: 'Делимость, простые числа, НОД/НОК, остатки',
      en: 'Divisibility, primes, GCD/LCM and remainders',
    },
  },
  {
    key: 'num-arithmetic', home: 'numbers',
    label: { uz: 'Aniq hisoblash', ru: 'Точные вычисления', en: 'Exact computation' },
    blurb: {
      uz: 'Kasrlar va butun sonlar ustida xatosiz amallar',
      ru: 'Безошибочные действия с дробями и целыми',
      en: 'Error-free arithmetic with fractions and integers',
    },
  },
  {
    key: 'num-powers', home: 'numbers',
    label: { uz: 'Daraja va ildiz', ru: 'Степени и корни', en: 'Powers and roots' },
    blurb: {
      uz: 'Daraja va ildiz xossalarini qo\'llash',
      ru: 'Применение свойств степеней и корней',
      en: 'Applying the laws of exponents and radicals',
    },
  },
  {
    key: 'num-forms', home: 'numbers',
    label: { uz: 'Shakldan shaklga', ru: 'Перевод форм', en: 'Converting forms' },
    blurb: {
      uz: "Bir yozuvdan boshqasiga o'tish (kasr, daraja, gradus/radian)",
      ru: 'Переход между записями (дробь, степень, градус/радиан)',
      en: 'Moving between notations (fraction, power, degree/radian)',
    },
  },

  // ── algebraic ──────────────────────────────────────────────────────────────
  {
    key: 'alg-expand', home: 'algebraic',
    label: { uz: 'Ochish va ko\'paytirish', ru: 'Раскрытие и умножение', en: 'Expanding' },
    blurb: {
      uz: "Qavslarni ochish, ko'phadlarni ko'paytirish",
      ru: 'Раскрытие скобок, умножение многочленов',
      en: 'Removing brackets and multiplying polynomials',
    },
  },
  {
    key: 'alg-factor', home: 'algebraic',
    label: { uz: 'Ko\'paytuvchilarga ajratish', ru: 'Разложение на множители', en: 'Factorising' },
    blurb: {
      uz: "Ifodani ko'paytuvchilar ko'rinishiga keltirish",
      ru: 'Приведение выражения к произведению множителей',
      en: 'Rewriting an expression as a product',
    },
  },
  {
    key: 'alg-simplify', home: 'algebraic',
    label: { uz: 'Soddalashtirish', ru: 'Упрощение', en: 'Simplifying' },
    blurb: {
      uz: 'Murakkab ifodani qisqartirish va tartibga solish',
      ru: 'Сокращение и приведение сложного выражения',
      en: 'Reducing and tidying a complicated expression',
    },
  },
  {
    key: 'alg-identity', home: 'algebraic',
    label: { uz: 'Ayniyatlarni qo\'llash', ru: 'Применение тождеств', en: 'Applying identities' },
    blurb: {
      uz: "Formulani tanib, kerakli shaklga o'tkazish (trigonometrik, logarifmik)",
      ru: 'Узнать формулу и перейти к нужному виду (тригонометрия, логарифмы)',
      en: 'Recognising a formula and transforming with it (trig, logs)',
    },
  },
  {
    key: 'alg-absolute', home: 'algebraic',
    label: { uz: 'Modul bilan ishlash', ru: 'Работа с модулем', en: 'Absolute value' },
    blurb: {
      uz: "Modulni ochish, hollarga ajratish",
      ru: 'Раскрытие модуля, разбор случаев',
      en: 'Unpacking a modulus by splitting into cases',
    },
  },

  // ── equations ──────────────────────────────────────────────────────────────
  {
    key: 'eq-linear', home: 'equations',
    label: { uz: 'Chiziqli munosabatlar', ru: 'Линейные соотношения', en: 'Linear relations' },
    blurb: {
      uz: 'Chiziqli tenglama va proporsiyani yechish',
      ru: 'Решение линейных уравнений и пропорций',
      en: 'Solving linear equations and proportions',
    },
  },
  {
    key: 'eq-reduce', home: 'equations',
    label: { uz: 'Standart shaklga keltirish', ru: 'Сведение к стандартному виду', en: 'Reduction to a standard form' },
    blurb: {
      uz: "Almashtirish orqali kvadrat yoki sodda shaklga keltirib yechish",
      ru: 'Решение заменой, сведением к квадратному или простому виду',
      en: 'Solving by substitution down to a quadratic or basic form',
    },
  },
  {
    key: 'eq-systems', home: 'equations',
    label: { uz: 'Sistemalar', ru: 'Системы', en: 'Systems' },
    blurb: {
      uz: 'Bir nechta shartni birga yechish',
      ru: 'Совместное решение нескольких условий',
      en: 'Solving several conditions together',
    },
  },
  {
    key: 'eq-inequality', home: 'equations',
    label: { uz: 'Tengsizliklar', ru: 'Неравенства', en: 'Inequalities' },
    blurb: {
      uz: "Yechim to'plamini oraliqlar bilan topish",
      ru: 'Нахождение множества решений интервалами',
      en: 'Finding a solution set as intervals',
    },
  },
  {
    key: 'eq-constraints', home: 'equations',
    label: { uz: 'Shartlarni nazorat qilish', ru: 'Контроль ограничений', en: 'Constraint control' },
    blurb: {
      uz: "Aniqlanish sohasini tekshirish, chet ildizlarni yo'qotish",
      ru: 'Проверка ОДЗ и отсев посторонних корней',
      en: 'Checking the domain and discarding extraneous roots',
    },
  },
  {
    key: 'eq-model', home: 'equations',
    label: { uz: 'Masalani modellashtirish', ru: 'Моделирование задачи', en: 'Modelling a problem' },
    blurb: {
      uz: "Matnli shartni tenglamaga o'girish",
      ru: 'Перевод текстового условия в уравнение',
      en: 'Turning a worded situation into an equation',
    },
  },

  // ── functions ──────────────────────────────────────────────────────────────
  {
    key: 'fn-domain', home: 'functions',
    label: { uz: 'Aniqlanish va qiymatlar sohasi', ru: 'Область определения и значений', en: 'Domain and range' },
    blurb: {
      uz: "Funksiya qayerda aniqlangani va qanday qiymat olishini topish",
      ru: 'Где функция определена и какие значения принимает',
      en: 'Where a function is defined and what values it takes',
    },
  },
  {
    key: 'fn-evaluate', home: 'functions',
    label: { uz: 'Hisoblash va teskarilash', ru: 'Вычисление и обращение', en: 'Evaluating and inverting' },
    blurb: {
      uz: 'Qiymat topish, murakkab va teskari funksiya bilan ishlash',
      ru: 'Вычисление значений, сложная и обратная функция',
      en: 'Computing values, composing and inverting',
    },
  },
  {
    key: 'fn-properties', home: 'functions',
    label: { uz: 'Xossalarni aniqlash', ru: 'Определение свойств', en: 'Reading properties' },
    blurb: {
      uz: "Juftlik, davriylik, o'sish — formuladan o'qish",
      ru: 'Чётность, периодичность, монотонность — по формуле',
      en: 'Parity, periodicity, monotonicity — read off the form',
    },
  },
  {
    key: 'fn-graph', home: 'functions',
    label: { uz: 'Grafik va formula', ru: 'График и формула', en: 'Graph and formula' },
    blurb: {
      uz: "Grafikdan formulaga va aksincha o'tish",
      ru: 'Переход от графика к формуле и обратно',
      en: 'Translating between a graph and a formula',
    },
  },
  {
    key: 'fn-parameter', home: 'functions',
    label: { uz: 'Parametrli mulohaza', ru: 'Рассуждение с параметром', en: 'Parameter reasoning' },
    blurb: {
      uz: "Parametr o'zgarganda yechim qanday o'zgarishini tahlil qilish",
      ru: 'Как меняется решение при изменении параметра',
      en: 'How the solution changes as a parameter varies',
    },
  },

  // ── geometry ───────────────────────────────────────────────────────────────
  {
    key: 'geo-figure', home: 'geometry',
    label: { uz: 'Shaklni o\'qish', ru: 'Чтение фигуры', en: 'Reading a figure' },
    blurb: {
      uz: 'Shakl elementlari va xossalarini aniqlash',
      ru: 'Определение элементов и свойств фигуры',
      en: 'Identifying a figure\'s elements and properties',
    },
  },
  {
    key: 'geo-metric', home: 'geometry',
    label: { uz: 'Metrik munosabatlar', ru: 'Метрические соотношения', en: 'Metric relations' },
    blurb: {
      uz: "Pifagor, sinuslar/kosinuslar teoremasi, o'xshashlik",
      ru: 'Пифагор, теоремы синусов/косинусов, подобие',
      en: 'Pythagoras, sine/cosine rules, similarity',
    },
  },
  {
    key: 'geo-measure', home: 'geometry',
    label: { uz: 'Yuza va hajm', ru: 'Площадь и объём', en: 'Area and volume' },
    blurb: {
      uz: 'Yuza, sirt va hajmni hisoblash',
      ru: 'Вычисление площади, поверхности и объёма',
      en: 'Computing area, surface and volume',
    },
  },
  {
    key: 'geo-coordinate', home: 'geometry',
    label: { uz: 'Koordinata va vektor', ru: 'Координаты и векторы', en: 'Coordinates and vectors' },
    blurb: {
      uz: 'Geometriyani koordinatalar orqali yechish',
      ru: 'Решение геометрии через координаты',
      en: 'Solving geometry by coordinates',
    },
  },
  {
    key: 'geo-spatial', home: 'geometry',
    label: { uz: 'Fazoviy tasavvur', ru: 'Пространственное мышление', en: 'Spatial reasoning' },
    blurb: {
      uz: 'Fazodagi joylashuv va jismlar kombinatsiyasi',
      ru: 'Взаимное расположение и комбинации тел',
      en: 'Position in space and combinations of solids',
    },
  },

  // ── analysis ───────────────────────────────────────────────────────────────
  {
    key: 'an-sequence', home: 'analysis',
    label: { uz: 'Ketma-ketliklar', ru: 'Последовательности', en: 'Sequences' },
    blurb: {
      uz: 'Progressiyaning hadi va yig\'indisi bilan ishlash',
      ru: 'Члены и суммы прогрессий',
      en: 'Terms and sums of progressions',
    },
  },
  {
    key: 'an-derivative', home: 'analysis',
    label: { uz: 'Hosila olish', ru: 'Дифференцирование', en: 'Differentiating' },
    blurb: {
      uz: 'Differensiallash qoidalarini qo\'llash',
      ru: 'Применение правил дифференцирования',
      en: 'Applying the rules of differentiation',
    },
  },
  {
    key: 'an-behaviour', home: 'analysis',
    label: { uz: 'Funksiyani tekshirish', ru: 'Исследование функции', en: 'Analysing behaviour' },
    blurb: {
      uz: "Hosila orqali o'sish, kamayish va ekstremumni topish",
      ru: 'Монотонность и экстремумы через производную',
      en: 'Monotonicity and extrema via the derivative',
    },
  },
  {
    key: 'an-tangent', home: 'analysis',
    label: { uz: 'Urinma va o\'zgarish tezligi', ru: 'Касательная и скорость', en: 'Tangent and rate' },
    blurb: {
      uz: "Hosilaning geometrik va mexanik ma'nosini qo'llash",
      ru: 'Геометрический и механический смысл производной',
      en: 'The geometric and physical meaning of the derivative',
    },
  },
  {
    key: 'an-integral', home: 'analysis',
    label: { uz: 'Integral', ru: 'Интеграл', en: 'Integration' },
    blurb: {
      uz: 'Boshlang\'ich funksiya va aniq integral bilan ishlash',
      ru: 'Первообразная и определённый интеграл',
      en: 'Antiderivatives and definite integrals',
    },
  },

  // ── probability ────────────────────────────────────────────────────────────
  {
    key: 'pr-count', home: 'probability',
    label: { uz: 'Sanash', ru: 'Подсчёт', en: 'Counting' },
    blurb: {
      uz: 'Variantlar sonini kombinatorika bilan sanash',
      ru: 'Подсчёт вариантов средствами комбинаторики',
      en: 'Counting arrangements combinatorially',
    },
  },
  {
    key: 'pr-probability', home: 'probability',
    label: { uz: 'Ehtimol hisoblash', ru: 'Вычисление вероятности', en: 'Computing probability' },
    blurb: {
      uz: 'Hodisa ehtimolini topish',
      ru: 'Нахождение вероятности события',
      en: 'Finding the probability of an event',
    },
  },
  {
    key: 'pr-sets', home: 'probability',
    label: { uz: 'To\'plamlar', ru: 'Множества', en: 'Sets' },
    blurb: {
      uz: "To'plamlar ustida amallar va ularni tasvirlash",
      ru: 'Операции над множествами и их изображение',
      en: 'Set operations and their diagrams',
    },
  },
  {
    key: 'pr-logic', home: 'probability',
    label: { uz: 'Mantiq', ru: 'Логика', en: 'Logic' },
    blurb: {
      uz: 'Mantiqiy ifodalar va mulohazalarni tahlil qilish',
      ru: 'Анализ логических выражений и высказываний',
      en: 'Analysing logical statements',
    },
  },
];

export const SKILL_KEYS: SkillKey[] = SKILLS.map((s) => s.key);

const BY_KEY = new Map<SkillKey, Skill>(SKILLS.map((s) => [s.key, s]));

export function skill(key: SkillKey): Skill | undefined {
  return BY_KEY.get(key);
}

export function skillLabel(key: SkillKey, lang: Lang): string {
  return BY_KEY.get(key)?.label[lang] ?? key;
}

// ─── The map: syllabus position → skill ──────────────────────────────────────
//
// A chapter declares the skill MOST of its subtopics exercise; individual
// subtopics override it. This is the "retag the bank" step from the migration
// plan, done as code rather than as 882 hand-edited documents — every existing
// response is re-tagged retroactively the moment this file ships, and a wrong
// call is fixed by editing one line here, not by a backfill.
//
// Keys are exactly what `questions1` carries: topicId unpadded ('1' Algebra,
// '2' Geometriya), chapterId and subtopicId zero-padded to 2 (lib/Mathstructure
// `padId`). Subtopic numbers follow data/syllabus.json order.

const CHAPTER_DEFAULT: Record<string, SkillKey> = {
  // ── Algebra ────────────────────────────────────────────────────────────────
  '1:01': 'num-structure',   // Natural va butun sonlar
  '1:02': 'num-arithmetic',  // Butun va ratsional sonlar
  '1:03': 'alg-simplify',    // Algebraik ifodalar
  '1:04': 'num-powers',      // Haqiqiy sonlar
  '1:05': 'eq-reduce',       // Tenglama
  '1:06': 'eq-systems',      // Tenglamalar sistemasi
  '1:07': 'eq-inequality',   // Tengsizliklar
  '1:08': 'eq-constraints',  // Irratsional tenglama va tengsizliklar
  '1:09': 'an-sequence',     // Progressiya
  '1:10': 'eq-model',        // Matnli masalalar
  '1:11': 'fn-properties',   // Funksiyalar
  '1:12': 'alg-identity',    // Ko'rsatkichli va logarifmik funksiyalar
  '1:13': 'alg-identity',    // Trigonometriya
  '1:14': 'alg-absolute',    // Modul
  '1:15': 'an-derivative',   // Hosila
  '1:16': 'an-integral',     // Boshlang'ich funksiya va integral
  '1:17': 'pr-count',        // Nostandart masalalar (matritsalar, binom)
  '1:18': 'pr-count',        // Kombinatorika. Ehtimollar. To'plam

  // ── Geometriya ─────────────────────────────────────────────────────────────
  '2:01': 'geo-figure',      // Burchak. Masofa. To'g'ri chiziqlar
  '2:02': 'geo-figure',      // Uchburchaklar
  '2:03': 'geo-figure',      // To'rtburchaklar
  '2:04': 'geo-figure',      // Aylana va doira
  '2:05': 'geo-metric',      // Aylana va ko'pburchak
  '2:06': 'geo-coordinate',  // Koordinatalar sistemasi
  '2:07': 'geo-coordinate',  // Vektorlar
  '2:08': 'geo-spatial',     // Fazoda to'g'ri chiziq va tekisliklar
  '2:09': 'geo-measure',     // Ko'p yoqlar
  '2:10': 'geo-measure',     // Aylanish jismlari
  '2:11': 'geo-spatial',     // Jismlar kombinatsiyasi
};

const SUBTOPIC_OVERRIDE: Record<string, SkillKey> = {
  // 01 Natural va butun sonlar — the chapter is number theory, its first row is not
  '1:01:01': 'num-arithmetic',

  // 02 Butun va ratsional sonlar
  '1:02:04': 'num-powers',    // Daraja xossalari
  '1:02:07': 'num-forms',     // Cheksiz davriy o'nli kasrlar
  '1:02:08': 'num-forms',     // Kompleks sonlar

  // 03 Algebraik ifodalar
  '1:03:01': 'alg-expand',    // Ko'phadlar ustida amallar
  '1:03:02': 'alg-expand',    // Qisqa ko'paytirish formulalari
  '1:03:03': 'alg-factor',    // Ko'paytuvchilarga ajratish

  // 04 Haqiqiy sonlar — the two "soddalashtirish" rows are algebra, not arithmetic
  '1:04:03': 'alg-simplify',
  '1:04:05': 'alg-simplify',

  // 05 Tenglama
  '1:05:01': 'eq-linear',     // Chiziqli tenglama. Ayniyat
  '1:05:02': 'eq-linear',     // Proportsiya
  '1:05:06': 'eq-constraints',// Ratsional tenglama — the skill is the excluded value
  '1:05:07': 'fn-parameter',  // Parametrli chiziqli
  '1:05:08': 'fn-parameter',  // Parametrli kvadrat

  // 06 Tenglamalar sistemasi
  '1:06:04': 'fn-parameter',  // Parametrli sistema

  // 07 Tengsizliklar
  '1:07:04': 'fn-parameter',  // Parametrli tengsizliklar
  '1:07:05': 'alg-identity',  // Tengsizliklarni isbotlash — an identity/estimate skill

  // 08 Irratsional tenglama va tengsizliklar
  '1:08:02': 'eq-systems',
  '1:08:03': 'eq-inequality',

  // 11 Funksiyalar
  '1:11:01': 'fn-domain',     // Aniqlanish sohasi
  '1:11:03': 'fn-graph',      // Grafik, eng katta qiymat, qiymatlar sohasi
  '1:11:04': 'fn-graph',      // Chiziqli funksiya
  '1:11:05': 'fn-graph',      // Kvadrat funksiya
  '1:11:06': 'fn-evaluate',   // Funksiyani tekshirish. Teskari funksiya
  '1:11:07': 'fn-evaluate',   // Murakkab funksiya

  // 12 Ko'rsatkichli va logarifmik funksiyalar — four different skills in one chapter
  '1:12:01': 'fn-properties', // Ko'rsatkichli funksiya xossalari
  '1:12:02': 'eq-reduce',     // Ko'rsatkichli tenglamalar
  '1:12:03': 'eq-systems',
  '1:12:04': 'eq-inequality',
  '1:12:05': 'fn-properties', // Logarifmik funksiya xossalari
  '1:12:06': 'fn-domain',     // Logarifmik aniqlanish/qiymatlar sohasi
  '1:12:08': 'eq-constraints',// Logarifmik tenglamalar — ODZ is the skill being tested
  '1:12:09': 'eq-inequality', // Logarifmik tengsizliklar

  // 13 Trigonometriya — identities by default, but the ends of the chapter are not
  '1:13:01': 'num-forms',     // Gradus va radian o'lchovi
  '1:13:02': 'fn-properties', // Juft/toqlik, choraklardagi ishoralar
  '1:13:10': 'fn-domain',     // Funksiyalarning qiymatlar to'plami
  '1:13:11': 'fn-evaluate',   // Teskari trigonometrik funksiyalar
  '1:13:12': 'eq-reduce',     // Trigonometrik tenglamalar
  '1:13:13': 'eq-inequality', // Trigonometrik tengsizliklar
  '1:13:14': 'fn-properties', // Davri, o'sish/kamayish, aniqlanish sohasi

  // 14 Modul
  '1:14:03': 'eq-inequality',
  '1:14:04': 'eq-systems',
  '1:14:05': 'fn-graph',      // Modulli funksiyaning grafigi

  // 15 Hosila
  '1:15:04': 'an-behaviour',  // O'sish va kamayish oraliqlari
  '1:15:05': 'an-behaviour',  // Eng katta/kichik qiymat, ekstremumlar
  '1:15:06': 'an-tangent',    // Urinmaning burchak koeffitsiyenti
  '1:15:07': 'an-tangent',    // Urinma tenglamasi
  '1:15:08': 'an-tangent',    // Hosilaning geometrik va mexanik ma'nosi

  // 17 Nostandart masalalar
  '1:17:02': 'pr-logic',      // Mantiqiy ifodalar

  // 18 Kombinatorika. Ehtimollar. To'plam
  '1:18:02': 'pr-probability',
  '1:18:03': 'pr-sets',

  // ── Geometriya ─────────────────────────────────────────────────────────────
  // 01 Burchak. Masofa
  '2:01:02': 'geo-metric',    // Kesmaga doir masalalar

  // 02 Uchburchaklar
  '2:02:06': 'geo-metric',    // Pifagor
  '2:02:07': 'geo-metric',    // Balandlik, proyeksiyalar
  '2:02:08': 'geo-metric',    // Sinuslar teoremasi
  '2:02:09': 'geo-metric',    // Kosinuslar teoremasi
  '2:02:14': 'geo-measure',   // Uchburchak yuzasi
  '2:02:15': 'geo-metric',    // O'xshash uchburchaklar
  '2:02:16': 'geo-metric',    // O'xshashlarning yuzalari nisbati

  // 03 To'rtburchaklar — every "yuzi" row is measurement, the rest are properties
  '2:03:03': 'geo-measure',
  '2:03:05': 'geo-measure',
  '2:03:07': 'geo-measure',
  '2:03:09': 'geo-measure',
  '2:03:13': 'geo-measure',
  '2:03:14': 'geo-measure',

  // 04 Aylana va doira
  '2:04:03': 'geo-metric',    // Aylana va kesuvchi
  '2:04:04': 'geo-measure',   // Aylana uzunligi
  '2:04:05': 'geo-measure',   // Yoy uzunligi
  '2:04:07': 'geo-metric',    // Kesuvchi va urinma orasidagi burchak
  '2:04:08': 'geo-measure',   // Doira yuzi
  '2:04:09': 'geo-measure',   // Sektor yuzi
  '2:04:10': 'geo-measure',   // Segment yuzi
  '2:04:11': 'geo-coordinate',// Aylana tenglamasi

  // 09 Ko'p yoqlar — the "xossalari / elementlari" rows are spatial, not metric
  '2:09:01': 'geo-spatial',   // Kub va uning xossalari
  '2:09:04': 'geo-spatial',   // Parallelepiped va uning xossasi
  '2:09:09': 'geo-spatial',   // Piramida va uning elementlari

  // 10 Aylanish jismlari
  '2:10:07': 'geo-coordinate',// Sfera tenglamasi
};

/**
 * The skill an item exercises, from the syllabus position it already carries.
 * Returns null only for a position the syllabus does not know — an unmapped
 * chapter is a data problem worth seeing, not something to silently bucket.
 */
export function skillFor(topicId: string, chapterId: string, subtopicId: string): SkillKey | null {
  return (
    SUBTOPIC_OVERRIDE[`${topicId}:${chapterId}:${subtopicId}`] ??
    CHAPTER_DEFAULT[`${topicId}:${chapterId}`] ??
    null
  );
}

/** The same, for a stored response. */
export function skillOfItem(item: Pick<ItemResponse, 'topicId' | 'chapterId' | 'subtopicId'>): SkillKey | null {
  return skillFor(item.topicId, item.chapterId, item.subtopicId);
}

// ─── Which dimensions each skill actually spans ──────────────────────────────

/**
 * Derived once, from the map — never declared. Every chapter that feeds a skill
 * is resolved to its dimension through the blueprint, so `eq-inequality` reports
 * ['equations', 'algebraic'] because chapters 07 and 12–14 genuinely feed it.
 *
 * ⚠️ The home dimension is NOT forced into the span. A skill's home says who
 * conceptually owns it; the span says where its evidence actually comes from,
 * and those genuinely differ: every chapter that tests `fn-parameter` (the
 * "parametrli" subtopics of chapters 05–07) sits in the `equations` dimension,
 * and the only chapter that tests `pr-logic` is 17, which sits in `algebraic`.
 * Forcing the home in made those two appear under a dimension that can never
 * measure them — permanently "not met", with their real evidence listed
 * elsewhere. They are now shown where they are actually exercised, marked ↗ with
 * their conceptual home.
 */
const SPAN: Record<SkillKey, TopicKey[]> = (() => {
  const acc = new Map<SkillKey, Set<TopicKey>>();
  for (const key of SKILL_KEYS) acc.set(key, new Set());

  const record = (chapterKey: string, skillKey: SkillKey) => {
    const [topicId, chapterId] = chapterKey.split(':');
    acc.get(skillKey)?.add(topicForChapter(topicId, chapterId));
  };

  for (const [chapterKey, skillKey] of Object.entries(CHAPTER_DEFAULT)) record(chapterKey, skillKey);
  for (const [subKey, skillKey] of Object.entries(SUBTOPIC_OVERRIDE)) {
    const [topicId, chapterId] = subKey.split(':');
    record(`${topicId}:${chapterId}`, skillKey);
  }

  const out = {} as Record<SkillKey, TopicKey[]>;
  for (const s of SKILLS) {
    const set = acc.get(s.key) ?? new Set<TopicKey>();
    // Home first when it genuinely feeds the skill, then the rest in a stable
    // (TOPIC_KEYS) order so the UI never reorders between renders.
    const home = set.has(s.home) ? [s.home] : [];
    out[s.key] = [...home, ...TOPIC_KEYS.filter((d) => d !== s.home && set.has(d))];
  }
  return out;
})();

/** Every dimension this skill draws evidence from, home dimension first. */
export function skillDimensions(key: SkillKey): TopicKey[] {
  return SPAN[key] ?? [];
}

// ─── Reverse lookups: from a skill back to the syllabus ──────────────────────

/**
 * skill → the chapters that feed it, built once from the same two tables.
 *
 * A chapter feeds a skill if its default IS that skill, or if any of its
 * subtopics overrides to it. Both directions matter: chapter 12 feeds
 * `eq-inequality` only through two of its nine subtopics, and a drill that
 * ignored that would serve mostly logarithm-identity questions.
 */
const CHAPTERS_BY_SKILL: Record<SkillKey, ChapterRef[]> = (() => {
  const acc = new Map<SkillKey, Set<string>>();
  for (const key of SKILL_KEYS) acc.set(key, new Set());

  for (const [chapterKey, skillKey] of Object.entries(CHAPTER_DEFAULT)) {
    acc.get(skillKey)?.add(chapterKey);
  }
  for (const [subKey, skillKey] of Object.entries(SUBTOPIC_OVERRIDE)) {
    const [topicId, chapterId] = subKey.split(':');
    acc.get(skillKey)?.add(`${topicId}:${chapterId}`);
  }

  const out = {} as Record<SkillKey, ChapterRef[]>;
  for (const key of SKILL_KEYS) {
    out[key] = [...(acc.get(key) ?? [])]
      .map((k) => {
        const [topicId, chapterId] = k.split(':');
        return { topicId, chapterId };
      })
      .sort((a, b) => a.topicId.localeCompare(b.topicId) || a.chapterId.localeCompare(b.chapterId));
  }
  return out;
})();

/**
 * The chapters to draw a drill for this skill from.
 *
 * `dim` narrows to the chapters that also belong to that dimension — practising
 * "inequalities" from inside Algebraic should serve logarithmic, trigonometric
 * and modular inequalities, NOT the rational ones that live under Equations.
 * That is what "the exact related dimension" means operationally.
 */
export function chaptersForSkill(key: SkillKey, dim?: TopicKey): ChapterRef[] {
  const all = CHAPTERS_BY_SKILL[key] ?? [];
  if (!dim) return all;
  const narrowed = all.filter((c) => topicForChapter(c.topicId, c.chapterId) === dim);
  // Never hand back an empty pool: a skill listed under a dimension always has
  // at least one chapter there, but a future map edit could break that and an
  // empty drill is a worse failure than a slightly wider one.
  return narrowed.length > 0 ? narrowed : all;
}

/**
 * Skills that share a chapter with this one — "you meet these in the same
 * material". Deliberately NOT "skills in the same dimension": `algebraic` lists
 * sixteen skills, and calling all of them related says nothing. Sharing a
 * chapter is a real, checkable relationship, and it is what makes the
 * cross-dimension links useful rather than decorative.
 */
export function relatedSkills(key: SkillKey, limit = 4): Array<{ key: SkillKey; shared: number }> {
  const mine = new Set((CHAPTERS_BY_SKILL[key] ?? []).map((c) => `${c.topicId}:${c.chapterId}`));
  if (mine.size === 0) return [];

  return SKILL_KEYS
    .filter((k) => k !== key)
    .map((k) => ({
      key: k,
      shared: (CHAPTERS_BY_SKILL[k] ?? []).filter((c) => mine.has(`${c.topicId}:${c.chapterId}`)).length,
    }))
    .filter((r) => r.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/**
 * The skills a dimension actually EXERCISES — homed ones first, then visitors.
 *
 * Membership is the span, not the home: a dimension must never list a skill none
 * of its chapters can measure, or that row sits at "not met" forever no matter
 * how much the student practises.
 */
export function skillsInDimension(dim: TopicKey): SkillKey[] {
  const here = SKILL_KEYS.filter((k) => SPAN[k].includes(dim));
  return [
    ...here.filter((k) => BY_KEY.get(k)!.home === dim),
    ...here.filter((k) => BY_KEY.get(k)!.home !== dim),
  ];
}

// ─── Measuring a skill ───────────────────────────────────────────────────────

/**
 * The level at which a skill counts as DEVELOPED rather than merely met:
 * reliably solving MEDIUM problems — the middle rung of the ladder.
 *
 * Derived from `MASTER_LEVEL`, not written as a literal, so it rides the display
 * stretch instead of being left behind by it. On the old 0–3 scale this bar was
 * the literal `2`; a hand-written `3` here would have quietly LOWERED it (the
 * exact stretch of 2 is 3.33), letting skills count as developed on strictly
 * less evidence than before.
 */
export const DEVELOPED_LEVEL = 2 * (MASTER_LEVEL / 3);

export interface SkillStat {
  key: SkillKey;
  /** Home dimension — where this row is listed first. */
  home: TopicKey;
  /** Every dimension that feeds it, home first. Length > 1 = a shared skill. */
  dims: TopicKey[];
  /** Lifetime evidence, from the persisted subtopic rollups. */
  seen: number;
  correct: number;
  /** Where the lifetime evidence came from — `{ dimension: items seen }`. */
  seenByDim: Partial<Record<TopicKey, number>>;
  /**
   * Rasch ability for this skill. Estimated from the recent item window when it
   * holds any evidence (current form), otherwise carried over as the seen-
   * weighted mean of the subtopic θ values (lifetime). Null = never measured —
   * which is NOT zero, and the UI must not draw it as zero.
   */
  ability: Ability | null;
  /** `ability.theta` on the 0–3 scale. Null while unmeasured. */
  level: number | null;
  /** P(mastery) from BKT, seen-weighted across the subtopics that feed it. */
  mastery: number | null;
  /** Most recent epoch-ms this skill was exercised. 0 = never. */
  lastAt: number;
  /** True when the recent window carried evidence, so θ reflects current form. */
  fresh: boolean;
}

function blankStat(s: Skill): SkillStat {
  return {
    key: s.key,
    home: s.home,
    dims: SPAN[s.key],
    seen: 0,
    correct: 0,
    seenByDim: {},
    ability: null,
    level: null,
    mastery: null,
    lastAt: 0,
    fresh: false,
  };
}

/**
 * Rolls the two persisted sources up per skill.
 *
 * `diagnostics.subtopics` is the LIFETIME accumulator — it is what makes
 * "collected skills" a real count rather than a window artefact. `recentItems`
 * is the 135-item window, which is where θ comes from when it has anything to
 * say, because a skill last exercised four sittings ago should not report the
 * ability the student had then as if it were current.
 */
export function skillStats(params: {
  diagnostics?: Diagnostics;
  recentItems?: ItemResponse[];
}): Record<SkillKey, SkillStat> {
  const { diagnostics, recentItems = [] } = params;

  const out = {} as Record<SkillKey, SkillStat>;
  for (const s of SKILLS) out[s.key] = blankStat(s);

  // θ-weighting accumulators for the lifetime fallback.
  const thetaAcc = new Map<SkillKey, { wTheta: number; wSe: number; wMastery: number; wSeen: number; mSeen: number }>();

  for (const spot of Object.values(diagnostics?.subtopics ?? {})) {
    const key = skillFor(spot.topicId, spot.chapterId, spot.subtopicId);
    if (!key || !out[key]) continue;
    const stat = out[key];
    const dim = topicForChapter(spot.topicId, spot.chapterId);

    stat.seen += spot.seen;
    stat.correct += spot.correct;
    stat.seenByDim[dim] = (stat.seenByDim[dim] ?? 0) + spot.seen;
    stat.lastAt = Math.max(stat.lastAt, spot.lastAt ?? 0);

    const acc = thetaAcc.get(key) ?? { wTheta: 0, wSe: 0, wMastery: 0, wSeen: 0, mSeen: 0 };
    if (typeof spot.theta === 'number' && spot.seen > 0) {
      acc.wTheta += spot.theta * spot.seen;
      acc.wSe += (spot.se ?? 1.2) * spot.seen;
      acc.wSeen += spot.seen;
    }
    if (typeof spot.mastery === 'number' && spot.seen > 0) {
      acc.wMastery += spot.mastery * spot.seen;
      acc.mSeen += spot.seen;
    }
    thetaAcc.set(key, acc);
  }

  // Group the recent window by skill in one pass, then estimate per skill.
  const window = new Map<SkillKey, ItemResponse[]>();
  for (const item of recentItems) {
    const key = skillOfItem(item);
    if (!key || !out[key]) continue;
    const list = window.get(key);
    if (list) list.push(item);
    else window.set(key, [item]);
  }

  for (const s of SKILLS) {
    const stat = out[s.key];
    const items = window.get(s.key) ?? [];
    // `estimateAbility` drops unanswered items itself, so a skill whose only
    // recent appearance was a question the student never reached correctly falls
    // through to the lifetime estimate instead of reporting the bare prior.
    const answered = items.filter((i) => i.chosen !== '');

    if (answered.length > 0) {
      stat.ability = estimateAbility(answered);
      stat.fresh = true;
    } else {
      const acc = thetaAcc.get(s.key);
      if (acc && acc.wSeen > 0) {
        const theta = acc.wTheta / acc.wSeen;
        stat.ability = {
          theta: Math.round(theta * 1000) / 1000,
          se: Math.round((acc.wSe / acc.wSeen) * 1000) / 1000,
          expected: 0, // not meaningful for a carried-over aggregate
          items: stat.seen,
        };
      }
    }

    stat.level = stat.ability ? thetaToLevel(stat.ability.theta) : null;

    const acc = thetaAcc.get(s.key);
    stat.mastery = acc && acc.mSeen > 0 ? acc.wMastery / acc.mSeen : null;
  }

  return out;
}

/**
 * How much of the skill map a sitting actually touched.
 *
 * A 45-question paper cannot measure 34 skills — it can measure a dozen or so,
 * and saying which is the honest version of "the exam detected your skills".
 * Coverage accumulates across sittings; one paper is a slice, not a portrait.
 */
export function skillCoverage(items: ItemResponse[]): {
  detected: SkillKey[];
  counts: Partial<Record<SkillKey, { seen: number; correct: number }>>;
  untouched: SkillKey[];
} {
  const counts: Partial<Record<SkillKey, { seen: number; correct: number }>> = {};

  for (const item of items) {
    const key = skillOfItem(item);
    if (!key) continue;
    const cell = counts[key] ?? { seen: 0, correct: 0 };
    cell.seen += 1;
    if (item.correct) cell.correct += 1;
    counts[key] = cell;
  }

  const detected = SKILL_KEYS.filter((k) => (counts[k]?.seen ?? 0) > 0);
  return { detected, counts, untouched: SKILL_KEYS.filter((k) => !detected.includes(k)) };
}

/**
 * The weakest measured skills — the practice queue, in Rasch terms.
 * Unmeasured skills are excluded on purpose: "never met" is not "weak", and
 * ranking them together would send every student to drill whatever the exam
 * blueprint happens to under-sample.
 */
export function weakestSkills(
  stats: Record<SkillKey, SkillStat>,
  opts: { minSeen?: number; limit?: number } = {},
): SkillStat[] {
  const { minSeen = 2, limit = 5 } = opts;
  return Object.values(stats)
    .filter((s) => s.level !== null && s.seen >= minSeen)
    .sort((a, b) => (a.level! - b.level!) || (b.seen - a.seen))
    .slice(0, limit);
}

/** Aggregated to a spot check: how many skills have any evidence at all. */
export function skillsCollected(stats: Record<SkillKey, SkillStat>): {
  collected: number;
  total: number;
  developed: number;
} {
  const all = Object.values(stats);
  return {
    collected: all.filter((s) => s.seen > 0).length,
    total: all.length,
    // "Developed" is deliberately a level, not a hit count: meeting a skill once
    // and getting it right is not the same as owning it. The bar is MEDIUM
    // (level 3 on the 0–5 scale) — it moved with the scale, because the old
    // `>= 2` meant "medium" then and would silently mean "easy" now.
    developed: all.filter((s) => (s.level ?? 0) >= DEVELOPED_LEVEL).length,
  };
}

/** Used by the map's own sanity check — every chapter in the syllabus is mapped. */
export function unmappedChapters(chapters: Array<{ topicId: string; chapterId: string }>): string[] {
  return chapters
    .filter((c) => !CHAPTER_DEFAULT[`${c.topicId}:${c.chapterId}`])
    .map((c) => `${c.topicId}:${c.chapterId}`);
}

export type { SpotStat };
