"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { MOTION_ON, springTransition } from "@/components/manager-ui";

interface Props {
  onClose: () => void;
  /** Allow closing via backdrop / Escape (disable while submitting). */
  dismissible?: boolean;
  children: React.ReactNode;
}

/**
 * Responsive modal container: slides up as a bottom sheet on phones,
 * renders as a centered dialog from `sm` up. Token-driven — follows the
 * manager switchboard (shape, motion, palette, dark mode).
 */
export default function ManagerSheet({ onClose, dismissible = true, children }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [dismissible, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={MOTION_ON ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-scrim backdrop-blur-sm"
        onClick={() => dismissible && onClose()}
      />
      <motion.div
        initial={MOTION_ON ? { opacity: 0, y: 32, scale: 0.98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springTransition}
        className="relative bg-surface-container-lowest w-full sm:max-w-md rounded-t-m3-xl sm:rounded-m3-xl shadow-elev-3 max-h-[90dvh] overflow-y-auto overscroll-contain custom-scrollbar"
      >
        <div className="sm:hidden pt-3 flex justify-center" aria-hidden>
          <div className="w-10 h-1 rounded-full bg-outline-variant" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
