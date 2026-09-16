import { useCallback, useEffect, useState } from "react";
import { fetchCenterEmployees } from "@/services/employeeService";
import type { CenterEmployeeLink } from "@/types/employee";

/** Mirrors the teacher half of useCenterClasses — kept as its own hook since
 *  employees are an unrelated roster (no classes/groups concern). */
export function useCenterEmployees(centerId: string | null) {
  const [employees, setEmployees] = useState<CenterEmployeeLink[]>([]);
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
      const list = await fetchCenterEmployees(centerId);
      list.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "uz", { sensitivity: "base" }));
      setEmployees(list);
    } catch (err: any) {
      console.error("useCenterEmployees error:", err);
      setError(err.message || "Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { employees, isLoading, error, refetch: fetchData };
}
