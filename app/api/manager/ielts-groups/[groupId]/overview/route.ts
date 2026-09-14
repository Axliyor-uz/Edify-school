import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ManagerApiError, requireActiveCenterManager } from '@/lib/server/verifyCenterManager';

export const dynamic = 'force-dynamic';

const toMs = (v: unknown): number | null => {
  const d = (v as { toDate?: () => Date } | null)?.toDate?.();
  return d instanceof Date ? d.getTime() : null;
};

/**
 * GET /api/manager/ielts-groups/{groupId}/overview — the manager's READ-ONLY
 * IELTS progress view (Admin SDK, so no client rules are opened on assignments/
 * attempts). Per docs/IELTS.md the teacher keeps all pedagogical control; this
 * endpoint only summarizes outcomes: per-student latest/best band + activity,
 * per-assignment completion, pending W/S review count, group average band.
 */
export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const { centerId } = await requireActiveCenterManager(request);

    const groupSnap = await adminDb.collection('ielts_groups').doc(groupId).get();
    if (!groupSnap.exists) throw new ManagerApiError('Guruh topilmadi.', 404);
    const group = groupSnap.data()!;
    if (group.centerId !== centerId) throw new ManagerApiError('Bu guruh markazingizga tegishli emas.', 403);

    const studentIds: string[] = Array.isArray(group.studentIds) ? group.studentIds : [];

    const [assignmentsSnap, attemptsSnap, userSnaps] = await Promise.all([
      groupSnap.ref.collection('assignments').orderBy('createdAt', 'desc').get(),
      adminDb.collection('ielts_attempts').where('groupId', '==', groupId).get(),
      studentIds.length
        ? adminDb.getAll(...studentIds.map((uid) => adminDb.collection('users').doc(uid)))
        : Promise.resolve([]),
    ]);

    const names = new Map<string, { name: string; username: string }>();
    for (const snap of userSnaps) {
      if (!snap.exists) continue;
      const u = snap.data()!;
      names.set(snap.id, {
        name: u.displayName || u.name || "O'quvchi",
        username: u.username || '',
      });
    }

    type Att = {
      userId: string; assignmentId?: string; skill?: string;
      bandScore?: number; teacherGrade?: { band?: number };
      reviewStatus?: string; submittedAt?: unknown; kind?: string;
    };
    const attempts = attemptsSnap.docs.map((d) => d.data() as Att);
    const bandOf = (a: Att): number | null =>
      typeof a.bandScore === 'number' ? a.bandScore
        : typeof a.teacherGrade?.band === 'number' ? a.teacherGrade.band : null;

    const perStudent = new Map<string, { attempts: number; latestBand: number | null; bestBand: number | null; lastActiveAt: number | null }>();
    for (const uid of studentIds) {
      perStudent.set(uid, { attempts: 0, latestBand: null, bestBand: null, lastActiveAt: null });
    }
    // attempts sorted oldest → newest so "latest" wins by iteration order
    attempts
      .slice()
      .sort((a, b) => (toMs(a.submittedAt) ?? 0) - (toMs(b.submittedAt) ?? 0))
      .forEach((a) => {
        const s = perStudent.get(a.userId);
        if (!s) return;
        s.attempts += 1;
        const ms = toMs(a.submittedAt);
        if (ms != null && (s.lastActiveAt == null || ms > s.lastActiveAt)) s.lastActiveAt = ms;
        const band = bandOf(a);
        if (band != null) {
          s.latestBand = band;
          if (s.bestBand == null || band > s.bestBand) s.bestBand = band;
        }
      });

    const latestBands = [...perStudent.values()]
      .map((s) => s.latestBand)
      .filter((b): b is number => b != null);
    const avgBand = latestBands.length
      ? Math.round((latestBands.reduce((a, b) => a + b, 0) / latestBands.length) * 10) / 10
      : null;

    return NextResponse.json({
      group: {
        id: groupSnap.id,
        title: group.title || '',
        targetBand: Number(group.targetBand) || null,
        teacherName: group.teacherName || '',
        studentCount: studentIds.length,
      },
      avgBand,
      pendingReviews: attempts.filter((a) => a.reviewStatus === 'pending_review').length,
      assignments: assignmentsSnap.docs.map((d) => {
        const a = d.data();
        return {
          id: d.id,
          testTitle: a.testTitle || '',
          skill: a.skill || 'reading',
          mode: a.mode || 'practice',
          dueAt: toMs(a.dueAt),
          completed: Array.isArray(a.completedBy) ? a.completedBy.length : 0,
          total: a.assignedTo === 'all' ? studentIds.length : (Array.isArray(a.assignedTo) ? a.assignedTo.length : 0),
        };
      }),
      students: studentIds.map((uid) => ({
        uid,
        name: names.get(uid)?.name || "O'quvchi",
        username: names.get(uid)?.username || '',
        ...perStudent.get(uid)!,
      })),
    });
  } catch (error) {
    if (error instanceof ManagerApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/manager/ielts-groups/[groupId]/overview error:', error);
    return NextResponse.json({ error: 'Maʼlumotlarni yuklashda xatolik yuz berdi.' }, { status: 500 });
  }
}
