// app/(student)/ielts/page.tsx — student IELTS hub.
// Three URL-addressable tabs (docs/IELTS.md → "Route map / Student"):
//   /ielts?tab=groups    · my groups (teacher-assigned mocks live inside a group)
//   /ielts?tab=practice  · platform Practice Library (+ ?skill= & ?type= deep links)
//   /ielts?tab=progress  · cross-group band trajectory
// The tab lives in the query string, so every state is shareable and the browser
// back button behaves. `?skill=`/`?type=` (weak-type link from the group page)
// imply the practice tab and stay backward compatible.
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, BookOpen, TrendingUp } from 'lucide-react';
import { Page, PageHeader, Button, Tabs, LoadingState, MOTION_ON } from '@/components/student-ui';
import type { IeltsGroup, IeltsSkill } from '@/lib/ielts/types';
import { useStudentLanguage } from '../layout';
import { fetchMyAttempts } from '@/services/ieltsService';

import JoinIeltsModal from './_components/JoinIeltsModal';
import GroupsTab from './_components/GroupsTab';
import PracticeTab from './_components/PracticeTab';
import ProgressTab from './_components/ProgressTab';
import { IELTS_TRANSLATIONS, HUB_TABS, SKILL_KEYS, type HubTab } from './_components/hubTexts';
import { attemptBand, type AttemptDoc } from './_components/hubData';

// ─── Module-level 60s cache (student-page convention) ────────────────────────
const CACHE_TTL = 60_000;
const myAttemptsCache: Record<string, { at: number; data: AttemptDoc[] }> = {};

function IeltsHub() {
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = IELTS_TRANSLATIONS[lang] || IELTS_TRANSLATIONS.uz;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groups, setGroups] = useState<IeltsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsError, setGroupsError] = useState(false);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);

  /**
   * Architecture doc §3-A / §4:
   * Strictly query ielts_groups filtered by studentIds array-contains.
   * onSnapshot gives real-time approval feedback (no refresh needed).
   */
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'ielts_groups'),
      where('studentIds', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as IeltsGroup)));
        setGroupsError(false);
        setLoading(false);
      },
      () => {
        // A real failure must not masquerade as "no groups yet".
        setGroupsError(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // My attempts once — feeds the best-band chips (practice) and the journey tab.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const cached = myAttemptsCache[user.uid];
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setAttempts(cached.data);
      return;
    }
    fetchMyAttempts(user.uid)
      .then(data => {
        myAttemptsCache[user.uid] = { at: Date.now(), data };
        if (alive) setAttempts(data);
      })
      .catch(() => { /* band chips + journey are optional decoration */ });
    return () => { alive = false; };
  }, [user]);

  // ── URL → state ────────────────────────────────────────────────────────────
  const rawTab = searchParams.get('tab');
  const rawSkill = searchParams.get('skill');
  const rawType = searchParams.get('type');

  const skill: IeltsSkill = SKILL_KEYS.includes(rawSkill as IeltsSkill)
    ? (rawSkill as IeltsSkill)
    : 'reading';
  // Weak-type filter only exists for the two auto-graded skills.
  const typeFilter = rawType && (skill === 'reading' || skill === 'listening') ? rawType : null;

  const hasGroups = groups.length > 0;
  const explicitTab = HUB_TABS.includes(rawTab as HubTab) ? (rawTab as HubTab) : null;
  // No ?tab= → a `?skill=` deep link means practice; otherwise groups, unless the
  // student has none (then the library is the only useful landing spot).
  const tab: HubTab = explicitTab ?? (rawSkill ? 'practice' : hasGroups ? 'groups' : 'practice');

  // ── state → URL (replace: tab switching should not pile up history entries) ─
  const setUrl = useCallback((next: { tab: HubTab; skill?: IeltsSkill | null; type?: string | null }) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', next.tab);
    if (next.skill === null) sp.delete('skill');
    else if (next.skill) sp.set('skill', next.skill);
    if (next.type === null) sp.delete('type');
    else if (next.type) sp.set('type', next.type);
    router.replace(`/ielts?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Leaving the library drops its filters so the URL always describes what is shown.
  const goTab = (next: HubTab) =>
    setUrl(next === 'practice' ? { tab: next } : { tab: next, skill: null, type: null });

  const goPractice = () => setUrl({ tab: 'practice' });

  if (loading) {
    return (
      <Page>
        <LoadingState rows={4} />
      </Page>
    );
  }

  // testId → best band across my attempts (server band or teacher grade for W/S).
  const bestBandByTest: Record<string, number> = {};
  for (const a of attempts) {
    const band = attemptBand(a);
    const testId = String(a.testId || '');
    if (band == null || !testId) continue;
    if (bestBandByTest[testId] == null || band > bestBandByTest[testId]) bestBandByTest[testId] = band;
  }

  const joinButton = (
    <Button icon={<Plus size={18} strokeWidth={3} />} onClick={() => setIsModalOpen(true)}>
      {t.join}
    </Button>
  );

  const TABS = [
    { value: 'groups',   label: t.tabs.groups,   icon: <Users size={16} strokeWidth={2.75} /> },
    { value: 'practice', label: t.tabs.practice, icon: <BookOpen size={16} strokeWidth={2.75} /> },
    { value: 'progress', label: t.tabs.progress, icon: <TrendingUp size={16} strokeWidth={2.75} /> },
  ];

  return (
    <Page>
      <PageHeader
        title={t.title}
        subtitle={hasGroups ? t.subtitleMember(groups.length) : t.subtitleEmpty}
        actions={joinButton}
      />

      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(v) => goTab(v as HubTab)}
        label={t.title}
        className="mb-s-section"
      />

      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={MOTION_ON ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'groups' && (
              <GroupsTab
                groups={groups}
                error={groupsError}
                t={t}
                onJoin={() => setIsModalOpen(true)}
                onGoPractice={goPractice}
                joinButton={joinButton}
              />
            )}

            {tab === 'practice' && (
              <PracticeTab
                skill={skill}
                typeFilter={typeFilter}
                bestBandByTest={bestBandByTest}
                t={t}
                onSkillChange={(s) => setUrl({ tab: 'practice', skill: s, type: null })}
                onClearType={() => setUrl({ tab: 'practice', skill, type: null })}
              />
            )}

            {tab === 'progress' && (
              <ProgressTab attempts={attempts} t={t} onGoPractice={goPractice} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <JoinIeltsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} lang={lang} />
    </Page>
  );
}

// useSearchParams needs a Suspense boundary for the prerender pass.
export default function StudentIeltsHubPage() {
  return (
    <Suspense fallback={<Page><LoadingState rows={4} /></Page>}>
      <IeltsHub />
    </Suspense>
  );
}
