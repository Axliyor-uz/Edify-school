import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ScheduleEntry } from "@/types/attendance";

// ─── Interfaces ───────────────────────────────────────────────
export interface ClassData {
  id: string;
  title: string;
  description: string;
  joinCode: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  studentCount: number;
  isLocked: boolean;
  createdAt: any;
  schedule?: ScheduleEntry[];
  /** Finance: integer so'm per month; missing/0 → group is not billed. */
  monthlyFee?: number;
  /** Center membership anchor (2026-07-15) — set at create, immutable client-side. */
  centerId?: string;
  /** Linked ielts_groups doc id (2026-07-29) — present only on center IELTS groups.
   *  Roster writes must mirror ielts_groups.studentIds (managedRosterBatch). */
  ieltsGroupId?: string;
}

export interface CenterTeacher {
  id: string;
  centerId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  teacherPhoto?: string | null;
  addedAt: any;
}

// ─── Hook ─────────────────────────────────────────────────────
export function useCenterClasses(centerId: string | null) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<CenterTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!centerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 🟢 centerId-ANCHORED MEMBERSHIP (2026-07-15): a class belongs to the
      // center iff classes.centerId == centerId. A linked teacher's personal /
      // other-center groups never appear here — only groups created IN the
      // center do. The teachers list still comes from center_teachers (that
      // link is employment, not group ownership).
      const [ctSnapshot, classSnapshot] = await Promise.all([
        getDocs(query(collection(db, "center_teachers"), where("centerId", "==", centerId))),
        getDocs(query(collection(db, "classes"), where("centerId", "==", centerId))),
      ]);

      const centerTeachers: CenterTeacher[] = ctSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CenterTeacher[];

      setTeachers(centerTeachers);

      const allClasses: ClassData[] = classSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ClassData[];

      // Sort by createdAt descending (newest first)
      allClasses.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setClasses(allClasses);
    } catch (err: any) {
      console.error("useCenterClasses error:", err);
      setError(err.message || "Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { classes, teachers, isLoading, error, refetch: fetchData };
}
