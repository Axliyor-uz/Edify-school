// scripts/addSATMathTopics.mjs
//
// ONE-SHOT generator: appends the `sat-matematika` subject to
// data/question_topics.json — the 4 official College Board digital SAT Math
// domains as topics, each with the official skill/content-category subtopics
// (public, factual test-specification categories, not copyrighted text). Run
// once with `node scripts/addSATMathTopics.mjs`; idempotent (re-running
// replaces the sat-matematika entry rather than duplicating it).
//
// Why a script and not hand-typed JSON — same reason as
// scripts/addChemistryTopics.mjs: ids are slugified the exact same way the
// existing subjects were, and they are PERSISTED into teacher_questions docs,
// so a typo is a topic path that can never be matched again.
//
// The moment this lands, /teacher/create/question and /teacher/create/block
// can author SAT Math questions with ZERO creator changes — both read
// `SUBJECTS`, exactly like every prior subject launch (docs/QUESTIONS.md).
//
// ⚠️ Unlike chemistry/biology/physics, these 4 domains have NO intermediate
// grouping to fold into subtopic names — the College Board spec is already
// flat (domain → content category), so subtopics are plain leaves.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/** Matches how the existing subjects (algebra/geometriya/biologiya/kimyo/…) were slugified. */
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’‘ʻ`]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[.,:;()"?!]/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// The 4 official digital SAT Math domains and their published content
// categories (College Board's own test-specification names — factual,
// non-copyrightable category labels, not excerpted question text).
const DOMAINS = [
  {
    name: 'Algebra',
    leaves: [
      'Linear equations in one variable',
      'Linear functions',
      'Linear equations in two variables',
      'Systems of two linear equations in two variables',
      'Linear inequalities in one or two variables',
    ],
  },
  {
    name: 'Advanced Math',
    leaves: [
      'Nonlinear functions',
      'Nonlinear equations in one variable and systems of equations in two variables',
      'Equivalent expressions',
    ],
  },
  {
    name: 'Problem-Solving and Data Analysis',
    leaves: [
      'Ratios, rates, proportional relationships, and units',
      'Percentages',
      'One-variable data: distributions and measures of center and spread',
      'Two-variable data: models and scatterplots',
      'Probability and conditional probability',
      'Inference from sample statistics and margin of error',
      'Evaluating statistical claims: observational studies and experiments',
    ],
  },
  {
    name: 'Geometry and Trigonometry',
    leaves: [
      'Area and volume',
      'Lines, angles, and triangles',
      'Right triangles and trigonometry',
      'Circles',
    ],
  },
];

const subject = {
  id: 'sat-matematika',
  name: 'SAT Matematika',
  topics: DOMAINS.map((d) => ({
    id: slug(d.name),
    name: d.name,
    subtopics: d.leaves.map((leaf) => ({ id: slug(leaf), name: leaf })),
  })),
};

// Ids must be unique inside their parent — a duplicate would make one of the
// two topic paths unreachable forever, since saved docs reference ids.
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
data.subjects = data.subjects.filter((s) => s.id !== 'sat-matematika');
data.subjects.push(subject);
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

const leaves = subject.topics.reduce((n, t) => n + t.subtopics.length, 0);
console.log(`sat-matematika: ${subject.topics.length} topics, ${leaves} subtopics`);
for (const t of subject.topics) console.log(`  ${t.id} (${t.subtopics.length})`);
