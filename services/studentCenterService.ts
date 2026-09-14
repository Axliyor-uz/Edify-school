import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Student ↔ center membership (client-side) ───────────────────────────────
// The roster link is `center_students/{centerId}_{uid}` — the rules explicitly
// allow a student to read their OWN links (get + `list` filtered on
// studentId == auth.uid), and `centers` is readable by any signed-in user, so
// no API round-trip is needed just to know "which center am I in".
// A student may belong to SEVERAL centers, and to a center with ZERO groups
// (docs/MANAGER.md) — never derive membership from classes alone.

export interface MyCenter {
  centerId: string;
  name: string;
}

const cache: Record<string, { centers: MyCenter[]; timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000;

export async function fetchMyCenters(uid: string): Promise<MyCenter[]> {
  const cached = cache[uid];
  if (cached && Date.now() - cached.timestamp < CACHE_LIFESPAN) return cached.centers;

  const links = await getDocs(
    query(collection(db, 'center_students'), where('studentId', '==', uid)),
  );
  const centerIds = [...new Set(links.docs.map((d) => d.data().centerId as string).filter(Boolean))];

  const centers = (
    await Promise.all(centerIds.map(async (centerId) => {
      try {
        const snap = await getDoc(doc(db, 'centers', centerId));
        return { centerId, name: snap.exists() ? snap.data().name || '' : '' };
      } catch {
        return { centerId, name: '' };
      }
    }))
  ).filter((c) => c.name || c.centerId);

  cache[uid] = { centers, timestamp: Date.now() };
  return centers;
}
