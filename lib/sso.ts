"use client";

import { auth } from "@/lib/firebase";

/**
 * Single sign-on hand-off to partner apps (e.g. tez-yozish, the typing
 * trainer). A partner sends the user here with ?returnTo=<its callback URL>;
 * after login/signup we mint a one-time Firebase custom token and send the
 * user back as  <returnTo>#sso_token=<token> . The partner calls
 * signInWithCustomToken() with it and is signed into the same account.
 *
 * The token travels in the URL fragment (#) so it never reaches any server
 * logs, and only origins on the allowlist below may receive one.
 */

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

function allowedOrigins(): string[] {
  const env = process.env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Read and validate the ?returnTo= param. Returns null unless the URL's
 *  origin is allowlisted — never redirect a token to an arbitrary site. */
export function getSsoReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (allowedOrigins().includes(url.origin)) return url.href;
  } catch {
    /* not a valid absolute URL */
  }
  return null;
}

/** Sends the currently signed-in user back to the partner app with a custom
 *  token. Returns false (and does not navigate) if no user is signed in or
 *  the token could not be minted — callers fall back to normal routing. */
export async function completeSsoRedirect(returnTo: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/sso/token", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return false;
    const { token } = await res.json();
    window.location.href = `${returnTo}#sso_token=${encodeURIComponent(token)}`;
    return true;
  } catch {
    return false;
  }
}
