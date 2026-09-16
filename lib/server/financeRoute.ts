import { NextResponse } from 'next/server';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';
import { OfficeApiError, requireCenterOffice } from '@/lib/server/verifyCenterOffice';

/**
 * Who, besides the center manager, may call a given finance route
 * (docs/OFFICE.md). Omit for the default: **manager only**.
 *
 *  - `'accountant'` — the buxgalter too. Only the four record/correct-money
 *    routes opt in (payments, payments/cancel, expenses, expenses/cancel).
 *    A director is refused here, which is what keeps that role read-only.
 *  - `'any'` — any office role. Reserved for routes that only COMPUTE and
 *    write nothing (payroll/calculate), so a director can see live salaries.
 *  - `'director'` — the director too, accountant excluded. Reserved for the
 *    expense approve/reject routes (docs/FINANCE.md §9): the director gets a
 *    genuinely new WRITE capability there (approve/reject only, never create),
 *    so it deliberately does not reuse `'any'`.
 */
export type FinanceOfficeAccess = 'accountant' | 'any' | 'director';

/** Who actually resolved this request — `createExpense` branches on it to
 *  decide the starting `status` (docs/FINANCE.md §9). */
export type FinanceCallerRole = 'manager' | 'director' | 'accountant';

/**
 * Resolve the calling center for a finance route.
 *
 * Manager first (the overwhelmingly common caller, and the only one for most
 * routes). A 403 there means "authenticated, but not this center's manager" —
 * the one case worth re-checking against the office link doc. A 401 (missing /
 * expired token) is propagated as-is: retrying it as office staff would only
 * fail again with a less accurate message.
 */
async function resolveFinanceCaller(
  request: Request,
  office?: FinanceOfficeAccess,
): Promise<{ uid: string; centerId: string; callerRole: FinanceCallerRole }> {
  try {
    const ctx = await requireActiveCenterManager(request);
    return { ...ctx, callerRole: 'manager' };
  } catch (error) {
    if (!office) throw error;
    if (!(error instanceof ManagerApiError) || error.status !== 403) throw error;
    const roles: ('director' | 'accountant')[] | undefined =
      office === 'accountant' ? ['accountant'] : office === 'director' ? ['director'] : undefined;
    const { uid, centerId, staffRole } = await requireCenterOffice(request, roles);
    return { uid, centerId, callerRole: staffRole };
  }
}

/**
 * Factory for the /api/manager/finance/* POST handlers: verifies the caller,
 * parses the JSON body, and maps ManagerApiError / OfficeApiError to their HTTP
 * status (messages are user-facing Uzbek, surfaced in toasts).
 *
 * ⚠️ `uid` in the op context is the ACTUAL caller — an accountant's uid lands in
 * `receivedBy`/`createdBy` on the money docs, so the audit trail names the
 * person who typed it, not the manager.
 */
export function financePostHandler(
  label: string,
  op: (ctx: { uid: string; centerId: string; callerRole: FinanceCallerRole }, body: any) => Promise<unknown>,
  options?: { office?: FinanceOfficeAccess }
) {
  return async function POST(request: Request) {
    try {
      const ctx = await resolveFinanceCaller(request, options?.office);
      const body = await request.json().catch(() => ({}));
      const result = await op(ctx, body ?? {});
      return NextResponse.json(result ?? { ok: true });
    } catch (error: any) {
      if (error instanceof ManagerApiError || error instanceof OfficeApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error(`POST ${label} error:`, error);
      return NextResponse.json({ error: 'Server xatosi yuz berdi.' }, { status: 500 });
    }
  };
}
