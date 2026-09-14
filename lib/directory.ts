'use client';

import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Client-side access to contact details (email/phone) — see docs/AUTH.md.
 *
 * These live in `users/{uid}/private/contact`, which is owner-only in the rules,
 * because the parent `users/{uid}` doc is readable by every signed-in user and
 * Firestore has no field-level read rules.
 *
 *   - YOUR OWN details      → read/write directly (the rules allow the owner).
 *   - SOMEONE ELSE'S        → go through /api/directory/contact, which proves the
 *                             teacher/manager relationship with the Admin SDK.
 *
 * Never add a client-side read of another user's `private/contact` — it will be
 * denied, and it is denied on purpose.
 */

export interface Contact {
  email: string;
  phone: string;
}

async function authedFetch(url: string, body: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

/**
 * Contact details of the signed-in user.
 *
 * ⚠️ MIGRATION: falls back to the parent `users/{uid}` doc, so this works for users
 * whose contact doc has not been backfilled yet. Once DEPLOY 2 has run, the parent
 * fields are gone and the fallback simply never matches — no code change needed.
 */
export async function getOwnContact(): Promise<Contact> {
  const user = auth.currentUser;
  if (!user) return { email: '', phone: '' };
  const [priv, parent] = await Promise.all([
    getDoc(doc(db, 'users', user.uid, 'private', 'contact')),
    getDoc(doc(db, 'users', user.uid)),
  ]);
  const p = priv.data() ?? {};
  const legacy = parent.data() ?? {};
  // `user.email` from the Auth token is always authoritative for the email.
  return {
    email: p.email ?? user.email ?? legacy.email ?? '',
    phone: p.phone ?? legacy.phone ?? '',
  };
}

/**
 * Writes the signed-in user's contact details.
 *
 * ⚠️ MIGRATION: also mirrors onto the parent `users/{uid}` doc, so the DEPLOY-1
 * build stays compatible with anything still reading the old location. DEPLOY 2
 * (scripts/stripPublicContact.mjs) removes the parent fields — at that point,
 * delete the `mirror` write below.
 */
export async function setOwnContact(patch: Partial<Contact>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const payload: Record<string, string> = {};
  if (typeof patch.email === 'string') payload.email = patch.email;
  if (typeof patch.phone === 'string') payload.phone = patch.phone;
  if (!Object.keys(payload).length) return;

  await setDoc(doc(db, 'users', user.uid, 'private', 'contact'), payload, { merge: true });
  await setDoc(doc(db, 'users', user.uid), payload, { merge: true }); // mirror — remove after DEPLOY 2
}

/** Another user's contact details. Requires a teacher/manager relationship (enforced server-side). */
export async function getContactOf(uid: string): Promise<Contact> {
  return authedFetch('/api/directory/contact', { uid });
}

export interface DirectoryMatch {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  role: string | null;
  email: string;
}

/** Resolve an email to an account. Teachers/managers/admins only (enforced server-side). */
export async function lookupByEmail(email: string): Promise<DirectoryMatch> {
  return authedFetch('/api/directory/lookup', { email });
}
