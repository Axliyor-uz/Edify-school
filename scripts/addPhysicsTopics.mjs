// scripts/addPhysicsTopics.mjs
//
// ONE-SHOT generator: appends the `fizika` subject to data/question_topics.json
// from the Milliy sertifikat physics programme's 5 sections. Run once with
// `node scripts/addPhysicsTopics.mjs`; it is idempotent (re-running replaces the
// fizika entry rather than duplicating it).
//
// Why a script and not hand-typed JSON — the same reason as
// scripts/addChemistryTopics.mjs: the ids have to be slugified the exact same way
// the existing algebra/geometriya/biologiya/kimyo ids were, and they are
// PERSISTED into teacher_questions docs, so a typo is a topic path that can never
// be matched again.
//
// ⚠️ The taxonomy is only 3 levels (subject → topic → subtopic), and each physics
// section has an intermediate grouping (Kinematika / Dinamika / Optika's two
// halves …). Those groups are folded into the SUBTOPIC NAME as a "Group — Leaf"
// prefix, exactly as biology and chemistry do. That keeps the programme's five
// classical branches at the TOPIC level — which is what the teacher's results
// page groups by, and the vocabulary every physics textbook and every teacher
// already uses — while the groups still read and sort together in the builder's
// dropdown.
//
// ⚠️ Do not promote the groups to topics. Twenty topics would make the results
// page name a class's weakest area as "Statika va gidrostatika" instead of
// "Mexanika", which is finer than any published physics distribution and finer
// than a 35-question paper can measure: with one or two questions per group the
// per-topic counts stop meaning anything.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/** Matches how the existing algebra/geometriya/biologiya/kimyo ids were slugified. */
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’‘ʻ`]/g, '')       // apostrophes vanish: O'zaro → ozaro
    .replace(/[–—]/g, '-')          // en/em dash → hyphen
    .replace(/[.,:;()"?!]/g, ' ')   // punctuation → space
    .replace(/\s*-\s*/g, '-')       // tidy spaces around hyphens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/** A grouped section: name + { group: leaves } folded into "Group — Leaf". */
const G = (name, groups) => ({
  name,
  leaves: Object.entries(groups).flatMap(([group, leaves]) =>
    leaves.map((leaf) => `${group} — ${leaf}`),
  ),
});

// ⚠️ A leaf must not contain a dash of its own — the "Group — Leaf" fold would
// then read as two separators. Use parentheses instead: "Urg'u (so'z urg'usi)",
// whose parens slugify to a single hyphen. That is why the Joule–Lenz law is
// written "Joul va Lens qonuni" below rather than hyphenated.
const SECTIONS = [
  G('I. Mexanika', {
    Kinematika: [
      'Moddiy nuqta va sanoq sistemasi',
      "Tekis to'g'ri chiziqli harakat",
      "Tekis o'zgaruvchan harakat",
      'Erkin tushish va tik otilgan jism',
      'Gorizontal va burchak ostida otilgan jism',
      'Aylanma harakat (chiziqli va burchak tezlik)',
      'Harakatlarning nisbiyligi',
    ],
    Dinamika: [
      'Nyutonning birinchi qonuni',
      'Nyutonning ikkinchi qonuni',
      'Nyutonning uchinchi qonuni',
      'Butun olam tortishish qonuni',
      "Og'irlik kuchi va vaznsizlik",
      'Elastiklik kuchi (Guk qonuni)',
      'Ishqalanish kuchi',
      "Sun'iy yo'ldoshlar va kosmik tezliklar",
    ],
    'Saqlanish qonunlari': [
      'Impuls va impulsning saqlanish qonuni',
      'Mexanik ish va quvvat',
      'Kinetik energiya',
      'Potensial energiya',
      'Mexanik energiyaning saqlanish qonuni',
      "To'qnashuvlar (elastik va noelastik)",
      'Foydali ish koeffitsienti',
    ],
    'Statika va gidrostatika': [
      'Kuch momenti va richag',
      'Jismlar muvozanati',
      'Bosim va Paskal qonuni',
      'Arximed kuchi va suzish sharti',
      'Suyuqlik oqimi (Bernulli tenglamasi)',
    ],
    "Tebranish va to'lqinlar": [
      'Garmonik tebranishlar',
      'Matematik mayatnik',
      'Prujinali mayatnik',
      "Mexanik to'lqinlar",
      'Tovush va uning xossalari',
    ],
  }),

  G('II. Molekulyar fizika va termodinamika', {
    'Molekulyar kinetika': [
      'Modda miqdori va Avogadro soni',
      'Molekulyar kinetik nazariyaning asosiy tenglamasi',
      'Ideal gaz holat tenglamasi',
      'Izojarayonlar',
      'Gaz qonunlarining grafiklari',
      'Molekulalarning tezligi va harorat',
    ],
    Termodinamika: [
      'Ichki energiya',
      'Gazning bajargan ishi',
      'Termodinamikaning birinchi qonuni',
      "Issiqlik miqdori va solishtirma issiqlik sig'imi",
      'Issiqlik mashinalari va ularning FIK i',
      'Termodinamikaning ikkinchi qonuni',
    ],
    'Agregat holatlar': [
      "Bug'lanish va kondensatsiya",
      'Havoning namligi',
      'Suyuqlik sirt taranglik kuchi',
      "Kapillyarlik va ho'llash",
      'Erish va kristallanish',
      'Jismlarning issiqlikdan kengayishi',
    ],
  }),

  G('III. Elektr va magnetizm', {
    Elektrostatika: [
      'Elektr zaryadi va Kulon qonuni',
      'Elektr maydon kuchlanganligi',
      'Potensial va kuchlanish',
      "Kondensatorlar va sig'im",
      'Kondensatorlarni ulash',
      'Elektr maydon energiyasi',
    ],
    "O'zgarmas tok": [
      'Tok kuchi va qarshilik',
      'Zanjir qismi uchun Om qonuni',
      "To'la zanjir uchun Om qonuni",
      "O'tkazgichlarni ketma ket va parallel ulash",
      'Tok ishi va quvvati (Joul va Lens qonuni)',
      "Elektr o'tkazuvchanlik turlari",
      'Elektroliz qonunlari',
    ],
    'Magnit maydon': [
      'Magnit induksiya va Amper kuchi',
      'Lorens kuchi',
      'Magnit oqimi',
      'Elektromagnit induksiya hodisasi',
      "O'z o'zidan induksiya va induktivlik",
    ],
    "O'zgaruvchan tok": [
      "O'zgaruvchan tok generatori",
      'Tebranish konturi va Tomson formulasi',
      'Transformator',
      "Elektromagnit to'lqinlar",
    ],
  }),

  G('IV. Optika va nisbiylik nazariyasi', {
    'Geometrik optika': [
      "Yorug'likning qaytish qonuni",
      "Yorug'likning sinish qonuni",
      "To'la ichki qaytish",
      'Linzalar va linza formulasi',
      "Ko'zgular va tasvir yasash",
      'Optik asboblar',
    ],
    "To'lqin optikasi": [
      "Yorug'lik interferensiyasi",
      "Yorug'lik difraksiyasi va difraksion panjara",
      'Dispersiya va spektr',
      "Yorug'likning qutblanishi",
    ],
    'Nisbiylik nazariyasi': [
      'Maxsus nisbiylik nazariyasi postulatlari',
      "Massa va energiyaning bog'lanishi",
    ],
  }),

  G('V. Kvant va yadro fizikasi', {
    'Kvant fizikasi': [
      'Fotoeffekt va Eynshteyn tenglamasi',
      'Foton energiyasi va impulsi',
      "Yorug'lik bosimi",
      "Yorug'likning kvant xossalari",
    ],
    'Atom fizikasi': [
      'Rezerford tajribasi va atom modeli',
      'Bor postulatlari',
      'Atom spektrlari',
      'Lazerlar',
    ],
    'Yadro fizikasi': [
      'Atom yadrosining tuzilishi',
      "Massa defekti va bog'lanish energiyasi",
      'Radioaktivlik turlari',
      'Radioaktiv yemirilish qonuni',
      'Yadro reaksiyalari va yadro energetikasi',
      'Elementar zarralar',
    ],
  }),
];

// ── build ────────────────────────────────────────────────────────────────────

/**
 * Section names carry their programme number; the id must not.
 *
 * ⚠️ The physics sections are numbered with ROMAN numerals, like chemistry's, so
 * this strips both forms — otherwise every id would start with `i-`, `ii-`… and
 * the slugs would sort and read by numeral.
 */
const topicSlug = (name) => slug(name.replace(/^(?:\d+|[IVXLC]+)\.\s*/, ''));

const subject = {
  id: 'fizika',
  name: 'Fizika',
  topics: SECTIONS.map((section) => ({
    id: topicSlug(section.name),
    name: section.name,
    subtopics: section.leaves.map((leaf) => ({ id: slug(leaf), name: leaf })),
  })),
};

// Ids must be unique inside their parent — a duplicate would make one of the two
// topic paths unreachable forever, since saved docs reference ids.
const dupes = [];
const topicIds = new Set();
for (const topic of subject.topics) {
  if (topicIds.has(topic.id)) dupes.push(`topic ${topic.id}`);
  topicIds.add(topic.id);
  const subIds = new Set();
  for (const sub of topic.subtopics) {
    if (subIds.has(sub.id)) dupes.push(`${topic.id} / ${sub.id}`);
    subIds.add(sub.id);
  }
}
if (dupes.length) {
  console.error('Duplicate ids — fix before writing:', dupes);
  process.exit(1);
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
data.subjects = data.subjects.filter((s) => s.id !== 'fizika');
data.subjects.push(subject);
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

const leaves = subject.topics.reduce((n, t) => n + t.subtopics.length, 0);
console.log(`fizika: ${subject.topics.length} topics, ${leaves} subtopics`);
for (const t of subject.topics) console.log(`  ${t.id} (${t.subtopics.length})`);
