"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { CheckSquare, FileSpreadsheet, Square } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import { calculatePayrollApi } from "@/services/financeService";
import {
  buildFinanceWorkbook,
  FINANCE_EXPORT_SECTIONS,
  sectionDescription,
  sectionLabel,
  type FinanceExportSection,
} from "@/lib/finance/exportExcel";
import type { Charge, Expense, Payment } from "@/types/finance";
import { Button } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  charges: Charge[];
  payments: Payment[];
  openCharges: Charge[];
  expenses: Expense[];
  monthKey: string;
}

const T_UZ = {
  buttonLabel: "Excelga eksport",
  title: "Excelga eksport",
  subtitle: "Qaysi ma'lumotlar kerak?",
  selectAll: "Hammasi",
  export: "Eksport qilish",
  cancel: "Bekor qilish",
  error: "Eksport qilishda xatolik.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    buttonLabel: "Export to Excel",
    title: "Export to Excel",
    subtitle: "Which data do you need?",
    selectAll: "All",
    export: "Export",
    cancel: "Cancel",
    error: "Failed to export.",
  },
  ru: {
    buttonLabel: "Экспорт в Excel",
    title: "Экспорт в Excel",
    subtitle: "Какие данные нужны?",
    selectAll: "Все",
    export: "Экспортировать",
    cancel: "Отмена",
    error: "Не удалось экспортировать.",
  },
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Header action: manager picks which money-cycle sheets to include (Hisob-kitob,
 * To'lovlar, Qarzdorlar, Oyliklar, Xarajatlar — all already loaded on the page
 * except payroll, fetched fresh on export), bundles them into one .xlsx, then
 * shares the actual file via the OS share sheet (Telegram etc.) when Web Share
 * Level 2 is available, otherwise downloads it.
 */
export default function ExportFinanceButton({ charges, payments, openCharges, expenses, monthKey }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Set<FinanceExportSection>>(new Set(FINANCE_EXPORT_SECTIONS));
  const [loading, setLoading] = useState(false);

  const toggle = (section: FinanceExportSection) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const allSelected = sections.size === FINANCE_EXPORT_SECTIONS.length;
  const toggleAll = () => setSections(allSelected ? new Set() : new Set(FINANCE_EXPORT_SECTIONS));

  const run = async () => {
    if (sections.size === 0 || loading) return;
    setLoading(true);
    try {
      const payrollRows = sections.has("payroll") ? (await calculatePayrollApi(monthKey)).rows : [];
      const { blob, filename } = buildFinanceWorkbook({
        sections,
        charges,
        payments,
        openCharges,
        payrollRows,
        expenses,
        monthKey,
        lang,
      });
      const file = new File([blob], filename, { type: blob.type });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          setOpen(false);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return; // user cancelled the share sheet
          // any other share failure falls through to a plain download
        }
      }

      downloadBlob(blob, filename);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="tonal" size="sm" icon={<FileSpreadsheet />} onClick={() => setOpen(true)}>
        {t.buttonLabel}
      </Button>

      {open && (
        <ManagerSheet onClose={() => setOpen(false)} dismissible={!loading}>
          <div className="p-5 sm:p-6">
            <h3 className="text-lg font-bold text-on-surface tracking-tight">{t.title}</h3>
            <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>

            <button
              onClick={toggleAll}
              className="w-full flex items-center gap-2.5 mt-4 mb-1 px-1 py-1.5 text-[13px] font-bold text-primary"
            >
              {allSelected ? <CheckSquare size={17} /> : <Square size={17} />}
              {t.selectAll}
            </button>

            <div className="space-y-1">
              {FINANCE_EXPORT_SECTIONS.map((section) => {
                const checked = sections.has(section);
                return (
                  <button
                    key={section}
                    onClick={() => toggle(section)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-m3-md hover:bg-state-hover transition-colors text-left"
                  >
                    {checked ? (
                      <CheckSquare size={18} className="text-primary shrink-0" />
                    ) : (
                      <Square size={18} className="text-on-surface-variant shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface">{sectionLabel(section, lang)}</p>
                      <p className="text-[12px] text-on-surface-variant truncate">{sectionDescription(section, lang)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-5">
              <Button variant="tonal" onClick={() => setOpen(false)} disabled={loading} className="flex-1">
                {t.cancel}
              </Button>
              <Button onClick={run} disabled={sections.size === 0} loading={loading} className="flex-1">
                {t.export}
              </Button>
            </div>
          </div>
        </ManagerSheet>
      )}
    </>
  );
}
