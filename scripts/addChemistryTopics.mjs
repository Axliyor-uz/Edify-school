// scripts/addChemistryTopics.mjs
//
// ONE-SHOT generator: appends the `kimyo` subject to data/question_topics.json
// from the Milliy sertifikat chemistry programme's 4 sections. Run once with
// `node scripts/addChemistryTopics.mjs`; it is idempotent (re-running replaces
// the kimyo entry rather than duplicating it).
//
// Why a script and not hand-typed JSON — the same reason as
// scripts/addBiologyTopics.mjs: the ids have to be slugified the exact same way
// the existing algebra/geometriya/biologiya ids were, and they are PERSISTED into
// teacher_questions docs, so a typo is a topic path that can never be matched
// again.
//
// ⚠️ The taxonomy is only 3 levels (subject → topic → subtopic), and the
// chemistry programme's 4 sections each have an intermediate grouping (Asosiy
// tushunchalar / Atom tuzilishi / Kimyoviy bog'lanish …). Those groups are folded
// into the SUBTOPIC NAME as a "Group — Leaf" prefix, exactly as biology's
// sections 2 and 4 do. That keeps the programme's official I–IV numbering at the
// TOPIC level — which is what the DTM question distribution is stated per
// (Umumiy 13 · Anorganik 6 · Organik 10 · Tahlil 3 closed questions) and what the
// teacher's results page groups by — while the groups still read and sort
// together in the builder's dropdown.
//
// ⚠️ The topic count (4) is deliberately much smaller than biology's (8). Do not
// "improve" it by promoting the groups to topics: the results page would then
// group a class's weakest area under a label that appears in no official
// document, and a teacher could no longer check a paper against the published
// per-section counts.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/** Matches how the existing algebra/geometriya/biologiya ids were slugified. */
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
// then read as two separators. Use parentheses instead: "IA guruh (ishqoriy
// metallar)", whose parens slugify to a single hyphen.
const SECTIONS = [
  G('I. Umumiy kimyo', {
    'Asosiy tushunchalar va qonunlar': [
      'Atom va molekula',
      'Kimyoviy element va oddiy modda',
      'Nisbiy atom va molekulyar massa',
      'Mol va molyar massa',
      'Valentlik',
      'Modda massasining saqlanish qonuni',
      'Tarkibning doimiylik qonuni',
      'Avogadro qonuni va molyar hajm',
      'Gaz qonunlari',
      'Formula va tenglama boyicha hisoblashlar',
    ],
    'Atom tuzilishi': [
      'Atom yadrosi va elektron qobiq',
      'D. I. Mendeleyev davriy qonuni',
      'Davriy sistema tuzilishi',
      'Izotoplar',
      'Elektron konfiguratsiya',
      'Pauli prinsipi va Hund qoidasi',
      'Kvant sonlari',
      'Yadro reaksiyalari',
    ],
    "Kimyoviy bog'lanish": [
      "Kovalent bog'lanish",
      "Ion bog'lanish",
      "Metall bog'lanish",
      "Vodorod bog'lanish",
      'Kristall panjara turlari',
      'Gibridlanish',
      'Molekulaning fazoviy tuzilishi',
    ],
    'Kinetika va muvozanat': [
      'Reaksiya tezligi',
      "Tezlikka ta'sir etuvchi omillar",
      'Katalizatorlar',
      'Kimyoviy muvozanat',
      'Le-Shatelye prinsipi',
    ],
    'Eritmalar': [
      'Eruvchanlik',
      'Massa ulushi',
      'Molyar konsentratsiya',
      'Normal konsentratsiya',
      'Oleum',
      'Elektrolitik dissotsiatsiyalanish',
      'Kuchli va kuchsiz elektrolitlar',
      'Ion almashinish reaksiyalari',
      'Vodorod korsatkichi pH',
      'Tuzlar gidrolizi',
    ],
    'Oksidlanish-qaytarilish va elektroliz': [
      'Oksidlanish darajasi',
      'Oksidlovchi va qaytaruvchi',
      'Elektron balans usuli',
      'Yarim reaksiyalar usuli',
      'Metallarning kuchlanish qatori',
      'Suyuqlanma elektrolizi',
      'Eritma elektrolizi',
      'Elektroliz boyicha hisoblashlar',
    ],
  }),

  G('II. Anorganik kimyo', {
    'Birikmalar sinflari': [
      'Oksidlar',
      'Asoslar',
      'Kislotalar',
      'Tuzlar',
      'Amfoter birikmalar',
      'Birikmalar orasidagi genetik aloqa',
    ],
    'Metallar': [
      'Metallarning umumiy xossalari',
      'Metallarni olish usullari',
      'IA guruh (ishqoriy metallar)',
      'IIA guruh (ishqoriy-yer metallar)',
      'IIIA guruh (alyuminiy)',
      'd guruhcha metallari',
      'Temir va uning birikmalari',
      'Xrom va marganets birikmalari',
      'Suvning qattiqligi',
    ],
    'Metallmaslar': [
      'IVA guruh (uglerod va kremniy)',
      'VA guruh (azot va fosfor)',
      'VIA guruh (kislorod va oltingugurt)',
      'VIIA guruh (galogenlar)',
      'Vodorod',
      'Nodir gazlar',
      "Mineral o'g'itlar",
    ],
  }),

  G('III. Organik kimyo', {
    'Uglevodorodlar': [
      'Organik kimyo asoslari',
      'Nomenklatura',
      'Izomeriya',
      'Alkanlar',
      'Sikloalkanlar',
      'Alkenlar',
      'Alkadiyenlar',
      'Alkinlar',
      'Aromatik uglevodorodlar',
      'Genetik aloqa va zanjirlar',
    ],
    'Uglevodorod manbalari': [
      'Neft',
      'Tabiiy gaz',
      "Toshko'mir",
    ],
    'Kislorodli birikmalar': [
      'Bir atomli spirtlar',
      "Ko'p atomli spirtlar",
      'Fenollar',
      'Aldegidlar',
      'Ketonlar',
      'Karbon kislotalar',
      'Oddiy efirlar',
      'Murakkab efirlar',
      "Yog'lar",
      'Sovunlar va yuvish vositalari',
    ],
    'Uglevodlar': [
      'Monosaxaridlar',
      'Disaxaridlar',
      'Polisaxaridlar',
    ],
    'Azotli birikmalar va polimerlar': [
      'Aminlar',
      'Aminokislotalar',
      'Oqsillar',
      'Polimerlanish reaksiyalari',
      'Polikondensatlanish reaksiyalari',
      'Kauchuklar',
      'Sintetik tolalar',
    ],
  }),

  G('IV. Kimyoviy tahlil', {
    'Laboratoriya asoslari': [
      'Xavfsizlik qoidalari',
      'Laboratoriya jihozlari',
      "O'lchash va tortish",
    ],
    'Moddalarni ajratish va tayyorlash': [
      'Tindirish',
      'Filtrlash',
      "Bug'latish",
      'Magnitlash',
      'Distillash',
      'Eritmalar tayyorlash',
    ],
    'Sifat reaksiyalari': [
      'Kationlarni aniqlash',
      'Anionlarni aniqlash',
      'Gazlarni aniqlash',
      'Organik moddalarni aniqlash',
      'Indikatorlar',
    ],
  }),
];

// ── build ────────────────────────────────────────────────────────────────────

/**
 * Section names carry their programme number; the id must not.
 *
 * ⚠️ The chemistry programme numbers its sections with ROMAN numerals, unlike
 * biology's arabic ones, so this strips both — otherwise every id would start
 * with `i-`, `ii-`… and the slugs would sort and read by numeral.
 */
const topicSlug = (name) => slug(name.replace(/^(?:\d+|[IVXLC]+)\.\s*/, ''));

const subject = {
  id: 'kimyo',
  name: 'Kimyo',
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
data.subjects = data.subjects.filter((s) => s.id !== 'kimyo');
data.subjects.push(subject);
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

const leaves = subject.topics.reduce((n, t) => n + t.subtopics.length, 0);
console.log(`kimyo: ${subject.topics.length} topics, ${leaves} subtopics`);
for (const t of subject.topics) console.log(`  ${t.id} (${t.subtopics.length})`);
