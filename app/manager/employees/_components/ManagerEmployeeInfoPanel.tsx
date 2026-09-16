"use client";

/**
 * Employee info panel (docs/EMPLOYEES.md) — mirrors the shape of
 * ManagerTeacherInfoPanel/ManagerStudentInfoPanel (mobile-first M3 dialog,
 * bottom sheet on phones) but much simpler: no groups section (employees
 * don't teach), no credentials card (no login account exists). Two blocks:
 * identity (edit name/role/phone) and salary (fixed + hourly + allowances/
 * deductions, via the finance API — the one payroll-adjacent write here).
 */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Phone, Plus, Save, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/manager-ui";
import { updateEmployee } from "@/services/employeeService";
import { saveEmployeeSalaryApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { EMPLOYEE_ROLES, EMPLOYEE_ROLE_LABELS, type CenterEmployeeLink } from "@/types/employee";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  employee: CenterEmployeeLink;
  onClose: () => void;
  onChanged: () => void;
}

const T_UZ = {
  editTitle: "Ma'lumotlarni tahrirlash",
  fullName: "To'liq ism",
  roleLabel: "Lavozim",
  phone: "Telefon",
  save: "Saqlash",
  saved: "Saqlandi.",
  saveError: "Saqlashda xatolik.",
  salaryTitle: "Oylik sozlamalari",
  fixedLabel: "Fiks oylik (so'm)",
  fixedHint: "Har oy o'zgarmas summa. Bo'sh — yo'q.",
  hourlyLabel: "Soatlik narx (so'm)",
  hourlyHint: "Davomatdagi ishlangan soatlarga ko'paytiriladi. Bo'sh — yo'q.",
  allowancesLabel: "Ustamalar",
  deductionsLabel: "Ushlab qolishlar",
  addLine: "Qo'shish",
  linePlaceholder: "Nomi",
  amountPlaceholder: "Summa",
  salarySaved: "Oylik sozlamalari saqlandi.",
  close: "Yopish",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    editTitle: "Edit details",
    fullName: "Full name",
    roleLabel: "Role",
    phone: "Phone",
    save: "Save",
    saved: "Saved.",
    saveError: "Failed to save.",
    salaryTitle: "Salary settings",
    fixedLabel: "Fixed salary (so'm)",
    fixedHint: "A fixed amount every month. Empty — none.",
    hourlyLabel: "Hourly rate (so'm)",
    hourlyHint: "Multiplied by hours worked, from attendance. Empty — none.",
    allowancesLabel: "Allowances",
    deductionsLabel: "Deductions",
    addLine: "Add",
    linePlaceholder: "Label",
    amountPlaceholder: "Amount",
    salarySaved: "Salary settings saved.",
    close: "Close",
  },
  ru: {
    editTitle: "Редактировать данные",
    fullName: "Полное имя",
    roleLabel: "Должность",
    phone: "Телефон",
    save: "Сохранить",
    saved: "Сохранено.",
    saveError: "Не удалось сохранить.",
    salaryTitle: "Настройки зарплаты",
    fixedLabel: "Фикс. оклад (so'm)",
    fixedHint: "Постоянная сумма каждый месяц. Пусто — нет.",
    hourlyLabel: "Ставка за час (so'm)",
    hourlyHint: "Умножается на отработанные часы из посещаемости. Пусто — нет.",
    allowancesLabel: "Надбавки",
    deductionsLabel: "Удержания",
    addLine: "Добавить",
    linePlaceholder: "Название",
    amountPlaceholder: "Сумма",
    salarySaved: "Настройки зарплаты сохранены.",
    close: "Закрыть",
  },
};

type Line = { label: string; amount: string };
const toLines = (arr?: { label: string; amount: number }[]): Line[] =>
  (arr || []).map((a) => ({ label: a.label, amount: String(a.amount) }));

function LineEditor({
  title,
  lines,
  onChange,
  t,
}: {
  title: string;
  lines: Line[];
  onChange: (lines: Line[]) => void;
  t: typeof T_UZ;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] font-bold text-on-surface-variant">{title}</p>
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={line.label}
            onChange={(e) => onChange(lines.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
            placeholder={t.linePlaceholder}
            className="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-m3-md text-[13px] text-on-surface focus:outline-none focus:border-primary"
          />
          <input
            type="number"
            inputMode="numeric"
            value={line.amount}
            onChange={(e) => onChange(lines.map((l, j) => (j === i ? { ...l, amount: e.target.value } : l)))}
            placeholder={t.amountPlaceholder}
            className="w-28 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-m3-md text-[13px] text-on-surface tabular-nums focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...lines, { label: "", amount: "" }])}
        className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary hover:opacity-80 transition-opacity"
      >
        <Plus size={14} /> {t.addLine}
      </button>
    </div>
  );
}

export default function ManagerEmployeeInfoPanel({ employee, onClose, onChanged }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  const [employeeName, setEmployeeName] = useState(employee.employeeName);
  const [role, setRole] = useState(employee.role);
  const [phone, setPhone] = useState(employee.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [fixed, setFixed] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [allowances, setAllowances] = useState<Line[]>([]);
  const [deductions, setDeductions] = useState<Line[]>([]);
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryLoaded, setSalaryLoaded] = useState(false);

  // Salary is write-only via the finance API, but reads are plain Firestore —
  // hydrate once from the same roster doc the list page already fetched.
  useEffect(() => {
    const salary = employee.salary;
    if (salary) {
      setFixed(salary.fixed ? String(salary.fixed) : "");
      setHourlyRate(salary.hourlyRate ? String(salary.hourlyRate) : "");
      setAllowances(toLines(salary.allowances));
      setDeductions(toLines(salary.deductions));
    }
    setSalaryLoaded(true);
  }, [employee]);

  const saveProfile = async () => {
    if (employeeName.trim().length < 3) return;
    setSavingProfile(true);
    try {
      await updateEmployee(employee.id, { employeeName, role, phone });
      toast.success(t.saved);
      onChanged();
    } catch {
      toast.error(t.saveError);
    } finally {
      setSavingProfile(false);
    }
  };

  const linesPayload = (lines: Line[]) =>
    lines
      .filter((l) => l.label.trim() && Number(l.amount) > 0)
      .map((l) => ({ label: l.label.trim(), amount: Math.round(Number(l.amount)) }));

  const saveSalary = async () => {
    setSavingSalary(true);
    try {
      await saveEmployeeSalaryApi(employee.id, {
        fixed: fixed ? Math.round(Number(fixed)) : null,
        hourlyRate: hourlyRate ? Math.round(Number(hourlyRate)) : null,
        allowances: linesPayload(allowances),
        deductions: linesPayload(deductions),
      });
      toast.success(t.salarySaved);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || t.saveError);
    } finally {
      setSavingSalary(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest w-full sm:max-w-lg sm:rounded-m3-xl rounded-t-m3-2xl max-h-[92vh] overflow-y-auto custom-scrollbar shadow-elev-3">
        <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-on-surface truncate">{employee.employeeName}</p>
              <p className="text-[12px] text-on-surface-variant">{EMPLOYEE_ROLE_LABELS[employee.role][lang]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center bg-surface-container-low hover:bg-state-hover text-on-surface-variant rounded-full transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity */}
          <section className="space-y-3">
            <p className="text-[13px] font-bold text-on-surface-variant">{t.editTitle}</p>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-on-surface-variant ml-1">{t.fullName}</label>
              <input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-on-surface-variant ml-1">{t.roleLabel}</label>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYEE_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-2 rounded-m3-md text-[12.5px] font-bold border transition-colors ${
                      role === r
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary"
                    }`}
                  >
                    {EMPLOYEE_ROLE_LABELS[r][lang]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-on-surface-variant ml-1">{t.phone}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                  <Phone size={16} />
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <Button onClick={saveProfile} loading={savingProfile} icon={<Save size={16} />} className="w-full">
              {t.save}
            </Button>
          </section>

          <div className="h-px bg-outline-variant" />

          {/* Salary */}
          {salaryLoaded && (
            <section className="space-y-3">
              <p className="text-[13px] font-bold text-on-surface-variant">{t.salaryTitle}</p>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-on-surface-variant ml-1">{t.fixedLabel}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fixed}
                  onChange={(e) => setFixed(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] text-on-surface tabular-nums focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-on-surface-variant ml-1">{t.fixedHint}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-on-surface-variant ml-1">{t.hourlyLabel}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] text-on-surface tabular-nums focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-on-surface-variant ml-1">{t.hourlyHint}</p>
              </div>

              <LineEditor title={t.allowancesLabel} lines={allowances} onChange={setAllowances} t={t} />
              <LineEditor title={t.deductionsLabel} lines={deductions} onChange={setDeductions} t={t} />

              <Button onClick={saveSalary} loading={savingSalary} icon={<Save size={16} />} className="w-full">
                {t.save}
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
