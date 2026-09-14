// scripts/addBiologyTopics.mjs
//
// ONE-SHOT generator: appends the `biologiya` subject to
// data/question_topics.json from the Milliy sertifikat biology programme's 8
// sections. Run once with `node scripts/addBiologyTopics.mjs`; it is idempotent
// (re-running replaces the biologiya entry rather than duplicating it).
//
// Why a script and not hand-typed JSON: 160+ ids have to be slugified the exact
// same way the existing algebra/geometriya ids were, and the ids are PERSISTED
// into teacher_questions docs — a typo is a topic path that can never be matched
// again. Kept in the repo so a future subject (chemistry, physics, english) is
// added the same reviewable way.
//
// ⚠️ The taxonomy is only 3 levels (subject → topic → subtopic). Sections 2 and
// 4 of the programme have an intermediate grouping (Sitologiya / Genetika /
// Seleksiya, and Botanika / Zoologiya), so those groups are folded into the
// SUBTOPIC NAME as a "Group — Leaf" prefix. That keeps the programme's official
// 8-section numbering at the topic level (which is what a paper is balanced on)
// while the groups still read and sort together in the builder's dropdown.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/** Matches how the existing algebra/geometriya ids were slugified. */
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

/** A flat section: name + leaves. */
const S = (name, leaves) => ({ name, leaves });
/** A grouped section: name + { group: leaves } folded into "Group — Leaf". */
const G = (name, groups) => ({
  name,
  leaves: Object.entries(groups).flatMap(([group, leaves]) =>
    leaves.map((leaf) => `${group} — ${leaf}`),
  ),
});

const SECTIONS = [
  S('1. Tiriklikning xilma-xilligi', [
    'Tirik organizmlarning umumiy xususiyatlari',
    'Hayotning kelib chiqishi',
    'Tiriklik darajalari',
    'Viruslar',
    'Prokariotlar',
    'Eukariotlar',
    'Biologik tasniflash asoslari',
  ]),

  G('2. Sitologiya, genetika va seleksiya asoslari', {
    Sitologiya: [
      'Hujayra nazariyasi',
      'Hujayra tuzilishi',
      'Organoidlar',
      'Plazmatik membrana',
      'Moddalar transporti',
      'Hujayra sikli',
      'Mitoz',
      'Meyoz',
      'Hujayra energetikasi',
    ],
    Genetika: [
      "Irsiyat va o'zgaruvchanlik",
      'Mendel qonunlari',
      'Monogibrid chatish',
      'Digibrid chatish',
      'Genotip va fenotip',
      'Dominant va retsessiv belgilar',
      'Kodominantlik',
      "To'liqsiz dominantlik",
      "Jinsga bog'liq irsiylanish",
      'Mutatsiyalar',
      'DNK',
      'RNK',
      'Replikatsiya',
      'Transkripsiya',
      'Translyatsiya',
      'Gen muhandisligi',
    ],
    Seleksiya: [
      "Sun'iy tanlash",
      'Duragaylash',
      'Poliploidiya',
      'Biotexnologiya',
      'Mikroorganizmlar seleksiyasi',
      "O'simlik va hayvonlar seleksiyasi",
    ],
  }),

  S('3. Tirik organizmlarning umumiy sistematikasi', [
    'Taksonomik birliklar',
    'Tur',
    'Avlod',
    'Oila',
    'Turkum',
    'Sinf',
    'Tip',
    "Bo'lim",
    'Shohlik',
    'Binar nomenklatura',
  ]),

  G("4. O'simlik va hayvonot dunyosi", {
    Botanika: [
      "Suvo'tlar",
      'Moxlar',
      'Qirqquloqlar',
      "Ochiq urug'lilar",
      "Yopiq urug'lilar",
      "O'simlik to'qimalari",
      'Ildiz',
      'Poya',
      'Barg',
      'Gul',
      'Meva',
      "Urug'",
      'Fotosintez',
      'Nafas olish',
      "Ko'payish",
    ],
    Zoologiya: [
      'Bir hujayralilar',
      "Bo'shliqichlilar",
      'Yassi chuvalchanglar',
      'Yumaloq chuvalchanglar',
      'Halqali chuvalchanglar',
      'Mollyuskalar',
      "Bo'g'imoyoqlilar",
      'Ignaterililar',
      'Baliqlar',
      'Suvda va quruqlikda yashovchilar',
      'Sudralib yuruvchilar',
      'Qushlar',
      'Sutemizuvchilar',
      'Hayvonlarning ekologiyasi',
    ],
  }),

  S('5. Odam organizmi va uning salomatligi', [
    'Tayanch-harakat tizimi',
    'Mushaklar',
    'Qon',
    'Yurak-qon tomir tizimi',
    'Immunitet',
    'Nafas olish tizimi',
    'Ovqat hazm qilish tizimi',
    'Ajratish tizimi',
    'Nerv tizimi',
    'Endokrin tizim',
    'Sezgi organlari',
    "Ko'payish tizimi",
    'Gigiyena',
    'Kasalliklar profilaktikasi',
    "Sog'lom turmush tarzi",
  ]),

  S('6. Hayotning tur va populyatsiya darajasining umumbiologik qonuniyatlari', [
    'Evolyutsiya',
    'Populyatsiya',
    'Mikroevolyutsiya',
    'Makroevolyutsiya',
    'Tabiiy tanlanish',
    "Sun'iy tanlanish",
    'Moslanish',
    "Tur hosil bo'lishi",
    'Genofond',
    'Hardy–Weinberg qonuni',
    'Evolyutsion omillar',
  ]),

  S('7. Hayotning ekosistema va biosfera darajasi umumiy qonuniyatlari', [
    'Ekologiya',
    'Ekotizim',
    'Biosfera',
    'Biogeotsenoz',
    'Biotik omillar',
    'Abiotik omillar',
    'Antropogen omillar',
    'Oziq zanjiri',
    'Trofik darajalar',
    'Moddalar aylanishi',
    'Energiya oqimi',
    'Biogeokimyoviy sikllar',
    'Organik olam filogenezi',
    'Global ekologik muammolar',
  ]),

  S('8. Umumbiologik qonuniyatlar asosida masala, misol va topshiriqlar', [
    'Genetik masalalar',
    'Sitologik masalalar',
    'Ekologik hisoblashlar',
    'Evolyutsion masalalar',
    'Hardy–Weinberg masalalari',
    'Diagramma va jadval tahlili',
    'Grafiklarni tahlil qilish',
    'Tajriba natijalarini izohlash',
    'Mantiqiy biologik topshiriqlar',
  ]),
];

// ── build ────────────────────────────────────────────────────────────────────

/** Section names carry their programme number; the id must not. */
const topicSlug = (name) => slug(name.replace(/^\d+\.\s*/, ''));

const subject = {
  id: 'biologiya',
  name: 'Biologiya',
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
data.subjects = data.subjects.filter((s) => s.id !== 'biologiya');
data.subjects.push(subject);
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

const leaves = subject.topics.reduce((n, t) => n + t.subtopics.length, 0);
console.log(`biologiya: ${subject.topics.length} topics, ${leaves} subtopics`);
for (const t of subject.topics) console.log(`  ${t.id} (${t.subtopics.length})`);
