import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

/**
 * Mints a Firebase custom token for the already-authenticated caller, used
 * for the SSO hand-off to partner apps (see lib/sso.ts). The caller proves
 * who they are with their own ID token, so this can never sign anyone into
 * an account they aren't already signed into.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Missing Authorization bearer token." },
      { status: 401 },
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    const token = await adminAuth.createCustomToken(decoded.uid);
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401 },
    );
  }
}
