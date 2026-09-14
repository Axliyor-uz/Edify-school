import type { Timestamp } from "firebase/firestore";

// ─── Room domain types ───────────────────────────────────────────────────────
// Rooms are a CENTER-ONLY feature. Standalone teachers never touch these.

/** Palette key for a room's color identity (reused across list, timetable, chips). */
export type RoomColor = "indigo" | "violet" | "teal" | "amber" | "rose" | "sky" | "emerald";

export const ROOM_COLORS: RoomColor[] = ["indigo", "violet", "teal", "amber", "rose", "sky", "emerald"];

/** Physical features a room can have (used for filtering + display). */
export type RoomFeature = "projector" | "computers" | "whiteboard" | "ac" | "tv";

export const ROOM_FEATURES: RoomFeature[] = ["projector", "computers", "whiteboard", "ac", "tv"];

export const ROOM_FEATURE_LABEL: Record<RoomFeature, string> = {
  projector: "Proyektor",
  computers: "Kompyuterlar",
  whiteboard: "Doska",
  ac: "Konditsioner",
  tv: "Televizor",
};

/** `rooms/{roomId}` — a physical room in a center. */
export interface Room {
  id: string;
  centerId: string;
  name: string;
  capacity: number;
  color: RoomColor;
  features: RoomFeature[];
  building?: string;
  isActive: boolean;
  orderIndex: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Shape used when creating/editing a room from a form. */
export type RoomInput = Pick<Room, "name" | "capacity" | "color" | "features" | "isActive"> & {
  building?: string;
};
