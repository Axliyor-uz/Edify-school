"use client";

import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  /** The "no filter" option label, e.g. "Barcha guruhlar". */
  allLabel: string;
}

/** M3 filter-chip styled <select>: outlined when idle, filled when a filter is active. */
export default function FilterSelect({ value, onChange, options, allLabel }: Props) {
  const active = value !== "";
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none h-t-control-sm pl-4 pr-9 rounded-full text-[13px] font-bold cursor-pointer max-w-[190px] border transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
          active
            ? "bg-primary text-on-primary border-primary"
            : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary"
        }`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className={`absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
          active ? "text-on-primary" : "text-on-surface-variant"
        }`}
      />
    </div>
  );
}
