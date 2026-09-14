/**
 * Face event processing service — reads face_events from Firestore,
 * converts them into staff attendance records, and marks events as processed.
 *
 * Face events are written by Cloud Functions (hikPollAttendance / hikWebhook).
 * This service listens in real-time and auto-processes them into the existing
 * center_staff_attendance collection (same format the manual grid uses).
 */
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { checkInStudent } from "./checkInService";
import type { ClassData } from "@/hooks/useCenterClasses";
import type { StaffAttendanceStatus } from "@/types/attendance";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FaceEvent {
  id: string;
  centerId: string;
  staffUid: string;
  staffName: string;
  role: string;
  at: string;           // 'YYYY-MM-DDTHH:mm:ss' (local Tashkent time)
  kind: "checkin" | "checkout";
  source: string;
  processed: boolean;
}

// ── Listener ────────────────────────────────────────────────────────────────

/**
 * Real-time listener for unprocessed face events.
 * Returns an unsubscribe function.
 */
export function listenFaceEvents(
  centerId: string,
  onEvents: (events: FaceEvent[]) => void
): () => void {
  const q = query(
    collection(db, "face_events"),
    where("centerId", "==", centerId),
    where("processed", "==", false),
    orderBy("at", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    const events: FaceEvent[] = snap.docs.map((d) => ({
      ...(d.data() as Omit<FaceEvent, "id">),
      id: d.id,
    }));
    onEvents(events);
  });
}

// ── Processing ──────────────────────────────────────────────────────────────

/** Time string from ISO: 'YYYY-MM-DDTHH:mm:ss' → 'HH:mm' */
function timeFromIso(iso: string): string {
  return iso.slice(11, 16);
}

/** Date string from ISO: 'YYYY-MM-DDTHH:mm:ss' → 'YYYY-MM-DD' */
function dateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

/** Hours between two HH:MM times (returns null if invalid). */
function hoursBetweenTimes(checkIn: string, checkOut: string): number | null {
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  if ([ih, im, oh, om].some((n) => Number.isNaN(n))) return null;
  const mins = oh * 60 + om - (ih * 60 + im);
  if (mins <= 0) return null;
  return Math.round((mins / 60) * 10) / 10;
}

/**
 * Process a single face event into the staff attendance record.
 *
 * For CHECK-IN: creates or updates the day record with checkIn time + status.
 * For CHECK-OUT: updates the existing day record with checkOut time + hours.
 */
export async function processFaceEvent(
  event: FaceEvent,
  centerId: string,
  managerId: string
): Promise<{ action: "checkin" | "checkout" | "skipped"; docId: string }> {
  const date = dateFromIso(event.at);
  const time = timeFromIso(event.at);
  const weekday = new Date(date + "T00:00:00").getDay();
  
  if (event.role === "student") {
    // ── STUDENT LOGIC ────────────────────────────────────────────────────────
    // Find all classes this student belongs to in this center
    const q = query(
      collection(db, "classes"),
      where("centerId", "==", centerId),
      where("studentIds", "array-contains", event.staffUid)
    );
    const snap = await getDocs(q);
    const classes = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassData));
    
    let checkedIn = false;
    for (const cls of classes) {
      const scheduledToday = (cls.schedule || []).some(s => s.dayOfWeek === weekday);
      // We don't have easy access to session overrides here (makeup/cancelled),
      // so we assume if they have a schedule today, we mark them present.
      // Or if it's a makeup lesson, checkInStudent will just create the "held" doc anyway.
      // To keep it simple, we mark them present for scheduled classes today.
      if (scheduledToday) {
        await checkInStudent({
          classId: cls.id,
          centerId,
          uid: event.staffUid,
          status: "present",
          markedBy: "system:face",
          date,
          weekday,
          method: "face",
        });
        checkedIn = true;
      }
    }
    
    // For students, checkouts are not strictly tracked in center_attendance per class,
    // so we just return checkin (or skipped if they had no classes today).
    return { action: checkedIn ? "checkin" : "skipped", docId: event.id };
  }

  // ── STAFF LOGIC ────────────────────────────────────────────────────────────
  const docId = `${event.staffUid}_${date}`;
  const ref = doc(db, "center_staff_attendance", docId);

  if (event.kind === "checkin") {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      // Already has a check-in — skip (don't overwrite)
      if (data.checkIn) {
        return { action: "skipped", docId };
      }
    }

    // Determine if late: staff starting after 09:00 is late (configurable later)
    const status: StaffAttendanceStatus = "present";

    await setDoc(ref, {
      id: docId,
      centerId,
      staffUid: event.staffUid,
      staffName: event.staffName,
      date,
      weekday,
      status,
      checkIn: time,
      method: "face" as const,
      markedBy: "system:face",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { action: "checkin", docId };
  }

  // CHECK-OUT
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // No check-in record — create one with both times
    await setDoc(ref, {
      id: docId,
      centerId,
      staffUid: event.staffUid,
      staffName: event.staffName,
      date,
      weekday,
      status: "present" as StaffAttendanceStatus,
      checkOut: time,
      method: "face" as const,
      markedBy: "system:face",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { action: "checkout", docId };
  }

  const data = snap.data();
  const hours = data.checkIn ? hoursBetweenTimes(data.checkIn, time) : null;

  await updateDoc(ref, {
    checkOut: time,
    ...(hours != null ? { hoursWorked: hours } : {}),
    updatedAt: serverTimestamp(),
  });

  return { action: "checkout", docId };
}

/**
 * Mark face events as processed in batch.
 */
export async function markFaceEventsProcessed(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;

  const batch = writeBatch(db);
  for (const id of eventIds) {
    batch.update(doc(db, "face_events", id), { processed: true });
  }
  await batch.commit();
}

/**
 * Process all unprocessed face events for a center.
 * Returns the count of events processed.
 */
export async function processAllFaceEvents(
  events: FaceEvent[],
  centerId: string,
  managerId: string
): Promise<{ processed: number; checkins: number; checkouts: number }> {
  let processed = 0, checkins = 0, checkouts = 0;
  const toMark: string[] = [];

  for (const event of events) {
    try {
      const result = await processFaceEvent(event, centerId, managerId);
      if (result.action === "checkin") checkins++;
      if (result.action === "checkout") checkouts++;
      processed++;
      toMark.push(event.id);
    } catch (e) {
      console.error("Failed to process face event:", event.id, e);
    }
  }

  if (toMark.length > 0) {
    await markFaceEventsProcessed(toMark);
  }

  return { processed, checkins, checkouts };
}
