import { useState, useEffect, useCallback } from "react";
import { fetchSchoolClasses, SchoolClassData } from "@/services/schoolClassService";

/** Mirrors useCenterClasses: one `where centerId==` query over school_classes. */
export function useSchoolClasses(centerId: string | null) {
  const [schoolClasses, setSchoolClasses] = useState<SchoolClassData[]>([]);
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
      setSchoolClasses(await fetchSchoolClasses(centerId));
    } catch (err: any) {
      console.error("useSchoolClasses error:", err);
      setError(err.message || "Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { schoolClasses, isLoading, error, refetch: fetchData };
}
