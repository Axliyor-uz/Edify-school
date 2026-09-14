'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Atom, BadgeCheck, BookText, FlaskConical, Languages, Sigma } from 'lucide-react';

import { useStudentLanguage } from '../layout';
import { MILLIY_SUBJECTS, studentSubjectHref, subjectName } from '@/lib/MilliyQuiz';
import { Card, Page, cn } from '@/components/student-ui';
import type { Lang } from '@/types/Math';

/**
 * **Milliy sertifikat — the student's subject hub, and their only nav entry to it.**
 *
 * ⚠️ The Rasch suite is no longer a nav destination of its own. It IS the Milliy
 * sertifikat **maths** section — its level chart, practice, diagnosis and code
 * page are the maths programme — so it is reached through the Matematika card
 * here instead of sitting beside "Milliy sertifikat" as if it were a separate
 * product. `studentSubjectHref` owns that mapping, so the hub cannot disagree
 * with the nav or with the teacher side about where a subject lives.
 *
 * Every other built subject opens `/milliy-sertifikat/[subject]` — code box,
 * sitting, result, sat papers. Contract: docs/MILLIY_QUIZ.md.
 *
 * Zero Firestore reads: the subject list is `MILLIY_SUBJECTS`, a bundled constant.
 */

const UI: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Milliy sertifikat',
    lead: 'Fan tanlang. Har bir fanda o‘qituvchi bergan 6 xonali kod bilan variant ochiladi.',
    ready: 'Tayyor',
    soon: 'Tez kunda',
    open: 'Ochish',
    notReady: 'Hali tayyor emas',
    mathHint: 'Darajangiz, mashq, tahlil va variantlar — 45 ta savol, DTM protokoli.',
    genericHint: 'O‘qituvchi variantini kod bilan oching va natijangizni ko‘ring.',
    soonHint: 'Bu fan hali qo‘shilmagan.',
    marking: 'Ball dinamik: sinf ko‘p yechgan savol arzon, kam yechilgan savol qimmat. Variant jami 100 ball.',
  },
  ru: {
    title: 'Milliy sertifikat',
    lead: 'Выберите предмет. Вариант открывается 6-значным кодом от учителя.',
    ready: 'Готово',
    soon: 'Скоро',
    open: 'Открыть',
    notReady: 'Пока не готово',
    mathHint: 'Ваш уровень, практика, анализ и варианты — 45 вопросов, протокол DTM.',
    genericHint: 'Откройте вариант учителя по коду и посмотрите результат.',
    soonHint: 'Этот предмет пока не добавлен.',
    marking: 'Балл динамический: часто решаемый вопрос дешевле, редко решаемый — дороже. Всего 100 баллов.',
  },
  en: {
    title: 'Milliy sertifikat',
    lead: 'Pick a subject. A paper opens with the 6-digit code your teacher gives you.',
    ready: 'Ready',
    soon: 'Soon',
    open: 'Open',
    notReady: 'Not ready yet',
    mathHint: 'Your level, practice, analysis and papers — 45 questions, the DTM protocol.',
    genericHint: "Open your teacher's paper by code and see your result.",
    soonHint: 'This subject is not added yet.',
    marking: 'Marks are dynamic: a question most of the class solves is worth less, a rarely-solved one more. 100 in total.',
  },
};

/** Presentation only — `MILLIY_SUBJECTS` owns everything else. */
const LOOK: Record<string, { icon: typeof Sigma; tone: string }> = {
  math: { icon: Sigma, tone: 'bg-primary-container text-on-primary-container' },
  biologiya: { icon: FlaskConical, tone: 'bg-secondary-container text-on-secondary-container' },
  kimyo: { icon: FlaskConical, tone: 'bg-tertiary-container text-on-tertiary-container' },
  fizika: { icon: Atom, tone: 'bg-primary-container text-on-primary-container' },
  'ona-tili': { icon: BookText, tone: 'bg-secondary-container text-on-secondary-container' },
  ingliz: { icon: Languages, tone: 'bg-tertiary-container text-on-tertiary-container' },
};

export default function MilliySertifikatHubPage() {
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = UI[lang];

  return (
    <Page>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="text-center">
          <h1 className="text-[22px] font-black tracking-tight text-on-surface">{t.title}</h1>
          <p className="mt-1 text-[13px] font-bold text-on-surface-variant">{t.lead}</p>
        </div>

        <div className="flex flex-col gap-3">
          {MILLIY_SUBJECTS.map((subject) => {
            const href = studentSubjectHref(subject);
            const ready = href !== null;
            const look = LOOK[subject.id] ?? { icon: BadgeCheck, tone: 'bg-primary-container text-on-primary-container' };
            const Icon = look.icon;
            const hint = subject.kind === 'rasch' ? t.mathHint
              : subject.kind === 'generic' ? t.genericHint
              : t.soonHint;

            return (
              <Card
                key={subject.id}
                onClick={ready ? () => router.push(href!) : undefined}
                // A card that goes nowhere must not look or feel like one that
                // does — no pointer, no lift, muted, out of the tab order.
                className={cn(
                  'group flex items-center gap-3.5 p-4',
                  ready ? 'cursor-pointer s-press' : 'opacity-60',
                )}
                role={ready ? 'link' : undefined}
                tabIndex={ready ? 0 : undefined}
                onKeyDown={ready ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(href!);
                  }
                } : undefined}
              >
                <span className={cn('grid h-12 w-12 flex-none place-items-center rounded-m3-md', look.tone)}>
                  <Icon size={22} strokeWidth={2.5} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="text-[15px] font-black text-on-surface">{subjectName(subject, lang)}</b>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                      ready ? 'bg-success-container text-on-success-container' : 'bg-surface-container-high text-on-surface-variant',
                    )}>
                      {ready ? t.ready : t.soon}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[12px] font-bold leading-snug text-on-surface-variant">
                    {hint}
                  </span>
                </span>

                {ready
                  ? <ArrowRight size={18} strokeWidth={3} className="flex-none text-primary transition-transform group-hover:translate-x-0.5" />
                  : <span className="flex-none text-[11px] font-black text-on-surface-variant">{t.notReady}</span>}
              </Card>
            );
          })}
        </div>

        {/* The marking rule, said once, in the student's own words — it is the
            same for every subject (lib/RASCHmarks.ts). */}
        <p className="px-2 text-center text-[11.5px] font-bold leading-relaxed text-on-surface-variant">
          {t.marking}
        </p>
      </div>
    </Page>
  );
}
