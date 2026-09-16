"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, documentId,
  setDoc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { X, Search, UserPlus, Loader2, ArrowRight, Users, Check } from "lucide-react";
import toast from "react-hot-toast";
import { lookupByEmail } from "@/lib/directory";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import ManagerSheet from "@/app/manager/_components/ManagerSheet";
import { patchStudentFinanceApi } from "@/services/financeService";
import { managedRosterBatch } from "@/services/ieltsService";
import { getTodayKey } from "@/lib/dateUtils";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    unknown: "Noma'lum",
    alreadyInGroup: "Bu o'quvchi allaqachon guruhda.",
    onlyStudents: "Faqat o'quvchilarni qo'shish mumkin.",
    userDataNotFound: "Foydalanuvchi ma'lumotlari topilmadi.",
    userNotFound: "Foydalanuvchi topilmadi.",
    searchError: "Qidiruvda xatolik yuz berdi.",
    studentFallback: "O'quvchi",
    added: (name: string) => `${name} qo'shildi!`,
    addError: "O'quvchini qo'shishda xatolik yuz berdi.",
    title: "O'quvchi qo'shish",
    subtitle: "Ro'yxatdan tanlang yoki qidiring",
    searchPlaceholder: "Ism, username yoki email...",
    exactSearchTitle: "Aniq username/email bo'yicha qidirish",
    add: "Qo'shish",
    centerStudents: "Markaz o'quvchilari",
    noCenterStudents: "Markazda qo'shiladigan o'quvchi yo'q. Yuqoridan qidiring yoki «O'quvchilar» bo'limida hisob yarating.",
    noListMatch: "Ro'yxatda topilmadi — aniq username/email bilan qidirib ko'ring.",
    addToGroupTitle: "Guruhga qo'shish",
    noGroupBadge: "Guruhsiz",
    addSelected: (n: number) => `${n} ta o'quvchini qo'shish`,
    addedMany: (n: number) => `${n} ta o'quvchi qo'shildi!`,
  },
  en: {
    unknown: "Unknown",
    alreadyInGroup: "This student is already in the group.",
    onlyStudents: "Only students can be added.",
    userDataNotFound: "User details could not be found.",
    userNotFound: "User not found.",
    searchError: "Something went wrong during the search.",
    studentFallback: "Student",
    added: (name: string) => `${name} has been added!`,
    addError: "Something went wrong while adding the student.",
    title: "Add student",
    subtitle: "Pick from the list or search",
    searchPlaceholder: "Name, username or email...",
    exactSearchTitle: "Search by exact username/email",
    add: "Add",
    centerStudents: "Center students",
    noCenterStudents: "No addable students in the center. Search above, or create/link accounts in the Students section.",
    noListMatch: "Not found in the list — try searching by exact username/email.",
    addToGroupTitle: "Add to group",
    noGroupBadge: "No group",
    addSelected: (n: number) => `Add ${n} ${n === 1 ? "student" : "students"}`,
    addedMany: (n: number) => `${n} ${n === 1 ? "student" : "students"} added!`,
  },
  ru: {
    unknown: "Неизвестно",
    alreadyInGroup: "Этот ученик уже состоит в группе.",
    onlyStudents: "Добавлять можно только учеников.",
    userDataNotFound: "Данные пользователя не найдены.",
    userNotFound: "Пользователь не найден.",
    searchError: "Произошла ошибка при поиске.",
    studentFallback: "Ученик",
    added: (name: string) => `${name} добавлен(а)!`,
    addError: "Не удалось добавить ученика.",
    title: "Добавить ученика",
    subtitle: "Выберите из списка или найдите",
    searchPlaceholder: "Имя, username или email...",
    exactSearchTitle: "Поиск по точному username/email",
    add: "Добавить",
    centerStudents: "Ученики центра",
    noCenterStudents: "В центре нет учеников, которых можно добавить. Найдите через поиск выше или добавьте в разделе «Ученики».",
    noListMatch: "В списке не найдено — попробуйте поиск по точному username/email.",
    addToGroupTitle: "Добавить в группу",
    noGroupBadge: "Без группы",
    addSelected: (n: number) => `Добавить учеников: ${n}`,
    addedMany: (n: number) => `Добавлено учеников: ${n}!`,
  },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  classId: string;
  centerId: string;
  existingStudentIds: string[];
  /** Present on center IELTS groups — roster writes must mirror ielts_groups.studentIds. */
  ieltsGroupId?: string;
  onClose: () => void;
  /** Called after each successful add — the modal stays open for adding more. */
  onAdded: () => void;
}

interface StudentLite {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  /** Linked to the center but not yet in ANY group ("Guruhsiz") — listed first. */
  groupless: boolean;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ManagerAddStudentModal({ classId, centerId, existingStudentIds, ieltsGroupId, onClose, onAdded }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [searchInput, setSearchInput] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);

  // Multi-select: tap rows to pick several students, one button adds them all.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAddingSelected, setIsAddingSelected] = useState(false);
  const toggleSelect = (uid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  // Every center student is pickable without typing exact usernames. The roster
  // is `center_students`-anchored (THE membership source, docs/MANAGER.md) —
  // students added via "Add existing" have a link doc but often NO group yet, so
  // a class-rosters-only union would hide exactly the students the manager just
  // added. Class rosters are still merged in for legacy pre-link enrollments.
  const { classes, isLoading: loadingClasses } = useCenterClasses(centerId);
  const [centerStudents, setCenterStudents] = useState<StudentLite[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    if (loadingClasses) return;

    let cancelled = false;
    (async () => {
      try {
        const linkSnap = await getDocs(
          query(collection(db, "center_students"), where("centerId", "==", centerId))
        ).catch(() => null);

        const inAnyGroup = new Set<string>();
        classes.forEach((c) => (c.studentIds || []).forEach((id) => inAnyGroup.add(id)));

        const ids = new Set<string>(inAnyGroup);
        linkSnap?.docs.forEach((d) => {
          const sid = d.data().studentId;
          if (sid) ids.add(sid);
        });
        existingStudentIds.forEach((id) => ids.delete(id));
        const list = [...ids];

        if (list.length === 0) {
          if (!cancelled) setCenterStudents([]);
          return;
        }

        const snaps = await Promise.all(
          chunk(list, 10).map((part) =>
            getDocs(query(collection(db, "users"), where(documentId(), "in", part)))
          )
        );
        const profiles: StudentLite[] = snaps.flatMap((s) =>
          s.docs
            .filter((d) => (d.data().role || "student") === "student")
            .map((d) => {
              const data = d.data();
              return {
                uid: d.id,
                displayName: data.displayName || t.unknown,
                username: data.username || "",
                email: data.email || "",
                groupless: !inAnyGroup.has(d.id),
              };
            })
        );
        // Group-less (just-linked) students first — they are the ones the
        // manager is most likely looking for — then A→Z.
        profiles.sort((a, b) =>
          a.groupless !== b.groupless
            ? (a.groupless ? -1 : 1)
            : a.displayName.localeCompare(b.displayName)
        );
        if (!cancelled) setCenterStudents(profiles);
      } catch (err) {
        console.error("Error loading center students:", err);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();

    return () => { cancelled = true; };
  }, [classes, loadingClasses, existingStudentIds, centerId]);

  // Typing filters the center list live; the arrow button does an exact global lookup.
  const visibleCenterStudents = useMemo(() => {
    const q = searchInput.trim().toLowerCase().replace("@", "");
    if (!q) return centerStudents;
    return centerStudents.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
    );
  }, [centerStudents, searchInput]);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setFoundUser(null);

    try {
      const isEmail = searchInput.includes("@") && searchInput.includes(".");

      let uidToFetch = null;

      if (isEmail) {
        // Resolved server-side: `users.email` is no longer client-queryable (contact
        // details are owner-only now — docs/AUTH.md).
        const formattedEmail = searchInput.trim().toLowerCase();
        const match = await lookupByEmail(formattedEmail).catch(() => null);
        if (match) {
          uidToFetch = match.uid;
        }
      } else {
        const cleanName = searchInput.replace("@", "").toLowerCase().trim();
        const usernameRef = doc(db, "usernames", cleanName);
        const usernameSnap = await getDoc(usernameRef);

        if (usernameSnap.exists()) {
          uidToFetch = usernameSnap.data().uid;
        }
      }

      if (uidToFetch) {
        if (existingStudentIds.includes(uidToFetch)) {
          toast.error(t.alreadyInGroup);
          setIsSearching(false);
          return;
        }
        const userSnap = await getDoc(doc(db, "users", uidToFetch));

        if (userSnap.exists()) {
          const userData = userSnap.data();

          if (userData.role !== "student") {
            toast.error(t.onlyStudents);
            setIsSearching(false);
            return;
          }

          setFoundUser({ uid: uidToFetch, ...userData });
        } else {
          toast.error(t.userDataNotFound);
        }
      } else {
        toast.error(t.userNotFound);
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(t.searchError);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStudent = async (uid: string, displayName: string) => {
    setAddingUid(uid);
    try {
      if (ieltsGroupId) {
        // Center IELTS group — mirror the roster onto the ielts_groups twin atomically.
        await managedRosterBatch(classId, ieltsGroupId, uid, "add");
      } else {
        const classRef = doc(db, "classes", classId);
        await updateDoc(classRef, { studentIds: arrayUnion(uid) });
      }

      // Center roster link (center_students is THE membership source — the
      // students page lists from it). Merge-safe + best-effort.
      setDoc(
        doc(db, "center_students", `${centerId}_${uid}`),
        { centerId, studentId: uid, studentName: displayName || "", source: "enrolled", addedAt: serverTimestamp() },
        { merge: true },
      ).catch(() => {});

      // Finance: stamp the join date (drives rolling billing cycles + first-month
      // proration). Best-effort — generation falls back to a full charge if missing.
      patchStudentFinanceApi(uid, { enrollmentDates: { [classId]: getTodayKey() } }).catch(() => {});

      toast.success(t.added(displayName || t.studentFallback));
      setFoundUser(null);
      setSearchInput("");
      setCenterStudents((prev) => prev.filter((s) => s.uid !== uid));
      onAdded();
    } catch (error) {
      console.error("Add student failed:", error);
      toast.error(t.addError);
    } finally {
      setAddingUid(null);
    }
  };

  // Add every selected student in ONE atomic batch: class roster (+ IELTS twin
  // mirror when present) + center_students links. Finance stamps follow
  // best-effort per student, same as the single-add path.
  const handleAddSelected = async () => {
    const uids = [...selected];
    if (uids.length === 0) return;
    setIsAddingSelected(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "classes", classId), { studentIds: arrayUnion(...uids) });
      if (ieltsGroupId) {
        batch.update(doc(db, "ielts_groups", ieltsGroupId), { studentIds: arrayUnion(...uids) });
      }
      for (const uid of uids) {
        const s = centerStudents.find((c) => c.uid === uid);
        batch.set(
          doc(db, "center_students", `${centerId}_${uid}`),
          { centerId, studentId: uid, studentName: s?.displayName || "", source: "enrolled", addedAt: serverTimestamp() },
          { merge: true },
        );
      }
      await batch.commit();

      uids.forEach((uid) => {
        patchStudentFinanceApi(uid, { enrollmentDates: { [classId]: getTodayKey() } }).catch(() => {});
      });

      toast.success(t.addedMany(uids.length));
      setCenterStudents((prev) => prev.filter((s) => !selected.has(s.uid)));
      setSelected(new Set());
      onAdded();
    } catch (error) {
      console.error("Add selected students failed:", error);
      toast.error(t.addError);
    } finally {
      setIsAddingSelected(false);
    }
  };

  const hasInput = searchInput.trim().length > 0;
  const isBusy = addingUid !== null || isAddingSelected;

  return (
    <ManagerSheet onClose={onClose} dismissible={!isBusy}>
      {/* HEADER */}
      <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-outline-variant flex justify-between items-center sticky top-0 bg-surface-container-lowest z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
            <UserPlus size={19} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface tracking-tight">{t.title}</h2>
            <p className="text-xs text-on-surface-variant font-medium">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover border border-outline-variant rounded-full text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
        >
          <X size={17} strokeWidth={2.5} />
        </button>
      </div>

      {/* BODY */}
      <div className="p-5 sm:p-7">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={17} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setFoundUser(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-11 pr-14 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-sm font-medium text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !hasInput}
            title={t.exactSearchTitle}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              hasInput && !isSearching
                ? "bg-primary text-on-primary hover:shadow-elev-1 active:scale-95"
                : "bg-surface-container text-on-surface-variant border border-outline-variant"
            }`}
          >
            {isSearching ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} strokeWidth={2.5} />}
          </button>
        </div>

        {/* Exact search result */}
        {foundUser && (
          <div className="mt-4 bg-primary-container border border-outline-variant p-3.5 rounded-m3-md flex items-center gap-3">
            <div className="w-11 h-11 bg-primary rounded-full flex items-center justify-center font-bold text-on-primary text-base shrink-0">
              {foundUser.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-on-primary-container text-sm truncate">{foundUser.displayName || t.unknown}</p>
              <p className="text-xs font-medium text-on-primary-container truncate">
                {foundUser.username ? `@${foundUser.username}` : foundUser.email}
              </p>
            </div>
            <button
              onClick={() => handleAddStudent(foundUser.uid, foundUser.displayName)}
              disabled={isBusy}
              className="h-10 px-4 bg-primary text-on-primary text-[13px] font-bold rounded-full transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              {addingUid === foundUser.uid ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
              {t.add}
            </button>
          </div>
        )}

        {/* Center students */}
        <div className="mt-5">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users size={13} /> {t.centerStudents}
            {!loadingStudents && centerStudents.length > 0 && (
              <span className="text-on-surface-variant font-semibold normal-case tracking-normal">· {visibleCenterStudents.length}</span>
            )}
          </p>

          {loadingStudents || loadingClasses ? (
            <div className="space-y-2 animate-pulse">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-m3-md">
                  <div className="w-10 h-10 bg-surface-container-highest rounded-m3-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-surface-container-highest rounded w-1/2" />
                    <div className="h-2.5 bg-surface-container rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : centerStudents.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant py-4 text-center bg-surface-container-low rounded-m3-md">
              {t.noCenterStudents}
            </p>
          ) : visibleCenterStudents.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant py-4 text-center bg-surface-container-low rounded-m3-md">
              {t.noListMatch}
            </p>
          ) : (
            <div className="max-h-[40dvh] overflow-y-auto overscroll-contain -mx-1 px-1 space-y-2">
              {visibleCenterStudents.map((s) => {
                const isSelected = selected.has(s.uid);
                return (
                  <button
                    key={s.uid}
                    type="button"
                    onClick={() => toggleSelect(s.uid)}
                    disabled={isBusy}
                    aria-pressed={isSelected}
                    title={t.addToGroupTitle}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-m3-lg border transition-colors disabled:opacity-60 ${
                      isSelected
                        ? "bg-primary-container border-primary"
                        : "bg-surface-container-lowest border-outline-variant hover:border-primary"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shrink-0">
                      {s.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{s.displayName}</p>
                        {s.groupless && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-warning-container text-on-warning-container shrink-0">
                            {t.noGroupBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant truncate">{s.username ? `@${s.username}` : s.email}</p>
                    </div>
                    <span
                      aria-hidden
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-on-primary"
                          : "border-outline text-transparent"
                      }`}
                    >
                      <Check size={14} strokeWidth={3.5} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky add-all bar — appears once anything is selected */}
        {selected.size > 0 && (
          <div className="sticky bottom-0 -mx-5 sm:-mx-7 px-5 sm:px-7 pt-3 pb-1 bg-surface-container-lowest border-t border-outline-variant">
            <button
              type="button"
              onClick={handleAddSelected}
              disabled={isBusy}
              className="w-full h-t-control bg-primary text-on-primary font-bold text-sm rounded-full flex items-center justify-center gap-2 shadow-elev-1 transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {isAddingSelected ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />}
              {t.addSelected(selected.size)}
            </button>
          </div>
        )}
      </div>
    </ManagerSheet>
  );
}
