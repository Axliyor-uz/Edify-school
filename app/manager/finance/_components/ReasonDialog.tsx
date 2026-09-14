"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";
import { Button } from "@/components/manager-ui";
import { useManagerLanguage, type LangType } from "@/app/manager/_components/ManagerLanguage";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  placeholder?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

const T_UZ = {
  reasonPlaceholder: "Sababni yozing (majburiy)...",
  cancel: "Bekor qilish",
};

const TRANSLATIONS: Record<LangType, typeof T_UZ> = {
  uz: T_UZ,
  en: { reasonPlaceholder: "Write the reason (required)...", cancel: "Cancel" },
  ru: { reasonPlaceholder: "Укажите причину (обязательно)...", cancel: "Отмена" },
};

/**
 * ConfirmDialog variant with a MANDATORY reason field — money records are never
 * deleted, only cancelled/waived with an audit reason (FINANCE.md rule #1).
 */
export default function ReasonDialog({ title, message, confirmLabel, placeholder, onConfirm, onClose }: Props) {
  const { lang } = useManagerLanguage();
  const t = TRANSLATIONS[lang];
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7">
        <div className="w-12 h-12 rounded-m3-lg bg-error-container text-on-error-container flex items-center justify-center mb-4">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-lg font-bold text-on-surface tracking-tight">{title}</h3>
        <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">{message}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder || t.reasonPlaceholder}
          rows={2}
          className="mt-4 w-full bg-transparent border border-outline-variant rounded-m3-md px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
        />
        <div className="flex gap-3 mt-5">
          <Button variant="tonal" onClick={onClose} disabled={submitting} className="flex-1">
            {t.cancel}
          </Button>
          <Button variant="danger" onClick={submit} disabled={!reason.trim()} loading={submitting} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ManagerSheet>
  );
}
