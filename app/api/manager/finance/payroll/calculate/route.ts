import { financePostHandler } from '@/lib/server/financeRoute';
import { calculatePayroll } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — live payroll preview for a month (no writes). Body: { periodKey: "YYYY-MM" }. */
export const POST = financePostHandler('/api/manager/finance/payroll/calculate', ({ centerId }, body) =>
  calculatePayroll({ centerId, periodKey: String(body.periodKey || '') })
);
