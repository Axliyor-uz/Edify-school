/**
 * Manager-created teacher accounts: credential generation helpers.
 *
 * Isomorphic on purpose — the create-teacher modal uses these for LIVE
 * previews while the manager types, and /api/manager/teachers/create uses the
 * same functions server-side so preview and reality never drift. Uniqueness
 * (suffixing a taken email/username) is server-only; here we only build the
 * base suggestion.
 *
 * See docs/MANAGER.md § "Manager-created teacher accounts".
 */

// Uzbek Cyrillic → Latin, then Latin-specific cleanup (oʻ/gʻ apostrophes).
const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", ғ: "g", қ: "q", ҳ: "h",
};

/** "Alisher Oʻktamov" → "alisher oktamov"; keeps only [a-z0-9] and spaces. */
export function translitToAscii(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("")
    // oʻ / o' / o` / o’ → o (Uzbek Latin apostrophe letters)
    .replace(/[ʻ'`’ʼ]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (é → e)
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** First word = first name, last word = surname (single word → both empty-safe). */
export function splitFullName(fullName: string): { first: string; last: string } {
  const parts = translitToAscii(fullName).split(" ").filter(Boolean);
  return { first: parts[0] || "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
}

/** All synthetic teacher-login emails share one short domain. */
export const TEACHER_EMAIL_DOMAIN = "edify.uz";

/**
 * Base login email, shortest form first: a.karimov@edify.uz (first initial +
 * surname). Single-word names fall back to the name itself. The server walks
 * suggestTeacherEmailCandidates + numeric suffixes on collision.
 */
export function suggestTeacherEmail(fullName: string): string {
  return suggestTeacherEmailCandidates(fullName)[0] || "";
}

/**
 * Collision-fallback chain for the server: ["a.karimov@…", "alisher.karimov@…"].
 * Numeric suffixes ("a.karimov2@…") are appended after these run out.
 */
export function suggestTeacherEmailCandidates(fullName: string): string[] {
  const { first, last } = splitFullName(fullName);
  if (!first) return [];
  if (!last) return [`${first}@${TEACHER_EMAIL_DOMAIN}`];
  return [
    `${first[0]}.${last}@${TEACHER_EMAIL_DOMAIN}`,
    `${first}.${last}@${TEACHER_EMAIL_DOMAIN}`,
  ];
}

/**
 * Base username: the first name, padded with the surname when shorter than the
 * signup minimum (≥5 chars, starts with a letter, [a-z0-9_] — same regex the
 * signup wizards enforce). Server adds 1,2… on collision.
 */
export function suggestTeacherUsername(fullName: string): string {
  const { first, last } = splitFullName(fullName);
  let base = first.length >= 5 ? first : (first + last);
  base = base.replace(/[^a-z0-9_]/g, "");
  if (!/^[a-z]/.test(base)) base = base ? `t${base}` : "";
  if (base && base.length < 5) base = base.padEnd(5, "1");
  return base;
}

export const USERNAME_REGEX = /^[a-z][a-z0-9_]{4,}$/;

/**
 * Friendly initial password: Surname + 4 digits (e.g. "Karimov4821") — easy to
 * read out loud at the front desk, ≥8 chars (the signup minimum).
 */
export function generateFriendlyPassword(fullName: string): string {
  const { first, last } = splitFullName(fullName);
  const word = last || first || "edify";
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return (cap + digits).length >= 8 ? cap + digits : cap + digits + String(Math.floor(100 + Math.random() * 900));
}
