"use client";

import { useState } from "react";
import { DoorOpen, Loader2, Check, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import { createRoom, updateRoom } from "@/services/roomService";
import { ROOM_COLORS, ROOM_FEATURES } from "@/types/rooms";
import type { Room, RoomColor, RoomFeature, RoomInput } from "@/types/rooms";
import { ROOM_THEME } from "@/lib/roomColors";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import { FEATURE_ICON, FEATURE_LABELS } from "./featureIcons";

const TRANSLATIONS = {
  uz: {
    updated: "Xona yangilandi!",
    created: "Xona qo'shildi!",
    saveError: "Saqlashda xatolik yuz berdi.",
    editTitle: "Xonani tahrirlash",
    newTitle: "Yangi xona",
    subtitle: "Nomi, sig'imi va jihozlarini kiriting",
    name: "Nomi",
    namePlaceholder: "Xona 4 / Lab 1",
    capacity: "Sig'im",
    building: "Bino (ixtiyoriy)",
    buildingPlaceholder: "Asosiy bino / 2-qavat",
    color: "Rang",
    features: "Jihozlar",
    active: "Faol xona",
    cancel: "Bekor qilish",
    saving: "Saqlanmoqda...",
    save: "Saqlash",
    add: "Qo'shish",
  },
  en: {
    updated: "Room updated!",
    created: "Room added!",
    saveError: "Something went wrong while saving.",
    editTitle: "Edit room",
    newTitle: "New room",
    subtitle: "Enter its name, capacity and equipment",
    name: "Name",
    namePlaceholder: "Room 4 / Lab 1",
    capacity: "Capacity",
    building: "Building (optional)",
    buildingPlaceholder: "Main building / 2nd floor",
    color: "Color",
    features: "Equipment",
    active: "Active room",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save",
    add: "Add",
  },
  ru: {
    updated: "Кабинет обновлён!",
    created: "Кабинет добавлен!",
    saveError: "Ошибка при сохранении.",
    editTitle: "Редактировать кабинет",
    newTitle: "Новый кабинет",
    subtitle: "Укажите название, вместимость и оснащение",
    name: "Название",
    namePlaceholder: "Кабинет 4 / Лаб 1",
    capacity: "Вместимость",
    building: "Здание (необязательно)",
    buildingPlaceholder: "Главный корпус / 2-й этаж",
    color: "Цвет",
    features: "Оснащение",
    active: "Активный кабинет",
    cancel: "Отмена",
    saving: "Сохранение...",
    save: "Сохранить",
    add: "Добавить",
  },
};
type ModalT = typeof TRANSLATIONS.uz;

interface Props {
  centerId: string;
  room?: Room | null;      // edit mode when present
  nextOrderIndex: number;  // used for new rooms
  onClose: () => void;
  onSaved: () => void;
}

export default function RoomModal({ centerId, room, nextOrderIndex, onClose, onSaved }: Props) {
  const { lang } = useManagerLanguage();
  const t: ModalT = TRANSLATIONS[lang];
  const editing = !!room;
  const [name, setName] = useState(room?.name || "");
  const [capacity, setCapacity] = useState<number>(room?.capacity ?? 15);
  const [building, setBuilding] = useState(room?.building || "");
  const [color, setColor] = useState<RoomColor>(room?.color || "indigo");
  const [features, setFeatures] = useState<RoomFeature[]>(room?.features || []);
  const [isActive, setIsActive] = useState(room?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const toggleFeature = (f: RoomFeature) =>
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const input: RoomInput = { name, capacity: Math.max(1, capacity || 1), color, features, isActive, building };
    try {
      if (editing && room) await updateRoom(room.id, input);
      else await createRoom(centerId, input, nextOrderIndex);
      toast.success(editing ? t.updated : t.created);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative bg-surface-container-lowest w-full max-w-md rounded-m3-xl p-6 sm:p-7 shadow-elev-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3.5 mb-6">
          <div className={`w-12 h-12 rounded-m3-lg flex items-center justify-center ${ROOM_THEME[color].soft} ${ROOM_THEME[color].text}`}>
            <DoorOpen size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface tracking-tight">{editing ? t.editTitle : t.newTitle}</h2>
            <p className="text-[13px] text-on-surface-variant font-medium">{t.subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name + capacity */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.name} <span className="text-error">*</span></label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} disabled={saving}
                placeholder={t.namePlaceholder}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.capacity}</label>
              <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} disabled={saving}
                className="w-full px-3 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60 tabular-nums" />
            </div>
          </div>

          {/* Building (optional) */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1 flex items-center gap-1.5"><Building2 size={13} className="text-on-surface-variant" /> {t.building}</label>
            <input type="text" value={building} onChange={(e) => setBuilding(e.target.value)} disabled={saving}
              placeholder={t.buildingPlaceholder}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60" />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.color}</label>
            <div className="flex items-center gap-2.5">
              {ROOM_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                  className={`w-8 h-8 rounded-full ${ROOM_THEME[c].bar} transition-transform active:scale-90 ${color === c ? `ring-2 ring-offset-2 ring-offset-[var(--m3-surface-container-lowest)] ${ROOM_THEME[c].ring}` : "opacity-60 hover:opacity-100"}`}>
                  {/* fixed white — sits on ROOM_THEME saturated swatches, same in light & dark */}
                  {color === c && <Check size={16} className="text-white mx-auto" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.features}</label>
            <div className="flex flex-wrap gap-2">
              {ROOM_FEATURES.map((f) => {
                const Icon = FEATURE_ICON[f];
                const on = features.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-m3-md text-[12.5px] font-semibold border transition-colors ${on ? "bg-secondary-container border-transparent text-on-secondary-container" : "bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-state-hover"}`}>
                    <Icon size={14} /> {FEATURE_LABELS[lang][f]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <button type="button" onClick={() => setIsActive((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low border border-outline-variant rounded-m3-md">
            <span className="text-[13.5px] font-semibold text-on-surface">{t.active}</span>
            <span className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-surface-container-highest"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface-container-lowest rounded-full shadow-elev-1 transition-transform ${isActive ? "translate-x-5" : "translate-x-0"}`} />
            </span>
          </button>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-3.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold rounded-full transition-colors disabled:opacity-60">{t.cancel}</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="m3-interactive flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary font-bold rounded-full transition-colors disabled:opacity-60 shadow-elev-1">
              {saving ? <><Loader2 size={18} className="animate-spin" /> {t.saving}</> : editing ? t.save : t.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
