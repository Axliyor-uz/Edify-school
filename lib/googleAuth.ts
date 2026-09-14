"use client";

import { GoogleAuthProvider, signInWithPopup, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/services/userService";

/**
 * Google sign-in is authentication only — it never creates the Firestore
 * profile. New users (no users/{uid} doc yet) must finish onboarding at
 * /auth/complete-profile, where they pick a role and username and the same
 * atomic signup batch as the password wizards runs (docs/AUTH.md).
 *
 * The default provider scopes already include name, email and photo; no
 * extra scopes are requested.
 */
export async function signInWithGoogle(): Promise<{
  user: User;
  profile: UserProfile | null;
}> {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser — shared/school computers are common.
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, provider);
  const snap = await getDoc(doc(db, "users", user.uid));
  return { user, profile: snap.exists() ? (snap.data() as UserProfile) : null };
}

/** Sanitized username suggestion from the Google email's local part.
 *  Returns "" when the result wouldn't pass the signup format rules
 *  (≥5 chars, starts with a letter, [a-z0-9_]). */
export function suggestUsername(email: string | null): string {
  if (!email) return "";
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const suggestion = base.replace(/^[^a-z]+/, "");
  return suggestion.length >= 5 ? suggestion : "";
}
