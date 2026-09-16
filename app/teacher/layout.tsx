'use client';

import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';

import '@/components/ui/theme.css';
import {
  Button, ConfirmDialog, ProgressBar, Loader, cn,
  TeacherThemeProvider, useTeacherTheme,
  TEACHER_DESIGN, MOTION_ON, springTransition, popIn, pageTransition,
} from '@/components/ui';

import { resolveSideStyle } from '@/components/ui/shellStyles';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile } from '@/services/userService';
import { useMonthlyLimit } from '@/hooks/useMonthlyLimit';
import NotificationBell from '@/components/NotificationBell';

import {
  LayoutDashboard, Users, FilePlus, FolderOpen, Library,
  Sparkles, Settings, LogOut, Menu, X, Bell,
  Zap, BookOpen, UserIcon, CreditCard, PanelLeft, MoreVertical,
  MoreHorizontal, Sun, Moon, Monitor, Globe, BadgeCheck, Building2, GraduationCap,
} from 'lucide-react';
import { useTeacherCenter } from '@/hooks/useTeacherCenter';

// ============================================================================
// 1. CONTEXT & TYPES
// ============================================================================
export type LangType = 'uz' | 'en' | 'ru';

interface TeacherLangContextType {
  lang: LangType;
  setLang: (lang: LangType) => void;
}

export const TeacherLanguageContext = createContext<TeacherLangContextType | undefined>(undefined);

export function useTeacherLanguage() {
  const context = useContext(TeacherLanguageContext);
  if (!context) throw new Error("useTeacherLanguage must be used within TeacherLayout");
  return context;
}

const LANG_STORAGE_KEY = 'edify-teacher-lang';

// ============================================================================
// 2. TRANSLATION DICTIONARY
// ============================================================================
const LAYOUT_TRANSLATIONS = {
  uz: {
    brandSubtitle: "O'QITUVCHI PORTALI",
    menu: { overview: "Boshqaruv", library: "Mening kutubxonam", classes: "Sinflar", onlineLibrary: "Onlayn Kitoblar", analytics: "Tahlillar", notifications: "Bildirishnomalar", subscription: "Obuna", profile: "Profil", ielts: "IELTS Moduli", milliy: "Milliy sertifikat", sat: "SAT", center: "Markazim" },
    menuShort: { library: "Kutubxonam", onlineLibrary: "Kitoblar", notifications: "Xabarlar", milliy: "Milliy", sat: "SAT" },
    bottom: { home: "Boshqaruv", create: "Yaratish", classes: "Sinflar", library: "Kutubxona", menu: "Menyu" },
    create: "Yangi Test", signOut: "Chiqish", settings: "Sozlamalar", more: "Yana",
    theme: { label: "Mavzu", light: "Yorug'", system: "Tizim", dark: "Tun" },
    aiLimit: { title: "Oylik AI Balans", upgrade: "Kredit Olish", used: "ishlatildi", unlimited: "Cheksiz", renews: "Yangilanadi" },
    logoutConfirm: { title: "Tizimdan chiqish", desc: "Haqiqatan ham hisobingizdan chiqmoqchimisiz?", cancel: "Bekor qilish", confirm: "Chiqish" }
  },
  en: {
    brandSubtitle: "INSTRUCTOR PORTAL",
    menu: { overview: "Dashboard", library: "Library", classes: "Classes", onlineLibrary: "Online Books", analytics: "Analytics", notifications: "Notifications", subscription: "Subscription", profile: "Profile", ielts: "IELTS Module", milliy: "Milliy sertifikat", sat: "SAT", center: "My Center" },
    menuShort: { library: "Library", onlineLibrary: "Books", notifications: "Alerts", milliy: "Milliy", sat: "SAT" },
    bottom: { home: "Home", create: "Create", classes: "Classes", library: "Library", menu: "Menu" },
    create: "New Test", signOut: "Sign Out", settings: "Settings", more: "More",
    theme: { label: "Theme", light: "Light", system: "System", dark: "Dark" },
    aiLimit: { title: "Monthly AI Balance", upgrade: "Buy Credits", used: "used", unlimited: "Unlimited", renews: "Renews" },
    logoutConfirm: { title: "Sign Out", desc: "Are you sure you want to sign out of your account?", cancel: "Cancel", confirm: "Sign Out" }
  },
  ru: {
    brandSubtitle: "ПОРТАЛ УЧИТЕЛЯ",
    menu: { overview: "Обзор", library: "Библиотека", classes: "Классы", onlineLibrary: "Онлайн Книги", analytics: "Аналитика", notifications: "Уведомления", subscription: "Подписка", profile: "Профиль", ielts: "Модуль IELTS", milliy: "Milliy sertifikat", sat: "SAT", center: "Мой центр" },
    menuShort: { library: "Библиотека", onlineLibrary: "Книги", notifications: "Инбокс", milliy: "Milliy", sat: "SAT" },
    bottom: { home: "Обзор", create: "Создать", classes: "Классы", library: "Книги", menu: "Меню" },
    create: "Новый Тест", signOut: "Выйти", settings: "Настройки", more: "Ещё",
    theme: { label: "Тема", light: "День", system: "Система", dark: "Ночь" },
    aiLimit: { title: "Месячный баланс ИИ", upgrade: "Купить кредиты", used: "использовано", unlimited: "Безлимит", renews: "Обновится" },
    logoutConfirm: { title: "Выход", desc: "Вы уверены, что хотите выйти из аккаунта?", cancel: "Отмена", confirm: "Выйти" }
  }
};

const LANGUAGE_OPTIONS: { code: LangType; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: "English" },
  { code: 'ru', label: "Русский" },
];

// Deep routes with their own bottom action bars — every mobile nav bar
// variant (dock/floating/iconic/topline) hides there.
const HIDE_BOTTOM_BAR = [
  /^\/teacher\/create\/.+/,
  /^\/teacher\/classes\/.+/,
  /^\/teacher\/print/,
  /^\/teacher\/ielts\/(reading|listening)\/(manual|view)/,
];

// Shared popover panel styling (M3 menu surface)
const PANEL = "bg-surface-container rounded-m3-lg shadow-elev-3 border border-outline-variant z-[60]";

// The switchboard decisions this shell renders (design.teacher.config.ts).
const SHELL = TEACHER_DESIGN.App_shell_navigation;
const MOBILE_NAV = TEACHER_DESIGN.Mobile_navigation;
const TOP_SHELL = SHELL === 'topbar' || SHELL === 'toolbar';
const SIDE_SHELL = !TOP_SHELL;
// Every side shell collapses except rail (born collapsed, pinned).
const COLLAPSIBLE = SIDE_SHELL && SHELL !== 'rail';
// Mobile variants that render a bottom bar (vs the drawer-only original).
const BAR_MOBILE = MOBILE_NAV === 'dock' || MOBILE_NAV === 'floating' || MOBILE_NAV === 'iconic' || MOBILE_NAV === 'topline';

// Sidebar style recipes live in components/ui/shellStyles.ts so the
// /theme-check-teacher gallery previews exactly what this shell renders.
// (Top shells and rail/floating resolve to the 'sidebar' recipe.)
const STYLE = resolveSideStyle(SHELL);
// The mobile drawer always paints a solid panel — transparent/glass variants
// fall back to the plain surface so the slide-out stays readable over content.
const DRAWER_BG = STYLE.bg === 'bg-transparent' ? 'bg-surface-container-lowest' : STYLE.bg;

// ============================================================================
// 3. SVG FLAGS (emoji flags render inconsistently across devices)
// ============================================================================
function FlagSvg({ code }: { code: LangType }) {
  if (code === 'uz') return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="14" fill="#0099B5" /><rect y="4.9" width="20" height="4.2" fill="#fff" />
      <rect y="4.55" width="20" height="0.5" fill="#CE1126" /><rect y="8.95" width="20" height="0.5" fill="#CE1126" />
      <rect y="9.45" width="20" height="4.55" fill="#1EB53A" />
      <circle cx="3.4" cy="2.5" r="1.5" fill="#fff" /><circle cx="4" cy="2.3" r="1.35" fill="#0099B5" />
    </svg>
  );
  if (code === 'ru') return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="4.67" fill="#fff" /><rect y="4.67" width="20" height="4.67" fill="#0039A6" /><rect y="9.33" width="20" height="4.67" fill="#D52B1E" />
    </svg>
  );
  return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#fff" strokeWidth="2.6" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.1" />
      <path d="M10 0v14M0 7h20" stroke="#fff" strokeWidth="4.4" />
      <path d="M10 0v14M0 7h20" stroke="#C8102E" strokeWidth="2.4" />
    </svg>
  );
}

// ============================================================================
// 4. LAYOUT ENTRY — theme provider wraps the shell so useTeacherTheme works
//    everywhere inside (including the mode toggle in the profile popover).
// ============================================================================
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeacherThemeProvider>
      <TeacherShell>{children}</TeacherShell>
    </TeacherThemeProvider>
  );
}

// ============================================================================
// 5. THE SHELL
// ============================================================================
function TeacherShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth() as any;
  const router = useRouter();
  const pathname = usePathname();
  const aiData = useMonthlyLimit();
  const { preference, setPreference, toggleEnabled } = useTeacherTheme();
  // Module-cached lookup (one getDoc per session) — gates the "Markazim" nav entry.
  const teacherCenter = useTeacherCenter();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(SHELL === 'rail');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const [lang, setLangState] = useState<LangType>('uz');
  const t = LAYOUT_TRANSLATIONS[lang as keyof typeof LAYOUT_TRANSLATIONS] || LAYOUT_TRANSLATIONS['uz'];

  // Restore the device's saved language once on mount (post-hydration, so the
  // server-rendered 'uz' shell never mismatches), then persist every change.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'uz' || stored === 'en' || stored === 'ru') setLangState(stored);
    } catch { /* private mode */ }
  }, []);

  const setLang = useCallback((l: LangType) => {
    setLangState(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* private mode */ }
  }, []);

  const headerRef = useRef<HTMLDivElement>(null);
  const deskHeaderRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const showBottomBar = BAR_MOBILE && !HIDE_BOTTOM_BAR.some((r) => r.test(pathname));

  // Restore persisted rail state (collapsible shells only; 'rail' is pinned).
  useEffect(() => {
    if (!COLLAPSIBLE) return;
    try { setIsCollapsed(localStorage.getItem('edify-sb-rail') === '1'); } catch { /* private mode */ }
  }, []);
  const toggleCollapsed = () => {
    if (!COLLAPSIBLE) return;
    setIsCollapsed((v) => {
      try { localStorage.setItem('edify-sb-rail', v ? '0' : '1'); } catch { /* private mode */ }
      return !v;
    });
  };

  // Keyboard shortcut: [ toggles the rail
  useEffect(() => {
    if (!COLLAPSIBLE) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable) return;
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const inHeader = headerRef.current?.contains(event.target as Node);
      const inDeskHeader = deskHeaderRef.current?.contains(event.target as Node);
      const inSidebar = sidebarRef.current?.contains(event.target as Node);
      if (!inHeader && !inDeskHeader && !inSidebar) {
        setIsProfileMenuOpen(false);
        setIsAiMenuOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auth & Role Check
  useEffect(() => {
    async function checkRole() {
      if (!loading) {
        if (!user) router.push('/auth/login');
        else {
          const profile = await getUserProfile(user.uid);
          if (profile?.role === 'manager') router.push('/manager/dashboard');
          // Office staff (docs/OFFICE.md) get their own panel, not /dashboard.
          else if (profile?.role === 'director' || profile?.role === 'accountant') router.push('/office');
          else if (profile?.role !== 'teacher') router.push('/dashboard');
          else setIsAuthorized(true);
        }
      }
    }
    checkRole();
  }, [user, loading, router]);

  useEffect(() => { setMobileMenuOpen(false); setIsProfileMenuOpen(false); setIsAiMenuOpen(false); setIsMoreMenuOpen(false); }, [pathname]);

  // Handle tour step changes for mobile sidebar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTourStepChange = (e: any) => {
      const stepId = e.detail;
      if (window.innerWidth < 768) {
        if (stepId && stepId.startsWith('tour-sidebar-')) setMobileMenuOpen(true);
        else setMobileMenuOpen(false);
      }
    };
    window.addEventListener('tour-step-change', handleTourStepChange);
    return () => window.removeEventListener('tour-step-change', handleTourStepChange);
  }, []);

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface t-canvas">
        <Loader className="w-40" />
      </div>
    );
  }

  const navItems: { name: string; href: string; icon: typeof LayoutDashboard; isAI?: boolean; tourId?: string; short?: string }[] = [
    { name: t.menu.overview, href: '/teacher/dashboard', icon: LayoutDashboard },
    { name: t.create, href: '/teacher/create', icon: FilePlus, isAI: true },
    { name: t.menu.classes, href: '/teacher/classes', icon: Users, tourId: 'tour-sidebar-classes' },
    // Center teachers only — a solo teacher never sees this entry, and
    // /teacher/center itself renders a "not linked" state if reached directly.
    ...(teacherCenter.centerId
      ? [{ name: t.menu.center, href: '/teacher/center', icon: Building2 }]
      : []),
    { name: t.menu.ielts, href: '/teacher/ielts', icon: Globe, isAI: true },
    // Milliy sertifikat — the subject hub. Maths routes into the existing Rasch
    // paper builder (same 45-question DTM paper); see docs/RASCH_QUIZ.md.
    { name: t.menu.milliy, href: '/teacher/milliy-sertifikat', icon: BadgeCheck, short: t.menuShort.milliy },
    // SAT — adaptive tests (docs/SAT_QUIZ.md). Own nav entry: it is a
    // different exam programme from Milliy sertifikat, not a subject inside it.
    { name: t.menu.sat, href: '/teacher/sat', icon: GraduationCap, short: t.menuShort.sat },
    { name: t.menu.library, href: '/teacher/library', icon: FolderOpen, short: t.menuShort.library },
    { name: t.menu.onlineLibrary, href: '/teacher/online-books', icon: Library, tourId: 'tour-sidebar-online-books', short: t.menuShort.onlineLibrary },
    { name: t.menu.analytics, href: '/teacher/analytics', icon: Sparkles, isAI: true },
    { name: t.menu.notifications, href: '/teacher/notifications', icon: Bell, short: t.menuShort.notifications },
    // { name: t.menu.subscription, href: '/teacher/subscription', icon: CreditCard }, // deliberately hidden — reachable via AI-balance widget
    { name: t.settings, href: '/teacher/settings', icon: Settings },
  ];

  // Topbar shell: first 5 destinations inline, the rest behind "More".
  // Toolbar shell shows every destination on its own nav row instead.
  const topbarPrimary = navItems.slice(0, 5);
  const topbarOverflow = navItems.slice(5);

  const isActive = (href: string) => pathname === href || (href !== '/teacher/dashboard' && pathname.startsWith(href));

  // --- AI balance panel body (shared: desktop popover + mobile popover) ---
  const aiPanelBody = (
    <>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-on-surface text-[14px] flex items-center gap-1.5"><Zap size={14} className="text-warning fill-warning" /> {t.aiLimit.title}</h4>
          <p className="text-[10px] text-on-surface-variant font-medium mt-1">{t.aiLimit.renews}: {aiData.resetDate}</p>
        </div>
        <span className={cn("text-xl font-bold leading-none tracking-tight tabular-nums", aiData.isDanger ? "text-error" : "text-on-surface")}>
          {aiData.isUnlimited ? '∞' : aiData.remaining}
        </span>
      </div>
      {!aiData.isUnlimited && (
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-[10px] font-semibold text-on-surface-variant"><span>{t.aiLimit.used}</span> <span className="text-on-surface tabular-nums">{aiData.used} / {aiData.limit}</span></div>
          <ProgressBar value={aiData.usagePercentage} tone={aiData.isDanger ? 'error' : 'primary'} />
        </div>
      )}
      <Button size="sm" icon={<CreditCard />} className="w-full" onClick={() => { setIsAiMenuOpen(false); setMobileMenuOpen(false); router.push('/teacher/subscription'); }}>
        {t.aiLimit.upgrade}
      </Button>
    </>
  );

  // --- Theme (light/system/dark) segmented switch — per-device override ---
  const themeSwitch = toggleEnabled && (
    <div className="flex items-center bg-surface-container-high p-1 rounded-m3-sm gap-1 mb-2" role="group" aria-label={t.theme.label}>
      {([
        { v: 'light' as const, icon: Sun, label: t.theme.light },
        { v: 'system' as const, icon: Monitor, label: t.theme.system },
        { v: 'dark' as const, icon: Moon, label: t.theme.dark },
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

  // --- Profile popover body (shared: sidebar + top bars) ---
  const profilePanelBody = (
    <>
      <div className="px-3 py-3 bg-surface-container-high rounded-m3-md mb-2">
        <p className="text-[13px] font-semibold text-on-surface truncate">{user?.displayName}</p>
        <p className="text-[10px] font-medium text-on-surface-variant truncate">{user?.email}</p>
      </div>
      {themeSwitch}
      {/* SVG-flag language switcher */}
      <div className="flex items-center bg-surface-container-high p-1 rounded-m3-sm gap-1 mb-2" role="group" aria-label="Til">
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
      <Link href="/teacher/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-colors"><UserIcon size={16} /> {t.menu.profile}</Link>
      <Link href="/teacher/settings" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-colors"><Settings size={16} /> {t.settings}</Link>
      <div className="h-px bg-outline-variant my-1.5 mx-2"></div>
      <button onClick={() => { setIsProfileMenuOpen(false); setShowLogoutModal(true); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium text-error hover:bg-error-container transition-colors"><LogOut size={16} /> {t.logoutConfirm.title}</button>
    </>
  );

  const avatar = (size: string, text: string) => (
    <span className={cn("rounded-m3-sm bg-primary text-on-primary flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-elev-1", size, text)}>
      {user?.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user?.displayName?.[0]}
    </span>
  );

  // --- The animated active indicator, per recipe ---
  // Positions use fixed offsets, never translate — framer's layout animation
  // owns `transform`, so translate-based centering breaks the glide.
  const navIndicator = (collapsed: boolean, isMobile: boolean) => {
    const layoutId = isMobile ? 'sb-pill-m' : 'sb-pill';
    if (STYLE.indicator === 'pill') {
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
    if (STYLE.indicator === 'bar') {
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
    <div className={cn("flex flex-col h-full relative", SHELL === 'floating' && !isMobile ? "bg-transparent" : isMobile ? DRAWER_BG : STYLE.bg)}>

      {/* Header: brand + rail toggle */}
      <div className={cn("flex items-center gap-2.5 px-3.5 pt-4 pb-2 shrink-0 min-h-[64px]", collapsed && "flex-col gap-2 px-0 justify-center")}>
        <div className="flex items-center gap-2.5 overflow-hidden cursor-pointer min-w-0" onClick={() => router.push('/teacher/dashboard')}>
          <div className={cn("w-9 h-9 rounded-m3-md flex items-center justify-center shrink-0 shadow-elev-1", STYLE.brandBox)}><BookOpen size={19} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className={cn("font-t-display font-bold text-[15px] leading-none tracking-tight truncate", STYLE.brandTitle)}>Edify<span className={STYLE.brandAccent}>Teacher</span></h1>
              <p className={cn("text-[8.5px] font-semibold uppercase tracking-[0.14em] mt-1 truncate", STYLE.brandSub)}>{t.brandSubtitle}</p>
            </div>
          )}
        </div>
        {isMobile ? (
          <button onClick={() => setMobileMenuOpen(false)} aria-label="Yopish" className={cn("m3-interactive ml-auto p-2 rounded-full", STYLE.email)}>
            <X size={19} />
          </button>
        ) : COLLAPSIBLE ? (
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Yoyish  [" : "Yig'ish  ["}
            aria-label={collapsed ? "Yoyish" : "Yig'ish"}
            className={cn("m3-interactive p-2 rounded-full", STYLE.email, !collapsed && "ml-auto")}
          >
            <PanelLeft size={18} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              title={collapsed ? item.name : undefined}
              onClick={() => isMobile && setMobileMenuOpen(false)}
              className={cn(
                "group relative flex items-center transition-all",
                collapsed
                  ? "flex-col justify-center gap-[3px] h-[56px] rounded-m3-md px-1"
                  : cn("gap-3 h-[46px] px-3.5", STYLE.itemShape, STYLE.indicator === 'bar' && "pl-4"),
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
              {item.isAI && !collapsed && (
                <span className="relative z-10 bg-primary-container text-on-primary-container text-[8.5px] px-1.5 py-[2px] rounded-m3-xs uppercase font-bold tracking-wider shrink-0">AI</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer: AI meter + profile row (or the classic user card + logout) */}
      <div className={cn("shrink-0 px-2.5 pb-3 pt-2 border-t relative", STYLE.footerBorder)}>

        {/* AI popover */}
        <AnimatePresence>
          {isAiMenuOpen && !isMobile && (
            <motion.div
              {...popIn}
              className={cn("absolute w-64 p-4", PANEL, collapsed ? "left-full ml-2 bottom-2" : "bottom-full mb-2 left-2.5 origin-bottom-left")}
            >
              {aiPanelBody}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile popover */}
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

        {/* Slim AI meter */}
        <button
          onClick={() => {
            if (isMobile) { setMobileMenuOpen(false); router.push('/teacher/subscription'); return; }
            setIsAiMenuOpen(!isAiMenuOpen); setIsProfileMenuOpen(false);
          }}
          title={t.aiLimit.title}
          className={cn(
            "m3-interactive w-full flex items-center rounded-m3-md transition-colors",
            collapsed ? "flex-col gap-1.5 px-1.5 py-2" : "gap-2.5 px-3 py-2.5",
            aiData.isDanger ? "bg-error-container" : "bg-surface-container-low hover:bg-surface-container",
          )}
        >
          <Zap size={15} className={cn("shrink-0", aiData.isDanger ? "text-error fill-error" : "text-warning")} />
          <span className={cn("flex-1 h-[5px] rounded-full overflow-hidden", collapsed ? "w-full flex-none" : "min-w-[30px]", aiData.isDanger ? "bg-[color-mix(in_oklab,var(--m3-on-error-container)_15%,transparent)]" : "bg-surface-container-highest")}>
            <i className={cn("block h-full rounded-full", aiData.isDanger ? "bg-error" : "bg-primary")} style={{ width: `${aiData.isUnlimited ? 100 : Math.min(100, aiData.usagePercentage)}%` }} />
          </span>
          <b className={cn("text-[10.5px] tabular-nums shrink-0", aiData.isDanger ? "text-on-error-container" : "text-on-surface-variant")}>
            {aiData.isUnlimited ? '∞' : `${aiData.used}/${aiData.limit}`}
          </b>
        </button>

        {STYLE.classicFooter && !collapsed ? (
          /* Classic footer: user card opens the popover, logout is its own
             always-visible button on the right. */
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsAiMenuOpen(false); }}
              title={user?.displayName || t.menu.profile}
              className="m3-interactive flex-1 flex items-center gap-2.5 p-1.5 rounded-m3-md text-left transition-colors hover:bg-state-hover min-w-0"
            >
              {avatar("w-10 h-10", "text-[13px]")}
              <span className="flex-1 min-w-0">
                <b className={cn("block text-[12.5px] font-bold truncate", STYLE.name)}>{user?.displayName?.split(' ')[0]}</b>
                <small className={cn("block text-[10px] truncate", STYLE.email)}>{user?.email}</small>
              </span>
            </button>
            <button
              onClick={() => { setIsProfileMenuOpen(false); if (isMobile) setMobileMenuOpen(false); setShowLogoutModal(true); }}
              title={t.logoutConfirm.title}
              aria-label={t.logoutConfirm.title}
              className="m3-interactive w-9 h-9 shrink-0 rounded-m3-md flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
            >
              <LogOut size={17} strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          /* Profile row */
          <button
            onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsAiMenuOpen(false); }}
            title={user?.displayName || t.menu.profile}
            className={cn("m3-interactive w-full flex items-center rounded-m3-md mt-1.5 transition-colors hover:bg-state-hover", collapsed ? "justify-center p-1.5" : "gap-2.5 p-1.5 text-left")}
          >
            {avatar("w-9 h-9", "text-[13px]")}
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0">
                  <b className={cn("block text-[12.5px] font-semibold truncate", STYLE.name)}>{user?.displayName?.split(' ')[0]}</b>
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
  const topbarLink = (item: (typeof navItems)[number]) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        data-tour={item.tourId}
        className={cn(
          "relative flex items-center gap-2 h-[38px] px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors",
          active ? "text-on-secondary-container" : "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
        )}
      >
        {active && (
          <motion.span layoutId="tb-pill" transition={springTransition} className="absolute inset-0 bg-secondary-container rounded-full" />
        )}
        <item.icon size={16} strokeWidth={active ? 2.4 : 2} className={cn("relative z-10", active && "text-primary")} />
        <span className={cn("relative z-10", active && "font-bold")}>{item.name}</span>
      </Link>
    );
  };

  const brandBlock = (
    <div className="flex items-center gap-2.5 cursor-pointer min-w-0 shrink-0" onClick={() => router.push('/teacher/dashboard')}>
      <div className="w-9 h-9 bg-primary rounded-m3-md flex items-center justify-center text-on-primary shrink-0 shadow-elev-1"><BookOpen size={19} /></div>
      <b className="font-t-display text-[15px] text-on-surface tracking-tight truncate hidden lg:block">Edify<span className="text-primary">Teacher</span></b>
    </div>
  );

  // Right cluster of both top shells: AI chip · bell · avatar
  const topbarRightCluster = (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="relative">
        <button
          onClick={() => { setIsAiMenuOpen(!isAiMenuOpen); setIsProfileMenuOpen(false); setIsMoreMenuOpen(false); }}
          className={cn(
            "m3-interactive flex items-center gap-1.5 px-2.5 h-9 rounded-full transition-colors",
            aiData.isDanger ? "bg-error-container text-on-error-container" : "bg-surface-container-low text-on-surface",
          )}
        >
          <Zap size={13} className={aiData.isDanger ? "fill-current" : "text-warning"} />
          <span className="text-[11.5px] font-bold tabular-nums">{aiData.isUnlimited ? '∞' : aiData.remaining}</span>
        </button>
        <AnimatePresence>
          {isAiMenuOpen && (
            <motion.div {...popIn} className={cn("absolute top-full right-0 mt-2 w-[260px] p-4 origin-top-right", PANEL)}>
              {aiPanelBody}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="m3-interactive flex items-center justify-center h-9 w-9 text-on-surface-variant rounded-full shrink-0">
        <NotificationBell />
      </div>

      <div className="relative">
        <button onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsAiMenuOpen(false); setIsMoreMenuOpen(false); }} className="transition-transform active:scale-95">
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

  // --- DESKTOP TOP BAR (SHELL === 'topbar'): single row, 5 + "More" ---
  const desktopTopbar = SHELL === 'topbar' && (
    <header ref={deskHeaderRef} className="hidden md:flex bg-t-bar-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-40 px-4 h-[60px] items-center gap-4 shrink-0">
      {brandBlock}

      {/* Horizontal nav */}
      <nav className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto custom-scrollbar">
        {topbarPrimary.map(topbarLink)}

        {/* More (overflow) */}
        <div className="relative shrink-0">
          <button
            onClick={() => { setIsMoreMenuOpen(!isMoreMenuOpen); setIsProfileMenuOpen(false); setIsAiMenuOpen(false); }}
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
                      data-tour={item.tourId}
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-m3-sm text-[13px] font-medium transition-colors",
                        active ? "bg-secondary-container text-on-secondary-container font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-state-hover",
                      )}
                    >
                      <item.icon size={16} /> {item.name}
                      {item.isAI && <span className="ml-auto bg-primary-container text-on-primary-container text-[8.5px] px-1.5 py-[2px] rounded-m3-xs uppercase font-bold tracking-wider">AI</span>}
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
  const desktopToolbar = SHELL === 'toolbar' && (
    <header ref={deskHeaderRef} className="hidden md:block bg-t-bar-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-40 shrink-0">
      <div className="px-4 h-[54px] flex items-center justify-between gap-4">
        {brandBlock}
        {topbarRightCluster}
      </div>
      <nav className="px-3 pb-2 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {navItems.map(topbarLink)}
      </nav>
    </header>
  );

  // --- MOBILE BOTTOM NAV (dock / floating / iconic / topline) ---
  const mobileNavItems = [
    { label: t.bottom.home, href: '/teacher/dashboard', icon: LayoutDashboard },
    { label: t.bottom.create, href: '/teacher/create', icon: FilePlus },
    { label: t.bottom.classes, href: '/teacher/classes', icon: Users },
    { label: t.bottom.library, href: '/teacher/library', icon: FolderOpen },
  ];

  const mobileNavLink = (item: { label: string; href: string; icon: typeof LayoutDashboard }) => {
    const active = isActive(item.href);
    if (MOBILE_NAV === 'iconic') {
      return (
        <Link key={item.href} href={item.href} aria-label={item.label} className={cn("flex-1 flex items-center justify-center h-[52px] relative", active ? "text-primary" : "text-on-surface-variant")}>
          {active && (
            <motion.span layoutId="bn-pill" transition={springTransition} className="absolute inset-y-2 inset-x-0 mx-auto w-[56px] bg-secondary-container rounded-full" />
          )}
          <item.icon size={22} strokeWidth={active ? 2.4 : 2} className="relative z-10" />
        </Link>
      );
    }
    if (MOBILE_NAV === 'topline') {
      return (
        <Link key={item.href} href={item.href} className={cn("flex-1 flex flex-col items-center gap-[3px] pt-2 pb-1 relative", active ? "text-primary" : "text-on-surface-variant")}>
          {active && (
            <motion.span layoutId="bn-pill" transition={springTransition} className="absolute top-0 inset-x-0 mx-auto w-9 h-[3px] rounded-b-full bg-primary" />
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
          <motion.span layoutId="bn-pill" transition={springTransition} className="absolute -top-0.5 inset-x-0 mx-auto w-[52px] h-[28px] bg-secondary-container rounded-full" />
        )}
        <item.icon size={21} strokeWidth={active ? 2.4 : 2} className={cn("relative z-10", active && "text-primary")} />
        <span className={cn("relative z-10 text-[9.5px] font-semibold", active && "font-bold")}>{item.label}</span>
      </Link>
    );
  };

  const menuButton = MOBILE_NAV === 'iconic' ? (
    <button onClick={() => setMobileMenuOpen(true)} aria-label={t.bottom.menu} className="flex-1 flex items-center justify-center h-[52px] text-on-surface-variant">
      <Menu size={22} strokeWidth={2} />
    </button>
  ) : (
    <button onClick={() => setMobileMenuOpen(true)} className={cn("flex-1 flex flex-col items-center gap-[3px] text-on-surface-variant", MOBILE_NAV === 'topline' ? "pt-2 pb-1" : "py-1")}>
      <Menu size={21} strokeWidth={2} />
      <span className="text-[9.5px] font-semibold">{t.bottom.menu}</span>
    </button>
  );

  // Bottom padding the scroll area reserves for each bar height.
  const mainBarPad =
    MOBILE_NAV === 'dock' ? "pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0"
    : MOBILE_NAV === 'floating' ? "pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0"
    : MOBILE_NAV === 'iconic' ? "pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0"
    : MOBILE_NAV === 'topline' ? "pb-[calc(70px+env(safe-area-inset-bottom))] md:pb-0"
    : "";

  return (
    <TeacherLanguageContext.Provider value={{ lang, setLang }}>
      <div className={cn(
        "min-h-[100dvh] bg-surface font-t-body selection:bg-primary-container selection:text-on-primary-container overflow-hidden relative",
        SIDE_SHELL ? "flex" : "flex flex-col",
      )}>

        {/* --- LOGOUT CONFIRM --- */}
        <ConfirmDialog
          open={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={() => { signOut(auth); setShowLogoutModal(false); }}
          title={t.logoutConfirm.title}
          description={t.logoutConfirm.desc}
          confirmText={t.logoutConfirm.confirm}
          cancelText={t.logoutConfirm.cancel}
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
        {SIDE_SHELL && SHELL !== 'floating' && (
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
        {SHELL === 'floating' && (
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

          {/* MOBILE TOP BAR — slim: (hamburger) · brand · AI chip · bell · avatar */}
          <header ref={headerRef} className="md:hidden bg-background-blur backdrop-blur-xl border-b border-outline-variant sticky top-0 z-30 px-3 py-2 flex justify-between items-center shrink-0">

            <div className="flex items-center gap-1.5 min-w-0">
              {MOBILE_NAV === 'drawer' && (
                <button onClick={() => setMobileMenuOpen(true)} aria-label={t.bottom.menu} className="m3-interactive flex items-center justify-center h-9 w-9 -ml-1 text-on-surface-variant rounded-full shrink-0">
                  <Menu size={20} />
                </button>
              )}
              <div className="flex items-center gap-2 min-w-0" onClick={() => router.push('/teacher/dashboard')}>
                <div className="w-8 h-8 bg-primary rounded-m3-sm flex items-center justify-center text-on-primary shrink-0 shadow-elev-1"><BookOpen size={16} /></div>
                <b className="font-t-display text-[14px] text-on-surface tracking-tight truncate">Edify<span className="text-primary">Teacher</span></b>
              </div>
            </div>

            <div className="flex items-center gap-1.5">

              {/* AI chip + popover */}
              <div className="relative">
                <button
                  onClick={() => { setIsAiMenuOpen(!isAiMenuOpen); setIsProfileMenuOpen(false); }}
                  className={cn(
                    "m3-interactive flex items-center gap-1.5 px-2.5 h-9 rounded-full transition-colors",
                    aiData.isDanger ? "bg-error-container text-on-error-container" : "bg-surface-container-low text-on-surface",
                  )}
                >
                  <Zap size={13} className={aiData.isDanger ? "fill-current" : "text-warning"} />
                  <span className="text-[11.5px] font-bold tabular-nums">{aiData.isUnlimited ? '∞' : aiData.remaining}</span>
                </button>
                <AnimatePresence>
                  {isAiMenuOpen && (
                    <motion.div {...popIn} className={cn("absolute top-full right-0 mt-2 w-[260px] p-4 origin-top-right", PANEL)}>
                      {aiPanelBody}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notification bell (quick panel) */}
              <div className="m3-interactive flex items-center justify-center h-9 w-9 text-on-surface-variant rounded-full shrink-0">
                <NotificationBell />
              </div>

              {/* Avatar + profile popover (theme + language switchers live inside) */}
              <div className="relative">
                <button onClick={() => { setIsProfileMenuOpen(!isProfileMenuOpen); setIsAiMenuOpen(false); }} className="transition-transform active:scale-95">
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
          </header>

          {/* MAIN SCROLLABLE CONTENT — reserves space for the bottom bar on mobile */}
          <main className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative t-canvas",
            showBottomBar && mainBarPad,
          )}>
            <motion.div key={pathname} {...pageTransition} className="w-full h-full relative z-10">
              {children}
            </motion.div>
          </main>

          {/* MOBILE BOTTOM NAVIGATION — per Mobile_navigation */}
          {showBottomBar && MOBILE_NAV === 'floating' && (
            <nav className="md:hidden fixed inset-x-3 z-40 bg-t-bar-blur backdrop-blur-xl border border-t-glass-border shadow-elev-3 rounded-full flex px-2 py-1.5" style={{ bottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
              {mobileNavItems.map(mobileNavLink)}
              {menuButton}
            </nav>
          )}
          {showBottomBar && MOBILE_NAV !== 'floating' && (
            <nav
              className={cn(
                "md:hidden fixed bottom-0 inset-x-0 z-40 bg-t-bar-blur backdrop-blur-xl border-t border-outline-variant flex",
                MOBILE_NAV === 'dock' && "px-1.5 pt-1.5",
                MOBILE_NAV === 'iconic' && "px-1.5",
                MOBILE_NAV === 'topline' && "px-1.5",
              )}
              style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}
            >
              {mobileNavItems.map(mobileNavLink)}
              {menuButton}
            </nav>
          )}

        </div>
      </div>
    </TeacherLanguageContext.Provider>
  );
}
