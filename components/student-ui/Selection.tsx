'use client';

import { forwardRef, useId } from 'react';
import { cn } from './cn';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

/** M3 switch — the thumb grows when on. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return <input ref={ref} type="checkbox" role="switch" aria-label={label} className={cn('s-switch', className)} {...rest} />;
});

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, ...rest },
  ref,
) {
  return <input ref={ref} type="checkbox" aria-label={label} className={cn('s-checkbox', className)} {...rest} />;
});

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, ...rest },
  ref,
) {
  return <input ref={ref} type="radio" aria-label={label} className={cn('s-radio', className)} {...rest} />;
});

export interface SettingRowProps {
  title: string;
  description?: string;
  /** The control on the right — usually a Switch. */
  control: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Labelled settings row: title, description, and a control on the right. */
export function SettingRow({ title, description, control, icon, className }: SettingRowProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-4 px-s-row-x py-3.5', className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[14px] font-bold">
          {title}
        </label>
        {description && (
          <p className="text-[12px] font-bold text-on-surface-variant">{description}</p>
        )}
      </div>
      {control}
    </div>
  );
}

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { label, className, ...rest },
  ref,
) {
  return <input ref={ref} type="range" aria-label={label} className={cn('s-range', className)} {...rest} />;
});
