"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";
import type { ClassData } from "@/hooks/useCenterClasses";
import { saveGroupFeesApi } from "@/services/financeService";
import { Button, StatusChip } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import SearchInput from "../../_components/SearchInput";

interface Props {
  classes: ClassData[];
  /** Refetch classes + finance data after prices change (banner/preview must update). */
  onSaved: () => void;
}

const T_UZ = {
  invalidPrice: "Narx noto'g'ri kiritildi — faqat butun son bo'lsin.",
  saved: (n: number) => `${n} ta guruh narxi saqlandi.`,
  saveError: "Saqlashda xatolik yuz berdi.",
  noGroups: "Markazda hali guruhlar yo'q.",
  searchPlaceholder: "Guruh yoki o'qituvchini qidiring...",
  notFound: "Guruh topilmadi",
  studentCount: (n: number) => `${n} o'quvchi`,
  noPriceChip: "narx yo'q",
  som: "so'm",
  footnote: "Narx o'zgarishi faqat KEYINGI hisob-kitoblarga ta'sir qiladi. 0 yoki bo'sh — guruh hisob-kitobga kirmaydi.",
  saveWithCount: (n: number) => `Saqlash (${n})`,
  save: "Saqlash",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    invalidPrice: "Invalid price — whole numbers only.",
    saved: (n: number) => `Prices saved for ${n} groups.`,
    saveError: "Failed to save.",
    noGroups: "The center has no groups yet.",
    searchPlaceholder: "Search for a group or teacher...",
    notFound: "No groups found",
    studentCount: (n: number) => `${n} students`,
    noPriceChip: "no price",
    som: "so'm",
    footnote: "A price change only affects FUTURE billing runs. 0 or empty — the group is excluded from billing.",
    saveWithCount: (n: number) => `Save (${n})`,
    save: "Save",
  },
  ru: {
    invalidPrice: "Цена указана неверно — только целое число.",
    saved: (n: number) => `Сохранены цены ${n} групп.`,
    saveError: "Не удалось сохранить.",
    noGroups: "В центре пока нет групп.",
    searchPlaceholder: "Поиск группы или учителя...",
    notFound: "Группы не найдены",
    studentCount: (n: number) => `Учеников: ${n}`,
    noPriceChip: "нет цены",
    som: "so'm",
    footnote: "Изменение цены влияет только на СЛЕДУЮЩИЕ начисления. 0 или пусто — группа не участвует в начислениях.",
    saveWithCount: (n: number) => `Сохранить (${n})`,
    save: "Сохранить",
  },
};

/**
 * All group prices in one editable list — same `classes.monthlyFee` field the
 * group settings page writes, so the two places can never disagree.
 */
export default function GroupPricesSection({ classes, onSaved }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed local inputs whenever classes (re)load — after a save the refetch
  // brings the stored values back, so edits are never silently lost.
  useEffect(() => {
    setPrices(Object.fromEntries(classes.map((c) => [c.id, c.monthlyFee ? String(c.monthlyFee) : ""])));
  }, [classes]);

  const parsedOf = (id: string): number | null => {
    const raw = (prices[id] ?? "").trim();
    if (raw === "") return 0;
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const changedIds = useMemo(
    () => classes.filter((c) => parsedOf(c.id) !== (c.monthlyFee || 0)).map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, prices]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.teacherName || "").toLowerCase().includes(q)
    );
  }, [classes, search]);

  const save = async () => {
    if (saving || changedIds.length === 0) return;
    const fees: Record<string, number> = {};
    for (const id of changedIds) {
      const n = parsedOf(id);
      if (n === null) {
        toast.error(t.invalidPrice);
        return;
      }
      fees[id] = n;
    }
    setSaving(true);
    try {
      // One API call — the server validates ownership and writes all fees in a
      // single batch, so there is never a "half saved" state.
      const { updated } = await saveGroupFeesApi(fees);
      toast.success(t.saved(updated));
      onSaved();
    } catch (err: any) {
      console.error("Group price save error:", err);
      toast.error(err.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (classes.length === 0) {
    return <p className="text-[13px] text-on-surface-variant">{t.noGroups}</p>;
  }

  return (
    <div className="space-y-3">
      {classes.length > 5 && (
        <SearchInput value={search} onChange={setSearch} placeholder={t.searchPlaceholder} />
      )}

      <div className="divide-y divide-outline-variant border border-outline-variant rounded-m3-lg">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-on-surface-variant">{t.notFound}</p>
        ) : (
          filtered.map((c) => {
            const hasPrice = (prices[c.id] ?? "").trim() !== "" && parsedOf(c.id) !== 0;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{c.title}</p>
                  <p className="text-[12px] text-on-surface-variant mt-0.5 truncate">
                    {c.teacherName} · {t.studentCount(c.studentIds?.length || 0)}
                  </p>
                </div>
                {!hasPrice && (
                  <StatusChip tone="warning" noDot className="shrink-0">
                    {t.noPriceChip}
                  </StatusChip>
                )}
                <div className="relative shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={prices[c.id] ?? ""}
                    onChange={(e) => setPrices((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder="0"
                    className="w-36 pl-3 pr-12 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-sm font-bold text-on-surface tabular-nums text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-on-surface-variant pointer-events-none">
                    {t.som}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11.5px] text-on-surface-variant">
          {t.footnote}
        </p>
        <Button onClick={save} disabled={changedIds.length === 0} loading={saving} icon={<Save />}>
          {changedIds.length > 0 ? t.saveWithCount(changedIds.length) : t.save}
        </Button>
      </div>
    </div>
  );
}
