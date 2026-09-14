// app/(student)/ielts/_components/JoinIeltsModal.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Target, ArrowRight, CheckCircle, Hourglass } from 'lucide-react';
import { Dialog, Button, TextField, Tile, sToast } from '@/components/student-ui';
import { joinGroupByCode } from '@/services/ieltsService';

// --- TRANSLATION DICTIONARY ---
const JOIN_TRANSLATIONS: any = {
  uz: {
    title: "Guruh Kodini Kiriting", subtitle: "O'qituvchingizdan olingan kod",
    fieldLabel: "IELTS Guruh Kodi", hint: "Masalan: I-X8K2",
    join: "Qo'shilish", cancel: "Bekor qilish", close: "Yopish",
    successTitle: "So'rov yuborildi!",
    successDesc: (g: string) => `"${g}" guruhiga so'rov yuborildi. O'qituvchingiz tasdiqlagach, guruh bu sahifada paydo bo'ladi.`,
    pendingTitle: "So'rov allaqachon yuborilgan",
    pendingDesc: (g: string) => `"${g}" guruhiga so'rovingiz o'qituvchida turibdi. Tasdiqlashini kuting.`,
    toasts: { notFound: "Bunday I- kodi topilmadi!", joined: "Siz bu IELTS guruhiga allaqachon a'zosiz!", error: "Xatolik yuz berdi" }
  },
  en: {
    title: "Enter the Group Code", subtitle: "The code you got from your teacher",
    fieldLabel: "IELTS Group Code", hint: "Ex: I-X8K2",
    join: "Join", cancel: "Cancel", close: "Close",
    successTitle: "Request sent!",
    successDesc: (g: string) => `Your request to join "${g}" was sent. Once your teacher approves, the group will appear on this page.`,
    pendingTitle: "Request already sent",
    pendingDesc: (g: string) => `Your request to join "${g}" is waiting for the teacher. Please wait for approval.`,
    toasts: { notFound: "No group found with this I- code!", joined: "You are already a member of this IELTS group!", error: "Something went wrong" }
  },
  ru: {
    title: "Введите Код Группы", subtitle: "Код, полученный от учителя",
    fieldLabel: "Код IELTS Группы", hint: "Например: I-X8K2",
    join: "Присоединиться", cancel: "Отмена", close: "Закрыть",
    successTitle: "Запрос отправлен!",
    successDesc: (g: string) => `Запрос на вступление в «${g}» отправлен. Как только учитель подтвердит, группа появится на этой странице.`,
    pendingTitle: "Запрос уже отправлен",
    pendingDesc: (g: string) => `Ваш запрос в «${g}» уже у учителя. Дождитесь подтверждения.`,
    toasts: { notFound: "Группа с таким I- кодом не найдена!", joined: "Вы уже состоите в этой IELTS группе!", error: "Произошла ошибка" }
  }
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}

export default function JoinIeltsModal({ isOpen, onClose, lang }: Props) {
  const { user } = useAuth();
  const t = JOIN_TRANSLATIONS[lang] || JOIN_TRANSLATIONS['en'];
  const [code, setCode]         = useState('I-');
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<'idle' | 'requested' | 'pending'>('idle');
  const [groupTitle, setGroupTitle] = useState('');

  // ── Reset + close ──────────────────────────────────────────────────────────
  const handleClose = () => {
    setCode('I-');
    setStatus('idle');
    setGroupTitle('');
    setLoading(false);
    onClose();
  };

  // ── Submit (server-side join — the old client Firestore path is blocked by rules) ──
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode.startsWith('I-') || cleanCode.length < 5 || !user) return;

    setLoading(true);
    try {
      const res = await joinGroupByCode(cleanCode);
      setGroupTitle(res.groupTitle || '');
      if (res.status === 'member') {
        // Already enrolled — informational, nothing more to do.
        sToast.success(t.toasts.joined);
        handleClose();
      } else if (res.status === 'pending') {
        setStatus('pending');
      } else {
        setStatus('requested');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      sToast.error(/not\s*found|topilmadi|не найдена/i.test(msg) ? t.toasts.notFound : (msg || t.toasts.error));
    } finally {
      setLoading(false);
    }
  };

  // ── Result states (requested = new success; pending = already waiting) ─────
  if (status !== 'idle') {
    const isPending = status === 'pending';
    return (
      <Dialog
        open={isOpen}
        onClose={handleClose}
        sheetOnMobile
        title={isPending ? t.pendingTitle : t.successTitle}
        icon={
          <Tile tone={isPending ? 'gold' : 'success'} size="lg">
            {isPending
              ? <Hourglass size={30} strokeWidth={2.5} />
              : <CheckCircle size={30} strokeWidth={3} />}
          </Tile>
        }
        actions={
          <Button variant="tonal" tone="primary" onClick={handleClose}>
            {t.close}
          </Button>
        }
      >
        {isPending ? t.pendingDesc(groupTitle) : t.successDesc(groupTitle)}
      </Dialog>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      sheetOnMobile
      title={
        <span className="flex items-center gap-3">
          <Tile tone="primary">
            <Target size={22} strokeWidth={3} />
          </Tile>
          <span className="min-w-0">
            <span className="block leading-tight">{t.title}</span>
            <span className="block text-[12px] font-bold text-on-surface-variant">
              {t.subtitle}
            </span>
          </span>
        </span>
      }
    >
      <form onSubmit={handleJoin} className="flex flex-col gap-4">
        <TextField
          label={t.fieldLabel}
          value={code}
          maxLength={8}
          autoFocus
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="text-center font-mono text-[26px] font-black uppercase tracking-[0.3em]"
          hint={t.hint}
        />

        <Button
          type="submit"
          fullWidth
          loading={loading}
          disabled={code.length < 5}
          icon={<ArrowRight size={20} strokeWidth={3} />}
        >
          {t.join}
        </Button>

        <Button type="button" variant="outlined" fullWidth onClick={handleClose}>
          {t.cancel}
        </Button>
      </form>
    </Dialog>
  );
}
