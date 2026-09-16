// scripts/addSATEnglishTopics.mjs
//
// ONE-SHOT generator: appends the `sat-ingliz-tili` subject to
// data/question_topics.json — the 4 official College Board digital SAT
// Reading & Writing domains as topics. Run once with
// `node scripts/addSATEnglishTopics.mjs`; idempotent (re-running replaces the
// sat-ingliz-tili entry rather than duplicating it). Mirrors
// scripts/addSATMathTopics.mjs exactly.
//
// ⚠️ Unlike Math's domains, the donated 1,443-question bank
// (questions.json, repo root — see scripts/importSATEnglishQuestions.mjs)
// carries only a DOMAIN per question, no finer content-category tag. So each
// domain here gets exactly ONE subtopic, same name as the topic — a
// pass-through level to satisfy the subject/topic/subtopic schema
// (isValidTopicPath in lib/questionTopics.ts requires all three), not a real
// subdivision. A teacher hand-authoring a new R&W question still only ever
// sees this one choice per domain.
//
// The moment this lands, /teacher/create/question can author SAT English
// questions with ZERO creator changes — it already reads `SUBJECTS` off
// data/question_topics.json, exactly like every prior subject launch
// (docs/QUESTIONS.md).

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/question_topics.json', import.meta.url);

/** Matches how the existing subjects (including sat-matematika) were slugified. */
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

// The 4 official digital SAT Reading & Writing domains, in College Board's
// own published order (factual, non-copyrightable test-specification names).
const DOMAINS = [
  'Information and Ideas',
  'Craft and Structure',
  'Expression of Ideas',
  'Standard English Conventions',
];

const subject = {
  id: 'sat-ingliz-tili',
  name: 'SAT Ingliz tili (Reading & Writing)',
  topics: DOMAINS.map((name) => ({
    id: slug(name),
    name,
    subtopics: [{ id: slug(name), name }],
  })),
};

// Ids must be unique inside their parent — a duplicate would make one of the
// two topic paths unreachable forever, since saved docs reference ids.
const dupes = [];
const topicIds = new Set();
for (const topic of subject.topics) {
  if (topicIds.has(topic.id)) dupes.push(`topic ${topic.id}`);
  topicIds.add(topic.id);
}
if (dupes.length) {
  console.error('Duplicate ids — fix before writing:', dupes);
  process.exit(1);
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
data.subjects = data.subjects.filter((s) => s.id !== 'sat-ingliz-tili');
data.subjects.push(subject);
writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);

console.log(`sat-ingliz-tili: ${subject.topics.length} topics (1 subtopic each)`);
for (const t of subject.topics) console.log(`  ${t.id}`);
