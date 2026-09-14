"use client";

import { useState } from "react";
import { FolderTree, Layers, ListChecks } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { SUBJECTS, findSubject, findTopic, resolveTopicPath, type TopicPath } from "@/lib/questionTopics";
import { Button, Dialog, Select, cn } from "@/components/ui";

/**
 * Asks the teacher which topic the questions belong to, BEFORE anything is written
 * to `teacher_questions`.
 *
 * Why it exists: an LLM cannot pick a topic from our taxonomy — the AI creators
 * used to write placeholders like `subject: "by_prompt"` straight into the bank.
 * `toQuestionV1()` now throws `InvalidTopicError` unless the path exists in
 * data/question_topics.json, so every creator must come through here first.
 *
 * Two modes: one topic for ALL the questions (the common case), or one per
 * question when a batch spans several subtopics.
 */

const TR = {
  uz: {
    title: "Mavzuni tanlang",
    desc: "Savollar bazaga qaysi mavzu ostida saqlansin? Barcha savollar mavzuga biriktirilishi shart.",
    modeAll: "Barchasi uchun bitta mavzu",
    modeEach: "Har bir savol uchun alohida",
    subject: "Fan",
    topic: "Mavzu",
    subtopic: "Ichki mavzu",
    choose: "Tanlang...",
    applyToRest: "Qolganlariga ham qo'llash",
    question: "Savol",
    missing: (n: number) => `${n} ta savolga mavzu tanlanmagan.`,
    cancel: "Bekor qilish",
    confirm: "Saqlash",
  },
  en: {
    title: "Choose the topic",
    desc: "Which topic should these questions be filed under? Every question must be assigned to one.",
    modeAll: "One topic for all",
    modeEach: "Per question",
    subject: "Subject",
    topic: "Topic",
    subtopic: "Subtopic",
    choose: "Choose...",
    applyToRest: "Apply to the rest",
    question: "Question",
    missing: (n: number) => `${n} question(s) still have no topic.`,
    cancel: "Cancel",
    confirm: "Save",
  },
  ru: {
    title: "Выберите тему",
    desc: "Под какой темой сохранить вопросы в базу? Каждому вопросу нужна тема.",
    modeAll: "Одна тема для всех",
    modeEach: "Для каждого вопроса",
    subject: "Предмет",
    topic: "Тема",
    subtopic: "Подтема",
    choose: "Выберите...",
    applyToRest: "Применить к остальным",
    question: "Вопрос",
    missing: (n: number) => `У ${n} вопрос(ов) нет темы.`,
    cancel: "Отмена",
    confirm: "Сохранить",
  },
};

/** The ids being edited for one row (names are resolved from the taxonomy on confirm). */
interface Ids {
  subjectId: string;
  topicId: string;
  subtopicId: string;
}

const EMPTY: Ids = { subjectId: "", topicId: "", subtopicId: "" };

interface Props {
  open: boolean;
  /** Short labels — usually the question text, truncated. Length drives the rows. */
  questions: string[];
  isSaving?: boolean;
  onClose: () => void;
  /** One resolved path per question, in the same order. */
  onConfirm: (paths: TopicPath[]) => void;
}

export default function TopicAssignModal({ open, questions, isSaving, onClose, onConfirm }: Props) {
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;

  const [mode, setMode] = useState<"all" | "each">("all");
  const [shared, setShared] = useState<Ids>(EMPTY);
  const [perQuestion, setPerQuestion] = useState<Ids[]>(() => questions.map(() => EMPTY));

  // The question list can change between openings (regenerate, remove one…), so
  // fall back to a blank row per question whenever the lengths drift apart.
  const rows = perQuestion.length === questions.length ? perQuestion : questions.map(() => EMPTY);

  const resolved: (TopicPath | null)[] =
    mode === "all"
      ? questions.map(() => resolveTopicPath(shared.subjectId, shared.topicId, shared.subtopicId))
      : rows.map((r) => resolveTopicPath(r.subjectId, r.topicId, r.subtopicId));

  const missing = resolved.filter((p) => !p).length;
  const canConfirm = missing === 0;

  const setRow = (index: number, ids: Ids) =>
    setPerQuestion(rows.map((r, i) => (i === index ? ids : r)));

  const applyToRest = (index: number) => setPerQuestion(rows.map((r, i) => (i > index ? rows[index] : r)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      description={t.desc}
      icon={<FolderTree />}
      className="max-w-2xl"
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={isSaving}>{t.cancel}</Button>
          <Button
            variant="filled"
            loading={isSaving}
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(resolved as TopicPath[])}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([
          { key: "all" as const, label: t.modeAll, icon: <Layers size={14} /> },
          { key: "each" as const, label: t.modeEach, icon: <ListChecks size={14} /> },
        ]).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              "m3-interactive flex items-center justify-center gap-1.5 rounded-m3-md border px-3 py-2 text-[12px] font-bold transition-colors",
              mode === m.key
                ? "border-primary bg-primary-container text-on-primary-container"
                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-state-hover",
            )}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {mode === "all" ? (
        <TopicSelects labels={t} value={shared} onChange={setShared} />
      ) : (
        <div className="max-h-[45vh] overflow-y-auto custom-scrollbar space-y-3 pr-1">
          {questions.map((text, i) => (
            <div key={i} className="rounded-m3-md border border-outline-variant p-3">
              <p className="text-[12px] font-bold text-on-surface-variant mb-2 line-clamp-2">
                {t.question} {i + 1}: <span className="font-medium text-on-surface">{text}</span>
              </p>
              <TopicSelects labels={t} value={rows[i]} onChange={(ids) => setRow(i, ids)} compact />
              {i < questions.length - 1 && (
                <Button variant="text" size="sm" className="mt-1" onClick={() => applyToRest(i)}>
                  {t.applyToRest}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {missing > 0 && (
        <p className="mt-3 text-[12px] font-bold text-error">{t.missing(missing)}</p>
      )}
    </Dialog>
  );
}

function TopicSelects({
  labels, value, onChange, compact,
}: {
  labels: typeof TR.uz;
  value: Ids;
  onChange: (ids: Ids) => void;
  compact?: boolean;
}) {
  const subject = findSubject(value.subjectId);
  const topic = findTopic(value.subjectId, value.topicId);

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3 gap-3")}>
      <Select
        label={labels.subject}
        value={value.subjectId}
        onChange={(e) => onChange({ subjectId: e.target.value, topicId: "", subtopicId: "" })}
      >
        <option value="">{labels.choose}</option>
        {SUBJECTS.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>

      <Select
        label={labels.topic}
        value={value.topicId}
        disabled={!subject}
        onChange={(e) => onChange({ ...value, topicId: e.target.value, subtopicId: "" })}
      >
        <option value="">{labels.choose}</option>
        {(subject?.topics || []).map((tp) => (
          <option key={tp.id} value={tp.id}>{tp.name}</option>
        ))}
      </Select>

      <Select
        label={labels.subtopic}
        value={value.subtopicId}
        disabled={!topic}
        onChange={(e) => onChange({ ...value, subtopicId: e.target.value })}
      >
        <option value="">{labels.choose}</option>
        {(topic?.subtopics || []).map((st) => (
          <option key={st.id} value={st.id}>{st.name}</option>
        ))}
      </Select>
    </div>
  );
}
