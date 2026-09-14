import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/* Switch / Checkbox / Radio — native inputs styled by the .m3-* classes in
   theme.css. Pass `label` to get a clickable label row for free. */

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

function withLabel(input: ReactNode, label: ReactNode | undefined, className?: string) {
  if (!label) return input;
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2.5 text-sm text-on-surface", className)}>
      {input}
      <span>{label}</span>
    </label>
  );
}

export function Switch({ label, className, ...rest }: ToggleProps) {
  const input = <input type="checkbox" role="switch" className={cn("m3-switch", !label && className)} {...rest} />;
  return withLabel(input, label, className);
}

export function Checkbox({ label, className, ...rest }: ToggleProps) {
  const input = <input type="checkbox" className={cn("m3-checkbox", !label && className)} {...rest} />;
  return withLabel(input, label, className);
}

export function Radio({ label, className, ...rest }: ToggleProps) {
  const input = <input type="radio" className={cn("m3-radio", !label && className)} {...rest} />;
  return withLabel(input, label, className);
}
