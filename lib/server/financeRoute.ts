import { NextResponse } from 'next/server';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

/**
 * Factory for the /api/manager/finance/* POST handlers: verifies the caller is
 * an approved center manager, parses the JSON body, and maps ManagerApiError
 * to its HTTP status (messages are user-facing Uzbek, surfaced in toasts).
 */
export function financePostHandler(
  label: string,
  op: (ctx: { uid: string; centerId: string }, body: any) => Promise<unknown>
) {
  return async function POST(request: Request) {
    try {
      const ctx = await requireActiveCenterManager(request);
      const body = await request.json().catch(() => ({}));
      const result = await op(ctx, body ?? {});
      return NextResponse.json(result ?? { ok: true });
    } catch (error: any) {
      if (error instanceof ManagerApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error(`POST ${label} error:`, error);
      return NextResponse.json({ error: 'Server xatosi yuz berdi.' }, { status: 500 });
    }
  };
}
