"use client";

import { useCallback, useMemo, useState } from "react";
import {
  collection, getDocs, limit, orderBy, query, where, type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Check, Database, Layers, Plus, Search } from "lucide-react";

import { db } from "@/lib/firebase";
import LatexRenderer from "@/components/LatexRenderer";
import { getMathTopics } from "@/lib/Mathstructure";
import { fetchMyQuestionsPage } from "@/services/questionBankService";
import { bankQuizItem, teacherQuizItem } from "@/lib/RASCHquiz";
import { Button, Select, cn } from "@/components/ui";
import type { DifficultyId, QuestionDoc } from "@/types/Math";
import {
  AI_CREATION_METHODS, MANUAL_CREATION_METHODS, IMAGE_CREATION_METHODS,
  isAiWritten, isClosedQuestion, type NormalizedQuestion,
} from "@/types/question";
import type { RaschQuizItem } from "@/types/TeacherRaschQuiz";

/**
 * The two pools a Rasch paper can be built from.
 *
 * `MyBankPicker` — the teacher's own `teacher_questions`, and the default: a
 * paper is normally built from questions a teacher wrote.
 * `BankPicker` — the bulk-imported national bank `questions1`, for topping up
 * the sections a teacher has not written for yet. Without it, publishing needs
 * 45 own questions before the button ever unlocks.
 *
 * Both are ON-DEMAND: nothing is read when a tab mounts, only when the teacher
 * presses the load button, and then exactly one page at a time. That is the same
 * rule the question bank follows (docs/QUESTIONS.md) and the reason opening the
 * builder is free.
 */

const PAGE = 10;

/**
 * How much room the paper still has in ONE blueprint row — a dimension × test
 * type (`BLUEPRINT_SECTION_TARGET`), made visible where the picking happens, so
 * a teacher sees "Geometriya · Y-2 3/3" before they pick instead of being
 * refused after. ⚠️ Per ROW, not per dimension: Geometriya needs 7 Y-1, 3 Y-2
 * and 4 O, and 14 closed geometry questions is a different paper. The builder
 * owns the arithmetic; the pickers only render it.
 */
export interface TopicRoom {
  /** The row's name in the teacher's language, e.g. "Geometriya · Y-2". */
  name: string;
  have: number;
  want: number;
  /**
   * The protocol has NO row for this question at all — an open question from a
   * dimension with no O row. Different from "full": no amount of removing other
   * questions makes room, so the row says so and the Add stays dead.
   */
  unavailable?: boolean;
}

const isFull = (room: TopicRoom | null | undefined) => !!room && room.have >= room.want;

export interface PickerStrings {
  load: string;
  loadMore: string;
  none: string;
  added: string;
  add: string;
  block: string;
  imageOnly: string;
  full: string;
  /** MyBankPicker only — the closed/open and provenance filters. */
  kind: string;
  kindAll: string;
  kindClosed: string;
  kindOpen: string;
  source: string;
  srcAi: string;
  srcMine: string;
  /** BankPicker only — the questions1 chapter/difficulty controls. */
  subject: string;
  chapter: string;
  difficulty: string;
  easy: string; medium: string; hard: string;
  reads: string;
  /** Quota readout: `{name} {have}/{want}` and the "this section is done" note. */
  quotaFull: string;
  quotaLeft: string;
  /** Add-button label when the protocol has no row for this question. */
  quotaNoSlot: string;
}

/** One row of either picker — the preview, and the add control. */
function PickRow({
  text, meta, imageUrl, isBlock, blockLabel, picked, disabled, addLabel, addedLabel, onAdd, room,
  fullLabel, noSlotLabel,
}: {
  text: string;
  meta: string;
  imageUrl?: string | null;
  isBlock?: boolean;
  blockLabel?: string;
  picked: boolean;
  disabled: boolean;
  addLabel: string;
  addedLabel: string;
  onAdd: () => void;
  /** The quota of the dimension THIS question files into, or null if unknown. */
  room?: TopicRoom | null;
  fullLabel: string;
  /** Shown instead of `fullLabel` when the paper has no row for this question. */
  noSlotLabel: string;
}) {
  // A question whose row is already at quota cannot join the paper, so the row
  // says so instead of letting the click bounce off a toast. An ALREADY picked
  // row is exempt: it is part of what filled the quota.
  const quotaBlocked = !picked && isFull(room);

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-m3-md border p-3 transition-colors",
      picked ? "border-success bg-success-container/40" : "border-outline-variant bg-surface-container-lowest",
      quotaBlocked && "opacity-60",
    )}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-m3-xs bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
            {meta}
          </span>
          {isBlock && (
            <span className="flex items-center gap-1 rounded-m3-xs bg-primary-container px-2 py-0.5 text-[10px] font-black uppercase text-on-primary-container">
              <Layers size={10} /> {blockLabel}
            </span>
          )}
          {room && (
            <span
              className={cn(
                "rounded-m3-xs px-2 py-0.5 text-[10px] font-black uppercase tabular-nums",
                room.unavailable
                  ? "bg-error-container text-on-error-container"
                  : isFull(room)
                    ? "bg-success-container text-on-success-container"
                    : "bg-surface-container text-on-surface-variant",
              )}
            >
              {room.unavailable ? room.name : `${room.name} ${room.have}/${room.want}`}
            </span>
          )}
        </div>
        <div className="line-clamp-2 text-[13px] font-medium text-on-surface">
          <LatexRenderer latex={text} />
        </div>
      </div>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" className="h-14 w-14 flex-none rounded-m3-sm border border-outline-variant object-cover" />
      )}

      <Button
        size="sm"
        variant={picked ? "text" : "tonal"}
        icon={picked ? <Check /> : <Plus />}
        disabled={picked || disabled || quotaBlocked}
        onClick={onAdd}
        className="flex-none"
      >
        {picked ? addedLabel : room?.unavailable ? noSlotLabel : quotaBlocked ? fullLabel : addLabel}
      </Button>
    </div>
  );
}

// ─── the national bank (questions1) ──────────────────────────────────────────

const DIFFICULTIES: DifficultyId[] = [1, 2, 3];

/**
 * Picks from `questions1` by chapter and difficulty.
 *
 * ⚠️ The query is exactly `topicId + chapterId + difficultyId` ordered by `rand`
 * — the SAME single composite index the exam sampler rides
 * (firestore.indexes.json). Adding a `subtopicId` equality here, or ordering by
 * anything else, silently demands a second index. The first page starts at a
 * random `rand` threshold so two teachers building a paper on the same chapter
 * do not get the same ten questions; "load more" walks on from there.
 *
 * A document written before `npm run backfill:rand` has no `rand` field and is
 * therefore absent from that index — invisible here, exactly as in the exam.
 */
export function BankPicker({
  t, picked, disabled, onAdd, roomForItem, roomForChapter,
}: {
  t: PickerStrings;
  picked: Set<string>;
  disabled: boolean;
  onAdd: (item: RaschQuizItem) => void;
  roomForItem: (item: RaschQuizItem) => TopicRoom | null;
  /**
   * Chapter + difficulty → the blueprint ROW's quota, resolved WITHOUT reading a
   * question. ⚠️ The difficulty is part of it: the same geometry chapter feeds
   * `geometry-y1` at medium and `geometry-y2` at hard.
   */
  roomForChapter: (topicId: string, chapterId: string, difficultyId: DifficultyId) => TopicRoom | null;
}) {
  const topics = useMemo(() => getMathTopics(), []);
  const [topicId, setTopicId] = useState(topics[0]?.topicId ?? "1");
  const [chapterId, setChapterId] = useState(topics[0]?.chapters[0]?.chapterId ?? "01");
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(2);

  const [rows, setRows] = useState<QuestionDoc[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [reads, setReads] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const chapters = topics.find((tp) => tp.topicId === topicId)?.chapters ?? [];
  const chapterRoom = roomForChapter(topicId, chapterId, difficultyId);

  const load = useCallback(async (fresh: boolean) => {
    setLoading(true);
    try {
      const after = fresh ? Math.random() : cursor ?? Math.random();
      const snap = await getDocs(query(
        collection(db, "questions1"),
        where("topicId", "==", topicId),
        where("chapterId", "==", chapterId),
        where("difficultyId", "==", difficultyId),
        where("rand", ">=", after),
        orderBy("rand"),
        limit(PAGE),
      ));

      const docs = snap.docs.map((d) => ({ ...(d.data() as QuestionDoc), id: d.id }));
      setReads((n) => (fresh ? snap.size : n + snap.size));
      setRows((prev) => (fresh ? docs : [...prev, ...docs]));
      setCursor(docs.length > 0 ? (docs[docs.length - 1].rand ?? null) : null);
      // Short page ⇒ the window above the threshold is spent. We deliberately do
      // NOT wrap around to the bottom of the range: this is a browsing UI, and a
      // silent wrap would show the teacher questions they already scrolled past.
      setExhausted(docs.length < PAGE);
    } finally {
      setLoading(false);
    }
  }, [topicId, chapterId, difficultyId, cursor]);

  const reset = (fn: () => void) => { fn(); setRows([]); setCursor(null); setExhausted(false); setReads(0); };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t.subject}
          value={topicId}
          onChange={(e) => reset(() => {
            const next = e.target.value;
            setTopicId(next);
            setChapterId(topics.find((tp) => tp.topicId === next)?.chapters[0]?.chapterId ?? "01");
          })}
        >
          {topics.map((tp) => <option key={tp.topicId} value={tp.topicId}>{tp.name}</option>)}
        </Select>

        {/* Every chapter carries the quota of the DIMENSION it files into, so a
            teacher can see which sections still need questions before spending a
            single read. Several chapters share one dimension — they show the
            same numbers on purpose, because they compete for the same slots. */}
        <Select
          label={t.chapter}
          value={chapterId}
          onChange={(e) => reset(() => setChapterId(e.target.value))}
        >
          {chapters.map((c) => {
            const room = roomForChapter(topicId, c.chapterId, difficultyId);
            const suffix = room ? ` — ${room.have}/${room.want}${isFull(room) ? ` ${t.quotaFull}` : ""}` : "";
            return <option key={c.chapterId} value={c.chapterId}>{c.chapterId}. {c.name}{suffix}</option>;
          })}
        </Select>
      </div>

      {chapterRoom && (
        <p
          className={cn(
            "rounded-m3-sm px-3 py-2 text-[11px] font-bold",
            isFull(chapterRoom)
              ? "bg-success-container text-on-success-container"
              : "bg-surface-container text-on-surface-variant",
          )}
        >
          {chapterRoom.name}: {chapterRoom.have}/{chapterRoom.want} ·{" "}
          {isFull(chapterRoom) ? t.quotaFull : `${t.quotaLeft} ${chapterRoom.want - chapterRoom.have}`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.difficulty}</span>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => reset(() => setDifficultyId(d))}
            className={cn(
              "m3-interactive rounded-m3-sm px-3 py-1.5 text-[11px] font-bold transition-colors",
              difficultyId === d
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant",
            )}
          >
            {d === 1 ? t.easy : d === 2 ? t.medium : t.hard}
          </button>
        ))}

        <Button size="sm" className="ml-auto" icon={<Search />} loading={loading} onClick={() => load(true)}>
          {t.load}
        </Button>
      </div>

      {reads > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
          <Database size={11} /> {reads} {t.reads}
        </p>
      )}

      {rows.length === 0 && !loading && (
        <p className="py-6 text-center text-[12px] font-medium text-on-surface-variant">{t.none}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((q) => {
          // The item is built anyway on add; building it here too is a pure
          // object construction and gives the row its real dimension.
          const item = bankQuizItem(q);
          return (
            <PickRow
              key={q.id}
              text={q.question?.uz || q.question?.ru || q.question?.en || ""}
              meta={`${q.chapter} · ${q.difficulty}`}
              picked={picked.has(q.id)}
              disabled={disabled}
              addLabel={t.add}
              addedLabel={t.added}
              onAdd={() => onAdd(item)}
              room={roomForItem(item)}
              fullLabel={t.quotaFull}
              noSlotLabel={t.quotaNoSlot}
            />
          );
        })}
      </div>

      {rows.length > 0 && !exhausted && (
        <Button variant="outlined" loading={loading} onClick={() => load(false)}>{t.loadMore}</Button>
      )}
    </div>
  );
}

// ─── the teacher's own bank (teacher_questions) ──────────────────────────────

/** What the own-bank picker shows: everything, only closed, only typed. */
export type BankKind = "all" | "closed" | "open";

const KINDS: BankKind[] = ["all", "closed", "open"];

const matchesKind = (kind: BankKind, q: NormalizedQuestion) =>
  kind === "all" ? true : kind === "closed" ? isClosedQuestion(q) : !isClosedQuestion(q);

/** Who wrote it: anyone, a machine (prompt / topic / image), or the teacher by hand. */
export type BankSource = "all" | "ai" | "mine";

const SOURCES: BankSource[] = ["all", "ai", "mine"];

/**
 * Provenance → the `creationMethod in […]` list, or `undefined` for no filter.
 *
 * ⚠️ A question whose method is empty or unrecognized (an old document) matches
 * NEITHER list, so it is only reachable under "Hammasi". That is deliberate:
 * guessing would file somebody's AI question under "written by me".
 */
const methodsFor = (source: BankSource): string[] | undefined =>
  source === "ai" ? [...AI_CREATION_METHODS, ...IMAGE_CREATION_METHODS]
    : source === "mine" ? MANUAL_CREATION_METHODS
    : undefined;

/**
 * Picks from the teacher's own `teacher_questions`, newest first.
 *
 * Reuses `fetchMyQuestionsPage`, so it rides the existing `creatorId + createdAt
 * desc` index and normalizes both v1 and legacy documents at the boundary —
 * blocks, images and typed answers all arrive already handled.
 *
 * Two filters, and they are filtered in DIFFERENT places on purpose:
 *
 * - **Provenance** (AI / written by me) is server-side — `creationMethod in […]`
 *   rides an index that already exists, so a filtered page still bills 10
 *   documents and shows all 10.
 * - **Closed / typed** is client-side. In Firestore it would mean a
 *   `type in […]` equality beside `creatorId` + `orderBy createdAt`, i.e. a
 *   second composite index, and it still could not express "a `multi_part` block
 *   whose every part carries options". ⚠️ The cost is that a page of 10 can hold
 *   nothing to show, so a press then pulls up to 3 pages (30 documents) before
 *   giving up — the read counter says what it actually spent.
 */
export function MyBankPicker({
  t, uid, picked, disabled, onAdd, roomForItem,
}: {
  t: PickerStrings;
  uid: string;
  picked: Set<string>;
  disabled: boolean;
  onAdd: (item: RaschQuizItem) => void;
  roomForItem: (item: RaschQuizItem) => TopicRoom | null;
}) {
  const [kind, setKind] = useState<BankKind>("all");
  const [source, setSource] = useState<BankSource>("all");
  const [rows, setRows] = useState<NormalizedQuestion[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reads, setReads] = useState(0);

  const load = async (fresh: boolean) => {
    setLoading(true);
    try {
      let next = fresh ? null : cursor;
      let more = true;
      let read = 0;
      const found: NormalizedQuestion[] = [];

      const methods = methodsFor(source);
      const maxPages = kind === "all" ? 1 : 3;
      for (let i = 0; i < maxPages; i++) {
        const page = await fetchMyQuestionsPage(uid, PAGE, next, methods);
        read += page.questions.length;
        found.push(...page.questions.filter((q) => matchesKind(kind, q)));
        if (page.cursor) next = page.cursor;
        more = page.hasMore;
        if (found.length > 0 || !more) break;
      }

      setRows((prev) => (fresh ? found : [...prev, ...found]));
      setCursor(next);
      setHasMore(more);
      setReads((n) => (fresh ? read : n + read));
      setTouched(true);
    } finally {
      setLoading(false);
    }
  };

  // Changing either filter re-walks the bank from the newest question: the
  // cursor it stopped at belongs to a different set of rows.
  const reset = (fn: () => void) => {
    fn();
    setRows([]);
    setCursor(null);
    setHasMore(true);
    setTouched(false);
    setReads(0);
  };

  const chip = (active: boolean) => cn(
    "m3-interactive rounded-m3-sm px-3 py-1.5 text-[11px] font-bold transition-colors",
    active
      ? "bg-primary text-on-primary"
      : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.kind}</span>
        {KINDS.map((k) => (
          <button key={k} onClick={() => reset(() => setKind(k))} className={chip(kind === k)}>
            {k === "all" ? t.kindAll : k === "closed" ? t.kindClosed : t.kindOpen}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.source}</span>
        {SOURCES.map((s) => (
          <button key={s} onClick={() => reset(() => setSource(s))} className={chip(source === s)}>
            {s === "all" ? t.kindAll : s === "ai" ? t.srcAi : t.srcMine}
          </button>
        ))}

        <Button size="sm" className="ml-auto" icon={<Search />} loading={loading} onClick={() => load(true)}>
          {t.load}
        </Button>
      </div>

      {reads > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
          <Database size={11} /> {reads} {t.reads}
        </p>
      )}

      {touched && rows.length === 0 && !loading && (
        <p className="py-6 text-center text-[12px] font-medium text-on-surface-variant">{t.none}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((q) => {
          // Same reasoning as the bank picker: a pure build, and it is the only
          // way to know which dimension this question would land in.
          const item = teacherQuizItem(q);
          return (
            <PickRow
              key={q.id}
              text={q.question?.uz || q.question?.ru || q.question?.en || (q.imageUrl ? t.imageOnly : "")}
              meta={[
                q.topic || q.subject,
                q.difficulty,
                isClosedQuestion(q) ? t.kindClosed : t.kindOpen,
                // Only AI is called out — a question with no recognizable method is
                // not evidence that the teacher wrote it by hand.
                ...(isAiWritten(q.creationMethod) ? [t.srcAi] : []),
              ].join(" · ")}
              imageUrl={q.imageUrl}
              isBlock={q.isBlock}
              blockLabel={`${t.block} · ${q.parts.length}`}
              picked={picked.has(q.id)}
              disabled={disabled}
              addLabel={t.add}
              addedLabel={t.added}
              onAdd={() => onAdd(item)}
              room={roomForItem(item)}
              fullLabel={t.quotaFull}
              noSlotLabel={t.quotaNoSlot}
            />
          );
        })}
      </div>

      {rows.length > 0 && hasMore && (
        <Button variant="outlined" loading={loading} onClick={() => load(false)}>{t.loadMore}</Button>
      )}
    </div>
  );
}
