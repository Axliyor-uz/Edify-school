"use client";

import { ChevronRight, GraduationCap, UserCog } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  onPick: (kind: "student" | "teacher") => void;
  onClose: () => void;
}

const T_UZ = {
  title: "To'lov qabul qilish",
  subtitle: "Kimga tegishli?",
  studentLabel: "O'quvchi",
  studentDesc: "O'quvchidan to'lov qabul qilish",
  teacherLabel: "O'qituvchi",
  teacherDesc: "O'qituvchiga oylik (dars asosida) to'lash",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    title: "Record payment",
    subtitle: "Who is this for?",
    studentLabel: "Student",
    studentDesc: "Record a payment from a student",
    teacherLabel: "Teacher",
    teacherDesc: "Pay a teacher's lesson-based salary",
  },
  ru: {
    title: "Принять платёж",
    subtitle: "Кому это относится?",
    studentLabel: "Ученик",
    studentDesc: "Принять платёж от ученика",
    teacherLabel: "Учитель",
    teacherDesc: "Выплатить зарплату учителю (по урокам)",
  },
};

/** First step of "To'lov qabul qilish": pick whether the money moves for a student or a teacher. */
export default function PaymentKindSheet({ onPick, onClose }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];

  const row = (icon: React.ReactNode, label: string, desc: string, kind: "student" | "teacher") => (
    <button
      onClick={() => onPick(kind)}
      className="w-full flex items-center gap-3.5 p-3.5 rounded-m3-lg border border-outline-variant hover:border-primary hover:bg-state-hover transition-colors text-left"
    >
      <div className="w-11 h-11 rounded-m3-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-on-surface">{label}</p>
        <p className="text-[12.5px] text-on-surface-variant mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={18} className="text-on-surface-variant shrink-0" />
    </button>
  );

  return (
    <ManagerSheet onClose={onClose}>
      <div className="p-5 sm:p-6 space-y-3">
        <div>
          <h3 className="text-lg font-bold text-on-surface tracking-tight">{t.title}</h3>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        {row(<GraduationCap size={20} />, t.studentLabel, t.studentDesc, "student")}
        {row(<UserCog size={20} />, t.teacherLabel, t.teacherDesc, "teacher")}
      </div>
    </ManagerSheet>
  );
}
