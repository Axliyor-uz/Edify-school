'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { approveJoinRequest } from '@/services/ieltsService';
import { Check, X, Inbox, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion, AnimatePresence } from 'framer-motion';
import { Spinner, EmptyState } from '@/components/ui';

const T: Record<string, any> = {
  uz: {
    emptyTitle: "So'rovlar yo'q",
    emptyDesc: "'I-' kodi orqali bu guruhga qo'shilishni so'ragan o'quvchilar hali yo'q.",
    approve: "Qabul qilish",
    reject: "Rad etish",
    successApprove: "{name} qabul qilindi!",
    successReject: "So'rov rad etildi",
    fail: "Xatolik yuz berdi",
    count: "ta so'rov",
    bannerTitle: "Shoshilinch So'rovlar",
  },
  en: {
    emptyTitle: "No pending requests",
    emptyDesc: "No students have requested access using your 'I-' code yet.",
    approve: "Approve",
    reject: "Reject",
    successApprove: "{name} approved!",
    successReject: "Request rejected",
    fail: "An error occurred",
    count: "requests",
    bannerTitle: "Pending Requests",
  },
  ru: {
    emptyTitle: "Нет запросов",
    emptyDesc: "Пока нет заявок на вступление по коду 'I-'.",
    approve: "Принять",
    reject: "Отклонить",
    successApprove: "{name} принят!",
    successReject: "Запрос отклонён",
    fail: "Произошла ошибка",
    count: "запроса",
    bannerTitle: "Срочные запросы",
  },
};

interface EnrichedRequest {
  requestId: string;
  uid: string;
  displayName: string;
  username: string;
  photoUrl: string | null;
  requestedAt: Date;
}

interface Props { groupId: string; }

export default function IeltsRequestsTab({ groupId }: Props) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [requests, setRequests]       = useState<EnrichedRequest[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(
      collection(db, 'ielts_groups', groupId, 'requests'),
      async (snapshot) => {
        try {
          const resolved = await Promise.all(
            snapshot.docs.map(async (reqDoc) => {
              const raw = reqDoc.data();
              const uid = raw.studentId || raw.userId || reqDoc.id;
              const userSnap = await getDoc(doc(db, 'users', uid));
              const u = userSnap.exists() ? userSnap.data() : {};
              return {
                requestId:   reqDoc.id,
                uid,
                displayName: u.displayName || raw.displayName || "Noma'lum",
                username:    u.username    || raw.username    || 'user',
                photoUrl:    u.photoURL    || raw.photoUrl    || null,
                requestedAt: raw.requestedAt?.toDate() || new Date(),
              };
            })
          );
          resolved.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
          setRequests(resolved);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      }
    );
    return () => unsub();
  }, [groupId]);

  const handleApprove = async (req: EnrichedRequest) => {
    setProcessingId(req.requestId);
    try {
      // Atomic: arrayUnion + request delete in one batch (services/ieltsService)
      await approveJoinRequest(groupId, req.requestId, req.uid);
      toast.success(t.successApprove.replace('{name}', req.displayName));
    } catch (e) {
      console.error(e); toast.error(t.fail);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: EnrichedRequest) => {
    setProcessingId(req.requestId);
    try {
      await deleteDoc(doc(db, 'ielts_groups', groupId, 'requests', req.requestId));
      toast.success(t.successReject);
    } catch (e) {
      console.error(e); toast.error(t.fail);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return (
    <div className="py-16 flex justify-center">
      <Spinner size={28} />
    </div>
  );

  if (requests.length === 0) return (
    <div className="py-8 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
      <EmptyState icon={<Inbox strokeWidth={2.5} />} title={t.emptyTitle} description={t.emptyDesc} />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      <div className="bg-warning-container rounded-m3-lg border-2 border-warning shadow-elev-1 p-6 overflow-hidden relative max-w-2xl">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-warning" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-warning text-surface-container-lowest flex items-center justify-center shrink-0">
            <AlertCircle size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[16px] font-black text-on-warning-container tracking-tight">{t.bannerTitle}</h3>
            <p className="text-[13px] font-bold text-on-warning-container">{requests.length} {t.count} kutmoqda</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {requests.map(req => {
              const isBusy = processingId === req.requestId;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={req.requestId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest border-2 border-outline-variant rounded-m3-md p-4 shadow-elev-1 hover:shadow-elev-2 transition-all ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-m3-md bg-primary-container text-on-primary-container font-black text-[16px] flex items-center justify-center shrink-0 overflow-hidden">
                      {req.photoUrl ? <img src={req.photoUrl} alt="" className="w-full h-full object-cover" /> : req.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-black text-on-surface truncate mb-0.5">{req.displayName}</p>
                      <p className="text-[12px] font-bold text-on-surface-variant truncate">@{req.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t-2 sm:border-t-0 border-outline-variant pt-3 sm:pt-0">
                    <button
                      onClick={() => handleReject(req)}
                      disabled={isBusy}
                      className="m3-interactive flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-error-container text-on-error-container rounded-m3-md font-black text-[13px] transition-colors border-2 border-transparent active:scale-95"
                    >
                      <X size={15} strokeWidth={3} /> {t.reject}
                    </button>
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={isBusy}
                      className="m3-interactive flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-success text-surface-container-lowest rounded-m3-md font-black text-[13px] transition-colors shadow-elev-1 active:scale-95 border-2 border-transparent"
                    >
                      {isBusy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} strokeWidth={3} />}
                      {t.approve}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
