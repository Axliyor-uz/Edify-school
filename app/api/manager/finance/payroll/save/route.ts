import { financePostHandler } from '@/lib/server/financeRoute';
import { savePayout } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — approve a teacher's month: recomputes server-side and persists the
 * payout. Body: { teacherId, periodKey, adjustment?, adjustmentNote? }.
 */
export const POST = financePostHandler('/api/manager/finance/payroll/save', ({ uid, centerId }, body) =>
  savePayout({
    centerId,
    uid,
    teacherId: String(body.teacherId || ''),
    periodKey: String(body.periodKey || ''),
    adjustment: body.adjustment,
    adjustmentNote: body.adjustmentNote,
  })
);
