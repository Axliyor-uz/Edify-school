import { NextResponse } from 'next/server';
import { DirectoryError, identifyCaller, canReadContact, readContact } from '@/lib/server/directory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { uid } → { email, phone }
 *
 * The only way a teacher/manager can obtain someone's contact details, now that
 * `users/{uid}/private/contact` is owner-only in the rules. The relationship is
 * proven server-side (see lib/server/directory.ts).
 */
export async function POST(request: Request) {
  try {
    const caller = await identifyCaller(request);
    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === 'string' ? body.uid : '';
    if (!uid) {
      return NextResponse.json({ error: "uid talab qilinadi." }, { status: 400 });
    }

    if (!(await canReadContact(caller, uid))) {
      return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });
    }

    return NextResponse.json(await readContact(uid));
  } catch (error) {
    if (error instanceof DirectoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/directory/contact error:', error);
    return NextResponse.json({ error: 'Server xatosi yuz berdi.' }, { status: 500 });
  }
}
