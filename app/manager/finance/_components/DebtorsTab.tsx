"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Banknote, PartyPopper, UserRound } from "lucide-react";
import type { Charge } from "@/types/finance";
import type { ClassData } from "@/hooks/useCenterClasses";
import { openAmountOf } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { Button, EmptyState, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import { initialsOf, periodLabelOf } from "./financeFormat";
import FilterSelect from "../../_components/FilterSelect";
import SearchInput from "../../_components/SearchInput";

interface Props {
  openCharges: Charge[];
  /** studentId → current-month attendance rate (%) or null; null map = not loaded. */
  attendanceRates: Record<string, number | null> | null;
  todayKey: string;
  classes: ClassData[];
  onRecordPayment: (studentId: string) => void;
  onShowStudent: (studentId: string, studentName: string) => void;
}

interface DebtorRow {
  studentId: string;
  studentName: string;
  total: number;
  overdue: boolean;
  charges: Charge[];
}

const T_UZ = {
  noDebtorsTitle: "Qarzdorlar yo'q",
  noDebtorsDesc: "Barcha hisoblar to'langan",
  searchPlaceholder: "Qarzdorni qidiring...",
  allTeachers: "Barcha o'qituvchilar",
  allGroups: "Barcha guruhlar",
  summary: (n: number) => `${n} ta qarzdor · jami`,
  emptySearchTitle: "Hech narsa topilmadi",
  emptyFilterDesc: "Filtr yoki qidiruvni o'zgartirib ko'ring",
  emptySearchDesc: "Qidiruvni o'zgartirib ko'ring",
  studentInfoTitle: "O'quvchi haqida to'liq ma'lumot",
  overdue: "Muddati o'tgan",
  attendance: (rate: number) => `Davomat ${rate}%`,
  payButton: "To'lov",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    noDebtorsTitle: "No debtors",
    noDebtorsDesc: "All charges are paid",
    searchPlaceholder: "Search for a debtor...",
    allTeachers: "All teachers",
    allGroups: "All groups",
    summary: (n: number) => `${n} debtors · total`,
    emptySearchTitle: "Nothing found",
    emptyFilterDesc: "Try changing the filter or search",
    emptySearchDesc: "Try changing your search",
    studentInfoTitle: "Full student details",
    overdue: "Overdue",
    attendance: (rate: number) => `Attendance ${rate}%`,
    payButton: "Payment",
  },
  ru: {
    noDebtorsTitle: "Должников нет",
    noDebtorsDesc: "Все начисления оплачены",
    searchPlaceholder: "Поиск должника...",
    allTeachers: "Все учителя",
    allGroups: "Все группы",
    summary: (n: number) => `Должников: ${n} · всего`,
    emptySearchTitle: "Ничего не найдено",
    emptyFilterDesc: "Попробуйте изменить фильтр или запрос",
    emptySearchDesc: "Попробуйте изменить запрос",
    studentInfoTitle: "Подробная информация об ученике",
    overdue: "Просрочен",
    attendance: (rate: number) => `Посещаемость ${rate}%`,
    payButton: "Платёж",
  },
};

/** Debtor list grouped by student — attendance % beside the debt (FINANCE.md §"edge cases"). */
export default function DebtorsTab({
  openCharges,
  attendanceRates,
  todayKey,
  classes,
  onRecordPayment,
  onShowStudent,
}: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) if (c.teacherId && !map.has(c.teacherId)) map.set(c.teacherId, c.teacherName);
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  /** Group options narrow to the picked teacher's groups. */
  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => !teacherFilter || c.teacherId === teacherFilter)
        .map((c) => ({ value: c.id, label: c.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classes, teacherFilter]
  );

  // Filters apply at the charge level, so a debtor's total reflects only the
  // selected group/teacher — "how much does he owe THIS teacher".
  const debtors = useMemo<DebtorRow[]>(() => {
    const chargeMatches = (c: Charge) => {
      if (classFilter && c.classId !== classFilter) return false;
      if (teacherFilter && classById.get(c.classId)?.teacherId !== teacherFilter) return false;
      return true;
    };
    const byStudent = new Map<string, DebtorRow>();
    for (const c of openCharges) {
      if (!chargeMatches(c)) continue;
      const open = openAmountOf(c);
      if (open <= 0) continue;
      const row = byStudent.get(c.studentId) || {
        studentId: c.studentId,
        studentName: c.studentName,
        total: 0,
        overdue: false,
        charges: [],
      };
      row.total += open;
      row.overdue = row.overdue || c.dueDate < todayKey;
      row.charges.push(c);
      byStudent.set(c.studentId, row);
    }
    return [...byStudent.values()].sort((a, b) => b.total - a.total);
  }, [openCharges, todayKey, classFilter, teacherFilter, classById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return debtors;
    return debtors.filter((d) => d.studentName.toLowerCase().includes(q));
  }, [debtors, search]);

  const hasFilters = classFilter !== "" || teacherFilter !== "" || search.trim() !== "";

  if (openCharges.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
        <EmptyState
          icon={<PartyPopper />}
          title={t.noDebtorsTitle}
          description={t.noDebtorsDesc}
        />
      </div>
    );
  }

  const grandTotal = filtered.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {debtors.length > 5 && (
          <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
        )}
        {classes.length > 1 && (
          <>
            <FilterSelect
              value={teacherFilter}
              onChange={(v) => {
                setTeacherFilter(v);
                // A group of another teacher can't stay selected.
                if (v && classFilter && classById.get(classFilter)?.teacherId !== v) setClassFilter("");
              }}
              options={teacherOptions}
              allLabel={t.allTeachers}
            />
            <FilterSelect
              value={classFilter}
              onChange={setClassFilter}
              options={classOptions}
              allLabel={t.allGroups}
            />
          </>
        )}
        <p className="text-[13px] text-on-surface-variant ml-auto">
          {t.summary(filtered.length)}{" "}
          <span className="font-bold text-error tabular-nums">{formatUZS(grandTotal)}</span>
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl">
          <EmptyState
            icon={<UserRound />}
            title={t.emptySearchTitle}
            description={hasFilters ? t.emptyFilterDesc : t.emptySearchDesc}
          />
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl divide-y divide-outline-variant overflow-hidden">
          {filtered.map((d) => {
            const rate = attendanceRates?.[d.studentId];
            return (
              <div key={d.studentId} className="px-4 py-3.5 hover:bg-state-hover transition-colors">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onShowStudent(d.studentId, d.studentName)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left group"
                    title={t.studentInfoTitle}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                        d.overdue ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {initialsOf(d.studentName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14.5px] font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                          {d.studentName}
                        </p>
                        {d.overdue && (
                          <StatusChip tone="error" noDot>
                            <AlertCircle size={11} /> {t.overdue}
                          </StatusChip>
                        )}
                        {typeof rate === "number" && (
                          <StatusChip tone={rate >= 80 ? "success" : "warning"} noDot>
                            {t.attendance(rate)}
                          </StatusChip>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {d.charges.map((c) => (
                          <span
                            key={c.id}
                            className={`px-2.5 py-1 rounded-m3-md text-[11.5px] font-semibold ${
                              c.dueDate < todayKey
                                ? "bg-error-container text-on-error-container"
                                : "bg-surface-container-highest text-on-surface-variant"
                            }`}
                          >
                            {periodLabelOf(c, lang)} · {c.classTitle} · {formatUZS(openAmountOf(c))}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-error tabular-nums">{formatUZS(d.total)}</p>
                    <div className="flex items-center gap-1.5 mt-2 justify-end">
                      <button
                        onClick={() => onShowStudent(d.studentId, d.studentName)}
                        title={t.studentInfoTitle}
                        className="w-8 h-8 rounded-full border border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors"
                      >
                        <UserRound size={14} />
                      </button>
                      <Button size="sm" icon={<Banknote />} onClick={() => onRecordPayment(d.studentId)}>
                        {t.payButton}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
