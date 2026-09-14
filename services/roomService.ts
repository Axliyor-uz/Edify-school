import {
  collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Room, RoomInput } from "@/types/rooms";
import type { ScheduleEntry } from "@/types/attendance";
import type { ClassData } from "@/hooks/useCenterClasses";

// ─── Room CRUD + the shared scheduling conflict engine ───────────────────────
// Single source of truth for overlap/conflict/utilization — reused by the room
// assignment editor, the timetable, and any validation. Keep this logic here.

export async function fetchCenterRooms(centerId: string): Promise<Room[]> {
  const qy = query(collection(db, "rooms"), where("centerId", "==", centerId), orderBy("orderIndex", "asc"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Room);
}

export async function createRoom(centerId: string, input: RoomInput, orderIndex: number): Promise<string> {
  const ref = await addDoc(collection(db, "rooms"), {
    centerId,
    name: input.name.trim(),
    capacity: input.capacity,
    color: input.color,
    features: input.features,
    ...(input.building ? { building: input.building.trim() } : {}),
    isActive: input.isActive,
    orderIndex,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRoom(roomId: string, input: RoomInput): Promise<void> {
  await updateDoc(doc(db, "rooms", roomId), {
    name: input.name.trim(),
    capacity: input.capacity,
    color: input.color,
    features: input.features,
    building: input.building?.trim() || "",
    isActive: input.isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoom(roomId: string): Promise<void> {
  await deleteDoc(doc(db, "rooms", roomId));
}

// ─── Conflict engine ─────────────────────────────────────────────────────────

/** True when [aStart,aEnd) and [bStart,bEnd) overlap. HH:MM strings compare lexicographically. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Minutes in a slot (endTime - startTime), 0 if malformed/negative. */
function slotMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export interface Clash {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  otherClassId: string;
  otherClassTitle: string;
  otherStart: string;
  otherEnd: string;
  /** Present for room clashes. */
  roomName?: string;
}

export interface ConflictResult {
  roomClashes: Clash[];
  teacherClashes: Clash[];
}

/**
 * Check a proposed `schedule` for `targetClassId` against every OTHER center class.
 * - room clash: another class in the same room, same weekday, overlapping time.
 * - teacher clash: the same teacher (targetTeacherId) teaching elsewhere at an overlapping time.
 */
export function findScheduleConflicts(
  allClasses: ClassData[],
  targetClassId: string,
  targetTeacherId: string,
  schedule: ScheduleEntry[],
): ConflictResult {
  const roomClashes: Clash[] = [];
  const teacherClashes: Clash[] = [];
  const others = allClasses.filter((c) => c.id !== targetClassId);

  for (const slot of schedule) {
    for (const other of others) {
      for (const os of other.schedule || []) {
        if (os.dayOfWeek !== slot.dayOfWeek) continue;
        if (!overlaps(slot.startTime, slot.endTime, os.startTime, os.endTime)) continue;

        if (slot.roomId && os.roomId === slot.roomId) {
          roomClashes.push({
            dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime,
            otherClassId: other.id, otherClassTitle: other.title,
            otherStart: os.startTime, otherEnd: os.endTime, roomName: slot.roomName,
          });
        }
        if (targetTeacherId && other.teacherId === targetTeacherId) {
          teacherClashes.push({
            dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime,
            otherClassId: other.id, otherClassTitle: other.title,
            otherStart: os.startTime, otherEnd: os.endTime,
          });
        }
      }
    }
  }
  return { roomClashes, teacherClashes };
}

/** Groups currently using a room (for referential-integrity checks on delete). */
export function classesUsingRoom(allClasses: ClassData[], roomId: string): ClassData[] {
  return allClasses.filter((c) => (c.schedule || []).some((s) => s.roomId === roomId));
}

/** Booked hours per week for each room id. */
export function roomUtilization(allClasses: ClassData[]): Map<string, number> {
  const mins = new Map<string, number>();
  for (const c of allClasses) {
    for (const s of c.schedule || []) {
      if (!s.roomId) continue;
      mins.set(s.roomId, (mins.get(s.roomId) || 0) + slotMinutes(s.startTime, s.endTime));
    }
  }
  const hours = new Map<string, number>();
  mins.forEach((m, id) => hours.set(id, Math.round((m / 60) * 10) / 10));
  return hours;
}
