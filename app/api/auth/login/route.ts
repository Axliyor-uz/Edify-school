import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkAuthRateLimit, requestIp } from "@/lib/server/authRateLimit";

/**
 * Username + password login (docs/AUTH.md). Resolves the username to the
 * account's email server-side — the email never reaches the browser — then
 * verifies the password against Firebase's Identity Toolkit and returns a
 * custom token the client finishes with signInWithCustomToken.
 *
 * Enumeration safety: unknown username, wrong password, and disabled account
 * all return the identical generic 401.
 */

function invalidCredentials() {
  return NextResponse.json({ error: "invalid-credentials" }, { status: 401 });
}

export async function POST(request: Request) {
  if (!checkAuthRateLimit(`login:${requestIp(request)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "too-many-attempts" }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return invalidCredentials();
  }
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || !/^[a-z0-9_]{1,64}$/.test(username)) {
    return invalidCredentials();
  }

  try {
    const usernameDoc = await adminDb.doc(`usernames/${username}`).get();
    const uid = usernameDoc.data()?.uid;
    if (!uid) return invalidCredentials();

    const email = (await adminAuth.getUser(uid)).email;
    if (!email) return invalidCredentials();

    const verify = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    if (!verify.ok) {
      const message: string =
        (await verify.json().catch(() => null))?.error?.message ?? "";
      if (message.startsWith("TOO_MANY_ATTEMPTS")) {
        return NextResponse.json({ error: "too-many-attempts" }, { status: 429 });
      }
      return invalidCredentials();
    }

    const token = await adminAuth.createCustomToken(uid);
    return NextResponse.json({ token });
  } catch (error) {
    // Stale usernames doc pointing at a deleted Auth account
    if ((error as { code?: string }).code === "auth/user-not-found") {
      return invalidCredentials();
    }
    console.error("Username login failed:", error);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
