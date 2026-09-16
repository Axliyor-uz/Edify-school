import { financePostHandler } from '@/lib/server/financeRoute';
import { calculatePayroll } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — live payroll preview for a month (no writes). Body: { periodKey: "YYYY-MM" }. */
export const POST = financePostHandler('/api/manager/finance/payroll/calculate', ({ centerId }, body) =>
  calculatePayroll({ centerId, periodKey: String(body.periodKey || '') }),
  // Read-only: computes, writes nothing. Open to BOTH office roles so the
  // director's staff tab can show live salaries. Approving/paying a payout
  // (payroll/save, payroll/mark-paid) stays manager-only.
  { office: 'any' }
);
