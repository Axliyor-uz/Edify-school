"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";

import "@/components/manager-ui/theme.css";
import {
  ConfirmDialog, Loader, cn,
  ManagerThemeProvider, useManagerTheme,
  MANAGER_DESIGN, MOTION_ON, springTransition, popIn, pageTransition,
} from "@/components/manager-ui";

import { resolveSideStyle } from "@/components/manager-ui/shellStyles";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { listenFaceEvents, processAllFaceEvents } from "@/services/faceEventService";
import ApprovalGate, { type CenterApprovalStatus } from "./_components/ApprovalGate";
import { ManagerLanguageProvider, useManagerLanguage, LANGUAGE_OPTIONS, FlagSvg } from "./_components/ManagerLanguage";

import {
  LayoutDashboard, GraduationCap, Layers, Users, Wallet, LogOut, Menu, X,
  BookOpen, CalendarCheck, UserCheck, DoorOpen, CalendarRange, Building2,
  UserIcon, PanelLeft, MoreVertical, MoreHorizontal, Sun, Moon, Monitor, QrCode,
  Briefcase, GitBranch,
} from "lucide-react";
import { fetchMyBranches } from "@/services/branchService";

// ============================================================================
// TRANSLATIONS — layout chrome only; pages carry their own TRANSLATIONS dicts
// and read the shared language via useManagerLanguage() (_components/ManagerLanguage).
// ============================================================================
const LAYOUT_TRANSLATIONS = {
  uz: {
    nav: { dashboard: "Boshqaruv paneli", dashboardShort: "Asosiy", branches: "Filiallar", groups: "Guruhlar", students: "O'quvchilar", parents: "Ota-onalar", teachers: "O'qituvchilar", teachersShort: "Ustozlar", employees: "Xodimlar", attendance: "Davomat", staffAttendance: "Xodimlar davomati", staffAttendanceShort: "Xodimlar", timetable: "Dars jadvali", timetableShort: "Jadval", rooms: "Xonalar", finance: "To'lovlar" },
    bar: { home: "Asosiy", groups: "Guruhlar", attendance: "Davomat", finance: "To'lovlar", menu: "Menyu" },
    theme: { label: "Mavzu", light: "Yorug'", system: "Tizim", dark: "Tun" },
    language: "Til", profile: "Profilim", manager: "Menejer", more: "Yana",
    close: "Yopish", expand: "Yoyish", collapse: "Yig'ish",
    logout: { title: "Tizimdan chiqish", desc: "Rostdan ham hisobingizdan chiqmoqchimisiz?", confirm: "Chiqish", cancel: "Bekor qilish", error: "Tizimdan chiqishda xatolik yuz berdi" },
  },
  en: {
    nav: { dashboard: "Dashboard", dashboardShort: "Home", branches: "Branches", groups: "Groups", students: "Students", parents: "Parents", teachers: "Teachers", teachersShort: "Teachers", employees: "Employees", attendance: "Attendance", staffAttendance: "Staff attendance", staffAttendanceShort: "Staff", timetable: "Timetable", timetableShort: "Schedule", rooms: "Rooms", finance: "Payments" },
    bar: { home: "Home", groups: "Groups", attendance: "Attendance", finance: "Payments", menu: "Menu" },
    theme: { label: "Theme", light: "Light", system: "System", dark: "Dark" },
    language: "Language", profile: "My profile", manager: "Manager", more: "More",
    close: "Close", expand: "Expand", collapse: "Collapse",
    logout: { title: "Sign out", desc: "Are you sure you want to sign out of your account?", confirm: "Sign out", cancel: "Cancel", error: "Something went wrong while signing out" },
  },
  ru: {
    nav: { dashboard: "Панель управления", dashboardShort: "Главная", branches: "Филиалы", groups: "Группы", students: "Ученики", parents: "Родители", teachers: "Учителя", teachersShort: "Учителя", employees: "Сотрудники", attendance: "Посещаемость", staffAttendance: "Посещаемость сотрудников", staffAttendanceShort: "Сотрудники", timetable: "Расписание", timetableShort: "Расписание", rooms: "Кабинеты", finance: "Платежи" },
    bar: { home: "Главная", groups: "Группы", attendance: "Посещения", finance: "Платежи", menu: "Меню" },
    theme: { label: "Тема", light: "День", system: "Система", dark: "Ночь" },
    language: "Язык", profile: "Мой профиль", manager: "Менеджер", more: "Ещё",
    close: "Закрыть", expand: "Развернуть", collapse: "Свернуть",
    logout: { title: "Выход", desc: "Вы уверены, что хотите выйти из аккаунта?", confirm: "Выйти", cancel: "Отмена", error: "Не удалось выйти из системы" },
  },
};
type LayoutT = typeof LAYOUT_TRANSLATIONS.uz;

// ============================================================================
// NAVIGATION — flat items with group boundaries (dividers, not headers).
// Names resolve per-language inside the shell via LAYOUT_TRANSLATIONS.nav.
// ============================================================================
type NavKey = keyof LayoutT["nav"];
type NavDef = { key: NavKey; shortKey?: NavKey; href: string; icon: typeof LayoutDashboard; groupStart?: boolean };
type NavItem = { name: string; href: string; icon: typeof LayoutDashboard; short?: string; groupStart?: boolean };

const NAV_DEFS: NavDef[] = [
  { key: "dashboard", shortKey: "dashboardShort", href: "/manager/dashboard", icon: LayoutDashboard },
  // 🟢 Multi-branch owner view (docs/MANAGER.md) — shown ONLY when this manager
  // can operate more than one branch; filtered out of NAV_ITEMS below otherwise,
  // so a single-branch manager sees zero UI change.
  { key: "branches", href: "/manager/branches", icon: GitBranch },
  { key: "groups", href: "/manager/groups", icon: Layers, groupStart: true },
  { key: "students", href: "/manager/students", icon: Users },
  // Parent QR access (docs/PARENTS.md) — a sibling of Students on purpose: it is
  // the same roster seen from the family's side, not a separate subsystem.
  { key: "parents", href: "/manager/parents", icon: QrCode },
  { key: "teachers", shortKey: "teachersShort", href: "/manager/teachers", icon: GraduationCap },
  { key: "employees", href: "/manager/employees", icon: Briefcase },
  { key: "attendance", href: "/manager/attendance", icon: CalendarCheck, groupStart: true },
  { key: "staffAttendance", shortKey: "staffAttendanceShort", href: "/manager/staff-attendance", icon: UserCheck },
  { key: "timetable", shortKey: "timetableShort", href: "/manager/timetable", icon: CalendarRange, groupStart: true },
  { key: "rooms", href: "/manager/rooms", icon: DoorOpen },
  { key: "finance", href: "/manager/finance", icon: Wallet, groupStart: true },
];

// Full-width routes: wide grids/tables need the room; the rest stay centered.
const WIDE_ROUTES = ["/manager/attendance", "/manager/staff-attendance", "/manager/timetable", "/manager/finance"];

// Shared popover panel styling (M3 menu surface)
const PANEL = "bg-surface-container rounded-m3-lg shadow-elev-3 border border-outline-variant z-[60]";

// The switchboard decisions this shell renders (design.manager.config.ts).
const SHELL = MANAGER_DESIGN.App_shell_navigation;
const MOBILE_NAV = MANAGER_DESIGN.Mobile_navigation;
const TOP_SHELL = SHELL === "topbar" || SHELL === "toolbar";
const SIDE_SHELL = !TOP_SHELL;
// Every side shell collapses except rail (born collapsed, pinned).
const COLLAPSIBLE = SIDE_SHELL && SHELL !== "rail";
// Mobile variants that render a bottom bar (vs the drawer-only original).
const BAR_MOBILE = MOBILE_NAV === "dock" || MOBILE_NAV === "floating" || MOBILE_NAV === "iconic" || MOBILE_NAV === "topline";

// Sidebar style recipes live in components/manager-ui/shellStyles.ts so the
// /theme-check-manager gallery previews exactly what this shell renders.
// (Top shells and rail/floating resolve to the 'sidebar' recipe.)
const STYLE = resolveSideStyle(SHELL);
// The mobile drawer always paints a solid panel — transparent/glass variants
// fall back to the plain surface so the slide-out stays readable over content.
const DRAWER_BG = STYLE.bg === "bg-transparent" ? "bg-surface-container-lowest" : STYLE.bg;

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ============================================================================
// LAYOUT ENTRY — theme provider wraps the shell so useManagerTheme works
// everywhere inside (including the mode toggle in the profile popover).
// ============================================================================
export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ManagerThemeProvider>
      <ManagerLanguageProvider>
        <ManagerShell>{children}</ManagerShell>
      </ManagerLanguageProvider>
    </ManagerThemeProvider>
  );
}

// ============================================================================
// THE SHELL
// ============================================================================
function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { preference, setPreference, toggleEnabled } = useManagerTheme();
  const { lang, setLang } = useManagerLanguage();
  const t: LayoutT = LAYOUT_TRANSLATIONS[lang] || LAYOUT_TRANSLATIONS.uz;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(SHELL === "rail");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [centerName, setCenterName] = useState("Markaz");
  const [centerId, setCenterId] = useState<string | null>(null);
  // 🟢 Multi-branch owner view — only >1 branch shows the "Filiallar" nav item.
  const [hasMultipleBranches, setHasMultipleBranches] = useState(false);
  // Approval gate: writes are blocked by Firestore rules until the center is
  // 'active'; this drives the matching UX. Unknown/missing status → 'pending'.
  const [centerStatus, setCenterStatus] = useState<CenterApprovalStatus>("pending");

  const headerRef = useRef<HTMLDivElement>(null);
  const deskHeaderRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const showBottomBar = BAR_MOBILE;

  // Restore persisted rail state (collapsible shells only; 'rail' is pinned).
  useEffect(() => {
    if (!COLLAPSIBLE) return;
    try { setIsCollapsed(localStorage.getItem("edify-mg-rail") === "1"); } catch { /* private mode */ }
  }, []);
  const toggleCollapsed = () => {
    if (!COLLAPSIBLE) return;
    setIsCollapsed((v) => {
      try { localStorage.setItem("edify-mg-rail", v ? "0" : "1"); } catch { /* private mode */ }
      return !v;
    });
  };

  // Keyboard shortcut: [ toggles the rail
  useEffect(() => {
    if (!COLLAPSIBLE) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[") return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      toggleCollapsed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const inHeader = headerRef.current?.contains(event.target as Node);
      const inDeskHeader = deskHeaderRef.current?.contains(event.target as Node);
      const inSidebar = sidebarRef.current?.contains(event.target as Node);
      if (!inHeader && !inDeskHeader && !inSidebar) {
        setIsProfileMenuOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auth & Role Check — resolves center name + approval status BEFORE
  // rendering children, so gated pages never flash as usable.
  useEffect(() => {
    async function checkRole() {
      if (!loading) {
        if (!user) router.push("/auth/login");
        else {
          try {
            const profile = await getUserProfile(user.uid);
            if (profile?.role === "manager") {
              setUserName(profile.displayName || "");
              setUserPhoto(profile.photoURL || null);
              if (profile.centerId) {
                setCenterId(profile.centerId);
                try {
                  const snap = await getDoc(doc(db, "centers", profile.centerId));
                  if (snap.exists()) {
                    const data = snap.data();
                    setCenterName(data.name || "Markaz");
                    setCenterStatus(
                      data.status === "active" ? "active"
                      : data.status === "suspended" ? "suspended"
                      : "pending"
                    );
                  }
                } catch { /* stays 'pending' */ }
              }
              setIsAuthorized(true);
            }
            else if (profile?.role === "teacher") router.push("/teacher/dashboard");
            // Office staff (docs/OFFICE.md) — the manager panel is not theirs.
            else if (profile?.role === "director" || profile?.role === "accountant") router.push("/office");
            else router.push("/dashboard");
          } catch (error) {
            // Fail closed: an unreadable profile must not grant access.
            console.error(error);
            router.push("/auth/login");
          }
        }
      }
    }
    checkRole();
  }, [user, loading, router]);

  // 🟢 Multi-branch owner view: a SEPARATE, best-effort check — never blocks
  // the gate above, and a failure just means the nav item stays hidden.
  useEffect(() => {
    if (!user || !centerId) return;
    let mounted = true;
    fetchMyBranches(user.uid, centerId)
      .then((branches) => { if (mounted) setHasMultipleBranches(branches.length > 1); })
      .catch(() => { /* stays false */ });
    return () => { mounted = false; };
  }, [user, centerId]);

  // Global face event processor: processes both staff and student check-ins
  // silently in the background as long as the manager panel is open.
  useEffect(() => {
    if (!centerId || !user) return;
    return listenFaceEvents(centerId, (events) => {
      if (events.length > 0) processAllFaceEvents(events, centerId, user.uid);
    });
  }, [centerId, user]);

  // Keep the avatar/name in sync — e.g. right after the manager uploads a
  // photo on /manager/profile — without needing a full reload.
  useEffect(() => {
    if (!isAuthorized || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setUserName(data.displayName || "");
      setUserPhoto(data.photoURL || null);
    }, () => { /* keep last known values on error */ });
    return () => unsub();
  }, [isAuthorized, user]);

  useEffect(() => { setMobileMenuOpen(false); setIsProfileMenuOpen(false); setIsMoreMenuOpen(false); }, [pathname]);

  if (loading || (user && !isAuthorized) || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface t-canvas">
        <Loader className="w-40" />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Language-resolved navigation items. "branches" is filtered out entirely
  // for a single-branch manager — not just hidden, absent — so nothing about
  // their nav changes.
  const NAV_ITEMS: NavItem[] = NAV_DEFS
    .filter((d) => d.key !== "branches" || hasMultipleBranches)
    .map((d) => ({
      name: t.nav[d.key],
      short: d.shortKey ? t.nav[d.shortKey] : undefined,
      href: d.href,
      icon: d.icon,
      groupStart: d.groupStart,
    }));

  // Topbar shell: first 5 destinations inline, the rest behind "More".
  // Toolbar shell shows every destination on its own nav row instead.
  const topbarPrimary = NAV_ITEMS.slice(0, 5);
  const topbarOverflow = NAV_ITEMS.slice(5);

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch {
      toast.error(t.logout.error);
    }
  };

  const avatar = (size: string, text: string) => (
    <span className={cn("rounded-m3-sm bg-primary text-on-primary flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-elev-1", size, text)}>
      {userPhoto
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={userPhoto} alt={userName || t.manager} className="w-full h-full object-cover" />
        : getInitials(userName)}
    </span>
  );

  // --- Theme (light/system/dark) segmented switch — per-device override ---
  const themeSwitch = toggleEnabled && (
    <div className="flex items-center bg-surface-container-high p-1 rounded-m3-sm gap-1 mb-2" role="group" aria-label={t.theme.label}>
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
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-m3-xs text-[11px] font-bold transition-all",
            preference === v ? "bg-surface-container-lowest text-primary shadow-elev-1" : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );

  // --- Profile popover body (shared: sidebar footer + top bars) ---
  const profilePanelBody = (
    <>
      <div className="px-3 py-3 bg-surface-container-high rounded-m3-md mb-2">
        <p className="text-[13px] font-semibold text-on-surface truncate">{userName || t.manager}</p>
        <p className="text-[10px] font-medium text-on-surface-variant truncate">{user?.email}</p>
        <p className="flex items-center gap-1 text-[10px] font-semibold text-primary truncate mt-1">
          <Building2 size={11} className="shrink-0" /> {centerName}
        </p>
      </div>
      {themeSwitch}
      {/* SVG-flag language switcher (same pattern as the teacher panel) */}
      <div className="flex items-center bg-surface-container-high p-1 rounded-m3-sm gap-1 mb-2" role="group" aria-label={t.language}>
        {LANGUAGE_OPTIONS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={lang === l.code}
            title={l.label}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-m3-xs text-[11px] font-bold uppercase transition-all",
              lang === l.code ? "bg-surface-container-lowest text-primary shadow-elev-1" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <FlagSvg code={l.code} />
            {l.code}
          </button>
        ))}
      </div>
      <Link href="/manager/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-colors"><UserIcon size={16} /> {t.profile}</Link>
      <div className="h-px bg-outline-variant my-1.5 mx-2"></div>
      <button onClick={() => { setIsProfileMenuOpen(false); setShowLogoutModal(true); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-error hover:bg-error-container transition-colors"><LogOut size={16} /> {t.logout.title}</button>
    </>
  );

  // --- The animated active indicator, per recipe ---
  // Positions use fixed offsets, never translate — framer's layout animation
  // owns `transform`, so translate-based centering breaks the glide.
  const navIndicator = (collapsed: boolean, isMobile: boolean) => {
    const layoutId = isMobile ? "mg-nav-m" : "mg-nav";
    if (STYLE.indicator === "pill") {
      return (
        <motion.span
          layoutId={layoutId}
          transition={springTransition}
          className={cn(
            "absolute", STYLE.indicatorCls,
            collapsed ? "top-1.5 inset-x-0 mx-auto w-[52px] h-[30px] rounded-full" : "inset-0 rounded-full",
          )}
        />
      );
    }
    if (STYLE.indicator === "bar") {
      return (
        <motion.span
          layoutId={layoutId}
          transition={springTransition}
          className={cn(
            "absolute left-0 w-1 rounded-r-full", STYLE.indicatorCls,
            collapsed ? "top-[16px] h-6" : "top-[13px] h-5",
          )}
        />
      );
    }
    // dot
    return (
      <motion.span
        layoutId={layoutId}
        transition={springTransition}
        className={cn(
          "absolute w-1.5 h-1.5 rounded-full", STYLE.indicatorCls,
          collapsed ? "left-2 top-[25px]" : "left-1.5 top-[20px]",
        )}
      />
    );
  };

  // --- SIDEBAR CONTENT (desktop side shells + mobile slide-out drawer) ---
  const renderSidebarContent = (collapsed: boolean, isMobile: boolean = false) => (
    <div className={cn("flex flex-col h-full relative", SHELL === "floating" && !isMobile ? "bg-transparent" : isMobile ? DRAWER_BG : STYLE.bg)}>

      {/* Header: brand + center + rail toggle */}
      <div className={cn("flex items-center gap-2.5 px-3.5 pt-4 pb-2 shrink-0 min-h-[64px]", collapsed && "flex-col gap-2 px-0 justify-center")}>
        <div className="flex items-center gap-2.5 overflow-hidden cursor-pointer min-w-0" onClick={() => router.push("/manager/dashboard")}>
          <div className={cn("w-9 h-9 rounded-m3-md flex items-center justify-center shrink-0 shadow-elev-1", STYLE.brandBox)}><BookOpen size={19} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className={cn("font-t-display font-bold text-[15px] leading-none tracking-tight truncate", STYLE.brandTitle)}>Edify<span className={STYLE.brandAccent}>Manager</span></h1>
              <p className={cn("flex items-center gap-1 text-[9.5px] font-semibold mt-1 truncate", STYLE.brandSub)}>
                <Building2 size={10} className="shrink-0" /> {centerName}
              </p>
            </div>
          )}
        </div>
        {isMobile ? (
          <button onClick={() => setMobileMenuOpen(false)} aria-label={t.close} className={cn("m3-interactive ml-auto p-2 rounded-full", STYLE.email)}>
            <X size={19} />
          </button>
        ) : COLLAPSIBLE ? (
          <button
            onClick={toggleCollapsed}
            title={collapsed ? `${t.expand}  [` : `${t.collapse}  [`}
            aria-label={collapsed ? t.expand : t.collapse}
            className={cn("m3-interactive p-2 rounded-full", STYLE.email, !collapsed && "ml-auto")}
          >
            <PanelLeft size={18} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <div key={item.href}>
              {item.groupStart && <div className={cn("h-px my-2", STYLE.divider, collapsed ? "mx-3" : "mx-2")} />}
              <Link
                href={item.href}
                title={collapsed ? item.name : undefined}
                onClick={() => isMobile && setMobileMenuOpen(false)}
                className={cn(
                  "group relative flex items-center transition-all mb-1",
                  collapsed
                    ? "flex-col justify-center gap-[3px] h-[56px] rounded-m3-md px-1"
                    : cn("gap-3 h-[46px] px-3.5", STYLE.itemShape, STYLE.indicator === "bar" && "pl-4"),
                  active ? cn(STYLE.active, STYLE.activeRowBg) : STYLE.idle,
                )}
              >
                {active && navIndicator(collapsed, isMobile)}
                <item.icon size={collapsed ? 20 : 19} strokeWidth={active ? 2.4 : 2} className={cn("shrink-0 relative z-10", active && STYLE.iconActive)} />
                <span className={cn(
                  "relative z-10 truncate",
                  collapsed ? "text-[9.5px] font-semibold max-w-full px-0.5" : "flex-1 text-[13.5px] font-medium",
                  active && "font-bold",
                )}>
                  {collapsed ? (item.short || item.name) : item.name}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer: profile row (or the classic user card) + popover */}
      <div className={cn("shrink-0 px-2.5 pb-3 pt-2 border-t relative", STYLE.footerBorder)}>
        <AnimatePresence>
          {isProfileMenuOpen && (
            <motion.div
              {...popIn}
              className={cn("absolute w-60 p-2", PANEL, collapsed && !isMobile ? "left-full ml-2 bottom-2" : "bottom-full mb-2 left-2.5 origin-bottom-left")}
            >
              {profilePanelBody}
            </motion.div>
          )}
        </AnimatePresence>

        {STYLE.classicFooter && !collapsed ? (
          /* Original manager footer: user card opens the popover, logout is its
             own always-visible button on the right. */
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title={userName || t.profile}
              className="m3-interactive flex-1 flex items-center gap-2.5 p-1.5 rounded-m3-md text-left transition-colors hover:bg-state-hover min-w-0"
            >
              {avatar("w-10 h-10", "text-[13px]")}
              <span className="flex-1 min-w-0">
                <b className={cn("block text-[12.5px] font-bold truncate", STYLE.name)}>{userName || t.manager}</b>
                <small className={cn("block text-[10px] truncate", STYLE.email)}>{user?.email}</small>
              </span>
            </button>
            <button
              onClick={() => { setIsProfileMenuOpen(false); if (isMobile) setMobileMenuOpen(false); setShowLogoutModal(true); }}
              title={t.logout.title}
              aria-label={t.logout.title}
              className="m3-interactive w-9 h-9 shrink-0 rounded-m3-md flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
            >
              <LogOut size={17} strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            title={userName || t.profile}
            className={cn("m3-interactive w-full flex items-center rounded-m3-md transition-colors hover:bg-state-hover", collapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5 text-left")}
          >
            {avatar("w-9 h-9", "text-[13px]")}
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0">
                  <b className={cn("block text-[12.5px] font-semibold truncate", STYLE.name)}>{userName || t.manager}</b>
                  <small className={cn("block text-[10px] truncate", STYLE.email)}>{user?.email}</small>
                </span>
                <MoreVertical size={15} className={cn("shrink-0", STYLE.email)} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  // --- Top-bar nav pill (shared by 'topbar' and 'toolbar') ---
  const topbarLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "relative flex items-center gap-2 h-[38px] px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors",
          active ? "text-on-secondary-container" : "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
        )}
      >
        {active && (
          <motion.span layoutId="mg-tb-pill" transition={springTransition} className="absolute inset-0 bg-secondary-container rounded-full" />
        )}
        <item.icon size={16} strokeWidth={active ? 2.4 : 2} className={cn("relative z-10", active && "text-primary")} />
        <span className={cn("relative z-10", active && "font-bold")}>{item.name}</span>
      </Link>
    );
  };

  const brandBlock = (
    <div className="flex items-center gap-2.5 cursor-pointer min-w-0 shrink-0" onClick={() => router.push("/manager/dashboard")}>
      <div className="w-9 h-9 bg-primary rounded-m3-md flex items-center justify-center text-on-primary shrink-0 shadow-elev-1"><BookOpen size={19} /></div>
      <b className="font-t-display text-[15px] text-on-surface tracking-tight truncate hidden lg:block">Edify<span className="text-primary">Manager</span></b>
    </div>
  );

  const topbarRightCluster = (
    <div className="flex items-center gap-2 shrink-0">
      <span className="hidden lg:flex items-center gap-1.5 px-3 h-9 rounded-full bg-surface-container-low text-on-surface-variant text-[11.5px] font-semibold max-w-[220px]">
        <Building2 size={13} className="shrink-0 text-primary" /> <span className="truncate">{centerName}</span>
      </span>
      <div className="relative">
        <button onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsMoreMenuOpen(false); }} className="transition-transform active:scale-95">
          {avatar("w-9 h-9", "text-[12px]")}
        </button>
        <AnimatePresence>
          {isProfileMenuOpen && (
            <motion.div {...popIn} className={cn("absolute top-full right-0 mt-2 w-60 p-2 origin-top-right", PANEL)}>
              {profilePanelBody}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // --- DESKTOP TOP BAR (SHELL === 'topbar'): single row, 5 + "Yana" ---
  const desktopTopbar = SHELL === "topbar" && (
    <header ref={deskHeaderRef} className="hidden md:flex bg-t-bar-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-40 px-4 h-[60px] items-center gap-4 shrink-0">
      {brandBlock}
      <nav className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto custom-scrollbar">
        {topbarPrimary.map(topbarLink)}

        {/* Yana (overflow) */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setIsMoreMenuOpen(!isMoreMenuOpen); setIsProfileMenuOpen(false); }}
            aria-expanded={isMoreMenuOpen}
            className={cn(
              "flex items-center gap-2 h-[38px] px-3.5 rounded-full text-[13px] font-medium transition-colors",
              topbarOverflow.some((i) => isActive(i.href)) ? "bg-secondary-container text-on-secondary-container font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
            )}
          >
            <MoreHorizontal size={16} />
            {t.more}
          </button>
          <AnimatePresence>
            {isMoreMenuOpen && (
              <motion.div {...popIn} className={cn("absolute top-full left-0 mt-2 w-56 p-2 origin-top-left", PANEL)}>
                {topbarOverflow.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium transition-colors",
                        active ? "bg-secondary-container text-on-secondary-container font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
                      )}
                    >
                      <item.icon size={16} /> {item.name}
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
      {topbarRightCluster}
    </header>
  );

  // --- DESKTOP TWO-DECK TOOLBAR (SHELL === 'toolbar'): brand row + full nav row ---
  const desktopToolbar = SHELL === "toolbar" && (
    <header ref={deskHeaderRef} className="hidden md:block bg-t-bar-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-40 shrink-0">
      <div className="px-4 h-[54px] flex items-center justify-between gap-4">
        {brandBlock}
        {topbarRightCluster}
      </div>
      <nav className="px-3 pb-2 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {NAV_ITEMS.map(topbarLink)}
      </nav>
    </header>
  );

  // --- MOBILE BOTTOM NAV (dock / floating / iconic / topline) ---
  const mobileNavItems = [
    { label: t.bar.home, href: "/manager/dashboard", icon: LayoutDashboard },
    { label: t.bar.groups, href: "/manager/groups", icon: Layers },
    { label: t.bar.attendance, href: "/manager/attendance", icon: CalendarCheck },
    { label: t.bar.finance, href: "/manager/finance", icon: Wallet },
  ];

  const mobileNavLink = (item: { label: string; href: string; icon: typeof LayoutDashboard }) => {
    const active = isActive(item.href);
    if (MOBILE_NAV === "iconic") {
      return (
        <Link key={item.href} href={item.href} aria-label={item.label} className={cn("flex-1 flex items-center justify-center h-[52px] relative", active ? "text-primary" : "text-on-surface-variant")}>
          {active && (
            <motion.span layoutId="mg-bn-pill" transition={springTransition} className="absolute inset-y-2 inset-x-0 mx-auto w-[56px] bg-secondary-container rounded-full" />
          )}
          <item.icon size={22} strokeWidth={active ? 2.4 : 2} className="relative z-10" />
        </Link>
      );
    }
    if (MOBILE_NAV === "topline") {
      return (
        <Link key={item.href} href={item.href} className={cn("flex-1 flex flex-col items-center gap-[3px] pt-2 pb-1 relative", active ? "text-primary" : "text-on-surface-variant")}>
          {active && (
            <motion.span layoutId="mg-bn-pill" transition={springTransition} className="absolute top-0 inset-x-0 mx-auto w-9 h-[3px] rounded-b-full bg-primary" />
          )}
          <item.icon size={21} strokeWidth={active ? 2.4 : 2} className="relative z-10" />
          <span className={cn("relative z-10 text-[9.5px] font-semibold", active && "font-bold")}>{item.label}</span>
        </Link>
      );
    }
    // dock + floating
    return (
      <Link key={item.href} href={item.href} className={cn("flex-1 flex flex-col items-center gap-[3px] py-1 relative", active ? "text-on-secondary-container" : "text-on-surface-variant")}>
        {active && (
          <motion.span layoutId="mg-bn-pill" transition={springTransition} className="absolute -top-0.5 inset-x-0 mx-auto w-[52px] h-[28px] bg-secondary-container rounded-full" />
        )}
        <item.icon size={21} strokeWidth={active ? 2.4 : 2} className={cn("relative z-10", active && "text-primary")} />
        <span className={cn("relative z-10 text-[9.5px] font-semibold", active && "font-bold")}>{item.label}</span>
      </Link>
    );
  };

  const menuButton = MOBILE_NAV === "iconic" ? (
    <button onClick={() => setMobileMenuOpen(true)} aria-label={t.bar.menu} className="flex-1 flex items-center justify-center h-[52px] text-on-surface-variant">
      <Menu size={22} strokeWidth={2} />
    </button>
  ) : (
    <button onClick={() => setMobileMenuOpen(true)} className={cn("flex-1 flex flex-col items-center gap-[3px] text-on-surface-variant", MOBILE_NAV === "topline" ? "pt-2 pb-1" : "py-1")}>
      <Menu size={21} strokeWidth={2} />
      <span className="text-[9.5px] font-semibold">{t.bar.menu}</span>
    </button>
  );

  // Bottom padding the scroll area reserves for each bar height.
  const mainBarPad =
    MOBILE_NAV === "dock" ? "pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0"
    : MOBILE_NAV === "floating" ? "pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0"
    : MOBILE_NAV === "iconic" ? "pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0"
    : MOBILE_NAV === "topline" ? "pb-[calc(70px+env(safe-area-inset-bottom))] md:pb-0"
    : "";

  const isWide = WIDE_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <div className={cn(
      "min-h-[100dvh] bg-surface font-t-body selection:bg-primary-container selection:text-on-primary-container overflow-hidden relative",
      SIDE_SHELL ? "flex" : "flex flex-col",
    )}>

      {/* --- LOGOUT CONFIRM --- */}
      <ConfirmDialog
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => { confirmLogout(); setShowLogoutModal(false); }}
        title={t.logout.title}
        description={t.logout.desc}
        confirmText={t.logout.confirm}
        cancelText={t.logout.cancel}
        danger
      />

      {/* --- MOBILE SLIDE-OUT DRAWER (full nav list, styled like the chosen sidebar) --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", bounce: 0, duration: MOTION_ON ? 0.4 : 0 }} className={cn("relative w-[280px] h-full shadow-elev-3", DRAWER_BG)}>
              {renderSidebarContent(false, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* --- DESKTOP SIDE SHELLS: recipe-styled aside · rail (pinned) · floating (glass card) --- */}
      {SIDE_SHELL && SHELL !== "floating" && (
        <aside
          ref={sidebarRef}
          className={cn(
            "hidden md:flex shrink-0 h-[100dvh] transition-[width] duration-t-med ease-t-std relative z-[50]",
            STYLE.bg, STYLE.asideBorder,
            isCollapsed ? "w-[84px]" : "w-[264px]",
          )}
        >
          {renderSidebarContent(isCollapsed, false)}
        </aside>
      )}
      {SHELL === "floating" && (
        <aside
          ref={sidebarRef}
          className={cn(
            "hidden md:flex shrink-0 h-[100dvh] p-3 pr-0 relative z-[50] transition-[width] duration-t-med ease-t-std",
            isCollapsed ? "w-[96px]" : "w-[276px]",
          )}
        >
          <div className="flex-1 rounded-m3-xl bg-t-glass backdrop-blur-xl border border-t-glass-border shadow-elev-2 overflow-hidden">
            {renderSidebarContent(isCollapsed, false)}
          </div>
        </aside>
      )}

      {/* --- MAIN COLUMN --- */}
      <div className={cn("flex-1 flex flex-col min-w-0 relative z-10", SIDE_SHELL ? "h-[100dvh]" : "min-h-[100dvh]")}>

        {desktopTopbar}
        {desktopToolbar}

        {/* MOBILE TOP BAR — slim: (hamburger) · brand · avatar */}
        <header ref={headerRef} className="md:hidden bg-background-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-30 px-3 py-2 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {MOBILE_NAV === "drawer" && (
              <button onClick={() => setMobileMenuOpen(true)} aria-label={t.bar.menu} className="m3-interactive flex items-center justify-center h-9 w-9 -ml-1 text-on-surface-variant rounded-full shrink-0">
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 min-w-0" onClick={() => router.push("/manager/dashboard")}>
              <div className="w-8 h-8 bg-primary rounded-m3-sm flex items-center justify-center text-on-primary shrink-0 shadow-elev-1"><BookOpen size={16} /></div>
              <div className="min-w-0">
                <b className="block font-t-display text-[14px] text-on-surface tracking-tight leading-tight truncate">Edify<span className="text-primary">Manager</span></b>
                <span className="block text-[9px] font-semibold text-on-surface-variant leading-tight truncate">{centerName}</span>
              </div>
            </div>
          </div>

          {/* Avatar + profile popover (theme switch lives inside) */}
          <div className="relative">
            <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="transition-transform active:scale-95">
              {avatar("w-9 h-9", "text-[12px]")}
            </button>
            <AnimatePresence>
              {isProfileMenuOpen && (
                <motion.div {...popIn} className={cn("absolute top-full right-0 mt-2 w-60 p-2 origin-top-right", PANEL)}>
                  {profilePanelBody}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT — reserves space for the bottom bar on mobile */}
        <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative t-canvas",
          showBottomBar && mainBarPad,
        )}>
          <motion.div
            key={pathname}
            {...pageTransition}
            className={cn(
              "w-full relative z-10 px-t-page-x py-t-page-y",
              !isWide && "max-w-[1400px] mx-auto",
            )}
          >
            <ApprovalGate status={centerStatus}>{children}</ApprovalGate>
          </motion.div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION — per Mobile_navigation */}
        {showBottomBar && MOBILE_NAV === "floating" && (
          <nav className="md:hidden fixed inset-x-3 z-40 bg-t-bar-blur backdrop-blur-xl border border-t-glass-border shadow-elev-3 rounded-full flex px-2 py-1.5" style={{ bottom: "calc(10px + env(safe-area-inset-bottom))" }}>
            {mobileNavItems.map(mobileNavLink)}
            {menuButton}
          </nav>
        )}
        {showBottomBar && MOBILE_NAV !== "floating" && (
          <nav
            className={cn(
              "md:hidden fixed bottom-0 inset-x-0 z-40 bg-t-bar-blur backdrop-blur-xl border-t border-outline-variant flex",
              MOBILE_NAV === "dock" && "px-1.5 pt-1.5",
              MOBILE_NAV === "iconic" && "px-1.5",
              MOBILE_NAV === "topline" && "px-1.5",
            )}
            style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom))" }}
          >
            {mobileNavItems.map(mobileNavLink)}
            {menuButton}
          </nav>
        )}

      </div>
    </div>
  );
}
