# IELTS **Writing** — JSON structure spec

> Self-contained: hand **this file alone** to an LLM and it can produce a valid Writing
> paper. Check it with `npm run ielts:verify -- path/to/file.json`, then import at
> `/admin/ielts` → **Writing** tab → **Import JSON**.

---

## 1. The whole structure

```json
{
  "test_id": "platform_writing_academic_01",
  "module": "writing",
  "test_title": "Academic Writing Practice Test 1",
  "test_category": "academic",
  "total_time_minutes": 60,
  "task1": {
    "prompt": "The chart below shows the percentage of households in Uzbekistan with internet access between 2005 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.",
    "imageUrl": "https://firebasestorage.googleapis.com/…/ielts_writing%2Fchart01.png?alt=media",
    "modelAnswer": "The line graph illustrates…"
  },
  "task2": {
    "prompt": "Some people believe that unpaid community service should be a compulsory part of high school programmes.\n\nTo what extent do you agree or disagree?\n\nWrite at least 250 words.",
    "modelAnswer": "It is sometimes argued that…"
  }
}
```

That is the complete document — there are no other fields.

| Field | Required | Rules |
|---|---|---|
| `module` | ✅ | Literally `"writing"`. |
| `test_title` | ✅ | ≤150 characters. The library card title. |
| `test_id` | recommended | 3–120 chars, `A–Z a–z 0–9 _ -`, starts alphanumeric. It is the Firestore document id — **re-importing the same id overwrites** that test. Omit it and one is derived from the title. |
| `test_category` | recommended | `"academic"` or `"general"` — this is what makes Task 1 a **chart description** vs a **letter**. |
| `total_time_minutes` | optional | 1–240; defaults to 60. |
| `task1` | ✅ | `{ prompt, imageUrl?, modelAnswer? }` |
| `task2` | ✅ | `{ prompt, modelAnswer? }` |

| Task field | Required | Rules |
|---|---|---|
| `prompt` | ✅ | The **full task wording the student reads**, including the "Write at least N words." line. Keep the line breaks. |
| `imageUrl` | Academic Task 1 | Absolute `https://` URL of an already-uploaded chart/diagram (Firebase Storage, `ielts_writing/`). |
| `modelAnswer` | optional | A band 8–9 sample. Teacher-facing reference; it is **not** shown to the student while writing. |

Never author `total_questions` (fixed at 2), `teacherId`, `source`, `status`.

---

## 2. Task 1 — the two variants

**Academic Task 1** (20 minutes, ≥150 words): describe visual information — line graph,
bar chart, pie chart, table, process diagram, or map. The prompt must name what the visual
shows and over what period, and end with the standard instruction:

> Summarise the information by selecting and reporting the main features, and make
> comparisons where relevant.

⚠️ **An LLM cannot create the chart image.** Either supply the model with an already-hosted
`imageUrl`, or ask it for the prompt and *a textual description of the data* so a human can
build the chart, upload it, and paste the URL in. The validator warns when an Academic
Task 1 has no `imageUrl`.

**General Training Task 1** (20 minutes, ≥150 words): a letter — formal, semi-formal or
personal. No image needed. The prompt states the situation and gives three bullet-style
requirements:

```
You recently stayed at a hotel and were unhappy with the service you received.

Write a letter to the hotel manager. In your letter:
• explain why you were staying at the hotel
• describe the problems you experienced
• say what action you would like the manager to take

Write at least 150 words.
You do NOT need to write any addresses.
Begin your letter as follows: Dear Sir or Madam,
```

---

## 3. Task 2 — the essay (40 minutes, ≥250 words)

Identical for Academic and General Training. Use one of the five real question forms:

| Form | Instruction line |
|---|---|
| Opinion | *To what extent do you agree or disagree?* |
| Discussion | *Discuss both these views and give your own opinion.* |
| Advantages / disadvantages | *Do the advantages outweigh the disadvantages?* |
| Problem / solution | *What problems does this cause and what measures could be taken?* |
| Two-part | *Why is this happening? Is it a positive or a negative development?* |

Rules for a good Task 2 prompt:
- One clear statement of the position/situation, then the instruction line, then
  "Write at least 250 words."
- Topic must be arguable by a general audience with no specialist knowledge (education,
  work, technology, environment, health, urban life, media, government spending).
- No culturally-specific or politically loaded premises.

---

## 4. How the submission is graded (context for `modelAnswer`)

Writing attempts are **teacher-graded**, not auto-graded — there is no answer key. The
teacher assigns a band plus four rubric sub-scores:

| Code | Criterion |
|---|---|
| `ta` | Task Achievement (Task 1) / Task Response (Task 2) |
| `cc` | Coherence & Cohesion |
| `lr` | Lexical Resource |
| `gra` | Grammatical Range & Accuracy |

An AI first-pass estimate can be generated per attempt, but the teacher's grade always
wins. A `modelAnswer` that actually demonstrates band-9 features (paraphrased task,
overview paragraph, precise data selection for Task 1; clear position, developed
paragraphs, range of complex structures for Task 2) is what makes this field worth filling.

---

## 5. Minimal valid document

```json
{
  "module": "writing",
  "test_title": "GT Writing Demo",
  "test_category": "general",
  "task1": {
    "prompt": "You recently moved to a new flat and want to tell a friend about it.\n\nWrite a letter to your friend. In your letter:\n• describe the new flat\n• explain why you moved\n• invite your friend to visit\n\nWrite at least 150 words."
  },
  "task2": {
    "prompt": "In many countries young people are leaving rural areas to work in cities.\n\nWhy is this happening? Is it a positive or a negative development?\n\nWrite at least 250 words."
  }
}
```

---

## 6. Before importing

```bash
npm run ielts:verify -- "data/ielts practise/writing/my-paper.json"
```

Then `/admin/ielts` → **Writing** tab → **Import JSON** → paste → **Validate** →
**Import to dataset**.
