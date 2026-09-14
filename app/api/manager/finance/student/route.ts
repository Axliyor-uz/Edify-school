import { financePostHandler } from '@/lib/server/financeRoute';
import { patchStudentProfile } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — patch a student's finance profile (discount, price overrides,
 * freeze/unfreeze, enrollment dates). Body: { studentId, patch: StudentFinancePatch }.
 */
export const POST = financePostHandler('/api/manager/finance/student', ({ uid, centerId }, body) =>
  patchStudentProfile({
    centerId,
    uid,
    studentId: String(body.studentId || ''),
    patch: body.patch || {},
  })
);
