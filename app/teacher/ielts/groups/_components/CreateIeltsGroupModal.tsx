'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateUniqueJoinCode } from '@/services/ieltsService';
import { X, Hash, CheckCircle, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, IconButton } from '@/components/ui';

const T: Record<string, any> = {
  uz: {
    title: "Yangi Guruh",
    namePlaceholder: "Guruh nomi...",
    descPlaceholder: "Tavsif (ixtiyoriy)",
    btn: "Yaratish",
    success: "Guruh yaratildi!",
    fail: "Xatolik yuz berdi",
    codeLabel: "Guruh kodi",
    codeHint: "O'quvchilar shu kodni kiritib qo'shiladi",
  },
  en: {
    title: "New Group",
    namePlaceholder: "Group name...",
    descPlaceholder: "Description (optional)",
    btn: "Create",
    success: "Group created!",
    fail: "Failed to create group",
    codeLabel: "Join code",
    codeHint: "Students use this code to join",
  },
  ru: {
    title: "Новая Группа",
    namePlaceholder: "Название группы...",
    descPlaceholder: "Описание (необязательно)",
    btn: "Создать",
    success: "Группа создана!",
    fail: "Ошибка при создании",
    codeLabel: "Код группы",
    codeHint: "Ученики вводят этот код",
  },
};

const BANDS = ['5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0'];

interface Props { isOpen: boolean; onClose: () => void; }

export default function CreateIeltsGroupModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  const [title, setTitle]           = useState('');
  const [targetBand, setTargetBand] = useState('7.0');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  // Uniqueness-checked code, generated per modal open (services/ieltsService)
  const [joinCode, setJoinCode] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setJoinCode('');
    generateUniqueJoinCode().then(code => { if (alive) setJoinCode(code); });
    return () => { alive = false; };
  }, [isOpen]);

  const handleClose = () => {
    setTitle(''); setDescription(''); onClose();
  };

  const handleCreate = async () => {
    if (!title.trim() || !user || !joinCode) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'ielts_groups'), {
        title:       title.trim(),
        targetBand:  parseFloat(targetBand),
        joinCode,
        teacherId:   user.uid,
        teacherName: user.displayName || 'O\'qituvchi',
        description: description.trim(),
        studentIds:  [],
        createdAt:   serverTimestamp(),
      });
      toast.success(t.success);
      handleClose();
    } catch (e) {
      console.error(e);
      toast.error(t.fail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-scrim"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative bg-surface-container-low w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-m3-xl overflow-hidden z-10 flex flex-col shadow-elev-3"
          >
            {/* Mobile drag handle */}
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mt-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-[17px] font-black text-on-surface tracking-tight">{t.title}</h2>
              <IconButton aria-label="Yopish" size="sm" onClick={handleClose} className="shrink-0">
                <X strokeWidth={2.5} />
              </IconButton>
            </div>

            {/* Form */}
            <div className="px-5 pb-5 flex flex-col gap-3">

              {/* Group name */}
              <input
                type="text"
                placeholder={t.namePlaceholder}
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[15px] font-bold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none transition-all"
              />

              {/* Band + Description row */}
              <div className="flex gap-2">
                {/* Band selector */}
                <div className="relative shrink-0">
                  <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" strokeWidth={2.5} />
                  <select
                    value={targetBand}
                    onChange={e => setTargetBand(e.target.value)}
                    className="pl-8 pr-3 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-black text-on-surface outline-none focus:border-primary cursor-pointer appearance-none transition-all hover:border-outline"
                  >
                    {BANDS.map(b => (
                      <option key={b} value={b}>Band {b}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <input
                  type="text"
                  placeholder={t.descPlaceholder}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="flex-1 min-w-0 px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[13px] font-medium text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none transition-all"
                />
              </div>

              {/* Join code display */}
              <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-m3-md px-4 py-3">
                <div>
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{t.codeLabel}</p>
                  <p className="text-[20px] font-black font-mono text-on-surface tracking-widest mt-0.5 leading-none">{joinCode || '…'}</p>
                </div>
                <div className="w-9 h-9 rounded-m3-md bg-primary-container border border-transparent flex items-center justify-center text-on-primary-container">
                  <Hash size={16} strokeWidth={2.5} />
                </div>
              </div>
              <p className="text-[11px] font-medium text-on-surface-variant -mt-1 px-1">{t.codeHint}</p>

              {/* Submit */}
              <Button
                variant="filled"
                size="lg"
                onClick={handleCreate}
                disabled={!title.trim() || !joinCode}
                loading={isSaving}
                icon={<CheckCircle strokeWidth={2.5} />}
                className="w-full mt-1"
              >
                {t.btn}
              </Button>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}