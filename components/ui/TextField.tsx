import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "./cn";
import { TEACHER_DESIGN, type TeacherDesignConfig } from "./config";

/* ── Input_style switch (design.teacher.config.ts) ──────────────────────────
   The default look of every field comes from TEACHER_DESIGN.Input_style; any
   single usage can override it with the `variant` prop.

   Fields keep an OPAQUE background in every variant so the floating-label
   patch always matches, on any card (docs/UI_KIT.md — never transparent). */

export type InputVariant = TeacherDesignConfig["Input_style"]; // 'outlined' | 'filled' | 'soft'

const DEFAULT_VARIANT: InputVariant = TEACHER_DESIGN.Input_style;

const FIELD =
  "m3-field w-full rounded-m3-xs text-sm text-on-surface transition-colors placeholder:text-transparent focus:outline-none";

/* ok/err = field chrome; patch = the floating label's cutout background,
   which must match the field background ('soft' has no border to cut, so its
   patch stays transparent). */
const FIELD_VARIANT: Record<InputVariant, { ok: string; err: string; patch: string }> = {
  outlined: {
    ok: "border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary",
    err: "border border-error bg-surface-container-lowest focus:border-error focus:ring-1 focus:ring-inset focus:ring-error",
    patch: "bg-surface-container-lowest",
  },
  /* the kit's original look — preserved verbatim as the 'filled' variant */
  filled: {
    ok: "border border-outline bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-inset focus:ring-primary",
    err: "border border-error bg-surface-container-lowest focus:border-error focus:ring-1 focus:ring-inset focus:ring-error",
    patch: "bg-surface-container-lowest",
  },
  soft: {
    ok: "border border-transparent bg-surface-container focus:bg-surface-container-high focus:ring-1 focus:ring-inset focus:ring-primary",
    err: "border border-transparent bg-surface-container ring-1 ring-inset ring-error focus:bg-surface-container-high focus:ring-error",
    patch: "",
  },
};

const LABEL =
  "pointer-events-none absolute left-3 px-1 text-sm text-on-surface-variant transition-all " +
  "peer-focus:text-[11px] peer-focus:font-semibold peer-[:not(:placeholder-shown)]:text-[11px]";

function fieldClasses(variant: InputVariant, error?: string) {
  const v = FIELD_VARIANT[variant];
  return cn(FIELD, error ? v.err : v.ok);
}

function Supporting({ error, supporting }: { error?: string; supporting?: ReactNode }) {
  if (!error && !supporting) return null;
  return <p className={cn("px-3.5 text-xs", error ? "text-error" : "text-on-surface-variant")}>{error || supporting}</p>;
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Error message — turns the field red and replaces the supporting text. */
  error?: string;
  /** Helper text under the field. */
  supporting?: ReactNode;
  /** Field style — defaults to TEACHER_DESIGN.Input_style. */
  variant?: InputVariant;
}

export function TextField({ label, error, supporting, className, id, variant = DEFAULT_VARIANT, ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <input
          id={fieldId}
          placeholder=" "
          className={cn(fieldClasses(variant, error), "peer h-t-control px-4")}
          {...rest}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            LABEL,
            FIELD_VARIANT[variant].patch,
            "top-1/2 -translate-y-1/2 peer-focus:top-0 peer-[:not(:placeholder-shown)]:top-0",
            error ? "peer-focus:text-error" : "peer-focus:text-primary",
          )}
        >
          {label}
        </label>
      </div>
      <Supporting error={error} supporting={supporting} />
    </div>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  supporting?: ReactNode;
  /** Field style — defaults to TEACHER_DESIGN.Input_style. */
  variant?: InputVariant;
}

export function TextArea({ label, error, supporting, className, id, variant = DEFAULT_VARIANT, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <textarea
          id={fieldId}
          placeholder=" "
          className={cn(fieldClasses(variant, error), "peer min-h-24 resize-y px-4 py-3")}
          {...rest}
        />
        <label
          htmlFor={fieldId}
          className={cn(
            LABEL,
            FIELD_VARIANT[variant].patch,
            "top-6 -translate-y-1/2 peer-focus:top-0 peer-[:not(:placeholder-shown)]:top-0",
            error ? "peer-focus:text-error" : "peer-focus:text-primary",
          )}
        >
          {label}
        </label>
      </div>
      <Supporting error={error} supporting={supporting} />
    </div>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  supporting?: ReactNode;
  /** Field style — defaults to TEACHER_DESIGN.Input_style. */
  variant?: InputVariant;
}

/** Native select (options passed as children). The label sits floated. */
export function Select({ label, error, supporting, className, id, children, variant = DEFAULT_VARIANT, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative">
        <select
          id={fieldId}
          className={cn(fieldClasses(variant, error), "h-t-control appearance-none px-4 pr-10")}
          {...rest}
        >
          {children}
        </select>
        {label && (
          <label
            htmlFor={fieldId}
            className={cn(
              "pointer-events-none absolute left-3 top-0 -translate-y-1/2 px-1 text-[11px] font-semibold text-on-surface-variant",
              FIELD_VARIANT[variant].patch,
            )}
          >
            {label}
          </label>
        )}
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
      </div>
      <Supporting error={error} supporting={supporting} />
    </div>
  );
}

/* SearchBar follows the same variant, and goes fully round when the button
   personality is 'pill' so the chrome reads as one family. */
const SEARCH_VARIANT: Record<InputVariant, string> = {
  outlined: "border border-outline-variant bg-surface-container-lowest focus-within:border-primary",
  filled: "bg-surface-container-high",
  soft: "bg-surface-container focus-within:bg-surface-container-high",
};

const SEARCH_RADIUS = TEACHER_DESIGN.Button_style === "pill" ? "rounded-full" : "rounded-m3-btn";

export interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Wrapper classes (width etc.); input takes the remaining props. */
  className?: string;
  /** Field style — defaults to TEACHER_DESIGN.Input_style. */
  variant?: InputVariant;
}

export function SearchBar({ className, variant = DEFAULT_VARIANT, ...rest }: SearchBarProps) {
  return (
    <div
      className={cn(
        "flex h-t-control items-center gap-2.5 px-4 text-on-surface-variant transition-colors",
        SEARCH_RADIUS,
        SEARCH_VARIANT[variant],
        className,
      )}
    >
      <Search aria-hidden className="h-[18px] w-[18px] flex-none" />
      <input type="search" className="m3-field h-full w-full min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none" {...rest} />
    </div>
  );
}
