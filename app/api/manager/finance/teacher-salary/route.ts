import { financePostHandler } from '@/lib/server/financeRoute';
import { updateTeacherSalary } from '@/lib/server/financeOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST — set a teacher's salary config. Body: { teacherId, config: { fixed?, percent?, perLesson? } } (null clears a part). */
export const POST = financePostHandler('/api/manager/finance/teacher-salary', ({ uid, centerId }, body) =>
  updateTeacherSalary({
    centerId,
    uid,
    teacherId: String(body.teacherId || ''),
    config: body.config || {},
  })
);
