"use client";

import { useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { Check, Download, Image as ImageIcon, Layers, Pencil, Trash2, User } from "lucide-react";
import toast from "react-hot-toast";

import LatexRenderer from "@/components/LatexRenderer";
import QuestionPartsPreview from "@/components/QuestionPartsPreview";
import { Button, Card, Chip, IconButton, Skeleton, cn } from "@/components/ui";
import { deleteQuestion, fetchMyQuestionsPage } from "@/services/questionBankService";
import type { NormalizedQuestion } from "@/types/question";

export interface ListLabels {
  title: string;
  subtitle: string;
  justCreated: string;
  empty: string;
  fetch: string;
  fetchMore: string;
  noMore: string;
  loadFailed: string;
  deleted: string;
  deleteFailed: string;
  confirmDelete: string;
  edit: string;
  correctedBy: string;
  correctIs: string;
  imageOnly: string;
  count: string;
}

interface Props {
  creatorId: string;
  /** Created in THIS session — shown with no Firestore read at all. */
  sessionQuestions: NormalizedQuestion[];
  onEdit: (q: NormalizedQuestion) => void;
  /** So the page can drop a question from its session list when it's deleted. */
  onDeleted: (id: string) => void;
  labels: ListLabels;
  /** Narrows what the bank shows — the block builder passes `q => q.isBlock`. */
  filter?: (q: NormalizedQuestion) => boolean;
}

const PAGE_SIZE = 10;

/**
 * The teacher's bank, on demand.
 *
 * ⚠️ It does NOT read Firestore on mount, and not after a save either. Opening
 * the builder costs zero reads: the question you just created is handed over
 * in-memory (`sessionQuestions`). Firestore is only touched when the teacher
 * presses "load 10", and then exactly 10 documents at a time.
 */
export default function CreatedQuestionsList({ creatorId, sessionQuestions, onEdit, onDeleted, labels, filter }: Props) {
  const [fetched, setFetched] = useState<NormalizedQuestion[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPage = async () => {
    if (!creatorId || loading) return;
    setLoading(true);
    try {
      let next = cursor;
      let more = true;
      const found: NormalizedQuestion[] = [];

      // Without a filter this is exactly ONE page of 10. With one (the block
      // builder shows blocks only) a page can hold nothing to show, so pull up
      // to 3 pages per press — otherwise the button looks dead.
      const maxPages = filter ? 3 : 1;
      for (let i = 0; i < maxPages; i++) {
        const page = await fetchMyQuestionsPage(creatorId, PAGE_SIZE, next);
        // A question created this session is already on screen — don't show it twice.
        const seen = new Set([...sessionQuestions, ...fetched, ...found].map((q) => q.id));
        found.push(...page.questions.filter((q) => !seen.has(q.id) && (!filter || filter(q))));
        if (page.cursor) next = page.cursor;
        more = page.hasMore;
        if (found.length > 0 || !more) break;
      }

      setFetched((prev) => [...prev, ...found]);
      setCursor(next);
      setHasMore(more);
    } catch (err) {
      console.error("teacher_questions fetch failed:", err);
      toast.error(labels.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (q: NormalizedQuestion) => {
    if (!window.confirm(labels.confirmDelete)) return;
    setDeletingId(q.id);
    try {
      await deleteQuestion(q);
      setFetched((prev) => prev.filter((x) => x.id !== q.id));
      onDeleted(q.id);
      toast.success(labels.deleted);
    } catch (err) {
      console.error("teacher_questions delete failed:", err);
      toast.error(labels.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  const shown = [...sessionQuestions, ...fetched];
  const hasFetched = fetched.length > 0 || cursor !== null;

  return (
    <Card variant="elevated" className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 shrink-0 rounded-m3-sm bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
            <Layers size={16} />
          </div>
          <div>
            <h2 className="text-[15px] md:text-[17px] font-extrabold text-on-surface leading-tight">
              {labels.title}
              {shown.length > 0 && (
                <span className="ml-2 text-[12px] font-bold text-on-surface-variant">
                  {shown.length} {labels.count}
                </span>
              )}
            </h2>
            <p className="text-[12px] text-on-surface-variant font-medium mt-0.5">{labels.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {shown.length === 0 && !loading && (
          <p className="text-[13px] text-on-surface-variant font-medium text-center py-4">{labels.empty}</p>
        )}

        {shown.map((q, i) => {
          const isSession = i < sessionQuestions.length;
          const topicPath = [q.subject, q.topic, q.subtopic].filter(Boolean).join(" → ");
          const correctLetters = Array.isArray(q.correctAnswer.value) ? q.correctAnswer.value : [q.answer];

          return (
            <div
              key={q.id}
              className={cn(
                "rounded-m3-lg border bg-surface-container-lowest p-3 md:p-4",
                isSession ? "border-primary" : "border-outline-variant",
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="bg-primary-container text-on-primary-container font-black px-2 py-0.5 rounded-m3-sm text-[11px]">
                    {i + 1}
                  </span>
                  {isSession && <Chip size="sm">{labels.justCreated}</Chip>}
                  <Chip size="sm">{q.isBlock ? `${q.type} · ${q.parts.length}` : q.type}</Chip>
                  <Chip size="sm">{q.uiDifficulty}</Chip>
                  {topicPath && <Chip size="sm">{topicPath}</Chip>}
                </div>
                <div className="flex items-center shrink-0">
                  <IconButton aria-label={labels.edit} size="sm" onClick={() => onEdit(q)}>
                    <Pencil />
                  </IconButton>
                  <IconButton
                    aria-label={labels.deleted}
                    size="sm"
                    onClick={() => handleDelete(q)}
                    disabled={deletingId === q.id}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </div>

              {/* Prompt */}
              <div className="text-[13px] md:text-[14px] font-semibold text-on-surface break-words">
                {q.question.uz ? (
                  <LatexRenderer latex={q.question.uz} />
                ) : (
                  <span className="text-on-surface-variant flex items-center gap-1.5">
                    <ImageIcon size={14} /> {labels.imageOnly}
                  </span>
                )}
              </div>

              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.imageUrl}
                  alt=""
                  loading="lazy"
                  className="mt-2 max-h-[160px] w-auto rounded-m3-md border border-outline-variant object-contain bg-surface-container"
                />
              )}

              {q.creatorName && (
                <p className="mt-2 text-[10px] font-medium text-on-surface-variant flex items-center gap-1">
                  <User size={10} /> {q.creatorName}
                </p>
              )}

              {q.correctedBy && (
                <p className="mt-1 text-[10px] font-medium text-on-surface-variant italic flex items-center gap-1">
                  <Pencil size={10} /> {labels.correctedBy} {q.correctedBy}
                </p>
              )}

              {/* A block answers through its parts, not through options/answer. */}
              {q.isBlock ? (
                <div className="mt-3">
                  <QuestionPartsPreview question={q} compact />
                </div>
              ) : q.optionList.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {q.optionList.map((opt) => {
                    const correct = correctLetters.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          "flex items-start gap-2 rounded-m3-sm border px-2 py-1.5 text-[12px]",
                          correct
                            ? "border-primary bg-primary-container text-on-primary-container font-bold"
                            : "border-outline-variant text-on-surface-variant",
                        )}
                      >
                        <span className="font-black shrink-0">{opt.id}</span>
                        <div className="min-w-0 flex-1 break-words">
                          {opt.text.uz && <LatexRenderer latex={opt.text.uz} />}
                          {opt.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={opt.imageUrl}
                              alt=""
                              className="mt-1 max-h-[70px] w-auto rounded-m3-xs border border-outline-variant object-contain bg-surface"
                            />
                          )}
                        </div>
                        {correct && <Check size={14} className="shrink-0 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="font-bold text-on-surface-variant">{labels.correctIs}</span>
                  <span className="rounded-m3-sm border border-primary bg-primary-container text-on-primary-container font-bold px-2 py-1">
                    <LatexRenderer latex={String(q.correctAnswer.value || "")} />
                  </span>
                  {q.correctAnswer.acceptedAnswers.map((alt) => (
                    <span key={alt} className="rounded-m3-sm border border-outline-variant px-2 py-1 text-on-surface-variant">
                      <LatexRenderer latex={alt} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <>
            <Skeleton className="h-24 w-full rounded-m3-lg" />
            <Skeleton className="h-24 w-full rounded-m3-lg" />
          </>
        )}
      </div>

      {/* The ONLY thing that reads Firestore on this page. */}
      <div className="mt-4 flex justify-center">
        {hasMore ? (
          <Button variant="tonal" size="sm" icon={<Download />} loading={loading} onClick={loadPage}>
            {hasFetched ? labels.fetchMore : labels.fetch}
          </Button>
        ) : (
          <p className="text-[12px] font-bold text-on-surface-variant">{labels.noMore}</p>
        )}
      </div>
      
    </Card>
  );
}
