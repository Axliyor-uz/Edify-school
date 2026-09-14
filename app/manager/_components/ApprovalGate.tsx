"use client";

import { useState } from "react";
import { ShieldAlert, ShieldX, Phone, Send, X, Lock } from "lucide-react";
import ManagerSheet from "./ManagerSheet";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

export type CenterApprovalStatus = "pending" | "active" | "suspended";

const ADMIN_PHONE_DISPLAY = "+998 33 860 20 06";
const ADMIN_PHONE_TEL = "+998338602006";
const ADMIN_TELEGRAM = "umidjon0339";

const TRANSLATIONS = {
  uz: {
    pending: {
      title: "Markazingiz tasdiqlanishi kutilmoqda",
      body: "Barcha funksiyalardan to'liq foydalanish uchun markazingiz admin tomonidan tasdiqlanishi kerak. Tasdiqlash uchun admin bilan bog'laning:",
    },
    suspended: {
      title: "Markazingiz faoliyati to'xtatilgan",
      body: "Markazingiz admin tomonidan vaqtincha to'xtatilgan. Qayta faollashtirish uchun admin bilan bog'laning:",
    },
    close: "Yopish",
    lockedTitle: "Bu funksiya hozircha yopiq",
  },
  en: {
    pending: {
      title: "Your center is awaiting approval",
      body: "To use all features, your center must be approved by the admin. Contact the admin to get approved:",
    },
    suspended: {
      title: "Your center has been suspended",
      body: "Your center has been temporarily suspended by the admin. Contact the admin to reactivate it:",
    },
    close: "Close",
    lockedTitle: "This feature is locked for now",
  },
  ru: {
    pending: {
      title: "Ваш центр ожидает подтверждения",
      body: "Чтобы пользоваться всеми функциями, ваш центр должен быть подтверждён администратором. Свяжитесь с администратором для подтверждения:",
    },
    suspended: {
      title: "Работа вашего центра приостановлена",
      body: "Ваш центр временно приостановлен администратором. Свяжитесь с администратором для повторной активации:",
    },
    close: "Закрыть",
    lockedTitle: "Эта функция пока недоступна",
  },
};
type T = typeof TRANSLATIONS.uz;

// Per-status icon + tone stay static; the texts resolve per-language above.
const COPY = {
  pending: {
    icon: ShieldAlert,
    tone: {
      card: "bg-warning-container",
      iconBox: "bg-warning text-on-warning",
      title: "text-on-warning-container",
      body: "text-on-warning-container",
    },
  },
  suspended: {
    icon: ShieldX,
    tone: {
      card: "bg-error-container",
      iconBox: "bg-error text-on-error",
      title: "text-on-error-container",
      body: "text-on-error-container",
    },
  },
} as const;

function ContactButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-2.5 ${compact ? "" : "mt-4"}`}>
      <a
        href={`tel:${ADMIN_PHONE_TEL}`}
        className="m3-interactive inline-flex items-center gap-2 px-4 h-t-control rounded-m3-btn bg-inverse-surface text-inverse-on-surface text-[13px] font-bold transition-colors shadow-elev-1"
      >
        <Phone size={15} /> {ADMIN_PHONE_DISPLAY}
      </a>
      <a
        href={`https://t.me/${ADMIN_TELEGRAM}`}
        target="_blank"
        rel="noopener noreferrer"
        className="m3-interactive inline-flex items-center gap-2 px-4 h-t-control rounded-m3-btn bg-primary text-on-primary text-[13px] font-bold transition-colors shadow-elev-1"
      >
        <Send size={15} /> @{ADMIN_TELEGRAM}
      </a>
    </div>
  );
}

/**
 * Wraps the manager pages. When the center is not yet approved (or suspended),
 * everything stays visible and navigable, but:
 *  - a big notice card is pinned above the page content (incl. the dashboard),
 *  - any interaction with the page content opens a "contact admin" dialog.
 * Firestore rules independently reject all writes for non-active centers —
 * this component is UX; the rules are the actual security boundary.
 */
export default function ApprovalGate({
  status,
  children,
}: {
  status: CenterApprovalStatus;
  children: React.ReactNode;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  // Rendered by the layout INSIDE ManagerLanguageProvider — the plain hook is safe here.
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;

  if (status === "active") return <>{children}</>;

  const copy = COPY[status];
  const text = t[status];
  const Icon = copy.icon;

  return (
    <>
      {/* BIG NOTICE CARD — always above the page content */}
      <div className={`rounded-m3-lg p-5 sm:p-6 mb-4 shadow-elev-1 ${copy.tone.card}`}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className={`w-12 h-12 rounded-m3-lg flex items-center justify-center shrink-0 ${copy.tone.iconBox}`}>
            <Icon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-[16px] font-black tracking-tight ${copy.tone.title}`}>{text.title}</h2>
            <p className={`text-[13.5px] font-medium mt-1 leading-relaxed ${copy.tone.body}`}>{text.body}</p>
            <ContactButtons />
          </div>
        </div>
      </div>

      {/* PAGE CONTENT — visible but not interactive */}
      <div className="relative">
        {children}
        <div
          className="absolute inset-0 z-30 cursor-not-allowed"
          onClick={() => setDialogOpen(true)}
          aria-hidden="true"
        />
      </div>

      {/* CONTACT DIALOG — opens on any attempted interaction */}
      {dialogOpen && (
        <ManagerSheet onClose={() => setDialogOpen(false)}>
          <div className="relative p-6">
            <button
              onClick={() => setDialogOpen(false)}
              aria-label={t.close}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-state-hover hover:text-on-surface transition-colors"
            >
              <X size={18} />
            </button>
            <div className={`w-14 h-14 rounded-m3-lg flex items-center justify-center mb-4 ${copy.tone.iconBox}`}>
              <Lock size={26} />
            </div>
            <h3 className="text-[17px] font-black text-on-surface tracking-tight">
              {t.lockedTitle}
            </h3>
            <p className="text-[13.5px] text-on-surface-variant font-medium mt-1.5 mb-5 leading-relaxed">
              {text.body}
            </p>
            <ContactButtons compact />
          </div>
        </ManagerSheet>
      )}
    </>
  );
}
