"use client";

/**
 * Manager links an EXISTING student account to the center — class-free (the
 * roster is centerId-anchored via center_students; groups come later). Lookup
 * by email (server-side /api/directory/lookup) or @username (public usernames
 * read). Multi-center: linking here never touches other centers' links.
 */

import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { lookupByEmail } from "@/lib/directory";
import { X, Search, User, Loader2, UserPlus, AtSign } from "lucide-react";
import toast from "react-hot-toast";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    notAStudent: "Bu hisob o'quvchi emas.",
    usernameNotFound: "Bunday username topilmadi.",
    userNotFound: "Foydalanuvchi topilmadi.",
    alreadyLinked: "Bu o'quvchi markazga allaqachon qo'shilgan.",
    searchError: "Qidirishda xatolik yuz berdi.",
    unknown: "Noma'lum",
    added: (name: string) => `${name} markazga qo'shildi!`,
    addError: "Qo'shishda xatolik yuz berdi.",
    title: "Mavjud o'quvchini qo'shish",
    subtitle: "Email yoki @username orqali toping — guruhsiz ham qo'shiladi.",
    inputPlaceholder: "email yoki @username",
    searchButton: "Qidirish",
    addButton: "Qo'shish",
    hint: "O'quvchi tizimda ro'yxatdan o'tgan bo'lishi kerak. Yangi hisob kerak boʻlsa — \"Yangi hisob yaratish\"dan foydalaning.",
  },
  en: {
    notAStudent: "This account is not a student.",
    usernameNotFound: "No such username was found.",
    userNotFound: "User not found.",
    alreadyLinked: "This student is already added to the center.",
    searchError: "Something went wrong during the search.",
    unknown: "Unknown",
    added: (name: string) => `${name} has been added to the center!`,
    addError: "Something went wrong while adding.",
    title: "Add an existing student",
    subtitle: "Find them by email or @username — they can be added without a group.",
    inputPlaceholder: "email or @username",
    searchButton: "Search",
    addButton: "Add",
    hint: "The student must already be registered in the system. If a new account is needed, use \"Create a new account\".",
  },
  ru: {
    notAStudent: "Этот аккаунт не является учеником.",
    usernameNotFound: "Такой username не найден.",
    userNotFound: "Пользователь не найден.",
    alreadyLinked: "Этот ученик уже добавлен в центр.",
    searchError: "Произошла ошибка при поиске.",
    unknown: "Неизвестно",
    added: (name: string) => `${name} добавлен(а) в центр!`,
    addError: "Не удалось добавить ученика.",
    title: "Добавить существующего ученика",
    subtitle: "Найдите по email или @username — можно добавить и без группы.",
    inputPlaceholder: "email или @username",
    searchButton: "Найти",
    addButton: "Добавить",
    hint: "Ученик должен быть зарегистрирован в системе. Если нужен новый аккаунт — воспользуйтесь «Создать новый аккаунт».",
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  centerId: string;
  onClose: () => void;
  /** Fired after a successful link so the page can refresh the roster. */
  onAdded?: () => void;
}

interface FoundStudent {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AddExistingStudentModal({ centerId, onClose, onAdded }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [found, setFound] = useState<FoundStudent | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFound(null);
    const q = input.trim().toLowerCase().replace(/^@/, "");
    if (!q) return;

    setSearching(true);
    try {
      let uid: string;
      if (q.includes("@")) {
        // Email path — server-side lookup (role comes back with it).
        const match = await lookupByEmail(q); // throws on 404
        if (match.role !== "student") throw new Error(t.notAStudent);
        uid = match.uid;
      } else {
        // Username path — public usernames doc → users doc.
        const unameSnap = await getDoc(doc(db, "usernames", q));
        if (!unameSnap.exists()) throw new Error(t.usernameNotFound);
        uid = unameSnap.data().uid;
      }

      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) throw new Error(t.userNotFound);
      const u = userSnap.data();
      if (u.role !== "student") throw new Error(t.notAStudent);

      // Already in THIS center? (get on own-center link is always allowed)
      const linkSnap = await getDoc(doc(db, "center_students", `${centerId}_${uid}`));
      if (linkSnap.exists()) throw new Error(t.alreadyLinked);

      setFound({ uid, displayName: u.displayName || t.unknown, username: u.username, photoURL: u.photoURL });
    } catch (err: any) {
      setError(err.message || t.searchError);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!found) return;
    setAdding(true);
    try {
      await setDoc(doc(db, "center_students", `${centerId}_${found.uid}`), {
        centerId,
        studentId: found.uid,
        studentName: found.displayName,
        source: "linked",
        addedAt: serverTimestamp(),
      });
      toast.success(t.added(found.displayName));
      onAdded?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t.addError);
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !adding && onClose()}></div>
      <div className="relative bg-surface-container-lowest w-full sm:max-w-md rounded-t-m3-xl sm:rounded-m3-xl p-6 sm:p-8 shadow-elev-3">

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
            <Search size={22} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.title}</h2>
            <p className="text-[13px] text-on-surface-variant">{t.subtitle}</p>
          </div>
          <button type="button" onClick={() => !adding && onClose()}
            className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover text-on-surface-variant rounded-full transition-colors shrink-0">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
              <AtSign size={18} />
            </div>
            <input
              type="text" required value={input} autoFocus
              onChange={(e) => { setInput(e.target.value); setError(""); setFound(null); }}
              disabled={searching || adding}
              placeholder={t.inputPlaceholder}
              className="w-full pl-11 pr-24 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
            <button type="submit" disabled={searching || adding || !input.trim()}
              className="absolute inset-y-1.5 right-1.5 px-4 bg-primary text-on-primary font-bold text-[13px] rounded-m3-sm transition-colors disabled:opacity-60 flex items-center gap-1.5">
              {searching ? <Loader2 size={14} className="animate-spin" /> : t.searchButton}
            </button>
          </div>

          {error && (
            <p className="text-[13px] font-bold text-error px-1">{error}</p>
          )}

          {found && (
            <div className="flex items-center gap-3 p-4 bg-primary-container rounded-m3-lg">
              {found.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={found.photoURL} alt={found.displayName} className="w-11 h-11 rounded-full object-cover border border-outline-variant shrink-0" />
              ) : (
                <span className="w-11 h-11 rounded-full bg-primary text-on-primary font-bold text-[13px] flex items-center justify-center shrink-0">
                  {getInitials(found.displayName)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-on-primary-container truncate">{found.displayName}</p>
                {found.username && <p className="text-[12px] text-on-primary-container truncate">@{found.username}</p>}
              </div>
              <button type="button" onClick={handleAdd} disabled={adding}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary font-bold text-[13px] rounded-full transition-colors disabled:opacity-60 shadow-elev-1">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {t.addButton}
              </button>
            </div>
          )}

          {!found && !error && (
            <div className="flex items-center gap-3 p-4 bg-surface-container-low border border-outline-variant rounded-m3-lg">
              <User size={18} className="text-on-surface-variant shrink-0" />
              <p className="text-[12.5px] text-on-surface-variant font-medium">
                {t.hint}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
