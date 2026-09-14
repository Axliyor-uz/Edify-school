// Batched users/{uid} profile lookup with a module-level cache — replaces the
// per-component getDoc fan-outs (IELTS roster / pulse / assign modal each did their own).
// Chunks of 10 via documentId() 'in' queries; missing profiles cache as null.
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserLite {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoUrl: string | null;
}

const cache = new Map<string, UserLite | null>(); // null = profile doc missing

export async function fetchUsersLite(uids: string[]): Promise<Record<string, UserLite | null>> {
  const unique = [...new Set(uids)].filter(Boolean);
  const missing = unique.filter((u) => !cache.has(u));
  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
    const found = new Set<string>();
    for (const d of snap.docs) {
      found.add(d.id);
      const data = d.data();
      cache.set(d.id, {
        uid: d.id,
        displayName: data.displayName || data.name || null,
        username: data.username || null,
        photoUrl: data.photoURL || null,
      });
    }
    for (const u of chunk) if (!found.has(u)) cache.set(u, null);
  }
  return Object.fromEntries(unique.map((u) => [u, cache.get(u) ?? null]));
}
