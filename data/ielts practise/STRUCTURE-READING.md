# IELTS **Reading** — JSON structure spec

> **Using this with an LLM?** Hand over **this file *and*
> [STRUCTURE-QUESTION-TYPES.md](STRUCTURE-QUESTION-TYPES.md)**, then ask for a complete
> paper. Everything the model needs is in those two files. Check the result with
> `npm run ielts:verify -- path/to/file.json` before importing it at `/admin/ielts`.

---

## 1. The envelope

```json
{
  "test_id": "platform_reading_academic_03",
  "module": "reading",
  "test_title": "Academic Reading Practice Test 3",
  "test_category": "academic",
  "total_time_minutes": 60,
  "passages": [ /* 1–3 passage objects */ ]
}
```

| Field | Required | Rules |
|---|---|---|
| `module` | ✅ | Literally `"reading"`. |
| `test_title` | ✅ | ≤150 characters. This is the library card title. |
| `test_id` | recommended | 3–120 chars, `A–Z a–z 0–9 _ -`, starts alphanumeric. It becomes the Firestore document id, so **re-importing the same id overwrites** that test instead of duplicating it. Omit it and a random id is derived from the title. |
| `test_category` | recommended | `"academic"` or `"general"`. It selects the **band table** — Academic and General Training convert raw scores differently. Missing ⇒ Academic. |
| `total_time_minutes` | optional | 1–240. Defaults to 60. |
| `passages` | ✅ | 1–3 passages. A full paper has **exactly 3**. |

Never author `total_questions`, `start_question`, `end_question`, `teacherId`, `source`,
`status` or `answers_split` — the import computes or owns all of them.

---

## 2. A passage

```json
{
  "title": "The rise and fall of the water clock",
  "subtitle": "How antiquity measured the hours",
  "instruction": "You should spend about 20 minutes on Questions 1–13.",
  "difficulty": "medium",
  "blocks": [
    { "label": "A", "content": "First paragraph text…" },
    { "label": "B", "content": "Second paragraph text…" }
  ],
  "questions": [ /* question blocks — see STRUCTURE-QUESTION-TYPES.md */ ]
}
```

| Field | Required | Rules |
|---|---|---|
| `title` | ✅ | Passage headline. |
| `subtitle` | optional | Italic strap-line under the title. Defaults to `""`. |
| `instruction` | optional | The "You should spend about 20 minutes…" line. |
| `difficulty` | optional | `"easy"` \| `"medium"` \| `"hard"`. Defaults to `"medium"`. |
| `blocks` | ✅ | The passage text, one entry per paragraph. |
| `blocks[].label` | see below | Paragraph letter (`"A"`, `"B"`, …). |
| `blocks[].content` | ✅ | The paragraph itself, as plain text. |
| `questions` | ✅ | Non-empty array of question blocks. |

**Paragraph labels.** Use `"A"`, `"B"`, `"C"`… whenever the passage carries any
`matching_headings` or `matching_paragraph_information` block — those question types
reference the labels, and the import rejects a `target_paragraph` that matches nothing.
For a passage with no paragraph-referencing questions, `label` may be `""`.

`passage_number`, `id` and `word_count` are computed — don't author them.

---

## 3. Cambridge-shaped paper (what "good" looks like)

| | Passage 1 | Passage 2 | Passage 3 |
|---|---|---|---|
| Questions | 13 | 13 | 14 |
| Words | 700–950 | 750–1000 | 800–1100 |
| Difficulty | `easy` | `medium` | `hard` |
| Register | general interest / descriptive | semi-academic, some argument | academic argument, abstract |

- **40 questions total, 60 minutes.** Any other total still imports, but bands become
  extrapolated and are labelled "indicative" to the student.
- **Mix the question types.** A realistic paper uses 5–8 different types; 2–4 blocks per
  passage. Don't use the same type twice in one passage unless the real exam does.
- Instructions must carry the real question range: `"Questions 14–20"`. Compute that range
  **after** accounting for `list_selection` blocks (§2 of the question-types file).
- Type frequency in the real exam, roughly: `true_false_not_given` (or YES/NO/NOT GIVEN)
  and `matching_headings` are the most common, then the completion family
  (`summary_completion`, `sentence_completion`, `table_completion`, `short_answer`), then
  `matching_paragraph_information` / `matching_features` / `multiple_choice`, and finally
  `list_selection` (usually 1–2 per paper).

---

## 4. Writing the passages

- **Original prose only.** Cambridge IELTS texts are copyrighted — never paste them into
  the dataset. Write new passages to the same specification.
- Neutral, information-dense, journalistic-academic register. No second person, no jokes.
- Every answer must be **findable in the text** and defensible against the other options.
- `NOT GIVEN` items must be genuinely absent, not merely unstated in that wording — the
  most common quality failure in generated papers.
- Distractor headings must not paraphrase the correct heading of another paragraph.
- Fill `passage_reference` on every row you can: it powers the "Locate" button on the
  student review page and is your own proof that the answer is really in the text. It must
  be a **verbatim substring** of some `blocks[].content`.

---

## 5. Minimal but complete example

```json
{
  "test_id": "platform_reading_academic_demo",
  "module": "reading",
  "test_title": "Reading Demo",
  "test_category": "academic",
  "total_time_minutes": 60,
  "passages": [
    {
      "title": "Hedgerows",
      "subtitle": "Britain's oldest living infrastructure",
      "instruction": "You should spend about 20 minutes on Questions 1–5.",
      "difficulty": "easy",
      "blocks": [
        { "label": "A", "content": "Hedgerows were planted as boundaries long before barbed wire existed…" },
        { "label": "B", "content": "Ecologists now value them chiefly as wildlife corridors…" }
      ],
      "questions": [
        {
          "type": "true_false_not_given",
          "instructions": "Questions 1–2\nDo the following statements agree with the information given in the passage?",
          "questions": [
            { "question_number": 1, "statement": "Hedgerows predate barbed wire.",
              "correct_answer": "TRUE",
              "passage_reference": "planted as boundaries long before barbed wire existed" },
            { "question_number": 2, "statement": "Most hedgerows are now protected by law.",
              "correct_answer": "NOT GIVEN" }
          ]
        },
        {
          "type": "list_selection",
          "instructions": "Questions 3–4\nChoose TWO letters, A–E.",
          "questions": [
            {
              "question_number": 3,
              "question_text": "Which TWO functions of hedgerows are mentioned?",
              "options": [
                { "id": "A", "text": "marking boundaries" },
                { "id": "B", "text": "producing timber" },
                { "id": "C", "text": "sheltering wildlife" },
                { "id": "D", "text": "preventing flooding" },
                { "id": "E", "text": "screening roads" }
              ],
              "correct_answer": ["A", "C"]
            }
          ]
        },
        {
          "type": "sentence_completion",
          "instructions": "Question 5\nComplete the sentence below.\nChoose NO MORE THAN TWO WORDS from the passage.",
          "word_limit": 2,
          "options": null,
          "questions": [
            { "question_number": 5,
              "sentence": "Ecologists chiefly value hedgerows as [1].",
              "correct_answer": ["wildlife corridors"],
              "passage_reference": "value them chiefly as wildlife corridors" }
          ]
        }
      ]
    }
  ]
}
```

Note how Q3's `list_selection` consumes **Q3 and Q4**, so the next block starts at Q5.

---

## 6. Before importing

```bash
npm run ielts:verify -- "data/ielts practise/reading/my-paper.json"
```

Then `/admin/ielts` → **Reading** tab → **Import JSON** → paste → **Validate** →
**Import to dataset**. The importer runs the identical checks and refuses to write a paper
with any error.
