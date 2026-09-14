import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * twMerge extended with the kit's token spacing utilities (tailwind.config.ts
 * `spacing` extensions). Without this, twMerge does not recognize e.g.
 * `p-t-card` as a padding class, so a caller's `p-4` override would not
 * replace a component's token default — both would land in the DOM and CSS
 * source order (not call-site intent) would win.
 */
const twMergeWithTokens = extendTailwindMerge({
  extend: {
    classGroups: {
      p: [{ p: ["t-card"] }],
      gap: [{ gap: ["t-gap", "t-gap-lg"] }],
    },
  },
});

/** Merge Tailwind classes with correct conflict resolution (later wins). */
export function cn(...inputs: ClassValue[]) {
  return twMergeWithTokens(clsx(inputs));
}
