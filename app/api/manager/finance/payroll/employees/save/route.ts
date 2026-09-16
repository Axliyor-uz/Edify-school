import { financePostHandler } from '@/lib/server/financeRoute';
import { saveEmployeePayout } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — approve an employee's month: recomputes server-side and persists the
 * payout. Body: { employeeId, periodKey, adjustment?, adjustmentNote? }.
 */
export const POST = financePostHandler('/api/manager/finance/payroll/employees/save', ({ uid, centerId }, body) =>
  saveEmployeePayout({
    centerId,
    uid,
    employeeId: String(body.employeeId || ''),
    periodKey: String(body.periodKey || ''),
    adjustment: body.adjustment,
    adjustmentNote: body.adjustmentNote,
  })
);
