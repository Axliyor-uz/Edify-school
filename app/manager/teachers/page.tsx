"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Mail, User, Loader2, Phone, BadgeCheck, Layers, Users, BookOpen, ArrowRight, UserPlus, Search, X } from "lucide-react";
import { collection, query, where, getDoc, setDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { getContactOf, lookupByEmail } from "@/lib/directory";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import { Button } from "@/components/manager-ui";
import ManagerTeacherInfoPanel from "./_components/ManagerTeacherInfoPanel";
import CreateTeacherModal from "./_components/CreateTeacherModal";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    dateLocale: "uz-UZ",
    loadError: "O'qituvchilarni yuklashda xatolik yuz berdi.",
    addedSuccess: "O'qituvchi muvaffaqiyatli qo'shildi!",
    deletedSuccess: "O'qituvchi o'chirildi.",
    deleteError: "O'qituvchini o'chirishda xatolik yuz berdi.",
    noCenterInfo: "Markaz ma'lumotlari topilmadi.",
    notTeacher: "Bu foydalanuvchi o'qituvchi emas.",
    linkedOtherCenter: "Bu o'qituvchi boshqa markazga biriktirilgan. Avval u markazdan chiqarilishi kerak.",
    alreadyAdded: "Bu o'qituvchi markazga allaqachon qo'shilgan.",
    genericError: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
    title: "O'qituvchilar",
    subtitle: "Markazdagi barcha o'qituvchilar",
    teacherCount: (n: number) => `${n} o'qituvchi`,
    addTeacher: "O'qituvchi qo'shish",
    emptyTitle: "Hali o'qituvchilar yo'q",
    emptyDesc: "Birinchi o'qituvchini email orqali qo'shing",
    verified: "Tasdiqlangan",
    experienceLabel: (n: number) => `${n} yil tajriba`,
    addedOn: "Qo'shilgan:",
    justNow: "hozirgina",
    groupsWord: "guruh",
    studentsWord: "o'quvchi",
    deleteTeacherTitle: "O'qituvchini markazdan o'chirish",
    viewProfile: "Profilni ko'rish",
    createNewAccount: "Yangi hisob yaratish",
    createNewAccountDesc: "Login va parol bilan tayyor hisob tuziladi",
    addExistingAccount: "Mavjud hisobni qo'shish",
    addExistingAccountDesc: "Ro'yxatdan o'tgan o'qituvchini email orqali topish",
    addModalDesc: "Emailini kiriting — tizimdan topib qo'shamiz.",
    teacherEmailLabel: "O'qituvchi emaili",
    emailPlaceholder: "misol@gmail.com",
    cancel: "Bekor qilish",
    searching: "Qidirilmoqda...",
    add: "Qo'shish",
    deleteConfirmTitle: "O'chirishni tasdiqlang",
    deleteConfirmSuffix: "markazdan o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
    deleting: "O'chirilmoqda...",
    delete: "O'chirish",
  },
  en: {
    dateLocale: "en-US",
    loadError: "Failed to load teachers.",
    addedSuccess: "Teacher added successfully!",
    deletedSuccess: "Teacher removed.",
    deleteError: "Failed to remove the teacher.",
    noCenterInfo: "Center information not found.",
    notTeacher: "This user is not a teacher.",
    linkedOtherCenter: "This teacher is linked to another center. They must be removed from that center first.",
    alreadyAdded: "This teacher has already been added to the center.",
    genericError: "Something went wrong. Please try again.",
    title: "Teachers",
    subtitle: "All teachers in the center",
    teacherCount: (n: number) => `${n} teachers`,
    addTeacher: "Add teacher",
    emptyTitle: "No teachers yet",
    emptyDesc: "Add your first teacher by email",
    verified: "Verified",
    experienceLabel: (n: number) => `${n} years experience`,
    addedOn: "Added:",
    justNow: "just now",
    groupsWord: "groups",
    studentsWord: "students",
    deleteTeacherTitle: "Remove teacher from center",
    viewProfile: "View profile",
    createNewAccount: "Create new account",
    createNewAccountDesc: "A ready account with a login and password is created",
    addExistingAccount: "Add existing account",
    addExistingAccountDesc: "Find a registered teacher by email",
    addModalDesc: "Enter their email — we'll find and add them.",
    teacherEmailLabel: "Teacher's email",
    emailPlaceholder: "example@gmail.com",
    cancel: "Cancel",
    searching: "Searching...",
    add: "Add",
    deleteConfirmTitle: "Confirm removal",
    deleteConfirmSuffix: "will be removed from the center. This action cannot be undone.",
    deleting: "Removing...",
    delete: "Remove",
  },
  ru: {
    dateLocale: "ru-RU",
    loadError: "Не удалось загрузить учителей.",
    addedSuccess: "Учитель успешно добавлен!",
    deletedSuccess: "Учитель удалён.",
    deleteError: "Не удалось удалить учителя.",
    noCenterInfo: "Информация о центре не найдена.",
    notTeacher: "Этот пользователь не является учителем.",
    linkedOtherCenter: "Этот учитель привязан к другому центру. Сначала его нужно открепить от того центра.",
    alreadyAdded: "Этот учитель уже добавлен в центр.",
    genericError: "Произошла ошибка. Попробуйте ещё раз.",
    title: "Учителя",
    subtitle: "Все учителя центра",
    teacherCount: (n: number) => `${n} учителей`,
    addTeacher: "Добавить учителя",
    emptyTitle: "Учителей пока нет",
    emptyDesc: "Добавьте первого учителя по email",
    verified: "Подтверждён",
    experienceLabel: (n: number) => `${n} лет опыта`,
    addedOn: "Добавлен:",
    justNow: "только что",
    groupsWord: "групп",
    studentsWord: "учеников",
    deleteTeacherTitle: "Удалить учителя из центра",
    viewProfile: "Просмотреть профиль",
    createNewAccount: "Создать новый аккаунт",
    createNewAccountDesc: "Готовый аккаунт с логином и паролем",
    addExistingAccount: "Добавить существующий аккаунт",
    addExistingAccountDesc: "Найти зарегистрированного учителя по email",
    addModalDesc: "Введите email — мы найдём и добавим его.",
    teacherEmailLabel: "Email учителя",
    emailPlaceholder: "primer@gmail.com",
    cancel: "Отмена",
    searching: "Поиск...",
    add: "Добавить",
    deleteConfirmTitle: "Подтвердите удаление",
    deleteConfirmSuffix: "будет удалён из центра. Это действие нельзя отменить.",
    deleting: "Удаление...",
    delete: "Удалить",
  },
};
type T = typeof TRANSLATIONS.uz;

interface CenterTeacher {
  id?: string;
  centerId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  addedAt: any;
}

/** Extra profile fields hydrated from `users/{uid}` for the card view. */
interface TeacherProfile {
  photoURL?: string;
  phone?: string;
  subject?: string;
  experience?: number;
  verifiedTeacher?: boolean;
}

// Deterministic tonal fill for teachers without a photo (token containers).
const AVATAR_TINTS = [
  "bg-primary-container text-on-primary-container",
  "bg-secondary-container text-on-secondary-container",
  "bg-tertiary-container text-on-tertiary-container",
  "bg-surface-container-highest text-on-surface-variant",
];
function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TeachersPage() {
  const { user } = useAuth() as any;
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<CenterTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal state
  const [emailInput, setEmailInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Info modal state
  const [viewingTeacher, setViewingTeacher] = useState<CenterTeacher | null>(null);
  
  // Delete modal state
  const [teacherToDelete, setTeacherToDelete] = useState<CenterTeacher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hydrated profile fields (photo, phone, subject...) keyed by teacher uid.
  const [profiles, setProfiles] = useState<Record<string, TeacherProfile>>({});

  // Center classes → per-teacher group/student counts for the cards.
  const { classes } = useCenterClasses(centerId);
  const teacherStats = useMemo(() => {
    const m = new Map<string, { groups: number; students: number }>();
    for (const c of classes) {
      const cur = m.get(c.teacherId) || { groups: 0, students: 0 };
      cur.groups += 1;
      cur.students += c.studentIds?.length || 0;
      m.set(c.teacherId, cur);
    }
    return m;
  }, [classes]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch manager's centerId
    getUserProfile(user.uid).then(profile => {
      if (profile?.centerId) {
        setCenterId(profile.centerId);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error("Error fetching profile:", err);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!centerId) return;

    // Listen to center_teachers collection
    const q = query(
      collection(db, "center_teachers"),
      where("centerId", "==", centerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: CenterTeacher[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as CenterTeacher);
      });
      // Sort by addedAt if available
      results.sort((a, b) => {
         const timeA = a.addedAt?.toMillis ? a.addedAt.toMillis() : Date.now();
         const timeB = b.addedAt?.toMillis ? b.addedAt.toMillis() : Date.now();
         return timeB - timeA;
      });
      setTeachers(results);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teachers:", error);
      toast.error(t.loadError);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [centerId]);

  // Hydrate photo/phone/subject from `users/{uid}` for every listed teacher.
  useEffect(() => {
    if (teachers.length === 0) return;
    let mounted = true;
    (async () => {
      try {
        // Public profile from the users doc; the phone comes from /api/directory/contact,
        // which verifies this teacher really belongs to my center (docs/AUTH.md).
        const [snaps, contacts] = await Promise.all([
          Promise.all(teachers.map((t) => getDoc(doc(db, "users", t.teacherId)))),
          Promise.all(
            teachers.map((t) => getContactOf(t.teacherId).catch(() => ({ email: "", phone: "" }))),
          ),
        ]);
        if (!mounted) return;
        const map: Record<string, TeacherProfile> = {};
        snaps.forEach((s, i) => {
          if (!s.exists()) return;
          const d = s.data();
          map[teachers[i].teacherId] = {
            photoURL: d.photoURL,
            phone: contacts[i].phone,
            subject: d.subject,
            experience: d.experience,
            verifiedTeacher: d.verifiedTeacher,
          };
        });
        setProfiles(map);
      } catch (err) {
        console.error("Teacher profile hydration error:", err);
      }
    })();
    return () => { mounted = false; };
  }, [teachers]);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) {
        setModalError(t.noCenterInfo);
        return;
    }
    
    setModalError("");
    setIsSubmitting(true);
    
    try {
      const formattedEmail = emailInput.trim().toLowerCase();

      // 1. Resolve the email server-side. `users.email` is no longer client-queryable
      // (contact details are owner-only now — docs/AUTH.md), and this route also stops
      // any signed-in user from using the old query as an email→account oracle.
      const foundUserData = await lookupByEmail(formattedEmail); // throws "Bu email tizimda topilmadi." on 404
      const foundUserUid = foundUserData.uid;

      // 2. Validation 1 (Role)
      if (foundUserData.role !== "teacher") {
        throw new Error(t.notTeacher);
      }
      
      // 3. Membership check (doc ID = teacher uid, so one center per teacher).
      // Never silently overwrite another center's membership.
      // Rules allow this get only when the doc is missing or belongs to MY
      // center — permission-denied here means "linked to another center".
      const ctDocRef = doc(db, "center_teachers", foundUserUid);
      let existingMembership;
      try {
        existingMembership = await getDoc(ctDocRef);
      } catch (err: any) {
        if (err?.code === "permission-denied") {
          throw new Error(t.linkedOtherCenter);
        }
        throw err;
      }

      if (existingMembership.exists()) {
        if (existingMembership.data().centerId === centerId) {
          throw new Error(t.alreadyAdded);
        }
        throw new Error(t.linkedOtherCenter);
      }
      
      // 4. The Write
      await setDoc(ctDocRef, {
        centerId: centerId,
        teacherId: foundUserUid,
        teacherName: foundUserData.displayName || "Noma'lum O'qituvchi",
        teacherEmail: foundUserData.email,
        addedAt: serverTimestamp()
      });
      
      // Success
      toast.success(t.addedSuccess);
      setIsModalOpen(false);
      setEmailInput("");
      
    } catch (error: any) {
      console.error("Add Teacher Error:", error);
      setModalError(error.message || t.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteTeacher = async () => {
    if (!teacherToDelete || !teacherToDelete.id) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "center_teachers", teacherToDelete.id));
      toast.success(t.deletedSuccess);
      setTeacherToDelete(null);
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error(t.deleteError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">
            {t.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && teachers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[12px] font-semibold text-on-surface-variant">
              <User size={14} className="text-on-surface-variant" /> {t.teacherCount(teachers.length)}
            </span>
          )}
        <Button onClick={() => setIsChooserOpen(true)} icon={<Plus size={18} strokeWidth={2.5} />}>
          {t.addTeacher}
        </Button>
        </div>
      </div>

      {/* Teacher profile cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-surface-container-highest rounded-m3-lg shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-surface-container-highest rounded w-3/4" />
                  <div className="h-3 bg-surface-container-highest rounded w-1/2" />
                  <div className="h-3 bg-surface-container-highest rounded w-2/3" />
                </div>
              </div>
              <div className="h-9 bg-surface-container rounded-m3-md mt-5" />
            </div>
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-14 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3">
            <User size={22} />
          </div>
          <h3 className="text-sm font-bold text-on-surface">{t.emptyTitle}</h3>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-[250px]">{t.emptyDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {teachers.map((teacher) => {
            const p = profiles[teacher.teacherId] || {};
            const stats = teacherStats.get(teacher.teacherId);
            return (
              <div key={teacher.id}
                className="group bg-surface-container-lowest rounded-m3-xl border border-outline-variant hover:shadow-elev-2 hover:-translate-y-0.5 hover:border-primary transition-all overflow-hidden flex flex-col">
                {/* Clickable profile body */}
                <button type="button" onClick={() => setViewingTeacher(teacher)} className="flex-1 text-left p-5">
                  <div className="flex items-start gap-4">
                    {/* Rectangular photo */}
                    {p.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoURL} alt={teacher.teacherName}
                        className="w-20 h-20 rounded-m3-lg object-cover shrink-0 border border-outline-variant" />
                    ) : (
                      <div className={`w-20 h-20 rounded-m3-lg shrink-0 flex items-center justify-center font-black text-[22px] ${tintFor(teacher.teacherId)}`}>
                        {getInitials(teacher.teacherName)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[15.5px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                          {teacher.teacherName}
                        </h3>
                        {p.verifiedTeacher && (
                          <BadgeCheck size={16} className="text-tertiary shrink-0" aria-label={t.verified} />
                        )}
                      </div>

                      {/* Subject + experience */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {p.subject && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold capitalize">
                            <BookOpen size={11} /> {p.subject}
                          </span>
                        )}
                        {typeof p.experience === "number" && p.experience > 0 && (
                          <span className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant rounded-full text-[11px] font-bold">
                            {t.experienceLabel(p.experience)}
                          </span>
                        )}
                      </div>

                      {/* Contact */}
                      <div className="mt-2.5 space-y-1">
                        <p className="flex items-center gap-1.5 text-[12px] text-on-surface-variant truncate">
                          <Mail size={12} className="text-on-surface-variant shrink-0" /> {teacher.teacherEmail}
                        </p>
                        {p.phone && (
                          <p className="flex items-center gap-1.5 text-[12px] text-on-surface-variant truncate">
                            <Phone size={12} className="text-on-surface-variant shrink-0" /> {p.phone}
                          </p>
                        )}
                        <p className="text-[11px] text-on-surface-variant">
                          {t.addedOn} {teacher.addedAt?.toDate ? teacher.addedAt.toDate().toLocaleDateString(t.dateLocale) : t.justNow}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Footer: stats + actions */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-outline-variant bg-surface-container-low">
                  <div className="flex items-center gap-3 text-[12px] font-semibold text-on-surface-variant">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-on-surface-variant" />
                      <span className="tabular-nums">{stats?.groups || 0}</span> {t.groupsWord}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-on-surface-variant" />
                      <span className="tabular-nums">{stats?.students || 0}</span> {t.studentsWord}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setTeacherToDelete(teacher)}
                      title={t.deleteTeacherTitle}
                      className="p-2 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-full transition-colors">
                      <Trash2 size={16} />
                    </button>
                    <button type="button" onClick={() => setViewingTeacher(teacher)}
                      title={t.viewProfile}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add-method chooser: create a new account vs link an existing one */}
      {isChooserOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setIsChooserOpen(false)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-md rounded-m3-xl p-6 shadow-elev-3">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.addTeacher}</h2>
              <button type="button" onClick={() => setIsChooserOpen(false)}
                className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover text-on-surface-variant rounded-full transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="space-y-3">
              <button type="button"
                onClick={() => { setIsChooserOpen(false); setIsCreateOpen(true); }}
                className="w-full flex items-center gap-4 p-4 bg-primary-container rounded-m3-lg text-left transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 bg-primary rounded-m3-lg flex items-center justify-center text-on-primary shrink-0 shadow-elev-1">
                  <UserPlus size={22} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold text-on-primary-container">{t.createNewAccount}</p>
                  <p className="text-[12.5px] text-on-primary-container mt-0.5">{t.createNewAccountDesc}</p>
                </div>
                <ArrowRight size={18} className="text-on-primary-container shrink-0" />
              </button>
              <button type="button"
                onClick={() => { setIsChooserOpen(false); setIsModalOpen(true); }}
                className="w-full flex items-center gap-4 p-4 bg-surface-container-low hover:bg-state-hover border border-outline-variant rounded-m3-lg text-left transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 bg-surface-container-lowest border border-outline-variant rounded-m3-lg flex items-center justify-center text-on-surface-variant shrink-0">
                  <Search size={22} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold text-on-surface">{t.addExistingAccount}</p>
                  <p className="text-[12.5px] text-on-surface-variant mt-0.5">{t.addExistingAccountDesc}</p>
                </div>
                <ArrowRight size={18} className="text-on-surface-variant shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create-account modal */}
      {isCreateOpen && centerId && (
        <CreateTeacherModal onClose={() => setIsCreateOpen(false)} />
      )}

      {/* Add Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="relative bg-surface-container-lowest w-full max-w-md rounded-m3-xl p-6 sm:p-8 shadow-elev-3">
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
                <User size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.addTeacher}</h2>
                <p className="text-[13px] text-on-surface-variant">{t.addModalDesc}</p>
              </div>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-4">
              
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-[13px] font-bold text-on-surface-variant ml-1">{t.teacherEmailLabel}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={isSubmitting}
                    placeholder={t.emailPlaceholder}
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
                  />
                </div>
                {modalError && (
                  <p className="text-[13px] font-bold text-error mt-2 px-1">
                    {modalError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-60"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !emailInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary font-bold rounded-full transition-colors disabled:opacity-60 shadow-elev-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {t.searching}
                    </>
                  ) : (
                    t.add
                  )}
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}

      {/* Teacher Info Slide-Over */}
      {viewingTeacher && viewingTeacher.id && (
        <ManagerTeacherInfoPanel
          teacherUid={viewingTeacher.teacherId}
          classes={classes.filter((c) => c.teacherId === viewingTeacher.teacherId)}
          onPhotoChange={(url) =>
            setProfiles((prev) => ({
              ...prev,
              [viewingTeacher.teacherId]: { ...prev[viewingTeacher.teacherId], photoURL: url || undefined },
            }))
          }
          onClose={() => setViewingTeacher(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {teacherToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
            onClick={() => !isDeleting && setTeacherToDelete(null)}
          ></div>
          <div className="relative bg-surface-container-lowest w-full max-w-sm rounded-m3-xl p-6 text-center shadow-elev-3">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center text-on-error-container mx-auto mb-4">
              <Trash2 size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-on-surface tracking-tight mb-2">{t.deleteConfirmTitle}</h3>
            <p className="text-sm text-on-surface-variant mb-8">
              <span className="font-bold text-on-surface">{teacherToDelete.teacherName}</span> {t.deleteConfirmSuffix}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setTeacherToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDeleteTeacher}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-error text-on-error font-bold rounded-full shadow-elev-2 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t.deleting}
                  </>
                ) : (
                  t.delete
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
