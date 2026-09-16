"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { FileText, Calendar, Clock } from "lucide-react";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    locale: "uz-UZ",
    emptyTitle: "Topshiriqlar yo'q",
    emptyDesc: "O'qituvchi test berganda shu yerda ko'rinadi",
    untitledTest: "Nomsiz test",
    unknownDate: "Noma'lum",
    dueLabel: "Muddat:",
    noDeadline: "Muddatsiz",
    active: "Faol",
  },
  en: {
    locale: "en-US",
    emptyTitle: "No assignments",
    emptyDesc: "They will appear here once the teacher assigns a test",
    untitledTest: "Untitled test",
    unknownDate: "Unknown",
    dueLabel: "Due:",
    noDeadline: "No deadline",
    active: "Active",
  },
  ru: {
    locale: "ru-RU",
    emptyTitle: "Заданий нет",
    emptyDesc: "Они появятся здесь, когда учитель назначит тест",
    untitledTest: "Тест без названия",
    unknownDate: "Неизвестно",
    dueLabel: "Срок:",
    noDeadline: "Без срока",
    active: "Активно",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Assignment {
  id: string;
  testTitle: string;
  createdAt: any;
  dueAt: any;
  status: string;
}

export default function ManagerOversightTab({ classId }: { classId: string }) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchAssignments() {
      setLoading(true);
      try {
        const q = query(
          collection(db, `classes/${classId}/assignments`),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Assignment[];

        if (isMounted) setAssignments(data);
      } catch (err) {
        console.error("Error fetching assignments:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAssignments();
    return () => { isMounted = false; };
  }, [classId]);

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-3 animate-pulse">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="p-4 bg-surface-container-low rounded-m3-md space-y-2.5">
            <div className="h-4 bg-surface-container-highest rounded w-1/2" />
            <div className="h-3 bg-surface-container rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="py-14 px-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
          <FileText size={22} />
        </div>
        <p className="text-sm font-bold text-on-surface mt-3">{t.emptyTitle}</p>
        <p className="text-[13px] text-on-surface-variant mt-1 max-w-[280px] mx-auto">
          {t.emptyDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-outline-variant">
      {assignments.map((assignment) => {
        const isLate = assignment.dueAt && new Date() > new Date(assignment.dueAt.seconds * 1000);

        return (
          <div key={assignment.id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-state-hover transition-colors">
            <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center shrink-0">
              <FileText size={18} strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[14.5px] font-semibold text-on-surface truncate">{assignment.testTitle || t.untitledTest}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[12.5px] text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-on-surface-variant" />
                  {assignment.createdAt?.toDate ? assignment.createdAt.toDate().toLocaleDateString(t.locale) : t.unknownDate}
                </span>
                {assignment.dueAt ? (
                  <span className={`flex items-center gap-1 ${isLate ? "text-error font-semibold" : ""}`}>
                    <Clock size={12} />
                    {t.dueLabel} {assignment.dueAt.toDate().toLocaleString(t.locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {t.noDeadline}
                  </span>
                )}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
              assignment.status === "active"
                ? "bg-success-container text-on-success-container"
                : "bg-surface-container-highest text-on-surface-variant"
            }`}>
              {assignment.status === "active" ? t.active : assignment.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
