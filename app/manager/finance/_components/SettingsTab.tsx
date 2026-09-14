"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Save } from "lucide-react";
import type { BillingAnchor, FinanceSettings, PercentBase } from "@/types/finance";
import { saveFinanceSettingsApi } from "@/services/financeService";
import type { ClassData } from "@/hooks/useCenterClasses";
import { Button } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";
import GroupPricesSection from "./GroupPricesSection";

interface Props {
  settings: FinanceSettings;
  onSaved: (s: FinanceSettings) => void;
  classes: ClassData[];
  /** Refetch classes + finance data after group prices change. */
  onClassesChanged: () => void;
}

// Stored values — the labels live in TRANSLATIONS.
const ANCHOR_VALUES: BillingAnchor[] = ["calendar", "enrollment"];
const PERCENT_BASE_VALUES: PercentBase[] = ["collected", "charged"];

const T_UZ = {
  dueDayError: "To'lov kuni 1–31 oralig'ida bo'lishi kerak.",
  dueDaysError: "Muddat 0–30 kun oralig'ida bo'lishi kerak.",
  saved: "Sozlamalar saqlandi.",
  saveError: "Saqlashda xatolik.",
  section1Title: "Guruh narxlari",
  section1Desc: "Har bir guruhning oylik narxi. Hisob-kitob shu narxlar asosida yaratiladi.",
  section2Title: "To'lov davri",
  section2Desc: "O'quvchilar qaysi tartibda to'laydi — bittasini tanlang.",
  anchorOptions: {
    calendar: {
      title: "Kalendar oy",
      desc: "Hamma bir xil: iyul uchun, avgust uchun... Eng oddiy va keng tarqalgan usul.",
    },
    enrollment: {
      title: "Qo'shilgan sanadan",
      desc: "Har kim o'z sanasida: 15-sanada qo'shilgan o'quvchi har oyning 15-sanasida to'laydi.",
    },
  },
  dueDayLabel: "To'lov oyning nechanchi kunigacha?",
  dueDayHint: "Masalan 5 — har oyning 5-sanasigacha. Kechiksa qarzdorlar ro'yxatida ko'rinadi.",
  dueDaysLabel: "Davr boshlangach necha kun ichida to'lanadi?",
  dueDaysHint: "Masalan 5 — davr boshidan 5 kun ichida.",
  prorateLabel: "Birinchi oy qisman hisoblansin",
  prorateDesc: "Masalan: guruh 400 000 so'm, o'quvchi oy o'rtasida qo'shildi → birinchi oy ≈ 200 000 so'm.",
  section3Title: "O'qituvchi foizi",
  section3Desc: "Bu faqat «Oyliklar» bo'limiga ta'sir qiladi — foizli oylik qaysi puldan hisoblanadi.",
  percentBaseOptions: {
    collected: {
      title: "Yig'ilgan puldan",
      desc: "Foiz REAL kelib tushgan puldan hisoblanadi. Xavfsiz — yo'q puldan oylik to'lanmaydi.",
    },
    charged: {
      title: "Hisoblangan puldan",
      desc: "Foiz o'quvchilar to'lashi KERAK bo'lgan summadan — hali to'lanmagan bo'lsa ham.",
    },
  },
  saveButton: "Sozlamalarni saqlash",
  unsaved: "Saqlanmagan o'zgarishlar bor",
  footnote: "Sozlama o'zgarishi faqat KEYINGI hisob-kitoblarga ta'sir qiladi — yaratilgan hisoblar o'zgarmaydi.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    dueDayError: "The due day must be between 1 and 31.",
    dueDaysError: "The deadline must be between 0 and 30 days.",
    saved: "Settings saved.",
    saveError: "Failed to save.",
    section1Title: "Group prices",
    section1Desc: "Each group's monthly price. Billing is generated from these prices.",
    section2Title: "Billing period",
    section2Desc: "How students pay — pick one.",
    anchorOptions: {
      calendar: {
        title: "Calendar month",
        desc: "The same for everyone: for July, for August... The simplest and most common way.",
      },
      enrollment: {
        title: "From enrollment date",
        desc: "Everyone on their own date: a student who joined on the 15th pays on the 15th of every month.",
      },
    },
    dueDayLabel: "By which day of the month is payment due?",
    dueDayHint: "E.g. 5 — by the 5th of each month. Late payers appear in the debtor list.",
    dueDaysLabel: "Within how many days after the period starts?",
    dueDaysHint: "E.g. 5 — within 5 days of the period start.",
    prorateLabel: "Prorate the first month",
    prorateDesc: "E.g.: the group costs 400 000 so'm, the student joined mid-month → first month ≈ 200 000 so'm.",
    section3Title: "Teacher percentage",
    section3Desc: "This only affects the Payroll tab — which money a percent-based salary is calculated from.",
    percentBaseOptions: {
      collected: {
        title: "From collected money",
        desc: "The percent is taken from money ACTUALLY received. Safe — salaries are never paid from money that isn't there.",
      },
      charged: {
        title: "From charged money",
        desc: "The percent is taken from what students are SUPPOSED to pay — even if not yet paid.",
      },
    },
    saveButton: "Save settings",
    unsaved: "You have unsaved changes",
    footnote: "A settings change only affects FUTURE billing runs — existing charges do not change.",
  },
  ru: {
    dueDayError: "День оплаты должен быть в диапазоне 1–31.",
    dueDaysError: "Срок должен быть в диапазоне 0–30 дней.",
    saved: "Настройки сохранены.",
    saveError: "Не удалось сохранить.",
    section1Title: "Цены групп",
    section1Desc: "Месячная цена каждой группы. Начисления создаются на основе этих цен.",
    section2Title: "Период оплаты",
    section2Desc: "Как платят ученики — выберите один вариант.",
    anchorOptions: {
      calendar: {
        title: "Календарный месяц",
        desc: "Одинаково для всех: за июль, за август... Самый простой и распространённый способ.",
      },
      enrollment: {
        title: "С даты зачисления",
        desc: "Каждый по своей дате: ученик, зачисленный 15-го числа, платит 15-го числа каждого месяца.",
      },
    },
    dueDayLabel: "До какого числа месяца нужно оплатить?",
    dueDayHint: "Например, 5 — до 5-го числа каждого месяца. При просрочке ученик появится в списке должников.",
    dueDaysLabel: "В течение скольких дней после начала периода?",
    dueDaysHint: "Например, 5 — в течение 5 дней с начала периода.",
    prorateLabel: "Считать первый месяц частично",
    prorateDesc: "Например: группа стоит 400 000 so'm, ученик пришёл в середине месяца → первый месяц ≈ 200 000 so'm.",
    section3Title: "Процент учителя",
    section3Desc: "Влияет только на раздел «Зарплаты» — от каких денег считается процентная зарплата.",
    percentBaseOptions: {
      collected: {
        title: "От собранных денег",
        desc: "Процент считается от РЕАЛЬНО поступивших денег. Безопасно — зарплата не платится из денег, которых нет.",
      },
      charged: {
        title: "От начисленных денег",
        desc: "Процент от суммы, которую ученики ДОЛЖНЫ заплатить — даже если она ещё не оплачена.",
      },
    },
    saveButton: "Сохранить настройки",
    unsaved: "Есть несохранённые изменения",
    footnote: "Изменение настроек влияет только на СЛЕДУЮЩИЕ начисления — созданные начисления не меняются.",
  },
};

function Section({
  n,
  title,
  desc,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-lg p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-primary text-on-primary text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">
          {n}
        </div>
        <div>
          <p className="text-[15px] font-bold text-on-surface">{title}</p>
          <p className="text-[12.5px] text-on-surface-variant mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Three plain-language sections: group prices (the daily need, so it's first),
 * billing cycle, teacher %. Only the fields that apply to the chosen mode are shown.
 */
export default function SettingsTab({ settings, onSaved, classes, onClassesChanged }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [anchor, setAnchor] = useState<BillingAnchor>(settings.billingAnchor);
  const [percentBase, setPercentBase] = useState<PercentBase>(settings.percentBase);
  const [prorate, setProrate] = useState(settings.prorateFirstMonth);
  const [dueDay, setDueDay] = useState(String(settings.dueDayOfMonth));
  const [dueDays, setDueDays] = useState(String(settings.dueDaysAfterStart));
  const [saving, setSaving] = useState(false);

  const dirty =
    anchor !== settings.billingAnchor ||
    percentBase !== settings.percentBase ||
    prorate !== settings.prorateFirstMonth ||
    dueDay !== String(settings.dueDayOfMonth) ||
    dueDays !== String(settings.dueDaysAfterStart);

  const save = async () => {
    const dueDayNum = parseInt(dueDay, 10);
    const dueDaysNum = parseInt(dueDays, 10);
    if (!Number.isInteger(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      toast.error(t.dueDayError);
      return;
    }
    if (!Number.isInteger(dueDaysNum) || dueDaysNum < 0 || dueDaysNum > 30) {
      toast.error(t.dueDaysError);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveFinanceSettingsApi({
        billingAnchor: anchor,
        percentBase,
        prorateFirstMonth: prorate,
        dueDayOfMonth: dueDayNum,
        dueDaysAfterStart: dueDaysNum,
      });
      toast.success(t.saved);
      onSaved(saved);
    } catch (e: any) {
      toast.error(e.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Section
        n={1}
        title={t.section1Title}
        desc={t.section1Desc}
      >
        <GroupPricesSection classes={classes} onSaved={onClassesChanged} />
      </Section>

      <Section
        n={2}
        title={t.section2Title}
        desc={t.section2Desc}
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          {ANCHOR_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => setAnchor(value)}
              className={`text-left p-4 rounded-m3-lg border-2 transition-colors ${
                anchor === value ? "border-primary bg-t-primary-soft" : "border-outline-variant hover:border-primary"
              }`}
            >
              <p className="text-[13.5px] font-bold text-on-surface">{t.anchorOptions[value].title}</p>
              <p className="text-[12px] text-on-surface-variant mt-1 leading-snug">{t.anchorOptions[value].desc}</p>
            </button>
          ))}
        </div>

        {anchor === "calendar" ? (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <p className="text-[13px] font-bold text-on-surface">{t.dueDayLabel}</p>
            <input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="w-20 px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-sm font-bold text-on-surface text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-[12px] text-on-surface-variant">{t.dueDayHint}</p>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <p className="text-[13px] font-bold text-on-surface">{t.dueDaysLabel}</p>
            <input
              type="number"
              min={0}
              max={30}
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
              className="w-20 px-3 py-2.5 bg-transparent border border-outline-variant rounded-m3-md text-sm font-bold text-on-surface text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-[12px] text-on-surface-variant">{t.dueDaysHint}</p>
          </div>
        )}

        <label className="mt-4 flex items-center justify-between gap-3 cursor-pointer bg-surface-container-low border border-outline-variant rounded-m3-lg p-4">
          <div>
            <p className="text-[13.5px] font-bold text-on-surface">{t.prorateLabel}</p>
            <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">
              {t.prorateDesc}
            </p>
          </div>
          <input
            type="checkbox"
            checked={prorate}
            onChange={(e) => setProrate(e.target.checked)}
            className="w-5 h-5 accent-primary shrink-0"
          />
        </label>
      </Section>

      <Section
        n={3}
        title={t.section3Title}
        desc={t.section3Desc}
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          {PERCENT_BASE_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => setPercentBase(value)}
              className={`text-left p-4 rounded-m3-lg border-2 transition-colors ${
                percentBase === value ? "border-primary bg-t-primary-soft" : "border-outline-variant hover:border-primary"
              }`}
            >
              <p className="text-[13.5px] font-bold text-on-surface">{t.percentBaseOptions[value].title}</p>
              <p className="text-[12px] text-on-surface-variant mt-1 leading-snug">{t.percentBaseOptions[value].desc}</p>
            </button>
          ))}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty} loading={saving} icon={<Save />}>
          {t.saveButton}
        </Button>
        {dirty && <p className="text-[12px] text-warning font-semibold">{t.unsaved}</p>}
      </div>
      <p className="text-[11.5px] text-on-surface-variant">
        {t.footnote}
      </p>
    </div>
  );
}
