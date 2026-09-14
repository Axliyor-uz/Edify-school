"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { MOTION_ON, TEACHER_DESIGN, springTransition } from "./config";
import { Button } from "./Button";
import { cn } from "./cn";

/** design.teacher.config.ts › Dialog_style: 'sheet' turns the dialog into a
 *  bottom sheet on phones (< md); 'center' keeps the centered dialog everywhere. */
const SHEET_MODE = TEACHER_DESIGN.Dialog_style === "sheet";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Muted text under the title. */
  description?: ReactNode;
  /** Optional icon shown in a circle above the title (centers the header). */
  icon?: ReactNode;
  /** Buttons row, right-aligned (e.g. text-Button + filled-Button). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, icon, actions, children, className }: DialogProps) {
  // Tracks the < md breakpoint so sheet mode can switch presentation. Only
  // wired up when the switchboard asks for sheets.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (!SHEET_MODE) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const asSheet = SHEET_MODE && isMobile;

  const panelClass = cn(
    "relative w-full max-w-md bg-surface-container-high shadow-elev-3",
    asSheet
      ? "max-h-[85vh] overflow-y-auto rounded-t-m3-xl px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      : "rounded-m3-xl p-6",
    className,
  );

  const body = (
    <>
      {asSheet && <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" />}
      {icon && (
        <div className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-full bg-error-container text-on-error-container [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <h2 className={cn("text-lg font-semibold text-on-surface", icon && "text-center")}>{title}</h2>
      {description && <p className={cn("mt-2 text-sm text-on-surface-variant", icon && "text-center")}>{description}</p>}
      {children}
      {actions && <div className="mt-6 flex justify-end gap-1.5">{actions}</div>}
    </>
  );

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[100] flex justify-center", asSheet ? "items-end" : "items-center p-6")}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      {asSheet && MOTION_ON ? (
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={springTransition} className={panelClass}>
          {body}
        </motion.div>
      ) : (
        <div className={panelClass}>{body}</div>
      )}
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Destructive action → red confirm button + warning icon. */
  danger?: boolean;
  /** Spinner on the confirm button while the action runs. */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Tasdiqlash",
  cancelText = "Bekor qilish",
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={danger ? <AlertTriangle /> : undefined}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={danger ? "danger" : "filled"} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    />
  );
}
