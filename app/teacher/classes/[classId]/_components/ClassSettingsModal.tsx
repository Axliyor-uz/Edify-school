'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 🟢 ADDED PORTAL
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  X, Settings, Shield, Edit2, Key, RefreshCw,
  Lock, Unlock, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { Button, IconButton, TextField, TextArea } from '@/components/ui';

const SETTINGS_TRANSLATIONS = {
  uz: {
    title: "Sinf Sozlamalari", save: "Saqlash", cancel: "Bekor qilish", close: "Yopish",
    profile: { title: "Sinf Profili", name: "Sinf Nomi", desc: "Tavsif (Ixtiyoriy)" },
    security: { title: "Xavfsizlik va Kirish", code: "Kirish Kodi", copy: "Nusxalash", newCode: "Yangi kod", lock: "Sinfni qulflash", lockDesc: "Yangi o'quvchilar qo'shilishini taqiqlash" },
    toasts: { updated: "Sozlamalar saqlandi", copied: "Kod nusxalandi", syncError: "Kodni yangilashda xatolik", failUpdate: "Saqlashda xatolik" }
  },
  en: {
    title: "Class Settings", save: "Save Changes", cancel: "Cancel", close: "Close",
    profile: { title: "Class Profile", name: "Class Name", desc: "Description (Optional)" },
    security: { title: "Security & Access", code: "Join Code", copy: "Copy", newCode: "Regenerate", lock: "Lock Class", lockDesc: "Prevent new students from requesting to join" },
    toasts: { updated: "Settings saved", copied: "Code copied to clipboard", syncError: "Failed to regenerate code", failUpdate: "Failed to update" }
  },
  ru: {
    title: "Настройки Класса", save: "Сохранить", cancel: "Отмена", close: "Закрыть",
    profile: { title: "Профиль Класса", name: "Название", desc: "Описание (Необяз.)" },
    security: { title: "Безопасность", code: "Код входа", copy: "Копировать", newCode: "Сгенерировать", lock: "Закрыть класс", lockDesc: "Запретить новые заявки на вступление" },
    toasts: { updated: "Настройки сохранены", copied: "Код скопирован", syncError: "Ошибка обновления кода", failUpdate: "Ошибка сохранения" }
  }
};

interface Props {
  classId: string;
  classData: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClassSettingsModal({ classId, classData, isOpen, onClose }: Props) {
  const { lang } = useTeacherLanguage();
  const t = SETTINGS_TRANSLATIONS[lang] || SETTINGS_TRANSLATIONS['en'];

  // 🟢 SSR HYDRATION FIX FOR PORTAL
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (isOpen && classData) {
      setTitle(classData.title || '');
      setDescription(classData.description || '');
      setIsLocked(classData.isLocked || false);
    }
  }, [isOpen, classData]);

  const handleSaveProfile = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'classes', classId), {
        title: title.trim(),
        description: description.trim(),
        isLocked
      });
      toast.success(t.toasts.updated);
      onClose();
    } catch (e) {
      console.error("Save Error:", e);
      toast.error(t.toasts.failUpdate);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let newCode = "";
      for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      await updateDoc(doc(db, 'classes', classId), { 
        joinCode: newCode 
      });
      
      toast.success(t.toasts.updated);
    } catch (e) {
      console.error("Sync Error Details:", e);
      toast.error(t.toasts.syncError);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!mounted || !isOpen || !classData) return null;

  // 🟢 WRAPPED IN CREATE PORTAL
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      
      {/* Premium Backdrop */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* 🟢 ULTRA MINIMALISTIC MOBILE-FIRST MODAL */}
      <div className="relative bg-surface-container-low rounded-t-m3-xl sm:rounded-m3-xl w-full max-w-2xl overflow-hidden shadow-elev-3 border border-outline-variant animate-in slide-in-from-bottom-10 sm:zoom-in-95 fade-in duration-300 flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">

        {/* HEADER */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0 z-20 shadow-elev-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-m3-md bg-surface-container-high border border-outline-variant flex items-center justify-center text-on-surface-variant shadow-elev-1 shrink-0">
               <Settings size={18} strokeWidth={2.5} className="sm:w-5 sm:h-5"/>
            </div>
            <h2 className="text-[16px] sm:text-[18px] font-black text-on-surface tracking-tight leading-tight">{t.title}</h2>
          </div>
          <IconButton aria-label={t.close} onClick={onClose} className="shrink-0">
            <X />
          </IconButton>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 bg-surface custom-scrollbar relative pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-8">
          
          {/* Section 1: Class Profile */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-[10px] sm:text-[12px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 ml-1">
              <Edit2 size={12} className="sm:w-3.5 sm:h-3.5"/> {t.profile.title}
            </h3>
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden p-4 sm:p-5 space-y-4">
              <TextField label={t.profile.name} type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
              <TextArea label={t.profile.desc} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="[&_textarea]:resize-none" />
            </div>
          </div>

          {/* Section 2: Security & Access */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-[10px] sm:text-[12px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 ml-1">
              <Shield size={12} className="sm:w-3.5 sm:h-3.5"/> {t.security.title}
            </h3>
            <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden flex flex-col">

              {/* Join Code */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-state-hover transition-colors">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0"><Key size={18} className="sm:w-5 sm:h-5"/></div>
                  <div>
                    <p className="text-[12px] sm:text-[14px] font-black text-on-surface">{t.security.code}</p>
                    <p className="text-[16px] sm:text-[18px] font-mono font-black text-primary tracking-widest mt-0.5">{classData.joinCode}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t border-outline-variant sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                  <Button
                    variant="outlined"
                    size="sm"
                    icon={<Copy />}
                    onClick={() => { navigator.clipboard.writeText(classData.joinCode); toast.success(t.toasts.copied); }}
                    className="flex-1 sm:flex-none"
                  >
                    {t.security.copy}
                  </Button>

                  <Button
                    variant="outlined"
                    size="sm"
                    icon={<RefreshCw className={isSyncing ? "animate-spin" : ""} />}
                    onClick={handleRegenerateCode}
                    disabled={isSyncing}
                    className="flex-1 sm:flex-none"
                  >
                    {t.security.newCode}
                  </Button>
                </div>
              </div>

              <div className="h-px bg-outline-variant mx-4 sm:mx-5"></div>

              {/* Lock Class */}
              <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-state-hover transition-colors">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-m3-md flex items-center justify-center shrink-0 ${isLocked ? 'bg-error-container text-on-error-container' : 'bg-success-container text-on-success-container'}`}>
                    {isLocked ? <Lock size={18} className="sm:w-5 sm:h-5"/> : <Unlock size={18} className="sm:w-5 sm:h-5"/>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] sm:text-[14px] font-black text-on-surface truncate">{t.security.lock}</p>
                    <p className="text-[11px] sm:text-[12px] font-medium text-on-surface-variant mt-0.5 leading-snug">{t.security.lockDesc}</p>
                  </div>
                </div>

                {/* Custom Toggle */}
                <button onClick={() => setIsLocked(!isLocked)} className={`w-12 h-6 sm:w-12 sm:h-6 rounded-full p-1 transition-colors relative shrink-0 ${isLocked ? 'bg-error' : 'bg-surface-container-highest'}`}>
                  <div className={`w-4 h-4 bg-surface-container-lowest rounded-full shadow-elev-1 transition-transform ${isLocked ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-outline-variant bg-surface-container-low flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 shrink-0 z-20 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-[0_-10px_30px_rgb(0,0,0,0.03)]">
          <Button variant="text" onClick={onClose} className="w-full sm:w-auto">
            {t.cancel}
          </Button>
          <Button variant="filled" onClick={handleSaveProfile} disabled={isSaving || !title.trim()} loading={isSaving} className="w-full sm:w-auto">
            {t.save}
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}