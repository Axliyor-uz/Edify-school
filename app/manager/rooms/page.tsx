"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DoorOpen, Plus, Users, Pencil, Trash2, Loader2, Building2, AlertTriangle, X, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { deleteRoom, classesUsingRoom, roomUtilization } from "@/services/roomService";
import type { Room } from "@/types/rooms";
import { roomTheme } from "@/lib/roomColors";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import RoomModal from "./_components/RoomModal";
import { FEATURE_ICON, FEATURE_LABELS } from "./_components/featureIcons";

const TRANSLATIONS = {
  uz: {
    deleted: "Xona o'chirildi.",
    deleteError: "O'chirishda xatolik.",
    title: "Xonalar",
    subtitle: "Markazingizdagi xonalarni boshqaring",
    timetable: "Jadval",
    newRoom: "Yangi xona",
    emptyTitle: "Xonalar yo'q",
    emptyDesc: "Hali xona qo'shilmagan. Guruhlarni xonalarga biriktirish uchun avval xona yarating.",
    addFirst: "Birinchi xonani qo'shish",
    inactive: "Nofaol",
    seats: "o'rin",
    groupsSuffix: "guruh",
    hoursPerWeek: "soat/hafta",
    edit: "Tahrirlash",
    cantDeleteTitle: "Xonani o'chirib bo'lmaydi",
    cantDeleteDesc: (name: string, n: number) => `«${name}» ${n} ta guruhga biriktirilgan. Avval ularni boshqa xonaga o'tkazing:`,
    understood: "Tushunarli",
    deleteTitle: "Xonani o'chirish",
    deleteDesc: (name: string) => `«${name}» butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
    cancel: "Bekor",
    delete: "O'chirish",
  },
  en: {
    deleted: "Room deleted.",
    deleteError: "Failed to delete.",
    title: "Rooms",
    subtitle: "Manage the rooms in your center",
    timetable: "Timetable",
    newRoom: "New room",
    emptyTitle: "No rooms",
    emptyDesc: "No rooms added yet. Create a room first to assign groups to rooms.",
    addFirst: "Add the first room",
    inactive: "Inactive",
    seats: "seats",
    groupsSuffix: "groups",
    hoursPerWeek: "h/week",
    edit: "Edit",
    cantDeleteTitle: "Room cannot be deleted",
    cantDeleteDesc: (name: string, n: number) => `«${name}» is assigned to ${n} groups. Move them to another room first:`,
    understood: "Got it",
    deleteTitle: "Delete room",
    deleteDesc: (name: string) => `«${name}» will be permanently deleted. This action cannot be undone.`,
    cancel: "Cancel",
    delete: "Delete",
  },
  ru: {
    deleted: "Кабинет удалён.",
    deleteError: "Ошибка при удалении.",
    title: "Кабинеты",
    subtitle: "Управляйте кабинетами вашего центра",
    timetable: "Расписание",
    newRoom: "Новый кабинет",
    emptyTitle: "Кабинетов нет",
    emptyDesc: "Кабинеты ещё не добавлены. Сначала создайте кабинет, чтобы закреплять за ним группы.",
    addFirst: "Добавить первый кабинет",
    inactive: "Неактивен",
    seats: "мест",
    groupsSuffix: "групп",
    hoursPerWeek: "ч/нед.",
    edit: "Редактировать",
    cantDeleteTitle: "Кабинет нельзя удалить",
    cantDeleteDesc: (name: string, n: number) => `«${name}» закреплён за ${n} группами. Сначала переведите их в другой кабинет:`,
    understood: "Понятно",
    deleteTitle: "Удалить кабинет",
    deleteDesc: (name: string) => `«${name}» будет удалён безвозвратно. Это действие нельзя отменить.`,
    cancel: "Отмена",
    delete: "Удалить",
  },
};
type PageT = typeof TRANSLATIONS.uz;

export default function RoomsPage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { rooms, isLoading, refetch } = useCenterRooms(centerId);
  const { classes } = useCenterClasses(centerId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);

  const utilization = useMemo(() => roomUtilization(classes), [classes]);
  const usageByRoom = useMemo(() => {
    const m = new Map<string, number>();
    rooms.forEach((r) => m.set(r.id, classesUsingRoom(classes, r.id).length));
    return m;
  }, [rooms, classes]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: Room) => { setEditing(r); setModalOpen(true); };

  const usingGroups = deleteTarget ? classesUsingRoom(classes, deleteTarget.id) : [];

  const confirmDelete = async () => {
    if (!deleteTarget || usingGroups.length > 0) return;
    setDeleting(true);
    try {
      await deleteRoom(deleteTarget.id);
      toast.success(t.deleted);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error(t.deleteError);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
            <DoorOpen className="text-primary" size={24} /> {t.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/manager/timetable"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant hover:bg-state-hover text-on-surface rounded-full font-bold text-[13px] transition-colors">
            <CalendarDays size={16} /> {t.timetable}
          </Link>
          <button onClick={openCreate}
            className="m3-interactive inline-flex items-center gap-2 pl-4 pr-5 py-2.5 bg-primary text-on-primary rounded-full font-bold text-[13px] shadow-elev-1 transition-colors">
            <Plus size={17} strokeWidth={2.5} /> {t.newRoom}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-on-surface-variant" size={30} /></div>
      ) : rooms.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-14 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3"><DoorOpen size={28} /></div>
          <h3 className="text-[15px] font-semibold text-on-surface">{t.emptyTitle}</h3>
          <p className="text-sm text-on-surface-variant mt-1 max-w-[280px]">{t.emptyDesc}</p>
          <button onClick={openCreate} className="m3-interactive mt-5 inline-flex items-center gap-2 pl-4 pr-5 py-2.5 bg-primary text-on-primary rounded-full font-bold text-[13px] transition-colors">
            <Plus size={16} /> {t.addFirst}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const th = roomTheme(room.color);
            const used = usageByRoom.get(room.id) || 0;
            const hours = utilization.get(room.id) || 0;
            return (
              <div key={room.id} className={`group relative bg-surface-container-lowest rounded-m3-xl border border-outline-variant hover:shadow-elev-2 transition-all overflow-hidden ${!room.isActive ? "opacity-60" : ""}`}>
                <div className={`h-1.5 ${th.bar}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-m3-lg flex items-center justify-center shrink-0 ${th.soft} ${th.text}`}><DoorOpen size={20} strokeWidth={2.5} /></div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold text-on-surface tracking-tight truncate">{room.name}</h3>
                        {room.building && <p className="text-[12px] text-on-surface-variant truncate flex items-center gap-1"><Building2 size={11} /> {room.building}</p>}
                      </div>
                    </div>
                    {!room.isActive && <span className="shrink-0 text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{t.inactive}</span>}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-4 text-on-surface-variant">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Users size={15} className="text-on-surface-variant" /> {room.capacity} <span className="text-[12px] text-on-surface-variant font-normal">{t.seats}</span></span>
                    <span className="text-[13px] font-semibold">{used} <span className="text-[12px] text-on-surface-variant font-normal">{t.groupsSuffix}</span></span>
                    {hours > 0 && <span className="text-[13px] font-semibold tabular-nums">{hours}<span className="text-[12px] text-on-surface-variant font-normal"> {t.hoursPerWeek}</span></span>}
                  </div>

                  {/* Features */}
                  {room.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {room.features.map((f) => {
                        const Icon = FEATURE_ICON[f];
                        return <span key={f} className="inline-flex items-center gap-1 px-2 py-1 bg-surface-container-low border border-outline-variant rounded-m3-md text-[11px] font-medium text-on-surface-variant"><Icon size={12} /> {FEATURE_LABELS[lang][f]}</span>;
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-outline-variant">
                    <button onClick={() => openEdit(room)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-surface-container-low hover:bg-state-hover hover:text-primary text-on-surface text-[13px] font-semibold transition-colors"><Pencil size={14} /> {t.edit}</button>
                    <button onClick={() => setDeleteTarget(room)} className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low hover:bg-error-container text-on-surface-variant hover:text-on-error-container transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && centerId && (
        <RoomModal centerId={centerId} room={editing} nextOrderIndex={rooms.length}
          onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); refetch(); }} />
      )}

      {/* Delete confirm / block */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-surface-container-lowest w-full max-w-sm rounded-m3-xl p-6 shadow-elev-3">
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-m3-lg flex items-center justify-center ${usingGroups.length > 0 ? "bg-warning-container text-on-warning-container" : "bg-error-container text-on-error-container"}`}>
                <AlertTriangle size={22} strokeWidth={2.5} />
              </div>
              <button onClick={() => setDeleteTarget(null)} className="w-8 h-8 rounded-m3-md flex items-center justify-center text-on-surface-variant hover:bg-state-hover"><X size={17} /></button>
            </div>
            {usingGroups.length > 0 ? (
              <>
                <h3 className="text-[16px] font-bold text-on-surface mt-4">{t.cantDeleteTitle}</h3>
                <p className="text-[13px] text-on-surface-variant mt-1.5">{t.cantDeleteDesc(deleteTarget.name, usingGroups.length)}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {usingGroups.map((c) => <span key={c.id} className="text-[12px] font-semibold text-on-secondary-container bg-secondary-container px-2.5 py-1 rounded-m3-md">{c.title}</span>)}
                </div>
                <button onClick={() => setDeleteTarget(null)} className="m3-interactive w-full mt-5 py-3 bg-inverse-surface text-inverse-on-surface font-bold rounded-full transition-colors">{t.understood}</button>
              </>
            ) : (
              <>
                <h3 className="text-[16px] font-bold text-on-surface mt-4">{t.deleteTitle}</h3>
                <p className="text-[13px] text-on-surface-variant mt-1.5">{t.deleteDesc(deleteTarget.name)}</p>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold rounded-full transition-colors disabled:opacity-60">{t.cancel}</button>
                  <button onClick={confirmDelete} disabled={deleting} className="m3-interactive flex-1 flex items-center justify-center gap-2 py-3 bg-error text-on-error font-bold rounded-full transition-colors disabled:opacity-60">
                    {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={16} />} {t.delete}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
