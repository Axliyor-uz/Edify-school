import { financePostHandler } from '@/lib/server/financeRoute';
import { cancelExpense } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — cancel an expense (salary-linked ones are protected). Body: { expenseId, reason }. */
export const POST = financePostHandler('/api/manager/finance/expenses/cancel', ({ uid, centerId }, body) =>
  cancelExpense({ centerId, uid, expenseId: String(body.expenseId || ''), reason: body.reason })
);
