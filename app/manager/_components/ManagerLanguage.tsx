"use client";

/**
 * Manager panel language system (uz / ru / en) — mirrors the teacher pattern
 * (TeacherLanguageContext in app/teacher/layout.tsx) but lives in its own
 * module so _components used BY the layout (ApprovalGate, dialogs…) can import
 * the hook without a layout ↔ component import cycle.
 *
 * Pages follow the teacher convention: a local `TRANSLATIONS = { uz, ru, en }`
 * dict + `const { lang } = useManagerLanguage()`.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type LangType = "uz" | "en" | "ru";

interface ManagerLangContextType {
  lang: LangType;
  setLang: (lang: LangType) => void;
}

export const ManagerLanguageContext = createContext<ManagerLangContextType | undefined>(undefined);

export function useManagerLanguage() {
  const context = useContext(ManagerLanguageContext);
  if (!context) throw new Error("useManagerLanguage must be used within ManagerLayout");
  return context;
}

export const LANGUAGE_OPTIONS: { code: LangType; label: string }[] = [
  { code: "uz", label: "O'zbek" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
];

// The chosen language survives reloads and new sessions on this device.
const LANG_STORAGE_KEY = "edify-manager-lang";

export function ManagerLanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangType>("uz");

  // Restore the device's saved language once on mount (post-hydration, so the
  // server-rendered 'uz' shell never mismatches), then persist every change.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === "uz" || stored === "en" || stored === "ru") setLangState(stored);
    } catch { /* private mode */ }
  }, []);

  const setLang = useCallback((l: LangType) => {
    setLangState(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* private mode */ }
  }, []);

  return (
    <ManagerLanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </ManagerLanguageContext.Provider>
  );
}

// SVG flags — emoji flags render as letter glyphs or mismatched art on many
// platforms (same rationale as the teacher/student switchers).
export function FlagSvg({ code }: { code: LangType }) {
  if (code === "uz") return (
    <svg viewBox="0 0 20 14" className="w-5 h-3.5 rounded-[3px] shrink-0" aria-hidden>
      <rect width="20" height="14" fill="#0099B5" /><rect y="4.9" width="20" height="4.2" fill="#fff" />
      <rect y="4.55" width="20" height="0.5" fill="#CE1126" /><rect y="8.95" width="20" height="0.5" fill="#CE1126" />
      <rect y="9.45" width="20" height="4.55" fill="#1EB53A" />
      <circle cx="3.4" cy="2.5" r="1.5" fill="#fff" /><circle cx="4" cy="2.3" r="1.35" fill="#0099B5" />
    </svg>
  );
  if (code === "ru") return (
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
