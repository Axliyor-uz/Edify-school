'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { X, UserPlus, Loader2, AtSign, ArrowRight, Target, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { useTeacherLanguage } from '@/app/teacher/layout';
import { IconButton } from '@/components/ui';

const TRANSLATIONS: Record<string, any> = {
  uz: {
    title: "IELTS Guruhga O'quvchi Qo'shish",
    placeholder: "username orqali qidirish",
    badge: "IELTS Roster",
    alreadyIn: "Bu o'quvchi allaqachon guruhda bor!",
    toasts: {
      self: "O'zingizni guruhga qo'sha olmaysiz!",
      teacher: "O'qituvchilarni qo'sha olmaysiz.",
      notFound: "O'quvchi topilmadi",
      searchFail: "Qidiruvda xatolik",
      success: "{name} IELTS guruhiga qo'shildi!",
      addFail: "Qo'shishda xatolik yuz berdi"
    }
  },
  en: {
    title: "Add Student to IELTS Group",
    placeholder: "Search by username",
    badge: "IELTS Roster",
    alreadyIn: "This student is already inside this group!",
    toasts: {
      self: "You cannot add yourself!",
      teacher: "You cannot add other teachers.",
      notFound: "Student not found",
      searchFail: "Search failed",
      success: "Added {name} to IELTS group!",
      addFail: "Failed to add student"
    }
  },
  ru: {
    title: "Добавить ученика в группу IELTS",
    placeholder: "Поиск по username",
    badge: "Список IELTS",
    alreadyIn: "Этот ученик уже состоит в этой группе!",
    toasts: {
      self: "Нельзя добавить себя!",
      teacher: "Нельзя добавлять учителей.",
      notFound: "Ученик не найден",
      searchFail: "Ошибка поиска",
      success: "{name} добавлен в группу IELTS!",
      addFail: "Не удалось добавить ученика"
    }
  }
};

interface Props {
  groupId: string; // Strictly typed to our IELTS Group ID
  isOpen: boolean;
  onClose: () => void;
}

export default function AddIeltsStudentModal({ groupId, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { lang } = useTeacherLanguage();
  const t = TRANSLATIONS[lang] || TRANSLATIONS['uz'];

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
        const targetUid = usernameSnap.data().uid;
        const userSnap = await getDoc(doc(db, 'users', targetUid));

        if (userSnap.exists()) {
          const userData = userSnap.data();

          if (targetUid === user?.uid) { toast.error(t.toasts.self); setIsSearching(false); return; }
          if (userData.role === 'teacher') { toast.error(t.toasts.teacher); setIsSearching(false); return; }

          // 🟢 SMART IELTS CHECK: Look inside the group to verify they aren't already enrolled
          const groupSnap = await getDoc(doc(db, 'ielts_groups', groupId));
          if (groupSnap.exists() && groupSnap.data().studentIds?.includes(targetUid)) {
            toast.error(t.alreadyIn);
            setIsSearching(false);
            return;
          }

          setFoundUser({ uid: targetUid, ...userData });
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
      // STRICT OUTPUT: Strictly targets Pillar 1 ('ielts_groups')
      const groupRef = doc(db, 'ielts_groups', groupId);
      await updateDoc(groupRef, { studentIds: arrayUnion(foundUser.uid) });

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-scrim backdrop-blur-md transition-opacity" onClick={handleClose} />

      <div className="relative bg-surface-container-low rounded-m3-xl w-full max-w-md overflow-hidden shadow-elev-3 border border-outline-variant flex flex-col max-h-[90vh]">

        {/* HEADER - Crimson IELTS Identity */}
        <div className="px-6 md:px-8 py-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-m3-md bg-primary text-on-primary flex items-center justify-center shadow-elev-1 shrink-0">
               <Target size={20} strokeWidth={2.5}/>
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-black text-on-surface tracking-tight truncate">{t.title}</h2>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">{t.badge}</span>
            </div>
          </div>
          <IconButton aria-label="Yopish" size="sm" onClick={handleClose} className="shrink-0">
            <X strokeWidth={2.5} />
          </IconButton>
        </div>

        {/* BODY */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">

          {/* Search Box */}
          <div className="relative group">
            <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text" placeholder={t.placeholder} value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-11 pr-14 py-4 bg-surface-container-lowest border border-outline-variant rounded-m3-md text-sm font-black text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-4 focus:ring-[color-mix(in_oklab,var(--m3-primary)_10%,transparent)] outline-none transition-all shadow-elev-1"
              autoFocus
            />

            <button
              onClick={handleSearch} disabled={isSearching || !hasInput}
              className={`m3-interactive absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-m3-md flex items-center justify-center transition-all duration-300 shadow-elev-1
                ${hasInput && !isSearching ? 'bg-primary text-on-primary hover:scale-105 active:scale-95' : 'bg-disabled-bg text-disabled-fg'}
              `}
            >
              {isSearching ? <Loader2 className="animate-spin" size={18}/> : <ArrowRight size={18} strokeWidth={3}/>}
            </button>
          </div>

          {/* User Found Card */}
          {foundUser && (
            <div className="bg-surface-container-lowest border border-success-container p-4 rounded-m3-lg flex items-center justify-between gap-4 shadow-elev-1 animate-in slide-in-from-bottom-3 duration-250">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-m3-md bg-success flex items-center justify-center font-black text-surface-container-lowest text-lg shadow-elev-2 shrink-0">
                  {foundUser.displayName?.[0]?.toUpperCase() || 'S'}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-on-surface text-sm truncate">{foundUser.displayName}</p>
                  <p className="text-xs font-bold text-on-surface-variant truncate">@{foundUser.username || username.replace('@', '')}</p>
                </div>
              </div>

              <button
                onClick={handleAddStudent} disabled={isAdding}
                className="m3-interactive w-12 h-12 bg-success text-surface-container-lowest rounded-m3-md transition-all disabled:bg-disabled-bg disabled:text-disabled-fg active:scale-95 flex items-center justify-center shrink-0 shadow-elev-2"
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
