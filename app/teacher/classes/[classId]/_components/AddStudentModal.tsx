'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { X, Search, UserPlus, Loader2, AtSign, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { IconButton } from '@/components/ui';

// --- TRANSLATION DICTIONARY ---
const ADD_STUDENT_TRANSLATIONS = {
  uz: {
    title: "O'quvchini Qo'shish", placeholder: "username orqali qidirish",
    toasts: { self: "Siz o'zingizni sinfga qo'sha olmaysiz!", teacher: "Boshqa o'qituvchilarni qo'sha olmaysiz.", notFound: "Foydalanuvchi topilmadi", searchFail: "Qidiruvda xatolik", success: "{name} sinfga qo'shildi!", addFail: "Qo'shishda xatolik" }
  },
  en: {
    title: "Add Student", placeholder: "Search by username",
    toasts: { self: "You cannot add yourself!", teacher: "You cannot add other teachers.", notFound: "User not found", searchFail: "Search failed", success: "Added {name} to class!", addFail: "Failed to add student" }
  },
  ru: {
    title: "Добавить ученика", placeholder: "Поиск по username",
    toasts: { self: "Нельзя добавить себя!", teacher: "Нельзя добавить учителей.", notFound: "Пользователь не найден", searchFail: "Ошибка поиска", success: "{name} добавлен в класс!", addFail: "Не удалось добавить" }
  }
};

interface Props {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddStudentModal({ classId, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = ADD_STUDENT_TRANSLATIONS[lang] || ADD_STUDENT_TRANSLATIONS['en'];

  const [username, setUsername] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!username.trim()) return;
    setIsSearching(true);
    setFoundUser(null);

    try {
      const cleanName = username.replace('@', '').toLowerCase();
      const usernameRef = doc(db, 'usernames', cleanName);
      const usernameSnap = await getDoc(usernameRef);

      if (usernameSnap.exists()) {
        const uid = usernameSnap.data().uid;
        const userSnap = await getDoc(doc(db, 'users', uid));
        
        if (userSnap.exists()) {
          const userData = userSnap.data();

          if (uid === user?.uid) { toast.error(t.toasts.self); setIsSearching(false); return; }
          if (userData.role === 'teacher') { toast.error(t.toasts.teacher); setIsSearching(false); return; }

          setFoundUser({ uid, ...userData });
        }
      } else {
        toast.error(t.toasts.notFound);
      }
    } catch (error) {
      toast.error(t.toasts.searchFail);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStudent = async () => {
    if (!foundUser) return;
    setIsAdding(true);
    try {
      const classRef = doc(db, 'classes', classId);
      await updateDoc(classRef, { studentIds: arrayUnion(foundUser.uid) });
      
      toast.success(t.toasts.success.replace("{name}", foundUser.displayName));
      setFoundUser(null);
      setUsername('');
      onClose();
    } catch (error) {
      toast.error(t.toasts.addFail);
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setFoundUser(null);
    setUsername('');
    onClose();
  };

  const hasInput = username.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm transition-opacity" onClick={handleClose}></div>

      <div className="relative bg-surface-container-low rounded-m3-xl w-full max-w-md overflow-hidden shadow-elev-3 border border-outline-variant animate-in zoom-in-95 fade-in duration-300">

        {/* HEADER */}
        <div className="px-6 md:px-8 py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-m3-md bg-primary-container flex items-center justify-center text-on-primary-container shadow-elev-1 shrink-0">
               <Search size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-[18px] font-black text-on-surface tracking-tight">{t.title}</h2>
          </div>
          <IconButton aria-label="Yopish" onClick={handleClose} className="shrink-0">
            <X />
          </IconButton>
        </div>

        {/* BODY */}
        <div className="p-6 md:p-8 bg-surface">
          
          {/* 🟢 UPGRADED: Android-Style Search Input */}
          <div className="relative group">
            <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder={t.placeholder}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-11 pr-14 py-4 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-[14px] font-bold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none transition-all shadow-elev-1"
              autoFocus
            />
            
            {/* Square Arrow Button (Matches Android) */}
            <button 
              onClick={handleSearch}
              disabled={isSearching || !hasInput}
              className={`m3-interactive absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-m3-md flex items-center justify-center transition-all duration-300 shadow-elev-1
                ${hasInput && !isSearching ? 'bg-primary text-on-primary hover:scale-105 active:scale-95' : 'bg-disabled-bg text-disabled-fg'}
              `}
            >
              {isSearching ? <Loader2 className="animate-spin" size={18}/> : <ArrowRight size={18} strokeWidth={3}/>}
            </button>
          </div>

          {/* Found User Result Card */}
          {foundUser && (
            <div className="mt-6 bg-surface-container-lowest border border-success-container p-4 rounded-m3-lg flex items-center justify-between gap-4 shadow-elev-1 animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden group">

              <div className="absolute -right-6 -top-6 w-24 h-24 bg-success-container rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center gap-4 relative z-10 min-w-0">
                <div className="w-12 h-12 bg-success rounded-m3-md flex items-center justify-center font-black text-surface-container-lowest text-[18px] shadow-elev-2 shrink-0">
                  {foundUser.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-on-surface text-[15px] truncate">{foundUser.displayName}</p>
                  <p className="text-[12px] font-bold text-on-surface-variant truncate">@{foundUser.username || username.replace('@', '')}</p>
                </div>
              </div>

              {/* 🟢 UPGRADED: Android-Style Square Add Button */}
              <button
                onClick={handleAddStudent}
                disabled={isAdding}
                className="m3-interactive w-12 h-12 bg-success text-surface-container-lowest rounded-m3-md transition-all disabled:bg-disabled-bg disabled:text-disabled-fg shadow-elev-2 active:scale-95 flex items-center justify-center relative z-10 shrink-0"
              >
                {isAdding ? <Loader2 className="animate-spin" size={20}/> : <UserPlus size={20} strokeWidth={2.5}/>}
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}