"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Sparkles } from "lucide-react";
import type { BillingAnchor, GenerateChargesResult } from "@/types/finance";
import { generateChargesApi } from "@/services/financeService";
import { formatUZS } from "@/lib/finance/money";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  anchor: BillingAnchor;
  monthKey: string;
  monthLabel: string;
  /** Bumped by the page after any data change (e.g. group prices) so the preview re-runs. */
  refreshToken?: number;
  onGenerated: () => void;
}

const T_UZ = {
  created: (n: number, total: string) => `${n} ta hisob yaratildi — jami ${total}`,
  generateError: "Hisob-kitob yaratishda xatolik.",
  titleCalendar: (month: string) => `${month} uchun hisob-kitob hali yaratilmagan`,
  titleRolling: "Yangi davrlar uchun hisob-kitob hali yaratilmagan",
  previewLine: (n: number, total: string) => `${n} ta hisob · jami ${total}`,
  frozenSkipped: (n: number) => ` · ${n} ta muzlatilgan o'quvchi o'tkazib yuboriladi`,
  generate: "Yaratish",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    created: (n: number, total: string) => `${n} charges created — total ${total}`,
    generateError: "Failed to generate charges.",
    titleCalendar: (month: string) => `Charges for ${month} have not been generated yet`,
    titleRolling: "Charges for new periods have not been generated yet",
    previewLine: (n: number, total: string) => `${n} charges · total ${total}`,
    frozenSkipped: (n: number) => ` · ${n} frozen students will be skipped`,
    generate: "Generate",
  },
  ru: {
    created: (n: number, total: string) => `Создано начислений: ${n} — всего ${total}`,
    generateError: "Не удалось создать начисления.",
    titleCalendar: (month: string) => `Начисления за ${month} ещё не созданы`,
    titleRolling: "Начисления за новые периоды ещё не созданы",
    previewLine: (n: number, total: string) => `Начислений: ${n} · всего ${total}`,
    frozenSkipped: (n: number) => ` · замороженных учеников будет пропущено: ${n}`,
    generate: "Создать",
  },
};

/**
 * Detects missing charges (dryRun preview) and offers one-click generation.
 * Generation is idempotent server-side, so a double click can't double-charge
 * (FINANCE.md §4.1) — but we still disable the button while running.
 */
export default function GenerateChargesBanner({ anchor, monthKey, monthLabel, refreshToken, onGenerated }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [preview, setPreview] = useState<GenerateChargesResult | null>(null);
  const [running, setRunning] = useState(false);

  const requestBody = anchor === "calendar" ? { periodKey: monthKey } : {};

  useEffect(() => {
    let mounted = true;
    setPreview(null);
    generateChargesApi({ ...requestBody, dryRun: true })
      .then((r) => mounted && setPreview(r))
      .catch(() => {});
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, monthKey, refreshToken]);

  if (!preview || preview.created === 0) return null;

  const generate = async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await generateChargesApi(requestBody);
      toast.success(t.created(result.created, formatUZS(result.totalAmount)));
      setPreview(null);
      onGenerated();
    } catch (e: any) {
      toast.error(e.message || t.generateError);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-warning-container rounded-m3-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-11 h-11 rounded-m3-md bg-warning text-on-warning flex items-center justify-center shrink-0">
        <Sparkles size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-warning-container">
          {anchor === "calendar" ? t.titleCalendar(monthLabel) : t.titleRolling}
        </p>
        <p className="text-[12.5px] text-on-warning-container mt-0.5">
          {t.previewLine(preview.created, formatUZS(preview.totalAmount))}
          {preview.frozenSkipped > 0 && t.frozenSkipped(preview.frozenSkipped)}
        </p>
      </div>
      <button
        onClick={generate}
        disabled={running}
        className="shrink-0 px-6 py-3 bg-warning text-on-warning hover:shadow-elev-1 active:scale-[0.98] font-bold text-sm rounded-m3-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {running && <Loader2 size={15} className="animate-spin" />}
        {t.generate}
      </button>
    </div>
  );
}
