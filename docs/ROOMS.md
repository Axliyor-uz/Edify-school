# ROOMS — Room Management & Timetable

> **Agent workflow:** read this BEFORE touching room/timetable code; update it in the same change whenever you alter behavior described here. Rooms model the physical spaces where groups meet, with a weekly timetable and conflict detection. Pairs with [ATTENDANCE.md](ATTENDANCE.md) (shares `ScheduleEntry` + the query-safe rules pattern). Index: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`) — checked against code; accurate.

**Center-only feature.** All room UI lives under `app/manager/**`. Standalone teachers (no
`center_teachers` link) never see rooms; room fields on a class are optional, so non-center classes are
unaffected.

---

## 0. Rules you must not violate
1. **Never write `undefined`** (Firestore rejects it). Room slot fields (`roomId`/`roomName`) are added
   conditionally — a slot with no room simply omits them. Same for optional room fields (`building`).
2. **Query-safe rules**: `rooms` uses `allow list: if isAuth()` + strict `get`; writes are manager-only.
   Never put a per-document `get()` in a `list` rule (access-limit → permission error). Same lesson as attendance.
3. **One conflict engine.** All overlap/conflict/utilization logic lives in `services/roomService.ts`.
   The assignment editor, the timetable, and validation all call it — don't reimplement overlap math.
4. **Overlap test**: `aStart < bEnd && bStart < aEnd` on zero-padded `HH:MM` (lexicographic). Touching
   edges (`end === start`) is NOT a conflict.
5. **Referential integrity**: never delete a room that's assigned to a group slot — block and list the
   using groups (`classesUsingRoom`). Never leave a dangling `roomId`.

---

## 1. File map
| File | Purpose |
|------|---------|
| `types/rooms.ts` | `Room`, `RoomColor`, `RoomFeature` (+ labels), `RoomInput`. |
| `types/attendance.ts` | `ScheduleEntry` — shared; carries optional `roomId?/roomName?` per slot. |
| `services/roomService.ts` | CRUD + **conflict engine**: `overlaps`, `findScheduleConflicts`, `classesUsingRoom`, `roomUtilization`, `fetchCenterRooms`, `createRoom/updateRoom/deleteRoom`. |
| `hooks/useCenterRooms.ts` | Loads a center's rooms (getDocs + refetch), mirrors `useCenterClasses`. |
| `lib/roomColors.ts` | `ROOM_THEME` — Tailwind bundles per color (bar/dot/soft/text/ring/cell). One source of truth for how a room looks everywhere. |
| `app/manager/rooms/page.tsx` | Rooms CRUD (card grid, usage count, utilization hours, delete w/ integrity). |
| `app/manager/rooms/_components/RoomModal.tsx` | Create/edit room (name, capacity, building, color, features, active). |
| `app/manager/rooms/_components/featureIcons.tsx` | Icon per `RoomFeature`. |
| `app/manager/timetable/page.tsx` | Weekly grid: rooms × weekdays, group+teacher chips, room clashes red, teacher-clash count, day/teacher filters, "Biriktirilmagan" row. **Promoted to a top-level "Jadval & Xonalar" nav item** (`/manager/rooms/timetable` now redirects here). **Editable**: click a booking → a drawer with that group's `ScheduleTab` (`autoEdit`); click an empty room×day cell → pick a group → editor opens `prefill`ed with that room+day. Saves apply optimistically (schedule `overrides`) then `refetch`. |
| `app/manager/groups/_shared/ScheduleTab.tsx` | **Where rooms are assigned** (moved here from attendance; 2026-09-14 promoted to `_shared`) — per-slot room picker ("same room for all" default + per-day), live conflict panel (room/teacher/capacity), "Bo'sh xona" suggestion, room chips in view mode. Reused by the timetable drawer via optional `autoEdit` (open in edit mode) + `prefill` (`{ dayOfWeek, roomId }`) props, AND by both group-detail routes below. |
| `app/manager/groups/detail/[classId]/page.tsx` · `[schoolClassId]/subjects/[classId]/page.tsx` | Group detail (IELTS/unlinked groups) and School Class subject detail (2026-09-14, [MANAGER.md](MANAGER.md)) — each renders its own schedule+room summary chips and a **"Jadval & xona" tab** (in-page, renders the shared `ScheduleTab`). |
| `services/schoolClassService.ts` (`addSubjectGroup`), `app/manager/groups/_components/CreateIeltsGroupModal.tsx` | Write `centerId` on group/subject create. |
| `app/manager/dashboard/page.tsx` | "N/M xona band" (rooms in use now) + room chip on today's lessons. |
| `app/manager/layout.tsx` | **Sectioned** sidebar ("Jadval & Xonalar" section holds Dars jadvali + Xonalar); full-width layout for `/manager/timetable`. |

---

## 2. Data model
### NEW — `rooms/{roomId}`
```ts
{ id, centerId, name, capacity: number,
  color: RoomColor,           // indigo|violet|teal|amber|rose|sky|emerald
  features: RoomFeature[],    // projector|computers|whiteboard|ac|tv
  building?, isActive: boolean, orderIndex: number, createdAt, updatedAt }
```
Query: `where centerId == orderBy orderIndex`. No composite index needed.

### MODIFY — `classes/{id}`
- Each `schedule` entry may carry `roomId?` + `roomName?` (per-slot; optional).
- `centerId` now written on create. Existing classes without it still work (timetable/conflicts read
  classes via `useCenterClasses`, which is teacher-based). No backfill required.

### Rules (`firestore.rules`, near `crm_leads` in §16)
`rooms`: `get` = manager/center-teacher; `list = isAuth()`; create/update/delete = center manager.
**Requires a rules redeploy** (`npx firebase-tools deploy --only firestore:rules`).

---

## 3. Conflict engine (`roomService.ts`)
- `findScheduleConflicts(allClasses, targetClassId, targetTeacherId, schedule)` → `{ roomClashes, teacherClashes }`.
  Room clash = another class, same weekday, overlapping time, **same `roomId`**. Teacher clash = same
  `targetTeacherId` teaching elsewhere at an overlapping time (any room).
- Capacity is a **soft** warning (`studentCount > room.capacity`), computed in the UI, never blocks save.
- Conflicts are **warnings, not blocks** — the manager can intentionally override (split groups, etc.).
- `roomUtilization(allClasses)` → `Map<roomId, hoursPerWeek>`. `classesUsingRoom(allClasses, roomId)` → groups using it.

---

## 4. How to extend
- **New room feature** → add to `RoomFeature`/`ROOM_FEATURES`/`ROOM_FEATURE_LABEL` (`types/rooms.ts`) +
  `FEATURE_ICON` (`_components/featureIcons.tsx`).
- **New room color** → add to `RoomColor`/`ROOM_COLORS` + `ROOM_THEME` (`lib/roomColors.ts`).
- **New surface that shows a room** → use `roomTheme(color)` for consistent styling; get the schedule
  from `useCenterClasses`, rooms from `useCenterRooms`.
- **Any new conflict/utilization view** → call `roomService` helpers; don't reimplement overlap logic.

## 5. Verification (dev server)
- **Rooms**: create/edit/delete; deleting an assigned room is blocked with the using groups listed.
- **Assign**: group's schedule (via `/manager/groups/detail/{classId}` or a School Class's `/manager/groups/{schoolClassId}/subjects/{classId}` → Jadval & xona) → pick a room;
  double-book a room/time → amber conflict panel names the clashing group; over-capacity → warning;
  "Bo'sh xona" suggests a free room. Room chips show in view mode + on the group page.
- **Timetable**: `/manager/timetable` shows every booking in its room/day; a real double-book is
  red in both cells; teacher-clash count in the header; day/teacher filters work; unassigned bookings
  appear in the "Biriktirilmagan" row. **Edit**: click any booking → drawer editor → change time/room →
  save → the chip moves on the grid instantly. **Add**: click an empty cell → pick a group → save; the
  booking appears in that room/day. A clash chip (red) opens straight into the conflict panel.
- **Dashboard**: "N/M xona band" reflects the current Tashkent time; today's lessons show their room.
- Confirm a **standalone teacher** sees no room UI; confirm no `undefined` writes / permission errors
  after deploying rules.
