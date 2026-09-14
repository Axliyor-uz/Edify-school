"use client";

import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

/** Shared list-filter input for the finance tabs. */
export default function SearchInput({ value, onChange, placeholder }: Props) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-t-control pl-10 pr-8 bg-surface-container-lowest border border-outline-variant rounded-full text-[13px] text-on-surface placeholder:text-on-surface-variant transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-state-hover flex items-center justify-center text-on-surface-variant"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
