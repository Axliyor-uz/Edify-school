"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { CalendarCheck, Clock, ArrowLeft, Loader2, Users, DoorOpen, Pencil, CalendarX2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import AttendanceTab from "./_components/AttendanceTab";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TRANSLATIONS = {
  uz: {
    days: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"], // index = getDay()
    noCenter: "Manager centerId topilmadi.",
    genericError: "Xatolik yuz berdi.",
    back: "Davomatlarga qaytish",
    teacherLabel: "O'qituvchi:",
    lessonCount: (n: number) => `${n} dars`,
    studentCount: (n: number) => `${n} o'quvchi`,
    tabAttendance: "Davomat",
    tabSchedule: "Dars Jadvali",
    scheduleHint: "Dars jadvali va xonalar shu yerda ko'rsatiladi. Tahrirlash guruh sahifasida.",
    editSchedule: "Jadvalni tahrirlash",
    noScheduleTitle: "Jadval belgilanmagan",
    noScheduleDesc: "Bu guruh uchun hali dars jadvali kiritilmagan. Guruh sahifasida qo'shing.",
    noRoom: "Xona belgilanmagan",
  },
  en: {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], // index = getDay()
    noCenter: "Manager centerId not found.",
    genericError: "Something went wrong.",
    back: "Back to attendance",
    teacherLabel: "Teacher:",
    lessonCount: (n: number) => `${n} lessons`,
    studentCount: (n: number) => `${n} students`,
    tabAttendance: "Attendance",
    tabSchedule: "Schedule",
    scheduleHint: "The lesson schedule and rooms are shown here. Edit them on the group page.",
    editSchedule: "Edit schedule",
    noScheduleTitle: "No schedule set",
    noScheduleDesc: "No lesson schedule has been added for this group yet. Add it on the group page.",
    noRoom: "No room assigned",
  },
  ru: {
    days: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], // index = getDay()
    noCenter: "centerId менеджера не найден.",
    genericError: "Произошла ошибка.",
    back: "Назад к посещаемости",
    teacherLabel: "Учитель:",
    lessonCount: (n: number) => `${n} занятий`,
    studentCount: (n: number) => `${n} учеников`,
    tabAttendance: "Посещаемость",
    tabSchedule: "Расписание",
    scheduleHint: "Здесь показаны расписание занятий и кабинеты. Редактирование — на странице группы.",
    editSchedule: "Редактировать расписание",
    noScheduleTitle: "Расписание не задано",
    noScheduleDesc: "Для этой группы ещё не введено расписание занятий. Добавьте его на странице группы.",
    noRoom: "Кабинет не назначен",
  },
};
type PageT = typeof TRANSLATIONS.uz;

export interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: string;
  roomName?: string;
}

export interface AttendanceClassDocument {
  id: string;
  title: string;
  teacherName: string;
  teacherId: string;
  studentIds: string[];
  schedule?: ScheduleEntry[];
  joinCode: string;
  centerId?: string;
}

export default function AttendanceClassPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];

  const [classData, setClassData] = useState<AttendanceClassDocument | null>(null);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false); // bad classId → branded 404
  const [activeTab, setActiveTab] = useState<"schedule" | "attendance">("attendance");

  useEffect(() => {
    if (!user || !classId) return;

    const load = async () => {
      try {
        setLoading(true);
        const profile = await getUserProfile(user.uid);
        if (!profile?.centerId) throw new Error(t.noCenter);
        setCenterId(profile.centerId);

        const snap = await getDoc(doc(db, "classes", classId));
        if (!snap.exists()) { setMissing(true); return; } // → not-found boundary

        const data = { id: snap.id, ...snap.data() } as AttendanceClassDocument;

        // The class must belong to this center: centerId-anchored membership
        // (same check as the group detail page — URLs must not leak other
        // centers' or a teacher's personal classes).
        if ((data as { centerId?: string }).centerId !== profile.centerId) {
          setMissing(true);
          return;
        }

        setClassData(data);
      } catch (err) {
        toast.error((err as Error)?.message || t.genericError);
        router.push("/manager/attendance");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, classId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (missing) notFound(); // renders app/manager/not-found.tsx
  if (!classData) return null;

  return (
    <div className="space-y-3">
      {/* Back */}
      <Link
        href="/manager/attendance"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-on-surface-variant hover:text-primary transition-colors"
      >
        <ArrowLeft size={14} /> {t.back}
      </Link>

      {/* Compact header row: title + stats */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-on-surface tracking-tight leading-tight truncate">
            {classData.title}
          </h1>
          <p className="text-[12px] text-on-surface-variant truncate">
            {t.teacherLabel} <span className="font-medium text-on-surface">{classData.teacherName}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full">
            <CalendarCheck size={14} className="text-on-surface-variant" />
            <span className="text-[12px] font-semibold text-on-surface whitespace-nowrap tabular-nums">
              {t.lessonCount(classData.schedule?.length || 0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full">
            <Users size={14} className="text-on-surface-variant" />
            <span className="text-[12px] font-semibold text-on-surface whitespace-nowrap tabular-nums">
              {t.studentCount(classData.studentIds?.length || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs — clearly differentiable (filled active pill) */}
      <div className="inline-flex items-center gap-0.5 p-1 bg-surface-container-lowest border border-outline-variant rounded-full">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-[13px] transition-colors ${
            activeTab === "attendance"
              ? "bg-primary text-on-primary shadow-elev-1"
              : "text-on-surface-variant hover:bg-state-hover hover:text-primary"
          }`}
        >
          <CalendarCheck size={15} /> {t.tabAttendance}
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-[13px] transition-colors ${
            activeTab === "schedule"
              ? "bg-primary text-on-primary shadow-elev-1"
              : "text-on-surface-variant hover:bg-state-hover hover:text-primary"
          }`}
        >
          <Clock size={15} /> {t.tabSchedule}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl min-h-[400px] overflow-hidden">
        {activeTab === "schedule" && (
          <div className="p-4 sm:p-5">
            {/* Read-only view — editing lives on the group page (single source of truth). */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-[13px] text-on-surface-variant">
                {t.scheduleHint}
              </p>
              <Link
                href={`/manager/groups/detail/${classData.id}`}
                className="m3-interactive inline-flex items-center gap-1.5 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-[12.5px] font-bold transition-colors shrink-0"
              >
                <Pencil size={14} /> {t.editSchedule}
              </Link>
            </div>

            {(classData.schedule?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3"><CalendarX2 size={26} /></div>
                <h3 className="text-sm font-semibold text-on-surface">{t.noScheduleTitle}</h3>
                <p className="text-[13px] text-on-surface-variant mt-1.5 max-w-[320px]">{t.noScheduleDesc}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[...(classData.schedule || [])]
                  .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek))
                  .map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-lg">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-bold text-on-surface">{t.days[s.dayOfWeek]}</p>
                        <p className="text-[12.5px] text-on-surface-variant tabular-nums mt-0.5">{s.startTime}–{s.endTime}</p>
                      </div>
                      {s.roomName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[12px] font-semibold shrink-0">
                          <DoorOpen size={13} /> {s.roomName}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-on-surface-variant shrink-0">{t.noRoom}</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
        {activeTab === "attendance" && centerId && (
          <AttendanceTab
            classId={classData.id}
            centerId={centerId}
            studentIds={classData.studentIds || []}
            managerId={user?.uid || ""}
            schedule={classData.schedule || []}
          />
        )}
      </div>
    </div>
  );
}
