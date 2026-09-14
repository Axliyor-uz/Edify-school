"use client";

import type { CSSProperties } from "react";
import toast from "react-hot-toast";

/* Themed wrappers over react-hot-toast — always use these in teacher pages
   (never raw toast.success/error) so notifications match the design system. */

const base: CSSProperties = {
  borderRadius: "var(--m3-shape-sm)",
  fontSize: "13.5px",
  fontWeight: 600,
  boxShadow: "var(--m3-elev-2)",
};

export const uiToast = {
  success: (message: string) =>
    toast.success(message, {
      style: { ...base, background: "var(--m3-success-container)", color: "var(--m3-on-success-container)" },
      iconTheme: { primary: "var(--m3-success)", secondary: "var(--m3-success-container)" },
    }),
  error: (message: string) =>
    toast.error(message, {
      style: { ...base, background: "var(--m3-error-container)", color: "var(--m3-on-error-container)" },
      iconTheme: { primary: "var(--m3-error)", secondary: "var(--m3-error-container)" },
    }),
  /** Neutral snackbar-style note (inverse surface). */
  info: (message: string) =>
    toast(message, {
      style: { ...base, background: "var(--m3-inverse-surface)", color: "var(--m3-inverse-on-surface)" },
    }),
};
