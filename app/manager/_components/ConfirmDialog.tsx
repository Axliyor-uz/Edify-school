"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import ManagerSheet from "./ManagerSheet";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

// Only the built-in cancel label is translated here; title/message/confirmLabel
// arrive via props from the calling page's own TRANSLATIONS dict.
const TRANSLATIONS = {
  uz: { cancel: "Bekor qilish" },
  en: { cancel: "Cancel" },
  ru: { cancel: "Отмена" },
};
type T = typeof TRANSLATIONS.uz;

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel, isLoading, onConfirm, onClose }: Props) {
  const { lang } = useManagerLanguage();
  const t: T = TRANSLATIONS[lang] || TRANSLATIONS.uz;
  return (
    <ManagerSheet onClose={onClose} dismissible={!isLoading}>
      <div className="p-6 sm:p-7">
        <div className="w-12 h-12 rounded-m3-lg bg-error-container text-on-error-container flex items-center justify-center mb-4">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-lg font-bold text-on-surface tracking-tight">{title}</h3>
        <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="m3-interactive flex-1 h-t-control bg-surface-container-high text-on-surface font-bold text-sm rounded-m3-btn transition-colors disabled:opacity-60"
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="m3-interactive flex-1 h-t-control bg-error text-on-error font-bold text-sm rounded-m3-btn transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ManagerSheet>
  );
}
