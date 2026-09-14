// app/p/_lib/store.ts
//
// **The parent's "account", such as it is: a list of tokens in localStorage.**
//
// ⚠️ A parent never signs up (docs/PARENTS.md), so there is nowhere on the server
// to record "this person has two children here" — and deliberately so: the moment
// the platform stores a parent identity, it owes them a password, a reset flow
// and a support burden. Instead the DEVICE remembers which QR codes it has
// opened, which is exactly what "scan the second child's QR too" should mean.
//
// Consequences to keep in mind:
// - ⚠️ Clearing browser data loses the list. Nothing is lost that a re-scan does
//   not restore, which is why the QR card tells the parent to keep it.
// - ⚠️ It is per BROWSER, so mum's phone and dad's phone each hold their own set.
//   That is the correct behaviour for links handed out individually.
// - ⚠️ A revoked token is dropped on the next visit rather than kept as a broken
//   row — see `forgetChild` in the page.

import type { ParentSavedChild } from '@/types/Parent';

const KEY = 'edify:parent:children:v1';
/** No parent has fifty children; a cap keeps a corrupted store from growing. */
const MAX = 12;

function read(): ParentSavedChild[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.token === 'string')
      .map((c) => ({
        token: String(c.token),
        name: String(c.name || ''),
        addedAt: Number(c.addedAt) || 0,
      }))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(children: ParentSavedChild[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(children.slice(0, MAX)));
  } catch {
    // A private-mode browser with no storage quota must not break the report —
    // the page still works, it just cannot remember the child for next time.
  }
}

// ─── the React binding ───────────────────────────────────────────────────────
//
// ⚠️ Exposed as a `useSyncExternalStore` source rather than "read it in a
// useEffect and setState": localStorage is an external store, and the effect
// version renders once with the server's empty list before flipping — which on
// this page means the child switcher flickering in after paint. The snapshot
// must be CACHED (same reference until something changes) or React re-renders
// forever, which is what `snapshot` below guarantees.

let snapshot: ParentSavedChild[] | null = null;
const listeners = new Set<() => void>();

/** Stable empty array — the server snapshot must never be a fresh literal. */
const EMPTY: ParentSavedChild[] = [];

function invalidate(): void {
  snapshot = null;
  for (const listener of listeners) listener();
}

export function subscribeChildren(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab (or the same parent in a second window) scanning a QR should
  // show up here too.
  window.addEventListener('storage', invalidate);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener('storage', invalidate);
  };
}

export function childrenSnapshot(): ParentSavedChild[] {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

export const childrenServerSnapshot = (): ParentSavedChild[] => EMPTY;

/**
 * Remember a child after a SUCCESSFUL load.
 *
 * ⚠️ Called only once the report actually came back: saving on navigation would
 * fill the list with typos and revoked links.
 */
export function rememberChild(token: string, name: string): void {
  const rest = read().filter((c) => c.token !== token);
  write([{ token, name, addedAt: Date.now() }, ...rest]);
  invalidate();
}

/**
 * Drop one child — used by the "remove" action and on a revoked link.
 *
 * ⚠️ Also drops the device secret: a link this device no longer holds must not
 * leave a credential behind, and if the manager later re-issues the QR to this
 * same parent, a stale secret would make their own device look like a stranger's.
 */
export function forgetChild(token: string): void {
  write(read().filter((c) => c.token !== token));
  clearDeviceSecret(token);
  invalidate();
}

// ─── the device secret ───────────────────────────────────────────────────────
//
// ⚠️ **This is what makes one link mean one person** (docs/PARENTS.md). The
// server mints the secret the first time this browser opens a link and never
// sends it again; from then on every request carries it and any OTHER browser
// opening the same URL is refused. Losing it means the manager must unbind the
// link — which is a one-tap action on the same printed QR, not a new card.
//
// ⚠️ Stored per TOKEN, not globally: one phone may legitimately hold two
// children's links, and they are separate claims.

const DEVICE_KEY = (token: string) => `edify:parent:device:${token}`;

export function readDeviceSecret(token: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DEVICE_KEY(token));
  } catch {
    return null;
  }
}

export function writeDeviceSecret(token: string, secret: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEVICE_KEY(token), secret);
  } catch {
    // ⚠️ A browser with no storage (private mode, storage full) still SEES the
    // report — the claim succeeded server-side. It just cannot prove itself on
    // the next load and will be told the link is taken, by itself. The parent
    // page explains that case rather than showing a bare error.
  }
}

export function clearDeviceSecret(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DEVICE_KEY(token));
  } catch {
    /* see writeDeviceSecret */
  }
}

// ─── language ────────────────────────────────────────────────────────────────

const LANG_KEY = 'edify:parent:lang';
type ParentLang = 'uz' | 'ru' | 'en';

/**
 * ⚠️ Its OWN key, not the student/teacher/manager one. A parent shares a device
 * with their child often enough that inheriting the student panel's language
 * would flip the app under the student, and neither of them can change the
 * other's setting from here.
 */
function readLang(): ParentLang {
  if (typeof window === 'undefined') return 'uz';
  const raw = window.localStorage.getItem(LANG_KEY);
  return raw === 'ru' || raw === 'en' ? raw : 'uz';
}

let langSnap: ParentLang | null = null;
const langListeners = new Set<() => void>();

function invalidateLang(): void {
  langSnap = null;
  for (const listener of langListeners) listener();
}

export function subscribeLang(onChange: () => void): () => void {
  langListeners.add(onChange);
  return () => { langListeners.delete(onChange); };
}

export function langSnapshot(): ParentLang {
  if (langSnap === null) langSnap = readLang();
  return langSnap;
}

/** ⚠️ Uzbek on the server, always — it is the app's default UI language. */
export const langServerSnapshot = (): ParentLang => 'uz';

export function writeParentLang(lang: ParentLang): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* see write() */
  }
  invalidateLang();
}
