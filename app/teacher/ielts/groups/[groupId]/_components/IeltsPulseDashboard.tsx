'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchUsersLite } from '@/services/userLookup';
import { useTeacherLanguage } from '@/app/teacher/layout';
import {
  Target, Activity, CheckCircle2, Clock, AlertTriangle,
  PenTool, Mic, BookOpen, Headphones, ClipboardCheck, ChevronRight, Inbox,
} from 'lucide-react';
import { Spinner } from '@/components/ui';
import { IeltsGroup } from '@/lib/ielts/types';
import type { IeltsSkill } from '@/lib/ielts/types';
import { GroupAttempt, effectiveBand, submittedMillis, timeAgo, toDateSafe } from './groupData';

const T: Record<string, any> = {
  uz: {
    avgTitle: "Guruh o'zlashtirishi (Avg Band)",
    deltaLabel: "maqsaddan farq",
    noBandYet: "Hozircha band natijalari yo'q",
    reviewsTitle: "Tekshirish kutmoqda",
    reviewsDesc: (n: number) => `${n} ta Writing/Speaking ishi baholanishi kerak`,
    reviewsBtn: "Tekshirish",
    reviewsNone: "Tekshirishga ishlar yo'q",
    activityTitle: "So'nggi topshirishlar",
    pending: "tekshirilmoqda",
    noActivity: "Hozircha topshirishlar yo'q",
    noActivityDesc: "O'quvchilar test topshirganda shu yerda ko'rinadi.",
    attentionTitle: "E'tibor talab qiladi",
    noAttempts: "Hali birorta test topshirmagan",
    belowTarget: (b: string) => `Band ${b} — maqsaddan past`,
    allGood: "Hammasi joyida — barcha o'quvchilar maqsad atrofida.",
    band: "Band",
  },
  en: {
    avgTitle: "Group performance (Avg Band)",
    deltaLabel: "from target",
    noBandYet: "No band results yet",
    reviewsTitle: "Awaiting review",
    reviewsDesc: (n: number) => `${n} Writing/Speaking submissions need grading`,
    reviewsBtn: "Review",
    reviewsNone: "Nothing to review",
    activityTitle: "Recent submissions",
    pending: "pending review",
    noActivity: "No submissions yet",
    noActivityDesc: "Student submissions will appear here.",
    attentionTitle: "Needs attention",
    noAttempts: "Has not taken any test yet",
    belowTarget: (b: string) => `Band ${b} — below target`,
    allGood: "All good — every student is on target.",
    band: "Band",
  },
  ru: {
    avgTitle: "Успеваемость группы (Avg Band)",
    deltaLabel: "от цели",
    noBandYet: "Пока нет результатов band",
    reviewsTitle: "Ожидают проверки",
    reviewsDesc: (n: number) => `${n} работ Writing/Speaking ждут оценки`,
    reviewsBtn: "Проверить",
    reviewsNone: "Нет работ на проверку",
    activityTitle: "Последние сдачи",
    pending: "на проверке",
    noActivity: "Пока нет сдач",
    noActivityDesc: "Сдачи учеников появятся здесь.",
    attentionTitle: "Требует внимания",
    noAttempts: "Ещё не сдал ни одного теста",
    belowTarget: (b: string) => `Band ${b} — ниже цели`,
    allGood: "Всё хорошо — все ученики близки к цели.",
    band: "Band",
  },
};

const SKILL_ICONS: Record<IeltsSkill, any> = {
  reading: BookOpen, listening: Headphones, writing: PenTool, speaking: Mic,
};

interface Props {
  group: IeltsGroup;
  attempts: GroupAttempt[];
  loaded: boolean;
  onOpenReviews?: () => void;
}

export default function IeltsPulseDashboard({ group, attempts, loaded, onOpenReviews }: Props) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const targetBand = Number(group.targetBand) || 7.0;
  const members = useMemo(() => group.studentIds || [], [group.studentIds]);

  const {
    groupAvg, pendingCount, recent, attention,
  } = useMemo(() => {
    // Latest band + any-attempt flag per member
    const latestBand: Record<string, { band: number; at: number }> = {};
    const hasAttempt: Record<string, boolean> = {};
    const nameOf: Record<string, string> = {};
    for (const a of attempts) {
      hasAttempt[a.userId] = true;
      if (a.userName) nameOf[a.userId] = a.userName;
      const band = effectiveBand(a);
      if (band == null) continue;
      const at = submittedMillis(a);
      if (!latestBand[a.userId] || at >= latestBand[a.userId].at) {
        latestBand[a.userId] = { band, at };
      }
    }

    const memberBands = members
      .map((uid) => latestBand[uid]?.band)
      .filter((b): b is number => b != null);
    const groupAvg = memberBands.length
      ? memberBands.reduce((s, b) => s + b, 0) / memberBands.length
      : null;

    const pendingCount = attempts.filter((a) => a.reviewStatus === 'pending_review').length;

    const recent = [...attempts]
      .sort((a, b) => submittedMillis(b) - submittedMillis(a))
      .slice(0, 8);

    const attention: { uid: string; name: string | null; reason: 'none' | 'below'; band?: number }[] = [];
    for (const uid of members) {
      if (!hasAttempt[uid]) {
        attention.push({ uid, name: nameOf[uid] || null, reason: 'none' });
      } else {
        const lb = latestBand[uid];
        if (lb && lb.band < targetBand - 0.5) {
          attention.push({ uid, name: nameOf[uid] || null, reason: 'below', band: lb.band });
        }
      }
    }

    return { groupAvg, pendingCount, recent, attention };
  }, [attempts, members, targetBand]);

  // Resolve names for flagged members that never submitted (no userName in attempts)
  // — batched via services/userLookup instead of one getDoc per member.
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = attention.filter((x) => !x.name && !resolvedNames[x.uid]).map((x) => x.uid).slice(0, 20);
    if (missing.length === 0) return;
    let alive = true;
    fetchUsersLite(missing)
      .then((profiles) => {
        if (!alive) return;
        setResolvedNames((prev) => ({
          ...prev,
          ...Object.fromEntries(missing.map((uid) => [uid, profiles[uid]?.displayName || uid.slice(0, 6)])),
        }));
      })
      .catch(() => { /* names are decoration */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attention]);

  if (!loaded) {
    return <div className="py-16 flex justify-center"><Spinner size={28} /></div>;
  }

  const delta = groupAvg != null ? groupAvg - targetBand : null;
  let deltaColor = 'bg-success-container text-on-success-container';
  if (delta != null && delta <= -0.5) deltaColor = 'bg-error-container text-on-error-container';
  else if (delta != null && delta < 0) deltaColor = 'bg-warning-container text-on-warning-container';
  const deltaText = delta == null ? null : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;

  return (
    <div className="flex flex-col gap-6">

      {/* Top: average band + pending reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Average band */}
        <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-m3-md bg-primary-container flex items-center justify-center text-on-primary-container mb-4">
            <Activity size={28} strokeWidth={2.5} />
          </div>
          <h3 className="text-[15px] font-black text-on-surface mb-1">{t.avgTitle}</h3>

          {groupAvg != null ? (
            <>
              <div className="flex items-end gap-3 mt-4 mb-3">
                <span className="text-5xl font-black text-on-surface tracking-tighter leading-none [font-variant-numeric:tabular-nums]">
                  {groupAvg.toFixed(1)}
                </span>
                <span className="text-sm font-bold text-on-surface-variant mb-1">/ {targetBand.toFixed(1)}</span>
              </div>
              <div className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm font-black text-[13px] ${deltaColor}`}>
                <Target size={14} strokeWidth={3} />
                <span>{deltaText} {t.deltaLabel}</span>
              </div>
            </>
          ) : (
            <p className="mt-4 text-[13px] font-bold text-on-surface-variant">{t.noBandYet}</p>
          )}
        </div>

        {/* Pending reviews */}
        <div className={`rounded-m3-lg border shadow-elev-1 p-6 flex flex-col justify-center ${
          pendingCount > 0
            ? 'bg-warning-container border-warning'
            : 'bg-surface-container-low border-outline-variant'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-11 h-11 rounded-m3-md flex items-center justify-center shrink-0 ${
              pendingCount > 0 ? 'bg-warning text-surface-container-lowest' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              <ClipboardCheck size={20} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className={`text-[16px] font-black tracking-tight ${pendingCount > 0 ? 'text-on-warning-container' : 'text-on-surface'}`}>
                {t.reviewsTitle}
              </h3>
              <p className={`text-[13px] font-bold ${pendingCount > 0 ? 'text-on-warning-container' : 'text-on-surface-variant'}`}>
                {pendingCount > 0 ? t.reviewsDesc(pendingCount) : t.reviewsNone}
              </p>
            </div>
          </div>
          {pendingCount > 0 && onOpenReviews && (
            <button
              onClick={onOpenReviews}
              className="m3-interactive self-start flex items-center gap-1.5 px-4 py-2.5 bg-warning text-surface-container-lowest rounded-m3-md font-black text-[13px] transition-colors active:scale-95 shadow-elev-1"
            >
              {t.reviewsBtn} <ChevronRight size={14} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* Needs attention */}
      {attention.length > 0 ? (
        <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-error" strokeWidth={2.5} />
            <h3 className="text-[15px] font-black text-on-surface">{t.attentionTitle}</h3>
          </div>
          <div className="flex flex-col gap-2">
            {attention.map((x) => (
              <div key={x.uid} className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md px-3.5 py-2.5">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${x.reason === 'none' ? 'bg-warning' : 'bg-error'}`} />
                <p className="text-[13.5px] font-bold text-on-surface truncate flex-1 min-w-0">
                  {x.name || resolvedNames[x.uid] || '…'}
                </p>
                <p className="text-[12px] font-bold text-on-surface-variant shrink-0 text-right">
                  {x.reason === 'none' ? t.noAttempts : t.belowTarget(x.band!.toFixed(1))}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : members.length > 0 && attempts.length > 0 ? (
        <div className="bg-success-container rounded-m3-lg border border-transparent shadow-elev-1 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-on-success-container shrink-0" strokeWidth={2.5} />
          <p className="text-[13.5px] font-bold text-on-success-container">{t.allGood}</p>
        </div>
      ) : null}

      {/* Recent submissions */}
      <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 p-6 flex flex-col">
        <h3 className="text-[15px] font-black text-on-surface mb-5">{t.activityTitle}</h3>

        {recent.length === 0 ? (
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            <Inbox size={24} className="text-on-surface-variant" strokeWidth={2} />
            <p className="text-[14px] font-black text-on-surface">{t.noActivity}</p>
            <p className="text-[12px] font-bold text-on-surface-variant">{t.noActivityDesc}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 relative">
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-outline-variant z-0" />
            {recent.map((a) => {
              const Icon = SKILL_ICONS[a.skill] || BookOpen;
              const band = effectiveBand(a);
              const isPending = a.reviewStatus === 'pending_review';
              return (
                <div key={a.id} className="relative z-10 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-m3-md bg-surface-container-lowest border border-outline-variant flex items-center justify-center shrink-0">
                    <Icon size={14} strokeWidth={2.5} className={isPending ? 'text-warning' : 'text-primary'} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[14px] font-bold text-on-surface truncate">
                      {a.userName || '—'}
                      <span className="text-on-surface-variant font-medium"> · </span>
                      <span className="capitalize">{a.skill}</span>
                      <span className="text-on-surface-variant font-medium"> · </span>
                      {isPending
                        ? <span className="text-warning font-black">{t.pending}</span>
                        : band != null
                          ? <span className="font-black">{t.band} {band.toFixed(1)}</span>
                          : '—'}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] font-black text-on-surface-variant mt-0.5">
                      <Clock size={10} strokeWidth={2.5} />
                      <span>{timeAgo(toDateSafe(a.submittedAt), lang)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
