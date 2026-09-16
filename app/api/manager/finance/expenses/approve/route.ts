import { financePostHandler } from '@/lib/server/financeRoute';
import { approveExpense } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — approve an accountant's pending expense. Body: { expenseId }. Manager or director only. */
export const POST = financePostHandler('/api/manager/finance/expenses/approve', ({ uid, centerId }, body) =>
  approveExpense({ centerId, uid, expenseId: String(body.expenseId || '') }),
  { office: 'director' }
);
