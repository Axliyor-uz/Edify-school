"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, BookOpenText, Info, KeyRound, Sigma } from "lucide-react";

import { useTeacherLanguage } from "@/app/teacher/layout";
import { SAT_SECTIONS, type SatSection } from "@/lib/SatMathQuiz";
import { Card, PageHeader, StatusChip, cn } from "@/components/ui";
import type { Lang } from "@/types/Math";

/**
 * SAT — the section hub (docs/SAT_QUIZ.md).
 *
 * ⚠️ **This page invents nothing** — which sections exist, what they are
 * called and where they lead all come from `SAT_SECTIONS`, so a section can
 * never be live here and missing from the student hub. Mirrors the Milliy
 * sertifikat hub's own contract.
 */

const TR: Record<string, Record<string, string>> = {
  uz: {
    title: "SAT",
    subtitle: "Bo'lim tanlang va shu bo'limdan adaptiv test tuzing.",
    about: "Har bir test o'zining 6 xonali maxfiy kodiga ega. Matematika testi ikki modulli: Modul 1 hamma uchun bir xil, Modul 2 esa Modul 1 natijasiga qarab — Oson yoki Qiyin — tanlanadi, xuddi haqiqiy raqamli SAT kabi.",
    ready: "Tayyor", soon: "Tez kunda",
    build: "Test tuzish", notReady: "Bu bo'lim hali tayyor emas",
    mathHint: "2 modulli adaptiv test · o'z bazangizdan yoki yangi savol yozib tuzing",
    soonHint: "Savol bazasi va test tuzuvchi hali qo'shilmagan.",
  },
  ru: {
    title: "SAT",
    subtitle: "Выберите раздел и составьте адаптивный тест.",
    about: "У каждого теста свой 6-значный секретный код. Тест по математике — двухмодульный: Модуль 1 одинаков для всех, а Модуль 2 — Лёгкий или Трудный — выбирается по результату Модуля 1, как в настоящем цифровом SAT.",
    ready: "Готово", soon: "Скоро",
    build: "Составить тест", notReady: "Этот раздел пока не готов",
    mathHint: "Адаптивный тест из 2 модулей · из своей базы или новыми вопросами",
    soonHint: "База вопросов и конструктор теста пока не добавлены.",
  },
  en: {
    title: "SAT",
    subtitle: "Pick a section and build an adaptive test for it.",
    about: "Every test gets its own private 6-digit code. The Math test is two modules: Module 1 is the same for everyone, and Module 2 — Easier or Harder — is chosen from the Module 1 result, just like the real digital SAT.",
    ready: "Ready", soon: "Soon",
    build: "Build a test", notReady: "This section is not built yet",
    mathHint: "2-module adaptive test · from your own bank or new questions",
    soonHint: "The question bank and test builder are not added yet.",
  },
};

type Tone = "primary" | "secondary";
const TONE_TILE: Record<Tone, string> = {
  primary: "bg-primary-container text-on-primary-container group-hover:bg-primary group-hover:text-on-primary",
  secondary: "bg-secondary-container text-on-secondary-container group-hover:bg-secondary group-hover:text-on-secondary",
};

const LOOK: Record<string, { icon: typeof Sigma; tone: Tone }> = {
  math: { icon: Sigma, tone: "primary" },
  "reading-writing": { icon: BookOpenText, tone: "secondary" },
};

export default function SatHubPage() {
  const router = useRouter();
  const { lang } = useTeacherLanguage();
  const t = TR[lang] || TR.uz;
  const L = (lang === "ru" || lang === "en" ? lang : "uz") as Lang;

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
        {SAT_SECTIONS.map((section: SatSection) => {
          const ready = section.teacherHref !== null;
          const look = LOOK[section.id] ?? { icon: BadgeCheck, tone: "primary" as Tone };
          const Icon = look.icon;

          return (
            <Card
              key={section.id}
              hoverable={ready}
              onClick={ready ? () => router.push(section.teacherHref!) : undefined}
              className={cn("group flex flex-col gap-3", ready ? "cursor-pointer" : "opacity-60")}
              role={ready ? "link" : undefined}
              tabIndex={ready ? 0 : undefined}
              onKeyDown={ready ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(section.teacherHref!);
                }
              } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn(
                  "flex h-12 w-12 flex-none items-center justify-center rounded-m3-md transition-all duration-t-med",
                  ready && "group-hover:scale-105",
                  TONE_TILE[look.tone],
                )}>
                  <Icon size={22} strokeWidth={2.4} />
                </span>
                <StatusChip tone={ready ? "success" : "muted"}>{ready ? t.ready : t.soon}</StatusChip>
              </div>

              <div className="min-w-0">
                <h2 className="text-[16px] font-bold leading-tight text-on-surface">{section.name[L] || section.name.uz}</h2>
                <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-on-surface-variant">
                  {ready ? t.mathHint : t.soonHint}
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
