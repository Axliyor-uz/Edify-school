import { useState, useEffect, useCallback } from "react";
import { fetchCenterRooms } from "@/services/roomService";
import type { Room } from "@/types/rooms";

/** Loads a center's rooms (ordered). Mirrors useCenterClasses (getDocs + refetch). */
export function useCenterRooms(centerId: string | null) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!centerId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      setRooms(await fetchCenterRooms(centerId));
    } catch (err) {
      console.error("useCenterRooms error:", err);
      setError(err instanceof Error ? err.message : "Xonalarni yuklashda xatolik.");
    } finally {
      setIsLoading(false);
    }
  }, [centerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { rooms, isLoading, error, refetch: fetchData };
}
