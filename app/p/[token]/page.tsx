"use client";

// app/p/[token]/page.tsx
//
// **What the parent sees after scanning the QR** (docs/PARENTS.md).
//
// ⚠️ **No login, no Firebase, no client SDK on this page.** It calls exactly one
// endpoint — `GET /api/parent/[token]` — and renders what comes back. That is the
// whole security model of the parent side: the browser never holds credentials
// that could read anything else, so the worst a hostile page in the same origin
// could do is re-fetch this same report.
//
// ⚠️ It deliberately lives OUTSIDE `app/(public)`, whose layout is the marketing
// shell with Log in / Sign up in the nav. A parent arriving here is not a lead to
// convert; showing them a signup button is exactly the confusion this feature
// removes.
//
// ⚠️ **None of the three UI kits are used here either** (docs/UI_KIT.md et al.).
// They are role-scoped — student, teacher, manager — and a parent is none of the
// three. Plain Tailwind keeps this page from inheriting a shell it has no role in.

import { use, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, CalendarCheck, Flame, GraduationCap,
  Layers, Loader2, Minus, Sparkles, TrendingDown, TrendingUp, Trophy, Wallet,
} from "lucide-react";

import { formatUZS } from "@/lib/finance/money";
import { PARENT_DEVICE_HEADER } from "@/lib/parentLinks";
import { PARENT_TEXTS, attendanceLabel, type ParentLangKey, type ParentT } from "../_lib/i18n";
import {
  childrenServerSnapshot, childrenSnapshot, forgetChild, langServerSnapshot, langSnapshot,
  readDeviceSecret, rememberChild, subscribeChildren, subscribeLang, writeDeviceSecret, writeParentLang,
} from "../_lib/store";
import type { ParentReport, ParentSavedChild } from "@/types/Parent";

type Fetched =
  | { state: "loading" }
  | { state: "ok"; report: ParentReport }
  | { state: "not_found" }
  | { state: "revoked" }
  /** The link is already connected to a DIFFERENT device (docs/PARENTS.md). */
  | { state: "claimed" }
  | { state: "rate_limited" }
  | { state: "error" };

export default function ParentReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  // ⚠️ localStorage read through useSyncExternalStore, not a useEffect+setState:
  // the effect version paints once with the server's defaults and then flips,
  // which is a visible flicker on the child switcher (app/p/_lib/store.ts).
  const lang = useSyncExternalStore(subscribeLang, langSnapshot, langServerSnapshot) as ParentLangKey;
  const children = useSyncExternalStore(subscribeChildren, childrenSnapshot, childrenServerSnapshot);
  const [data, setData] = useState<Fetched>({ state: "loading" });

  const t: ParentT = PARENT_TEXTS[lang];

  // Bumped by the retry button; the effect below is the only place that fetches.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // ⚠️ `alive` guards against a stale response: switching children re-runs this
    // with a new token, and the slower request must not overwrite the newer one's
    // report with another child's.
    let alive = true;

    (async () => {
      try {
        // ⚠️ The device secret proves this browser is the ONE connected to the
        // link. Absent on the very first open — that request is what claims it.
        const secret = readDeviceSecret(token);
        const res = await fetch(`/api/parent/${token}`, {
          cache: "no-store",
          headers: secret ? { [PARENT_DEVICE_HEADER]: secret } : {},
        });
        if (!alive) return;

        if (res.status === 404) return setData({ state: "not_found" });
        // 409: somebody else's phone got here first, or this browser lost its
        // secret (cleared storage, private window). Both need the center.
        if (res.status === 409) return setData({ state: "claimed" });
        if (res.status === 410) {
          // A revoked link must not linger in the child switcher — the parent
          // would keep tapping a name that always errors.
          forgetChild(token);
          return setData({ state: "revoked" });
        }
        if (res.status === 429) return setData({ state: "rate_limited" });
        if (!res.ok) return setData({ state: "error" });

        const body = (await res.json()) as { report: ParentReport; device?: string };
        if (!alive) return;
        // Present exactly once, on the claiming request — keep it or this device
        // cannot prove itself next time.
        if (body.device) writeDeviceSecret(token, body.device);
        setData({ state: "ok", report: body.report });
        // Remembered only on success — see app/p/_lib/store.ts.
        rememberChild(token, body.report.student.name);
      } catch {
        if (alive) setData({ state: "error" });
      }
    })();

    return () => { alive = false; };
  }, [token, attempt]);

  /** The retry button, where setting "loading" is an event, not an effect. */
  const retry = () => {
    setData({ state: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <TopBar t={t} lang={lang} onLang={writeParentLang} children_={children} token={token} />

      <div className="mx-auto w-full max-w-2xl px-4">
        {data.state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-sm font-semibold">{t.loading}</p>
          </div>
        )}

        {data.state === "not_found" && <Problem title={t.notFoundTitle} body={t.notFoundBody} />}
        {data.state === "revoked" && <Problem title={t.revokedTitle} body={t.revokedBody} />}
        {data.state === "claimed" && <Problem title={t.claimedTitle} body={t.claimedBody} />}
        {data.state === "rate_limited" && <Problem title={t.rateTitle} body={t.rateBody} onRetry={retry} retry={t.retry} />}
        {data.state === "error" && <Problem title={t.errorTitle} body={t.errorBody} onRetry={retry} retry={t.retry} />}

        {data.state === "ok" && <Report report={data.report} t={t} lang={lang} />}
      </div>
    </main>
  );
}

// ─── chrome ──────────────────────────────────────────────────────────────────

function TopBar({
  t, lang, onLang, children_, token,
}: {
  t: ParentT; lang: ParentLangKey; onLang: (l: ParentLangKey) => void;
  children_: ParentSavedChild[]; token: string;
}) {
  const others = children_.filter((c) => c.token !== token);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3">
        <Link href="/p" className="flex items-center gap-1.5 text-[13px] font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> {t.myChildren}
        </Link>

        <div className="ml-auto flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {(["uz", "ru", "en"] as ParentLangKey[]).map((l) => (
            <button
              key={l}
              onClick={() => onLang(l)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase transition-colors ${
                lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* The child switcher only exists once a second QR has been scanned. */}
      {others.length > 0 && (
        <div className="mx-auto flex w-full max-w-2xl gap-2 overflow-x-auto px-4 pb-2">
          {others.map((c) => (
            <Link
              key={c.token}
              href={`/p/${c.token}`}
              className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700"
            >
              {c.name || "..."}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

function Problem({ title, body, onRetry, retry }: { title: string; body: string; onRetry?: () => void; retry?: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
        <AlertCircle size={24} />
      </span>
      <h1 className="mt-3 text-[17px] font-black">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-slate-600">{body}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-bold text-white">
          {retry}
        </button>
      )}
    </div>
  );
}

// ─── the report ──────────────────────────────────────────────────────────────

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</section>
);

const CardTitle = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <h2 className="mb-3 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-slate-500">
    {icon} {children}
  </h2>
);

/** Percent → a colour band. Same thresholds the teacher-side grids use. */
const pctTone = (p: number) =>
  p >= 80 ? "bg-emerald-100 text-emerald-700"
    : p >= 60 ? "bg-sky-100 text-sky-700"
    : p >= 40 ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";

function Report({ report, t, lang }: { report: ParentReport; t: ParentT; lang: ParentLangKey }) {
  const locale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "uz-UZ";
  const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "");
  const fmtDay = (key: string) => (key ? key.slice(8) + "." + key.slice(5, 7) : "");

  return (
    <div className="space-y-3 py-4">
      {/* Who this is about */}
      <Card className="flex items-center gap-3">
        {report.student.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.student.photoURL} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-lg font-black text-white">
            {report.student.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-black leading-tight">{report.student.name}</h1>
          <p className="truncate text-[12.5px] font-semibold text-slate-500">{report.center.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
              <Sparkles size={11} /> {t.xpLevel} {report.student.xpLevel}
            </span>
            {report.student.streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                <Flame size={11} /> {report.student.streak} {t.days}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Measured level */}
      {report.levels && (
        <Card>
          <CardTitle icon={<Trophy size={14} />}>{t.level}</CardTitle>
          {report.levels.mathLevel === null ? (
            <p className="text-[13px] font-semibold text-slate-500">{t.levelNone}</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="text-[38px] font-black leading-none text-slate-900">{report.levels.mathLevel.toFixed(1)}</span>
                <span className="mb-1 text-[13px] font-bold text-slate-500">{t.levelOf}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${(report.levels.mathLevel / 5) * 100}%` }} />
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">{t.levelHint}</p>

              {report.levels.dimensions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{t.dimensions}</p>
                  {report.levels.dimensions.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <span className="w-[46%] truncate text-[12px] font-semibold text-slate-700">{d.label}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-sky-500" style={{ width: `${(d.level / 5) * 100}%` }} />
                      </span>
                      <span className="w-8 text-right text-[12px] font-black text-slate-700">{d.level.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {report.levels.milliy.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t.milliy}</p>
              <ul className="space-y-1">
                {report.levels.milliy.map((m, i) => (
                  <li key={`${m.title}-${i}`} className="flex items-center gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">{m.title || m.subject}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-black ${pctTone(m.percent)}`}>{m.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Results + the improvement headline */}
      {report.results && (
        <Card>
          <CardTitle icon={<GraduationCap size={14} />}>{t.results}</CardTitle>

          {report.results.graded === 0 ? (
            <p className="text-[13px] font-semibold text-slate-500">{t.noResults}</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.average}</p>
                  <p className="text-[30px] font-black leading-none">{report.results.averageAll}%</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.improvement}</p>
                  <Improvement value={report.results.improvement} t={t} />
                </div>
              </div>

              {report.results.trend.length > 1 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t.trend}</p>
                  <div className="flex h-24 items-end gap-1.5">
                    {report.results.trend.map((point) => (
                      <div key={point.monthKey} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-black text-slate-500">{point.average}</span>
                        <span
                          className="w-full rounded-t bg-sky-500"
                          style={{ height: `${Math.max(4, point.average * 0.6)}px` }}
                          title={`${point.monthKey}: ${point.average}% (${point.count})`}
                        />
                        <span className="text-[9.5px] font-bold text-slate-400">{point.monthKey.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t.recent}</p>
                <ul className="divide-y divide-slate-100">
                  {report.results.recent.map((row) => (
                    <li key={row.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-slate-800">{row.title || row.context}</p>
                        <p className="truncate text-[11.5px] text-slate-500">
                          {row.context}
                          {row.context && row.at ? " · " : ""}
                          {fmtDate(row.at)}
                        </p>
                      </div>
                      {row.pending ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{t.pending}</span>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-black ${pctTone(row.percent ?? 0)}`}>
                          {row.percent}%
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Attendance */}
      {report.attendance && (
        <Card>
          <CardTitle icon={<CalendarCheck size={14} />}>{t.attendance}</CardTitle>

          {report.attendance.rate === null ? (
            <p className="text-[13px] font-semibold text-slate-500">{t.noAttendance}</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="text-[32px] font-black leading-none">{report.attendance.rate}%</span>
                <span className="mb-1 text-[12.5px] font-bold text-slate-500">{t.attendanceRate}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {([
                  [t.present, report.attendance.present, "text-emerald-700 bg-emerald-50"],
                  [t.late, report.attendance.late, "text-amber-700 bg-amber-50"],
                  [t.absent, report.attendance.absent, "text-rose-700 bg-rose-50"],
                  [t.excused, report.attendance.excused, "text-slate-600 bg-slate-50"],
                ] as [string, number, string][]).map(([label, value, tone]) => (
                  <div key={label} className={`rounded-xl py-2 ${tone}`}>
                    <p className="text-[17px] font-black leading-none">{value}</p>
                    <p className="mt-0.5 text-[10.5px] font-bold">{label}</p>
                  </div>
                ))}
              </div>

              {report.attendance.recent.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {report.attendance.recent.map((r, i) => (
                    <span
                      key={`${r.date}-${i}`}
                      title={`${r.date} · ${r.classTitle} · ${attendanceLabel(t, r.status)}`}
                      className={`rounded-md px-1.5 py-1 text-[10px] font-black ${
                        r.status === "present" ? "bg-emerald-100 text-emerald-700"
                          : r.status === "late" ? "bg-amber-100 text-amber-700"
                          : r.status === "absent" ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {fmtDay(r.date)}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">{t.attendanceHint}</p>
            </>
          )}
        </Card>
      )}

      {/* Money */}
      {report.finance && (
        <Card>
          <CardTitle icon={<Wallet size={14} />}>{t.finance}</CardTitle>

          <div className="flex items-end gap-2">
            {/* ⚠️ Positive balance = OWED (docs/FINANCE.md). The label changes with
                the sign; the number is never silently flipped. */}
            <span className={`text-[26px] font-black leading-none ${report.finance.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {report.finance.balance === 0 ? t.balancePaid : formatUZS(Math.abs(report.finance.balance))}
            </span>
            {report.finance.balance !== 0 && (
              <span className="mb-0.5 text-[12.5px] font-bold text-slate-500">
                {report.finance.balance > 0 ? t.balanceOwed : t.balanceAdvance}
              </span>
            )}
          </div>

          {report.finance.nextDueDate && (
            <p className="mt-1 text-[12.5px] font-semibold text-slate-600">
              {t.nextDue}: {report.finance.nextDueDate}
            </p>
          )}

          {report.finance.charges.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t.charges}</p>
              <ul className="divide-y divide-slate-100">
                {report.finance.charges.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-slate-800">{c.title}</p>
                      <p className="text-[11px] text-slate-500">{c.periodKey}</p>
                    </div>
                    <span className="text-[12.5px] font-black text-slate-700">{formatUZS(c.amount)}</span>
                    <span className="w-[74px] text-right text-[11px] font-bold text-slate-500">
                      {t.chargeStatus[c.status] || c.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.finance.payments.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">{t.payments}</p>
              <ul className="divide-y divide-slate-100">
                {report.finance.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                    <span className="flex-1 font-semibold text-slate-600">{p.paidAt}</span>
                    <span className="font-black text-emerald-600">{formatUZS(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.finance.charges.length === 0 && report.finance.payments.length === 0 && (
            <p className="mt-2 text-[12.5px] font-semibold text-slate-500">{t.noFinance}</p>
          )}
        </Card>
      )}

      {/* Groups */}
      <Card>
        <CardTitle icon={<Layers size={14} />}>{t.groups}</CardTitle>
        {report.groups.length === 0 ? (
          <p className="text-[13px] font-semibold text-slate-500">{t.noGroups}</p>
        ) : (
          <ul className="space-y-2">
            {report.groups.map((g) => (
              <li key={g.classId} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[13px] font-bold text-slate-800">{g.title}</p>
                {g.teacherName && (
                  <p className="text-[11.5px] text-slate-500">{t.teacher}: {g.teacherName}</p>
                )}
                {g.schedule.length > 0 && (
                  <p className="mt-0.5 text-[11.5px] font-semibold text-slate-600">{g.schedule.join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="px-2 pt-1 text-center text-[11.5px] leading-relaxed text-slate-400">
        {t.footer}
        <br />
        {t.updated}: {new Date(report.generatedAt).toLocaleString(locale)}
      </p>
    </div>
  );
}

/** The one number a parent came for — with the honest "not enough data" state. */
function Improvement({ value, t }: { value: number | null; t: ParentT }) {
  if (value === null) {
    return <p className="max-w-[190px] text-[11.5px] font-semibold leading-snug text-slate-500">{t.improvementNone}</p>;
  }
  const Icon = value > 2 ? TrendingUp : value < -2 ? TrendingDown : Minus;
  const tone = value > 2 ? "text-emerald-600" : value < -2 ? "text-rose-600" : "text-slate-500";
  const text = value > 2 ? t.improvementUp(value) : value < -2 ? t.improvementDown(Math.abs(value)) : t.improvementFlat;

  return (
    <div className="flex flex-col items-end">
      <span className={`flex items-center gap-1 text-[22px] font-black leading-none ${tone}`}>
        <Icon size={18} /> {value > 0 ? "+" : ""}{value}%
      </span>
      <span className="mt-0.5 max-w-[190px] text-right text-[11px] font-semibold leading-snug text-slate-500">{text}</span>
    </div>
  );
}
