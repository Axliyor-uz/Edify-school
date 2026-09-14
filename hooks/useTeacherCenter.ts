'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

export interface TeacherCenter {
  centerId: string;
  centerName: string;
  loading: boolean;
}

// One lookup per session per teacher — membership changes are rare, and the
// chip renders on several pages at once.
const cache: Record<string, { centerId: string; centerName: string }> = {};

/**
 * Resolves the signed-in teacher's center (if any) from their
 * `center_teachers/{uid}` link + the `centers/{id}` doc.
 *
 * ⚠️ Uses a direct getDoc on `center_teachers/{uid}` — the doc id IS the
 * teacher uid, which the rules `get` branch proves. A
 * `where('teacherId','==',uid)` LIST query is NOT provable by the rules
 * (the list branch checks the doc-id wildcard) and fails with
 * permission-denied — never query this collection from the teacher side.
 */
export function useTeacherCenter(): TeacherCenter {
  const { user } = useAuth();
  // Cache hit resolves in the initializer — no sync setState inside the effect.
  const [state, setState] = useState<TeacherCenter>(() => {
    const cached = user ? cache[user.uid] : undefined;
    return cached ? { ...cached, loading: false } : { centerId: '', centerName: '', loading: true };
  });

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const cached = cache[user.uid];
      if (cached) {
        // Auth user arrived after mount — the initializer missed the cache.
        if (mounted) {
          setState(prev =>
            !prev.loading && prev.centerId === cached.centerId && prev.centerName === cached.centerName
              ? prev
              : { ...cached, loading: false }
          );
        }
        return;
      }
      try {
        const linkSnap = await getDoc(doc(db, 'center_teachers', user.uid));
        if (!linkSnap.exists()) {
          cache[user.uid] = { centerId: '', centerName: '' };
          if (mounted) setState({ centerId: '', centerName: '', loading: false });
          return;
        }
        const centerId = linkSnap.data().centerId || '';
        let centerName = '';
        if (centerId) {
          try {
            const centerSnap = await getDoc(doc(db, 'centers', centerId));
            centerName = centerSnap.exists() ? (centerSnap.data().name || '') : '';
          } catch {
            // center doc unreadable/missing — keep the id, show a generic label
          }
        }
        cache[user.uid] = { centerId, centerName };
        if (mounted) setState({ centerId, centerName, loading: false });
      } catch (err) {
        console.error('useTeacherCenter lookup error:', err);
        if (mounted) setState({ centerId: '', centerName: '', loading: false });
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  return state;
}
