'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, Hash, CheckCircle, BookOpen, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, IconButton } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const CREATE_CLASS_TRANSLATIONS = {
  uz: {
    title: "Yangi Sinf Yaratish", nameLabel: "Sinf Nomi", namePlace: "Masalan: Algebra 9-B", descLabel: "Tavsif (Ixtiyoriy)", descPlace: "Ertalabki guruh...", codeLabel: "Kirish Kodi", helpText: "O'quvchilar qo'shilish uchun ushbu koddan foydalanadilar.", btn: "Yaratish", success: "Sinf Muvaffaqiyatli Yaratildi!", fail: "Sinf yaratishda xatolik"
  },
  en: {
    title: "Create New Class", nameLabel: "Class Name", namePlace: "e.g. Algebra 9-B", descLabel: "Description (Optional)", descPlace: "Morning session...", codeLabel: "Join Code", helpText: "Students will use this code to request access.", btn: "Create Class", success: "Class Created Successfully!", fail: "Failed to create class"
  },
  ru: {
    title: "Создать Новый Класс", nameLabel: "Название Класса", namePlace: "Напр.: Алгебра 9-Б", descLabel: "Описание (Необязательно)", descPlace: "Утренняя группа...", codeLabel: "Код Входа", helpText: "Ученики будут использовать этот код для входа.", btn: "Создать", success: "Класс успешно создан!", fail: "Ошибка создания класса"
  }
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateClassModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = CREATE_CLASS_TRANSLATIONS[lang] || CREATE_CLASS_TRANSLATIONS['en'];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-generate secure 6-char code (Executes only once on mount)
  const [joinCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'classes'), {
        title: title.trim(),
        description: description.trim(),
        joinCode,
        teacherId: user.uid,
        teacherName: user.displayName,
        studentIds: [], 
        studentCount: 0,
        createdAt: serverTimestamp(),
      });

      toast.success(t.success);
      // Reset state so next time it opens it's fresh
      setTitle('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(t.fail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Soft Backdrop */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Premium Modal Container */}
      <div className="relative bg-surface-container-low rounded-m3-xl w-full max-w-md overflow-hidden shadow-elev-3 animate-in zoom-in-95 fade-in duration-300 flex flex-col max-h-[90vh]">

        {/* HEADER */}
        <div className="px-6 md:px-8 py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-m3-md bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
               <BookOpen size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-[18px] font-black text-on-surface tracking-tight">{t.title}</h2>
          </div>
          <IconButton size="sm" aria-label="Yopish" onClick={onClose} className="shrink-0">
            <X strokeWidth={2.5} />
          </IconButton>
        </div>

        {/* BODY */}
        <div className="p-6 md:p-8 space-y-5 overflow-y-auto custom-scrollbar">
          
          {/* Title Input */}
          <div>
            <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.nameLabel}</label>
            <input
              type="text"
              placeholder={t.namePlace}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none transition-all"
              autoFocus
            />
          </div>

          {/* Description Input */}
          <div>
             <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">{t.descLabel}</label>
             <textarea
               rows={2}
               placeholder={t.descPlace}
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="w-full px-4 py-3 bg-surface-container border border-outline-variant rounded-m3-md text-[14px] font-medium text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none resize-none transition-all"
             />
          </div>

          {/* 🟢 UPGRADED: Glowing Join Code Box */}
          <div className="relative overflow-hidden bg-primary-container p-5 rounded-m3-lg flex items-center justify-between group mt-2">
            {/* Subtle background flare */}
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-[color-mix(in_oklab,var(--m3-surface-container-lowest)_40%,transparent)] rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10">
              <p className="text-[10px] font-black text-on-primary-container uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-primary" /> {t.codeLabel}
              </p>
              <p className="text-2xl font-black text-on-primary-container tracking-[0.2em] font-mono leading-none py-1">
                {joinCode}
              </p>
            </div>

            <div className="w-12 h-12 bg-surface-container-lowest rounded-m3-md flex items-center justify-center text-primary shadow-elev-1 relative z-10">
              <Hash size={24} strokeWidth={2.5} />
            </div>
          </div>

          <p className="text-[12px] font-medium text-center text-on-surface-variant">{t.helpText}</p>
        </div>

        {/* FOOTER */}
        <div className="px-6 md:px-8 py-4 border-t border-outline-variant bg-surface-container flex justify-end shrink-0">
          <Button
            onClick={handleCreate}
            disabled={!title.trim()}
            loading={isSaving}
            icon={<CheckCircle strokeWidth={2.5} />}
            className="w-full sm:w-auto"
          >
            {t.btn}
          </Button>
        </div>
        
      </div>
    </div>
  );
}