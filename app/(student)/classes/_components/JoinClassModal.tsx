'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { Hash, CheckCircle } from 'lucide-react';
import { Dialog, TextField, Button, Tile, Banner, sToast } from '@/components/student-ui';

// --- TRANSLATION DICTIONARY ---
const JOIN_TRANSLATIONS: any = {
  uz: {
    title: "Sinfga Qo'shilish", subtitle: "O'qituvchingizdan olingan 6 xonali kodni kiriting.", placeholder: "M: A1B2C3", btnSend: "So'rov Yuborish", successTitle: "So'rov Yuborildi!", successDesc: "O'qituvchi tasdiqlashini kuting.",
    toasts: { invalid: "Noto'g'ri Sinf Kodi", joined: "Siz allaqachon bu sinfdasiz!", pending: "So'rov allaqachon yuborilgan.", success: "So'rov muvaffaqiyatli yuborildi!", error: "Xatolik yuz berdi", centerManaged: "Bu guruh o'quv markazi tomonidan boshqariladi. Qo'shilish uchun markaz menejeriga murojaat qiling." }
  },
  en: {
    title: "Join a Class", subtitle: "Enter the 6-character code from your teacher.", placeholder: "Ex: A1B2C3", btnSend: "Send Request", successTitle: "Request Sent!", successDesc: "Please wait for teacher approval.",
    toasts: { invalid: "Invalid Class Code", joined: "You are already in this class!", pending: "Request already pending.", success: "Request sent successfully!", error: "Something went wrong", centerManaged: "This group is managed by a learning center. Ask the center's manager to enroll you." }
  },
  ru: {
    title: "Вступить в Класс", subtitle: "Введите 6-значный код от учителя.", placeholder: "Напр: A1B2C3", btnSend: "Отправить Запрос", successTitle: "Запрос Отправлен!", successDesc: "Пожалуйста, ожидайте подтверждения учителя.",
    toasts: { invalid: "Неверный код класса", joined: "Вы уже в этом классе!", pending: "Запрос уже отправлен.", success: "Запрос успешно отправлен!", error: "Что-то пошло не так", centerManaged: "Эта группа управляется учебным центром. Для зачисления обратитесь к менеджеру центра." }
  }
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}

export default function JoinClassModal({ isOpen, onClose, lang }: Props) {
  const { user } = useAuth();
  const t = JOIN_TRANSLATIONS[lang] || JOIN_TRANSLATIONS['en'];

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !user) return;
    setLoading(true);

    try {
      // 1. Find the class
      const q = query(collection(db, 'classes'), where('joinCode', '==', code.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        sToast.error(t.toasts.invalid);
        setLoading(false); return;
      }

      const classDoc = snapshot.docs[0];
      const classId = classDoc.id;
      const classData = classDoc.data();

      // 2a. Markaz guruhiga kod bilan qo'shilib bo'lmaydi — faqat menejer
      // qo'shadi (rules ham so'rov yaratishni rad etadi).
      if (classData.centerId) {
        sToast.error(t.toasts.centerManaged);
        setLoading(false); return;
      }

      // 2. Check if already joined
      if (classData.studentIds?.includes(user.uid)) {
        sToast.error(t.toasts.joined);
        setLoading(false); return;
      }

      // 3. Check for pending request
      const requestQ = query(collection(db, 'classes', classId, 'requests'), where('studentId', '==', user.uid));
      const requestSnap = await getDocs(requestQ);

      if (!requestSnap.empty) {
        sToast.reward(t.toasts.pending, '⏳');
        setLoading(false); return;
      }

      // 4. Send Request (Notification logic removed for 100k scale safety)
      await addDoc(collection(db, 'classes', classId, 'requests'), {
        studentId: user.uid,
        studentName: user.displayName || 'Unknown Student',
        studentUsername: user.email?.split('@')[0] || 'student',
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp()
      });

      setStatus('success');
      sToast.success(t.toasts.success);
      setTimeout(() => handleClose(), 2000);
    } catch (error) {
      console.error(error);
      sToast.error(t.toasts.error);
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStatus('idle'); setCode(''); setLoading(false); onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title={t.title}
      sheetOnMobile
      icon={<Tile tone="primary" size="lg"><Hash size={28} strokeWidth={2.5} /></Tile>}
    >
      <p className="mb-6">{t.subtitle}</p>

      {status === 'success' ? (
        <Banner
          status="success"
          icon={<CheckCircle size={20} strokeWidth={2.5} />}
          title={t.successTitle}
          description={t.successDesc}
        />
      ) : (
        <form onSubmit={handleJoin} className="space-y-4 text-left">
          <TextField
            label={t.placeholder}
            value={code}
            maxLength={6}
            autoFocus
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="text-[22px] font-black uppercase tracking-[0.3em]"
          />
          <Button type="submit" size="lg" fullWidth loading={loading} disabled={code.length < 3}>
            {t.btnSend}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
