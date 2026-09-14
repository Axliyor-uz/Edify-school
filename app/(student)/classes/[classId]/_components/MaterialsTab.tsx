'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { Folder, Image as ImageIcon, Video, FileText, File, Link as LinkIcon, ExternalLink, Download } from 'lucide-react';
import {
  ListGroup, Tile, Chip, EmptyState, LoadingState, Spinner, cn,
  type TileProps,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

// ============================================================================
// 🟢 1. GLOBAL CACHE (0 Reads on Tab Switch, Survives Navigation)
// ============================================================================
const globalStudentMaterialsCache: Record<string, { materials: any[], lastDoc: any, hasMore: boolean, timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000; // 60 seconds
const PAGE_SIZE = 10;

// --- TRANSLATION DICTIONARY ---
const STUDENT_MATERIALS_TRANSLATIONS: any = {
  uz: {
    empty: "O'qituvchi hali material yuklamagan.",
    new: "Yangi", open: "Ochish", download: "Yuklab olish", external: "TASHQI HAVOLA"
  },
  en: {
    empty: "No materials uploaded by the teacher yet.",
    new: "New", open: "Open", download: "Download", external: "EXTERNAL LINK"
  },
  ru: {
    empty: "Учитель еще не загрузил материалы.",
    new: "Новый", open: "Открыть", download: "Скачать", external: "ВНЕШНЯЯ ССЫЛКА"
  }
};

export default function MaterialsTab({ classId }: { classId: string }) {
  const { lang } = useStudentLanguage();
  const t = STUDENT_MATERIALS_TRANSLATIONS[lang] || STUDENT_MATERIALS_TRANSLATIONS['en'];

  // --- STATE ---
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // ============================================================================
  // 🟢 2. SWR FETCH LOGIC (True Cursor Pagination)
  // ============================================================================
  useEffect(() => {
    if (!classId) return;

    const initializeTab = async () => {
      const cached = globalStudentMaterialsCache[classId];
      const now = Date.now();

      // 🟢 Cache Hit: Instant Load!
      if (cached) {
        setMaterials(cached.materials);
        setLastDoc(cached.lastDoc);
        setHasMore(cached.hasMore);
        setLoadingInitial(false);

        // If fresh, stop here. 0 Firebase Reads!
        if (now - cached.timestamp < CACHE_LIFESPAN) return;

        // If stale, silently fetch page 1 in the background
        fetchMaterials(false, true);
      } else {
        setLoadingInitial(true);
        fetchMaterials(false, false);
      }
    };

    initializeTab();
  }, [classId]);

  const fetchMaterials = async (isNextPage: boolean = false, silent: boolean = false) => {
    if (!classId) return;
    if (isNextPage && !lastDoc) return;

    if (!silent) isNextPage ? setLoadingMore(true) : setLoadingInitial(true);

    try {
      // 🟢 Security: Only fetch visible, unarchived materials!
      let q = query(
        collection(db, 'classes', classId, 'materials'),
        where('isVisible', '==', true),
        where('isArchived', '==', false),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      // 🟢 PRO FIX: Use startAfter to only fetch the NEXT 10 items, not all of them!
      if (isNextPage && lastDoc) {
        q = query(
          collection(db, 'classes', classId, 'materials'),
          where('isVisible', '==', true),
          where('isArchived', '==', false),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setMaterials(prev => {
        const updated = isNextPage ? [...prev, ...newDocs] : newDocs;
        const newLastDoc = snap.docs[snap.docs.length - 1] || null;
        const newHasMore = snap.docs.length >= PAGE_SIZE;

        // 🟢 Save to Cache
        globalStudentMaterialsCache[classId] = {
          materials: updated,
          lastDoc: newLastDoc,
          hasMore: newHasMore,
          timestamp: Date.now()
        };

        if (!silent || !isNextPage) {
          setLastDoc(newLastDoc);
          setHasMore(newHasMore);
        }
        return updated;
      });
    } catch (e) {
      console.error("Materials fetch error:", e);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  };

  // --- 3. INFINITE SCROLL TRIGGER (Replaces manual button) ---
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingInitial || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchMaterials(true);
    }, { threshold: 0.5 });
    if (node) observerRef.current.observe(node);
  }, [loadingInitial, loadingMore, hasMore]);


  // ============================================================================
  // 🟢 4. UI HELPERS & RENDER
  // ============================================================================
  const getSemanticStyle = (type: string): { tone: TileProps['tone']; action: string; icon: any } => {
    if (type === 'pdf') return { tone: 'error', action: 'bg-error-container text-on-error-container', icon: FileText };
    if (type === 'image') return { tone: 'secondary', action: 'bg-secondary-container text-on-secondary-container', icon: ImageIcon };
    if (type === 'video') return { tone: 'primary', action: 'bg-primary-container text-on-primary-container', icon: Video };
    if (type === 'link') return { tone: 'success', action: 'bg-success-container text-on-success-container', icon: LinkIcon };
    return { tone: 'neutral', action: 'bg-surface-container-high text-on-surface-variant', icon: File };
  };

  if (loadingInitial && materials.length === 0) {
    return <LoadingState rows={3} />;
  }

  if (materials.length === 0) {
    return <EmptyState icon={<Folder size={30} strokeWidth={2.5} />} title={t.empty} />;
  }

  return (
    <div className="space-y-s-gap">
      <ListGroup>
        {materials.map((mat, index) => {
          const isLastElement = index === materials.length - 1;
          const style = getSemanticStyle(mat.fileType);
          const IconComp = style.icon;

          return (
            <div
              key={mat.id}
              ref={isLastElement ? lastElementRef : null}
              className="flex items-center gap-3 px-s-row-x py-3.5"
            >
              <Tile tone={style.tone}><IconComp size={22} strokeWidth={2.5} /></Tile>

              <div className="min-w-0 flex-1">
                {mat.topicId && (
                  <Chip status="neutral" className="mb-1 uppercase tracking-widest" icon={<Folder size={10} strokeWidth={3} />}>
                    {mat.topicId}
                  </Chip>
                )}
                <h3 className="truncate text-[15px] font-bold leading-tight text-on-surface">
                  {mat.title}
                </h3>
                {mat.description && (
                  <p className="truncate text-[12.5px] font-bold text-on-surface-variant">{mat.description}</p>
                )}

                <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {mat.isExternal ? (
                    <span className="flex items-center gap-1 text-success"><ExternalLink size={12} strokeWidth={3} /> {t.external}</span>
                  ) : (
                    <span className="s-num">{(mat.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  )}
                  <span>•</span>
                  <span>{mat.createdAt ? new Date(mat.createdAt.seconds * 1000).toLocaleDateString() : t.new}</span>
                </div>
              </div>

              <a
                href={mat.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-m3-btn px-3.5',
                  'text-[12px] font-extrabold uppercase tracking-widest s-press',
                  style.action,
                )}
              >
                {mat.isExternal ? <><ExternalLink size={15} strokeWidth={3} /> {t.open}</> : <><Download size={15} strokeWidth={3} /> {t.download}</>}
              </a>
            </div>
          );
        })}
      </ListGroup>

      {/* Invisible loading indicator to trigger the observer */}
      {loadingMore && (
        <div className="flex justify-center py-6">
          <Spinner size={24} />
        </div>
      )}
    </div>
  );
}
