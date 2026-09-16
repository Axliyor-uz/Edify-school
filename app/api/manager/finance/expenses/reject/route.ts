import { financePostHandler } from '@/lib/server/financeRoute';
import { rejectExpense } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — reject an accountant's pending expense. Body: { expenseId, reason }. Manager or director only. */
export const POST = financePostHandler('/api/manager/finance/expenses/reject', ({ uid, centerId }, body) =>
  rejectExpense({ centerId, uid, expenseId: String(body.expenseId || ''), reason: body.reason }),
  { office: 'director' }
);
