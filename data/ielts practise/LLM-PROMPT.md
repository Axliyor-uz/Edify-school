# Prompts for generating IELTS papers with an LLM

Copy a brief below, attach the listed structure file(s), send. Then run
`npm run ielts:verify -- path/to/file.json` and fix whatever it reports before importing at
`/admin/ielts`.

---

## What a model cannot do

| Asset | Why | What to do instead |
|---|---|---|
| Listening `audio_url` | It cannot record or host audio | Ask for full transcripts + `"audio_url": "TODO"`, produce the audio, upload to Firebase Storage `ielts_audio/{testId}/`, paste the download URLs in |
| Writing Task 1 `imageUrl` | It cannot render and host a chart | Ask for the prompt + a **data table** describing the chart, build and upload the image, paste the URL in |
| `diagram_completion` `diagram_url` | Same | Skip the type, or supply an existing hosted image URL up front |

The importer rejects placeholder URLs, so these must be real before import.

---

## Reading — full Academic paper

> **Attach:** `STRUCTURE-READING.md` + `STRUCTURE-QUESTION-TYPES.md`

```
You are writing a full IELTS Academic Reading paper for a learning platform.

Read the two attached specification files completely. They define a JSON format that a
strict validator will check — any deviation is rejected.

Produce ONE JSON object, and nothing else (no prose, no markdown fences), meeting all of:

• "module": "reading", "test_category": "academic", "total_time_minutes": 60
• "test_id": "platform_reading_academic_03"
• Exactly 3 passages, exactly 40 questions total (13 / 13 / 14).
• Passages are ORIGINAL prose written by you — never reproduce Cambridge or any other
  published text. Topics: <TOPIC 1>, <TOPIC 2>, <TOPIC 3>.
• Lengths ~800 / ~900 / ~1000 words; difficulty easy / medium / hard; every paragraph gets
  a label ("A", "B", "C", …).
• Use at least 6 different question types across the paper, in exam-realistic proportions.
  Do NOT use diagram_completion (it needs a hosted image).
• Every "Choose TWO letters" question uses type "list_selection" — and remember it consumes
  one question number per correct letter, so all later numbers shift.
• Number the questions 1–40 with no gaps, and make each block's "instructions" state its
  real range ("Questions 14–20").
• Every row that can have one carries a "passage_reference" copied VERBATIM from the
  passage text.
• correct_answer shapes exactly as the spec's quick-reference table says.
• Every NOT GIVEN item must be genuinely absent from the passage, not just worded
  differently. Every other answer must be provable from a single identifiable sentence.

Before you output, silently self-check: numbering (including list_selection spans),
gap-token count vs answer-row count in every completion block, every letter answer existing
in its option list, and no accepted answer exceeding its block's word_limit.
```

## Reading — single passage / short practice

Same brief, with:

```
• 1 passage, 13 questions, "total_time_minutes": 20, "test_id": "<id>".
• Topic: <TOPIC>. Difficulty: <easy|medium|hard>.
```

---

## Listening — full paper (transcripts first)

> **Attach:** `STRUCTURE-LISTENING.md` + `STRUCTURE-QUESTION-TYPES.md`

```
You are writing a full IELTS Listening paper for a learning platform.

Read the two attached specification files completely. They define a JSON format that a
strict validator will check.

Produce ONE JSON object, and nothing else, meeting all of:

• "module": "listening", "total_time_minutes": 32, "test_id": "platform_listening_02"
• Exactly 4 parts, 10 questions each (40 total), following the standard situations:
  Part 1 everyday transaction (2 speakers) — Part 2 everyday monologue —
  Part 3 academic discussion (2–4 speakers) — Part 4 academic lecture (1 speaker).
• Write a FULL, natural transcript for every part in "transcript" (speaker labels, natural
  hesitation, spelled-out names in Part 1). The answers must be spoken verbatim in it.
• Set "audio_url": "TODO" on every part — a human will record and upload the audio.
• Do NOT use diagram_completion (it needs a hosted image).
• Prefer word_limit 1 or 2: answers are heard once.
• Every "Choose TWO letters" question uses type "list_selection" (it consumes one number
  per correct letter — shift the later numbers accordingly).
• Each block's "instructions" states its real question range.

Before you output, silently self-check: every accepted answer appears verbatim in the
transcript; numbering runs 1–40; gap-token count equals answer-row count in every
completion block.
```

---

## Writing

> **Attach:** `STRUCTURE-WRITING.md`

```
You are writing an IELTS <Academic|General Training> Writing paper for a learning platform.

Read the attached specification completely. Produce ONE JSON object and nothing else:

• "module": "writing", "test_category": "<academic|general>", "total_time_minutes": 60
• "test_id": "<id>", "test_title": "<title>"
• task1.prompt: <for Academic — describe the chart in the prompt and ALSO give me, in a
  separate message after the JSON, the underlying data as a table so I can build the image;
  for General Training — a letter task with three bullet requirements>
• task2.prompt: a <opinion|discussion|advantages-disadvantages|problem-solution|two-part>
  essay on <TOPIC>, ending with "Write at least 250 words."
• Include a band-9 "modelAnswer" for both tasks: paraphrased task, clear overview /
  position, developed paragraphs, precise data selection (Task 1), range of complex
  structures.
• Keep the line breaks inside the prompts as the student would see them.
```

For Academic, leave `imageUrl` out of the JSON and add it after uploading the chart.

---

## Speaking

> **Attach:** `STRUCTURE-SPEAKING.md`

```
You are writing an IELTS Speaking set for a learning platform.

Read the attached specification completely. Produce ONE JSON object and nothing else:

• "module": "speaking", "total_time_minutes": 14
• "test_id": "<id>", "test_title": "Speaking Set — <topic>"
• 5 Part 1 questions on <familiar topic>, personal and concrete.
• A Part 2 cue card starting "Describe …", with 3 short bullet prompts plus a final
  "and explain why/how …" bullet.
• 5 Part 3 questions that extend the Part 2 topic into abstract/societal territory,
  escalating: general → comparison → speculation → evaluation.
• The three parts must read as one coherent interview.
• British English, examiner register, one question per string.
```

---

## Reviewing what came back

The verifier catches structure. It cannot catch quality — check these by hand:

- **NOT GIVEN items** that are actually FALSE (or vice versa) — the most common LLM failure.
- **Distractor headings** that paraphrase the correct heading of a different paragraph.
- Answers that appear **twice** in the passage in different forms, making a second option
  defensible.
- Listening answers that a candidate could not realistically catch at natural speed.
- Task 2 prompts that presuppose a specific country's politics.
- Cue cards that need specialist experience to answer.
