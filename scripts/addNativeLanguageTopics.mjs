// scripts/addNativeLanguageTopics.mjs
//
// ONE-SHOT generator: appends the `ona-tili` subject to data/question_topics.json
// from the Milliy sertifikat ona tili programme's 7 sections. Run once with
// `node scripts/addNativeLanguageTopics.mjs`; it is idempotent (re-running
// replaces the ona-tili entry rather than duplicating it).
//
// Why a script and not hand-typed JSON — the same reason as
// scripts/addChemistryTopics.mjs: the ids have to be slugified the exact same way
// the existing algebra/geometriya/biologiya/kimyo/fizika ids were, and they are
// PERSISTED into teacher_questions docs, so a typo is a topic path that can never
// be matched again.
//
// ⚠️ **This is ONA TILI, not "ona tili va adabiyot".** The sections below are the
// linguistic ones — fonetika through uslubiyat — and there is deliberately no
// literature topic. Literature is examined on its own texts and its own authors;
// filing a question about a novel under "Sintaksis" (or inventing an "Adabiyot"
// topic here) would put a whole second subject inside this one's per-topic
// report. If literature is ever added it is its own taxonomy and its own registry
// entry, exactly as biology and chemistry are two subjects and not one.
//
// ⚠️ The taxonomy is only 3 levels (subject → topic → subtopic) and most sections
// have an intermediate grouping (Nutq tovushlari, Ma'no munosabatlari,
// Mustaqil so'z turkumlari …). Those groups are folded into the SUBTOPIC NAME as
// a "Group — Leaf" prefix, exactly as biology, chemistry and physics do — the
// programme's own seven sections stay at the TOPIC level, which is what the
// teacher's results page groups by.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/** Matches how the existing algebra/geometriya/biologiya/kimyo/fizika ids were slugified. */
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
// then read as two separators. Use parentheses instead: "Rasmiy uslub
// (idoraviy)", whose parens slugify to a single hyphen.
const SECTIONS = [
  G('I. Fonetika va grafika', {
    'Nutq tovushlari': [
      'Unli tovushlar tasnifi',
      'Undosh tovushlar tasnifi',
      'Tovush va harf munosabati',
      "Bo'g'in va bo'g'in ko'chirish",
      "Urg'u (so'z va mantiq urg'usi)",
      "Tovush o'zgarishlari (tushishi, orttirilishi)",
      'Alifbo va yozuv tarixi',
    ],
    Orfoepiya: [
      "Adabiy talaffuz me'yorlari",
      'Talaffuzda uchraydigan xatolar',
    ],
  }),

  G('II. Leksikologiya', {
    "So'z ma'nosi": [
      "So'zning o'z va ko'chma ma'nosi",
      "Ko'chim turlari (metafora, metonimiya, sinekdoxa)",
      "Ko'p ma'noli so'zlar",
    ],
    "Ma'no munosabatlari": [
      'Sinonimlar',
      'Antonimlar',
      'Omonimlar',
      'Paronimlar',
    ],
    "Lug'at boyligi": [
      "Umumiste'mol so'zlar",
      "Sheva so'zlari (dialektizmlar)",
      'Atamalar (terminlar)',
      "Eskirgan so'zlar (arxaizm va istorizm)",
      "Yangi so'zlar (neologizmlar)",
      "O'zlashma so'zlar",
    ],
    Frazeologiya: [
      'Frazeologik birikmalar',
      'Maqol va matallar',
      "Hikmatli so'zlar",
    ],
    "Lug'atlar": [
      "Izohli lug'at",
      "Imlo lug'ati",
      "Lug'atning boshqa turlari",
    ],
  }),

  G("III. So'z tarkibi va so'z yasalishi", {
    "So'z tarkibi": [
      "O'zak va negiz",
      "So'z yasovchi qo'shimchalar",
      "Shakl yasovchi qo'shimchalar",
      "Lug'aviy shakl yasovchilar",
    ],
    "So'z yasalishi": [
      "Qo'shimcha qo'shish usuli",
      "Qo'shma so'zlar",
      "Juft va takroriy so'zlar",
      "Qisqartma so'zlar",
    ],
  }),

  G('IV. Morfologiya', {
    "Mustaqil so'z turkumlari": [
      'Ot va uning kategoriyalari',
      'Sifat va daraja shakllari',
      'Son va uning turlari',
      'Olmosh turlari',
      'Ravish turlari',
      "Taqlid so'zlar",
    ],
    "Fe'l va uning shakllari": [
      "Fe'l nisbatlari",
      "Fe'l mayllari",
      "Fe'l zamonlari",
      'Sifatdosh',
      'Ravishdosh',
      'Harakat nomi',
    ],
    "Yordamchi so'z turkumlari": [
      "Ko'makchi",
      "Bog'lovchi",
      'Yuklama',
      "Undov va modal so'zlar",
    ],
  }),

  G('V. Sintaksis', {
    "So'z birikmasi": [
      'Boshqaruv aloqasi',
      'Bitishuv aloqasi',
      'Moslashuv aloqasi',
    ],
    "Gap bo'laklari": [
      'Ega va kesim',
      "To'ldiruvchi",
      'Aniqlovchi',
      'Hol',
      "Uyushiq bo'laklar",
      "Ajratilgan bo'laklar",
      "Undalma va kirish so'zlar",
    ],
    'Gap turlari': [
      'Sodda gap turlari',
      "Bir bosh bo'lakli gaplar",
      "Bog'langan qo'shma gap",
      "Ergashgan qo'shma gap",
      "Bog'lovchisiz qo'shma gap",
      "Ko'chirma va o'zlashtirma gap",
    ],
  }),

  G('VI. Imlo va tinish belgilari', {
    Orfografiya: [
      'Unli va undosh harflar imlosi',
      "Qo'shib va ajratib yozish",
      'Bosh harflar imlosi',
      "Qo'shimchalar imlosi",
    ],
    Punktuatsiya: [
      "Nuqta, so'roq va undov belgisi",
      'Vergul',
      'Ikki nuqta va tire',
      "Qo'shtirnoq va qavs",
    ],
  }),

  G('VII. Uslubiyat va nutq madaniyati', {
    'Nutq uslublari': [
      "So'zlashuv uslubi",
      'Badiiy uslub',
      'Ilmiy uslub',
      'Rasmiy uslub (idoraviy)',
      'Publitsistik uslub',
    ],
    'Nutq madaniyati': [
      "Nutqning to'g'riligi va aniqligi",
      'Matn va uning turlari',
      "Til birliklari me'yori",
    ],
  }),
];

// ── build ────────────────────────────────────────────────────────────────────

/**
 * Section names carry their programme number; the id must not.
 *
 * ⚠️ Numbered with ROMAN numerals, like chemistry's and physics', so this strips
 * both forms — otherwise every id would start with `i-`, `ii-`… and the slugs
 * would sort and read by numeral.
 */
const topicSlug = (name) => slug(name.replace(/^(?:\d+|[IVXLC]+)\.\s*/, ''));

const subject = {
  id: 'ona-tili',
  name: 'Ona tili',
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
data.subjects = data.subjects.filter((s) => s.id !== 'ona-tili');
data.subjects.push(subject);
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

const leaves = subject.topics.reduce((n, t) => n + t.subtopics.length, 0);
console.log(`ona-tili: ${subject.topics.length} topics, ${leaves} subtopics`);
for (const t of subject.topics) console.log(`  ${t.id} (${t.subtopics.length})`);
