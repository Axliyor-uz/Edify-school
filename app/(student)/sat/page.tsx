"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck, BookOpenText, Sigma } from "lucide-react";

import { SAT_SECTIONS, type SatSection } from "@/lib/SatMathQuiz";
import { Card, Page, cn } from "@/components/student-ui";

/**
 * SAT — the student's section hub (docs/SAT_QUIZ.md). Cards only, zero
 * Firestore reads — the section list is `SAT_SECTIONS`, mirroring how the
 * Milliy sertifikat student hub reads `MILLIY_SUBJECTS`.
 *
 * ⚠️ English-only, unlike the rest of the student app: the real SAT is
 * administered in English, so this hub (and the code entry / runner it leads
 * to) ignores `useStudentLanguage()` and always renders English chrome +
 * English question content, regardless of the student's app-wide language.
 */

const t = { title: "SAT", subtitle: "Pick a section.", ready: "Open", soon: "Soon" };

const LOOK: Record<string, typeof Sigma> = { math: Sigma, "reading-writing": BookOpenText };

export default function SatHubPage() {
  const router = useRouter();

  return (
    <Page>
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="text-[20px] font-black text-on-surface">{t.title}</h1>
          <p className="text-[13px] font-medium text-on-surface-variant">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-3">
          {SAT_SECTIONS.map((section: SatSection) => {
            const ready = section.studentHref !== null;
            const Icon = LOOK[section.id] ?? BadgeCheck;
            return (
              <Card
                key={section.id}
                interactive={ready}
                onClick={ready ? () => router.push(section.studentHref!) : undefined}
                className={cn("flex items-center gap-4 p-4", ready ? "cursor-pointer" : "opacity-60")}
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-m3-md bg-primary-container text-on-primary-container">
                  <Icon size={20} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-bold text-on-surface">{section.name.en}</span>
                <span className={cn(
                  "flex-none rounded-m3-xs px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                  ready ? "bg-success-container text-on-success-container" : "bg-surface-container text-on-surface-variant",
                )}>
                  {ready ? t.ready : t.soon}
                </span>
              </Card>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
