"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Phone, User, Loader2, ArrowRight, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterEmployees } from "@/hooks/useCenterEmployees";
import { createEmployee, deleteEmployee } from "@/services/employeeService";
import toast from "react-hot-toast";
import { Button } from "@/components/manager-ui";
import { EMPLOYEE_ROLES, EMPLOYEE_ROLE_LABELS, type EmployeeRole, type CenterEmployeeLink } from "@/types/employee";
import ManagerEmployeeInfoPanel from "./_components/ManagerEmployeeInfoPanel";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

const T_UZ = {
  title: "Xodimlar",
  subtitle: "Qabulxona, farrosh, qo'riqchi, haydovchi va boshqa xodimlar",
  employeeCount: (n: number) => `${n} xodim`,
  addEmployee: "Xodim qo'shish",
  emptyTitle: "Hali xodimlar yo'q",
  emptyDesc: "Birinchi xodimni qo'shing",
  viewProfile: "Profilni ko'rish",
  deleteTitle: "Xodimni o'chirish",
  deleteConfirmSuffix: "ro'yxatdan o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
  cancel: "Bekor qilish",
  deleting: "O'chirilmoqda...",
  delete: "O'chirish",
  addedSuccess: "Xodim qo'shildi.",
  deletedSuccess: "Xodim o'chirildi.",
  genericError: "Xatolik yuz berdi.",
  fullName: "To'liq ism",
  fullNamePlaceholder: "Ism Familiya",
  roleLabel: "Lavozim",
  phone: "Telefon (ixtiyoriy)",
  add: "Qo'shish",
  errNameRequired: "To'liq ismni kiriting.",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: {
    title: "Employees",
    subtitle: "Reception, cleaning, security, drivers and other staff",
    employeeCount: (n: number) => `${n} employees`,
    addEmployee: "Add employee",
    emptyTitle: "No employees yet",
    emptyDesc: "Add your first employee",
    viewProfile: "View profile",
    deleteTitle: "Remove employee",
    deleteConfirmSuffix: "will be removed from the roster. This action cannot be undone.",
    cancel: "Cancel",
    deleting: "Removing...",
    delete: "Remove",
    addedSuccess: "Employee added.",
    deletedSuccess: "Employee removed.",
    genericError: "Something went wrong.",
    fullName: "Full name",
    fullNamePlaceholder: "First Last",
    roleLabel: "Role",
    phone: "Phone (optional)",
    add: "Add",
    errNameRequired: "Enter the full name.",
  },
  ru: {
    title: "Сотрудники",
    subtitle: "Ресепшн, уборка, охрана, водители и другой персонал",
    employeeCount: (n: number) => `${n} сотрудников`,
    addEmployee: "Добавить сотрудника",
    emptyTitle: "Сотрудников пока нет",
    emptyDesc: "Добавьте первого сотрудника",
    viewProfile: "Просмотреть профиль",
    deleteTitle: "Удалить сотрудника",
    deleteConfirmSuffix: "будет удалён из списка. Это действие нельзя отменить.",
    cancel: "Отмена",
    deleting: "Удаление...",
    delete: "Удалить",
    addedSuccess: "Сотрудник добавлен.",
    deletedSuccess: "Сотрудник удалён.",
    genericError: "Произошла ошибка.",
    fullName: "Полное имя",
    fullNamePlaceholder: "Имя Фамилия",
    roleLabel: "Должность",
    phone: "Телефон (необязательно)",
    add: "Добавить",
    errNameRequired: "Введите полное имя.",
  },
};

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

export default function EmployeesPage() {
  const { user } = useAuth() as any;
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [centerId, setCenterId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewing, setViewing] = useState<CenterEmployeeLink | null>(null);
  const [toDelete, setToDelete] = useState<CenterEmployeeLink | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => {
      if (p?.centerId) setCenterId(p.centerId);
    });
  }, [user]);

  const { employees, isLoading, refetch } = useCenterEmployees(centerId);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteEmployee(toDelete.id);
      toast.success(t.deletedSuccess);
      setToDelete(null);
      refetch();
    } catch {
      toast.error(t.genericError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{t.title}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && employees.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[12px] font-semibold text-on-surface-variant">
              <User size={14} /> {t.employeeCount(employees.length)}
            </span>
          )}
          <Button onClick={() => setIsAddOpen(true)} icon={<Plus size={18} strokeWidth={2.5} />}>
            {t.addEmployee}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-m3-xl p-14 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container mb-3">
            <User size={22} />
          </div>
          <h3 className="text-sm font-bold text-on-surface">{t.emptyTitle}</h3>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-[250px]">{t.emptyDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((e) => (
            <div
              key={e.id}
              className="group bg-surface-container-lowest rounded-m3-xl border border-outline-variant hover:shadow-elev-2 hover:-translate-y-0.5 hover:border-primary transition-all overflow-hidden flex flex-col"
            >
              <button type="button" onClick={() => setViewing(e)} className="flex-1 text-left p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-m3-lg shrink-0 flex items-center justify-center font-black text-[18px] ${tintFor(e.id)}`}>
                    {getInitials(e.employeeName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15.5px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                      {e.employeeName}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 bg-primary-container text-on-primary-container rounded-full text-[11px] font-bold mt-1.5">
                      {EMPLOYEE_ROLE_LABELS[e.role]?.[lang] || e.role}
                    </span>
                    {e.phone && (
                      <p className="flex items-center gap-1.5 text-[12px] text-on-surface-variant truncate mt-2">
                        <Phone size={12} className="shrink-0" /> {e.phone}
                      </p>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex items-center justify-end gap-1 px-5 py-3 border-t border-outline-variant bg-surface-container-low">
                <button
                  type="button"
                  onClick={() => setToDelete(e)}
                  title={t.deleteTitle}
                  className="p-2 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-full transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewing(e)}
                  title={t.viewProfile}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition-colors"
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddOpen && centerId && user && (
        <AddEmployeeModal
          centerId={centerId}
          createdBy={user.uid}
          onClose={() => setIsAddOpen(false)}
          onDone={() => {
            setIsAddOpen(false);
            refetch();
          }}
        />
      )}

      {viewing && (
        <ManagerEmployeeInfoPanel
          employee={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => {
            refetch();
          }}
        />
      )}

      {toDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !isDeleting && setToDelete(null)} />
          <div className="relative bg-surface-container-lowest w-full max-w-sm rounded-m3-xl p-6 text-center shadow-elev-3">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center text-on-error-container mx-auto mb-4">
              <Trash2 size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-on-surface tracking-tight mb-2">{t.deleteTitle}</h3>
            <p className="text-sm text-on-surface-variant mb-8">
              <span className="font-bold text-on-surface">{toDelete.employeeName}</span> {t.deleteConfirmSuffix}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-error text-on-error font-bold rounded-full shadow-elev-2 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> {t.deleting}
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

function AddEmployeeModal({
  centerId,
  createdBy,
  onClose,
  onDone,
}: {
  centerId: string;
  createdBy: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  const [employeeName, setEmployeeName] = useState("");
  const [role, setRole] = useState<EmployeeRole>(EMPLOYEE_ROLES[0]);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeName.trim().length < 3) {
      setError(t.errNameRequired);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await createEmployee({ centerId, employeeName, role, phone, createdBy });
      toast.success(t.addedSuccess);
      onDone();
    } catch (err: any) {
      setError(err.message || t.genericError);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div className="relative bg-surface-container-lowest w-full max-w-md rounded-m3-xl p-6 sm:p-8 shadow-elev-3">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-on-surface tracking-tight">{t.addEmployee}</h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="w-9 h-9 flex items-center justify-center bg-surface-container-low hover:bg-state-hover text-on-surface-variant rounded-full transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.fullName}</label>
            <input
              type="text"
              autoFocus
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              disabled={submitting}
              placeholder={t.fullNamePlaceholder}
              className="w-full px-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.roleLabel}</label>
            <div className="flex flex-wrap gap-1.5">
              {EMPLOYEE_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  disabled={submitting}
                  className={`px-3.5 py-2.5 rounded-m3-md text-[13px] font-bold border transition-colors ${
                    role === r
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary"
                  }`}
                >
                  {EMPLOYEE_ROLE_LABELS[r][lang]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-on-surface-variant ml-1">{t.phone}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                <Phone size={18} />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                placeholder="+998 90 123 45 67"
                className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {error && <p className="text-[13px] font-bold text-error px-1">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3.5 bg-surface-container hover:bg-state-hover text-on-surface font-bold rounded-full transition-colors disabled:opacity-60"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || employeeName.trim().length < 3}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-on-primary font-bold rounded-full transition-colors disabled:opacity-60 shadow-elev-1"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : t.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
