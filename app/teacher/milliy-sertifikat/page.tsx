"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight, Atom, BadgeCheck, BookText, FlaskConical, Info, KeyRound, Languages, Sigma,
} from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { MILLIY_SUBJECTS, subjectName, type MilliySubject } from "@/lib/MilliyQuiz";
import { Card, PageHeader, StatusChip, cn } from "@/components/ui";
import type { Lang } from "@/types/Math";

/**
 * Milliy sertifikat — the subject hub.
 *
 * ⚠️ **Maths is NOT a new subsystem.** The Milliy sertifikat maths paper is
 * exactly the paper `app/teacher/milliy-sertifikat/math` already builds: the 45-question
 * DTM protocol (Y-1 #1–32, Y-2 #33–40, O #41–45) is what `EXAM_BLUEPRINT`
 * encodes — see the header of [lib/Examblueprint.ts](../../../lib/Examblueprint.ts).
 * So the Matematika card ROUTES there rather than duplicating it; the 6-digit
 * code, the student runner and the results page all come along for free.
 * Contract: docs/RASCH_QUIZ.md.
 *
 * Every other subject is served by the generic subject-paper subsystem
 * (docs/MILLIY_QUIZ.md). ⚠️ **This page invents nothing** — which subjects exist,
 * what they are called and where they lead all come from `MILLIY_SUBJECTS`, so a
 * subject can never be live here and missing from the student hub.
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    title: "Milliy sertifikat",
    subtitle: "Fan tanlang va shu fandan variant tuzing.",
    about: "Har bir variant o'zining 6 xonali maxfiy kodiga ega — o'quvchi shu kod bilan ochadi va natijasi darhol hisoblanadi. Matematika varianti DTM protokoli bo'yicha 45 ta savoldan iborat; boshqa fanlarda savollar sonini o'zingiz belgilaysiz.",
    ready: "Tayyor",
    soon: "Tez kunda",
    build: "Variant tuzish",
    notReady: "Bu fan hali tayyor emas",
    mathHint: "DTM protokoli · 45 ta savol (Y-1, Y-2, O)",
    genericHint: "Savollarni o'z bazangizdan tanlang · uzunligini o'zingiz belgilaysiz",
    soonHint: "Savol bazasi va variant tuzuvchi hali qo'shilmagan.",
  },
  ru: {
    title: "Milliy sertifikat",
    subtitle: "Выберите предмет и составьте вариант по нему.",
    about: "У каждого варианта свой 6-значный секретный код — ученик открывает его этим кодом, результат считается сразу. Вариант по математике — 45 вопросов по протоколу DTM; по остальным предметам длину варианта задаёте вы.",
    ready: "Готово",
    soon: "Скоро",
    build: "Составить вариант",
    notReady: "Этот предмет пока не готов",
    mathHint: "Протокол DTM · 45 вопросов (Y-1, Y-2, O)",
    genericHint: "Выбирайте из своей базы · длину задаёте сами",
    soonHint: "База вопросов и конструктор варианта пока не добавлены.",
  },
  en: {
    title: "Milliy sertifikat",
    subtitle: "Pick a subject and build a paper for it.",
    about: "Every paper gets its own private 6-digit code — students open it with that code and are scored immediately. The maths paper is 45 questions per the DTM protocol; for the other subjects you set the length yourself.",
    ready: "Ready",
    soon: "Soon",
    build: "Build a paper",
    notReady: "This subject is not built yet",
    mathHint: "DTM protocol · 45 questions (Y-1, Y-2, O)",
    genericHint: "Pick from your own bank · you set the length",
    soonHint: "The question bank and paper builder are not added yet.",
  },
};

/** M3 three-tone rotation — no rainbow accents (docs/UI_KIT.md). */
type Tone = "primary" | "secondary" | "tertiary";

const TONE_TILE: Record<Tone, string> = {
  primary: "bg-primary-container text-on-primary-container group-hover:bg-primary group-hover:text-on-primary",
  secondary: "bg-secondary-container text-on-secondary-container group-hover:bg-secondary group-hover:text-on-secondary",
  tertiary: "bg-tertiary-container text-on-tertiary-container group-hover:bg-tertiary group-hover:text-on-tertiary",
};

/** Presentation only — the registry owns everything else. */
const LOOK: Record<string, { icon: typeof Sigma; tone: Tone }> = {
  math: { icon: Sigma, tone: "primary" },
  biologiya: { icon: FlaskConical, tone: "secondary" },
  kimyo: { icon: FlaskConical, tone: "tertiary" },
  fizika: { icon: Atom, tone: "primary" },
  "ona-tili": { icon: BookText, tone: "secondary" },
  ingliz: { icon: Languages, tone: "tertiary" },
};

export default function MilliySertifikatHubPage() {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

  const hintFor = (subject: MilliySubject) =>
    subject.kind === "rasch" ? t.mathHint
      : subject.kind === "generic" ? t.genericHint
      : t.soonHint;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <Card variant="filled" className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-m3-sm bg-primary-container text-on-primary-container">
          <Info size={16} />
        </span>
        <p className="text-[12.5px] font-medium leading-relaxed text-on-surface-variant">{t.about}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {MILLIY_SUBJECTS.map((subject) => {
          const ready = subject.href !== null;
          const look = LOOK[subject.id] ?? { icon: BadgeCheck, tone: "primary" as Tone };
          const Icon = look.icon;

          return (
            <Card
              key={subject.id}
              hoverable={ready}
              onClick={ready ? () => router.push(subject.href!) : undefined}
              // A card that goes nowhere must not look or feel like one that
              // does — no pointer, no lift, muted surface, out of the tab order.
              className={cn(
                "group flex flex-col gap-3",
                ready ? "cursor-pointer" : "opacity-60",
              )}
              role={ready ? "link" : undefined}
              tabIndex={ready ? 0 : undefined}
              onKeyDown={ready ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(subject.href!);
                }
              } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex h-12 w-12 flex-none items-center justify-center rounded-m3-md transition-all duration-t-med",
                    ready && "group-hover:scale-105",
                    TONE_TILE[look.tone],
                  )}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </span>
                <StatusChip tone={ready ? "success" : "muted"}>
                  {ready ? t.ready : t.soon}
                </StatusChip>
              </div>

              <div className="min-w-0">
                <h2 className="text-[16px] font-bold leading-tight text-on-surface">
                  {subjectName(subject, L)}
                </h2>
                <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-on-surface-variant">
                  {hintFor(subject)}
                </p>
              </div>

              {ready ? (
                <span className="mt-auto inline-flex items-center gap-2 text-[13px] font-bold text-primary">
                  <KeyRound size={14} />
                  {t.build}
                  <ArrowRight size={15} className="transition-transform duration-t-fast group-hover:translate-x-1" />
                </span>
              ) : (
                <span className="mt-auto inline-flex items-center gap-2 text-[12px] font-semibold text-on-surface-variant">
                  <BadgeCheck size={14} />
                  {t.notReady}
                </span>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
