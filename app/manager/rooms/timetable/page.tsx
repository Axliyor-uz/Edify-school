import { redirect } from "next/navigation";

// The weekly timetable was promoted out of Rooms to a top-level "Jadval & Xonalar"
// destination. Keep this redirect so old links / bookmarks still resolve.
export default function RoomsTimetableRedirect() {
  redirect("/manager/timetable");
}
