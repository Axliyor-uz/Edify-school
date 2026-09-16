"use client";

/**
 * OFFICE PANEL SHELL — director & buxgalter (docs/OFFICE.md).
 *
 * A deliberately thin shell: the panel is ONE page, so there is no navigation
 * to render — just identity, language, theme and sign-out. It reuses the
 * manager design system wholesale (theme.css + ManagerThemeProvider +
 * ManagerLanguageProvider) because the office page is built from the manager's
 * own finance components, which call `useManagerLanguage()` internally.
 *
 * ⚠️ THE GUARD READS `center_staff/{uid}`, NOT `users/{uid}.role`. The user doc
 * is client-writable (docs/AUTH.md), so a role field there proves nothing; the
 * link doc is Admin-SDK-only and its id must equal the uid. Fails CLOSED — any
 * error, or no link, redirects out — matching the manager layout's posture.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, LogOut, UserIcon, Sun, Moon, Monitor } from "lucide-react";

import "@/components/manager-ui/theme.css";
import {
  ConfirmDialog, Loader, cn,
  ManagerThemeProvider, useManagerTheme,
  MOTION_ON, popIn,
} from "@/components/manager-ui";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { fetchOfficeLink } from "@/services/officeService";
import { OFFICE_ROLE_LABELS, type CenterStaffLink, type OfficeRole } from "@/types/office";
import {
  ManagerLanguageProvider,
  useManagerLanguage,
  LANGUAGE_OPTIONS,
  FlagSvg,
} from "@/app/manager/_components/ManagerLanguage";

// ── The office session, published to the page below ──────────────────────────
export interface OfficeSession {
  uid: string;
  centerId: string;
  centerName: string;
  staffRole: OfficeRole;
  name: string;
  /** Only the buxgalter may record payments/expenses (server-enforced too). */
  canRecord: boolean;
}

const OfficeSessionContext = createContext<OfficeSession | null>(null);

/** The resolved office session. Only callable below the layout's guard, so it
 *  never returns null to a page — throwing here means a page escaped the gate. */
export function useOfficeSession(): OfficeSession {
  const ctx = useContext(OfficeSessionContext);
  if (!ctx) throw new Error("useOfficeSession must be used within OfficeLayout");
  return ctx;
}

const T = {
  uz: {
    theme: { label: "Mavzu", light: "Yorug'", system: "Tizim", dark: "Tun" },
    language: "Til",
    logout: {
      title: "Tizimdan chiqish",
      desc: "Rostdan ham hisobingizdan chiqmoqchimisiz?",
      confirm: "Chiqish",
      cancel: "Bekor qilish",
      error: "Tizimdan chiqishda xatolik yuz berdi",
      action: "Chiqish",
    },
  },
  en: {
    theme: { label: "Theme", light: "Light", system: "System", dark: "Dark" },
    language: "Language",
    logout: {
      title: "Sign out",
      desc: "Are you sure you want to sign out of your account?",
      confirm: "Sign out",
      cancel: "Cancel",
      error: "Something went wrong while signing out",
      action: "Sign out",
    },
  },
  ru: {
    theme: { label: "Тема", light: "День", system: "Система", dark: "Ночь" },
    language: "Язык",
    logout: {
      title: "Выход",
      desc: "Вы уверены, что хотите выйти из аккаунта?",
      confirm: "Выйти",
      cancel: "Отмена",
      error: "Не удалось выйти из системы",
      action: "Выйти",
    },
  },
};

const PANEL = "bg-surface-container rounded-m3-lg shadow-elev-3 border border-outline-variant z-[60]";

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ManagerThemeProvider>
      <ManagerLanguageProvider>
        <OfficeShell>{children}</OfficeShell>
      </ManagerLanguageProvider>
    </ManagerThemeProvider>
  );
}

function OfficeShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { lang, setLang } = useManagerLanguage();
  const t = T[lang];
  const { mode, preference, setPreference, toggleEnabled } = useManagerTheme();

  const [session, setSession] = useState<OfficeSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── The gate ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const link: CenterStaffLink | null = await fetchOfficeLink(user.uid);
        if (!alive) return;
        if (!link) {
          // Not office staff — send them to the login page's router rather than
          // guessing a dashboard for a role we know nothing about.
          router.replace("/auth/login");
          return;
        }
        const centerSnap = await getDoc(doc(db, "centers", link.centerId));
        if (!alive) return;
        setSession({
          uid: user.uid,
          centerId: link.centerId,
          centerName: (centerSnap.exists() ? (centerSnap.data()!.name as string) : "") || "—",
          staffRole: link.staffRole,
          name: link.name || user.displayName || "",
          canRecord: link.staffRole === "accountant",
        });
      } catch (err) {
        console.error("Office guard error:", err);
        if (alive) router.replace("/auth/login"); // fail CLOSED
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, loading, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.replace("/auth/login");
    } catch {
      toast.error(t.logout.error);
      setSigningOut(false);
    }
  };

  if (loading || checking || !session) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <Loader />
      </div>
    );
  }

  const roleLabel = OFFICE_ROLE_LABELS[session.staffRole][lang];
  const menu = (
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          {...(MOTION_ON ? popIn : {})}
          className={cn("absolute top-full right-0 mt-2 w-60 p-2 origin-top-right", PANEL)}
        >
          <div className="px-3 py-2 border-b border-outline-variant mb-1.5">
            <p className="text-[13.5px] font-bold text-on-surface truncate">{session.name}</p>
            <p className="text-[11.5px] text-on-surface-variant mt-0.5">{roleLabel}</p>
          </div>

          {toggleEnabled && (
            <div className="px-1.5 py-1">
              <p className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                {t.theme.label}
              </p>
              <div className="flex gap-1">
                {([
                  { v: "light" as const, icon: Sun, label: t.theme.light },
                  { v: "system" as const, icon: Monitor, label: t.theme.system },
                  { v: "dark" as const, icon: Moon, label: t.theme.dark },
                ]).map(({ v, icon: Icon, label }) => (
                  <button
                    key={v}
                    onClick={() => setPreference(v)}
                    aria-pressed={preference === v}
                    title={label}
                    className={cn(
                      "flex-1 h-9 rounded-m3-sm flex items-center justify-center transition-colors",
                      preference === v
                        ? "bg-secondary-container text-on-secondary-container"
                        : "text-on-surface-variant hover:bg-state-hover",
                    )}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-1.5 py-1">
            <p className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
              {t.language}
            </p>
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                onClick={() => setLang(opt.code)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-m3-sm text-[13px] font-medium transition-colors",
                  lang === opt.code
                    ? "bg-secondary-container text-on-secondary-container font-bold"
                    : "text-on-surface-variant hover:bg-state-hover",
                )}
              >
                <FlagSvg code={opt.code} /> {opt.label}
              </button>
            ))}
          </div>

          <div className="border-t border-outline-variant mt-1.5 pt-1.5">
            <button
              onClick={() => {
                setMenuOpen(false);
                setConfirmLogout(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-error hover:bg-error-container transition-colors"
            >
              <LogOut size={16} /> {t.logout.action}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <OfficeSessionContext.Provider value={session}>
      <div className="min-h-dvh bg-surface" data-mode={mode}>
        <header className="bg-t-bar-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-40">
          <div className="max-w-[1400px] mx-auto px-4 h-[56px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-on-surface truncate leading-tight">
                  {session.centerName}
                </p>
                <p className="text-[11.5px] text-on-surface-variant leading-tight">{roleLabel}</p>
              </div>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container text-[12.5px] font-bold flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {session.name ? initialsOf(session.name) : <UserIcon size={16} />}
              </button>
              {menu}
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 pb-16">{children}</main>

        <ConfirmDialog
          open={confirmLogout}
          onClose={() => setConfirmLogout(false)}
          onConfirm={handleSignOut}
          title={t.logout.title}
          description={t.logout.desc}
          confirmText={t.logout.confirm}
          cancelText={t.logout.cancel}
          loading={signingOut}
          danger
        />
      </div>
    </OfficeSessionContext.Provider>
  );
}
