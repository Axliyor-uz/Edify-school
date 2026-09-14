import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkAuthRateLimit, requestIp } from "@/lib/server/authRateLimit";

/**
 * Forgot-password for users who typed a username instead of an email
 * (docs/AUTH.md). Resolves the username server-side and sends Firebase's
 * standard reset email to the account's real address. The response is
 * identical whether or not the username exists, so nothing can be enumerated.
 */
export async function POST(request: Request) {
  if (!checkAuthRateLimit(`reset:${requestIp(request)}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "too-many-attempts" }, { status: 429 });
  }

  let username = "";
  try {
    const body = await request.json();
    if (typeof body.username === "string") {
      username = body.username.trim().toLowerCase();
    }
  } catch {
    // fall through to the generic response
  }

  if (/^[a-z0-9_]{1,64}$/.test(username)) {
    try {
      const uid = (await adminDb.doc(`usernames/${username}`).get()).data()?.uid;
      const email = uid ? (await adminAuth.getUser(uid)).email : undefined;
      if (email) {
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
          },
        );
      }
    } catch (error) {
      console.error("Username password reset failed:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
