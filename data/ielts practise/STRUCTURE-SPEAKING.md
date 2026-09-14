# IELTS **Speaking** — JSON structure spec

> Self-contained: hand **this file alone** to an LLM and it can produce a valid Speaking
> set. Check it with `npm run ielts:verify -- path/to/file.json`, then import at
> `/admin/ielts` → **Speaking** tab → **Import JSON**.

---

## 1. The whole structure

```json
{
  "test_id": "platform_speaking_01",
  "module": "speaking",
  "test_title": "Speaking Set 1 — Hometown & Travel",
  "total_time_minutes": 14,
  "part1Questions": [
    "Let's talk about your hometown. Where is it?",
    "What do you like most about living there?",
    "Has your hometown changed much since you were a child?",
    "Would you like to live somewhere else in the future? Why?"
  ],
  "part2CueCard": {
    "topic": "Describe a journey that you remember well.",
    "bullets": [
      "where you went",
      "who you travelled with",
      "what happened during the journey",
      "and explain why you remember it well"
    ]
  },
  "part3Questions": [
    "Why do you think people enjoy travelling?",
    "How has tourism changed your country in the last twenty years?",
    "Do you think international travel will become more or less common in future?",
    "What are the disadvantages of mass tourism for local communities?"
  ]
}
```

That is the complete document — there are no other fields.

| Field | Required | Rules |
|---|---|---|
| `module` | ✅ | Literally `"speaking"`. |
| `test_title` | ✅ | ≤150 characters. Name it after the topic — students browse by it. |
| `test_id` | recommended | 3–120 chars, `A–Z a–z 0–9 _ -`, starts alphanumeric. It is the Firestore document id — **re-importing the same id overwrites** that set. |
| `total_time_minutes` | optional | 1–240; defaults to 14 (the real interview is 11–14 minutes). |
| `part1Questions` | ✅ | Non-empty array of strings. 4–6 is the useful range. |
| `part2CueCard.topic` | ✅ | The cue-card task line. |
| `part2CueCard.bullets` | ✅ | Non-empty array of strings — the "You should say:" prompts. 3–4 is standard. |
| `part3Questions` | ✅ | Non-empty array of strings. 4–6 is the useful range. |

`test_category` has no effect on Speaking (there is one band descriptor set). Never author
`total_questions` (computed as `part1Questions.length + 1 + part3Questions.length`),
`teacherId`, `source` or `status`.

---

## 2. What each part has to be

### Part 1 — Introduction and interview (4–5 min)

Short, personal, **concrete** questions about the candidate's own life: home, work/study,
hobbies, daily routine, food, weather, transport, technology, holidays.

- Present-tense and simple past. No abstract or societal questions — those belong in Part 3.
- Group them around **one or two familiar topics**, in a natural order (as above: hometown →
  what you like → change → future).
- Each answerable in 2–3 sentences.

❌ *"What role should government play in urban planning?"* — that is a Part 3 question.

### Part 2 — The long turn / cue card (3–4 min)

One card: 1 minute to prepare, 1–2 minutes to speak.

- `topic` starts with **Describe…** (occasionally *Talk about…*).
- `bullets` are 3 short noun-phrase prompts plus a final **"and explain why/how…"** bullet.
  Write them exactly as they appear on a real card — lower case, no trailing full stops on
  the first three.
- The task must be answerable from ordinary experience (a person, place, object, event,
  activity, or a time when something happened).

```json
"part2CueCard": {
  "topic": "Describe a skill you would like to learn.",
  "bullets": ["what the skill is", "how you would learn it", "how difficult you think it would be",
              "and explain why you want to learn it"]
}
```

### Part 3 — Two-way discussion (4–5 min)

Abstract, societal extensions of the Part 2 topic. This is where band 7+ is separated from
band 6.

- Ask about causes, consequences, comparisons, trends, and predictions — not personal facts.
- Escalate: general/present → comparison/past → speculation/future → evaluation.
- Each question must be answerable without specialist knowledge.
- **Part 3 must extend the Part 2 topic.** A cue card about a journey pairs with tourism,
  transport and cultural exchange — not with, say, school uniforms.

---

## 3. Writing a coherent set

The three parts should feel like one interview:

| | Example set |
|---|---|
| Part 1 topics | hometown, travel habits |
| Part 2 card | *Describe a journey that you remember well.* |
| Part 3 themes | why people travel · tourism's effect on communities · the future of travel |

Language notes:
- British English spelling, natural examiner register, no contractions in written form
  beyond what an examiner would say aloud (`Let's talk about…` is fine).
- One question per string — never bundle two questions into one entry.
- No yes/no-only questions in Part 3; make them open.

---

## 4. How the submission is handled (context)

Speaking attempts are **recorded by the student and graded by a teacher** — there is no
answer key and nothing is auto-marked. The teacher assigns a band and comments. That is why
the JSON carries prompts only.

---

## 5. Minimal valid document

```json
{
  "module": "speaking",
  "test_title": "Speaking Demo — Food",
  "part1Questions": [
    "What kind of food do you usually eat?",
    "Do you prefer eating at home or in restaurants?",
    "Have your eating habits changed in recent years?"
  ],
  "part2CueCard": {
    "topic": "Describe a meal you enjoyed with other people.",
    "bullets": ["what the meal was", "who you ate it with", "where you ate it",
                "and explain why you enjoyed it"]
  },
  "part3Questions": [
    "Why do people in your country like eating together?",
    "How has fast food changed the way families eat?",
    "Do you think traditional cooking will disappear in the future?"
  ]
}
```

---

## 6. Before importing

```bash
npm run ielts:verify -- "data/ielts practise/speaking/my-set.json"
```

Then `/admin/ielts` → **Speaking** tab → **Import JSON** → paste → **Validate** →
**Import to dataset**.
