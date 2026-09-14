import { Projector, Monitor, Presentation, AirVent, Tv } from "lucide-react";
import type { RoomFeature } from "@/types/rooms";
import type { LangType } from "@/app/manager/_components/ManagerLanguage";

// Icon per room feature — shared by the modal, room cards, and timetable tooltips.
export const FEATURE_ICON: Record<RoomFeature, React.ElementType> = {
  projector: Projector,
  computers: Monitor,
  whiteboard: Presentation,
  ac: AirVent,
  tv: Tv,
};

// Display labels per language — the stored feature KEYS ('projector'…) never change.
// (uz values mirror ROOM_FEATURE_LABEL in types/rooms.ts.)
export const FEATURE_LABELS: Record<LangType, Record<RoomFeature, string>> = {
  uz: { projector: "Proyektor", computers: "Kompyuterlar", whiteboard: "Doska", ac: "Konditsioner", tv: "Televizor" },
  en: { projector: "Projector", computers: "Computers", whiteboard: "Whiteboard", ac: "Air conditioner", tv: "TV" },
  ru: { projector: "Проектор", computers: "Компьютеры", whiteboard: "Доска", ac: "Кондиционер", tv: "Телевизор" },
};
