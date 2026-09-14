// lib/parentLinks.ts
//
// The pure layer of **parent access** (docs/PARENTS.md): what a token looks like,
// how it becomes a URL, and what a link is allowed to show. No Firestore, no
// Admin SDK — so the manager panel, the API routes and the parent page all agree
// on the same vocabulary without any of them importing the others.
//
// ⚠️ The token IS the credential (types/Parent.ts). Everything here exists to
// make it unguessable, unambiguous when read aloud, and safe in a URL.

import type { ParentScope } from '@/types/Parent';

/**
 * The token alphabet — 29 characters, deliberately NOT base64.
 *
 * ⚠️ `0/O`, `1/I/L` and `U/V` are excluded so a token can be **read out over the
 * phone and typed by hand** when a camera fails, which is the fallback the `/p`
 * page offers. Uppercase + digits only, so it is URL-safe, survives being
 * shouted across a room, and can be normalized from whatever case a parent types.
 */
export const PARENT_TOKEN_CHARS = '23456789ABCDEFGHJKMNPQRSTWXYZ';

/**
 * How long a token is.
 *
 * 24 chars over this alphabet is ≈117 bits. ⚠️ Do not shorten it to make a denser
 * QR: this string is the ONLY thing standing between a stranger and a child's
 * report, and there is no login behind it. A QR at this length still scans
 * instantly from a printed card.
 */
export const PARENT_TOKEN_LENGTH = 24;

/** Group size when a token is printed for hand-typing (`ABCD-EFGH-…`). */
const GROUP = 4;

/**
 * A fresh token, from the platform CSPRNG.
 *
 * ⚠️ **Never `Math.random()`** — it is seeded from the clock and its output is
 * predictable given a few samples, which for a bearer credential means an
 * attacker who holds one link can derive others. `globalThis.crypto` is the Web
 * Crypto API, present in both the browser and Node ≥18, so this one function
 * serves the API route today and a client-side preview if one is ever wanted.
 *
 * The modulo bias is nil here because 256 % 30 ≠ 0 is handled by rejection.
 */
export function generateParentToken(length = PARENT_TOKEN_LENGTH): string {
  const chars = PARENT_TOKEN_CHARS;
  const max = Math.floor(256 / chars.length) * chars.length; // rejection ceiling
  let out = '';
  const buf = new Uint8Array(length * 2);

  while (out.length < length) {
    globalThis.crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      if (buf[i] < max) out += chars[buf[i] % chars.length];
    }
  }
  return out;
}

/**
 * Is this string shaped like a token?
 *
 * Called before ANY Firestore lookup on the public route: a token is a document
 * id, and rejecting junk here means a scanner spraying `../` or a 4 KB string
 * never reaches the database. ⚠️ Shape only — it says nothing about the link
 * existing or being active.
 */
export function isParentToken(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length !== PARENT_TOKEN_LENGTH) return false;
  for (const ch of value) if (!PARENT_TOKEN_CHARS.includes(ch)) return false;
  return true;
}

/**
 * What a human typed → a token.
 *
 * Accepts the printed grouping (`ABCD-EFGH-…`), spaces, lowercase, and a full
 * pasted URL — every one of which a parent will produce. Returns `''` when it
 * cannot be read as a token, so callers get one shape to check.
 */
export function normalizeParentToken(raw: string): string {
  const tail = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;
  const cleaned = tail.trim().toUpperCase().replace(/[\s-]/g, '');
  return isParentToken(cleaned) ? cleaned : '';
}

/** `ABCD-EFGH-JKLM-…` — the token as it is printed under the QR. */
export const formatParentToken = (token: string): string =>
  (token.match(new RegExp(`.{1,${GROUP}}`, 'g')) || []).join('-');

/**
 * The path a QR encodes. ⚠️ Short on purpose — every character is QR modules,
 * and this string is printed on a card that has to scan from arm's length.
 */
export const parentLinkPath = (token: string): string => `/p/${token}`;

/**
 * The absolute URL to put in the QR.
 *
 * `origin` comes from the browser in the manager panel (`window.location.origin`)
 * rather than from an env var, so a link generated on a staging host points at
 * staging and a link generated in production points at production — nobody has
 * to remember to set `NEXT_PUBLIC_SITE_URL` before printing 200 cards.
 */
export const parentLinkUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/$/, '')}${parentLinkPath(token)}`;

// ─── scope ───────────────────────────────────────────────────────────────────

/**
 * What a new link shows unless the manager says otherwise.
 *
 * ⚠️ **Finance defaults ON.** The parent is the person who pays, so hiding the
 * balance by default would make the feature useless for the thing centers ask
 * for first. The manager turns it off per link when they do not want a
 * forwarded link to carry the family's debt — see docs/PARENTS.md.
 */
export const DEFAULT_PARENT_SCOPE: ParentScope = {
  results: true,
  levels: true,
  attendance: true,
  finance: true,
};

/**
 * Anything → a valid scope.
 *
 * ⚠️ Unknown keys are DROPPED and missing ones fall back to the default, so a
 * client cannot widen a link by inventing a flag, and an older stored link keeps
 * working when a new block is added here.
 */
export function normalizeParentScope(raw: unknown): ParentScope {
  const input = (raw ?? {}) as Partial<Record<keyof ParentScope, unknown>>;
  const pick = (key: keyof ParentScope) =>
    typeof input[key] === 'boolean' ? (input[key] as boolean) : DEFAULT_PARENT_SCOPE[key];

  return {
    results: pick('results'),
    levels: pick('levels'),
    attendance: pick('attendance'),
    finance: pick('finance'),
  };
}

/** The label a manager typed, trimmed and capped. Empty is legal. */
export const cleanParentLabel = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().slice(0, 40) : '';

// ─── the device claim ────────────────────────────────────────────────────────

/**
 * The header the parent's browser proves itself with.
 *
 * ⚠️ A HEADER, not a query parameter or a cookie: a query parameter would end up
 * in server logs, browser history and any "copy link" the parent performs — and
 * the whole point of the secret is that it does NOT travel with the URL. A cookie
 * would be sent cross-site by an embedded image and needs SameSite reasoning
 * nobody will maintain.
 */
export const PARENT_DEVICE_HEADER = 'x-parent-device';

/**
 * The secret a claimed device keeps. 32 chars ≈ 156 bits.
 *
 * ⚠️ Longer than the token because it is never typed by a human — it only ever
 * moves machine-to-machine, so there is no reason to make it readable.
 */
export const generateParentDeviceSecret = (): string => generateParentToken(32);

/** Shape check for an incoming device secret, before any hashing or lookup. */
export const isParentDeviceSecret = (value: unknown): value is string =>
  typeof value === 'string' && value.length === 32 && [...value].every((c) => PARENT_TOKEN_CHARS.includes(c));

/**
 * A coarse device note for the manager's list — "iPhone · Safari".
 *
 * ⚠️ Deliberately lossy. The full user-agent is a fingerprint and this string is
 * shown in a panel that other staff can read; "which phone is connected" is all
 * the manager needs to tell one parent from another.
 */
export function describeParentDevice(userAgent: string): string {
  const ua = (userAgent || '').slice(0, 400);
  const os = /iPhone|iPad/i.test(ua) ? 'iPhone'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'Mac'
    : /Linux/i.test(ua) ? 'Linux'
    : '';
  const browser = /Telegram/i.test(ua) ? 'Telegram'
    : /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /SamsungBrowser/i.test(ua) ? 'Samsung'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Chrome/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : '';
  return [os, browser].filter(Boolean).join(' · ') || 'Nomaʼlum qurilma';
}

// ─── sharing ─────────────────────────────────────────────────────────────────

/**
 * Telegram's share sheet.
 *
 * ⚠️ `t.me/share/url` opens the app's contact picker rather than sending
 * anything, which is exactly right here: the manager picks the ONE parent, and
 * the first device to open the link claims it. Sharing is delivery, not access.
 */
export const telegramShareUrl = (url: string, text: string): string =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

/**
 * A pre-filled SMS.
 *
 * ⚠️ `sms:?&body=` — the `?&` is not a typo. iOS wants `sms:&body=` when no
 * number is given and Android wants `sms:?body=`; the combined form is the one
 * that works on both, and it is what every share widget in the wild uses.
 */
export const smsShareUrl = (url: string, text: string): string =>
  `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`;

// ─── the attendance/report windows ───────────────────────────────────────────

/**
 * How far back the report looks.
 *
 * ⚠️ These bound the COST of a parent page view, which is the one number that
 * matters here: a link is public, so anyone holding it can refresh forever. Each
 * window is small enough that a full report stays around 60–80 document reads,
 * and the route caches for `PARENT_REPORT_TTL_MS` on top.
 */
export const PARENT_ATTENDANCE_DAYS = 56;
export const PARENT_RESULT_LIMIT = 40;
export const PARENT_RECENT_RESULTS = 12;
export const PARENT_TREND_MONTHS = 6;
export const PARENT_REPORT_TTL_MS = 60_000;
