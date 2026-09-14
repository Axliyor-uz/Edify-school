'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, getDocs,
  doc, writeBatch, limit, updateDoc
} from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import {
  Bell, Check, FileText, UserPlus, Trophy, Eye, Clock,
  Trash2, Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Button, Chip, EmptyState, ListGroup, ListRow, LoadingState,
  Page, PageHeader, Stack, Tile, cn,
} from '@/components/student-ui';
import { useStudentLanguage } from '@/app/(student)/layout';

// ============================================================================
// 🟢 1. GLOBAL CACHE (0 Reads on Tab Switch)
// ============================================================================
const globalNotificationsCache: Record<string, { notifications: any[], timestamp: number }> = {};
const CACHE_LIFESPAN = 60 * 1000; // 60 seconds

// --- TRANSLATION DICTIONARY ---
const NOTIF_TRANSLATIONS: any = {
  uz: {
    title: "Bildirishnomalar", subtitle: "Faollik va yangilanishlar",
    dismiss: "O'qilgan qilish", clear: "Tozalash",
    emptyTitle: "Hammasi ko'rib chiqildi!", emptyDesc: "Sizda yangi bildirishnomalar yo'q.",
    time: { now: "Hozirgina", view: "Batafsil" },
    confirmClear: "Barcha bildirishnomalarni o'chirasizmi? Bu amalni qaytarib bo'lmaydi.", newBadge: "YANGI"
  },
  en: {
    title: "Inbox", subtitle: "Your activity & updates",
    dismiss: "Mark Read", clear: "Clear",
    emptyTitle: "All caught up!", emptyDesc: "You have no new notifications.",
    time: { now: "Just now", view: "View Details" },
    confirmClear: "Clear all notifications? This cannot be undone.", newBadge: "NEW"
  },
  ru: {
    title: "Входящие", subtitle: "Активность и обновления",
    dismiss: "Прочитано", clear: "Очистить",
    emptyTitle: "Все прочитано!", emptyDesc: "У вас нет новых уведомлений.",
    time: { now: "Только что", view: "Подробнее" },
    confirmClear: "Очистить все? Это нельзя отменить.", newBadge: "НОВОЕ"
  }
};

interface Notification {
  id: string;
  title: string;
  message: string;
  // Must mirror services/notificationService.ts NotificationType — only types
  // an emitter actually sends: 'assignment' (AssignTestModal), 'request'
  // (follow), 'levelup' (lib/xp.ts). 'general' renders the default bell.
  type: 'assignment' | 'request' | 'levelup' | 'general';
  read: boolean;
  link?: string;
  createdAt: any;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = NOTIF_TRANSLATIONS[lang] || NOTIF_TRANSLATIONS['en'];

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // 🟢 2. SWR FETCH LOGIC (Replaces onSnapshot)
  // ============================================================================
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async (silent = false) => {
      const cached = globalNotificationsCache[user.uid];
      const now = Date.now();

      if (cached && !silent) {
        setNotifications(cached.notifications);
        setLoading(false);
        if (now - cached.timestamp < CACHE_LIFESPAN) return;
      }

      if (!silent) setLoading(true);

      try {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));

        setNotifications(data);
        globalNotificationsCache[user.uid] = { notifications: data, timestamp: Date.now() };
      } catch (e) {
        console.error("Error fetching notifications:", e);
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchNotifications();
  }, [user]);

  // ============================================================================
  // 🟢 3. ACTIONS (Optimistic UI Updates)
  // ============================================================================
  const handleRead = async (notification: Notification) => {
    if (notification.link) router.push(notification.link);

    if (!notification.read) {
      // Optimistic Update
      const updated = notifications.map(n => n.id === notification.id ? { ...n, read: true } : n);
      setNotifications(updated);
      if (globalNotificationsCache[user!.uid]) globalNotificationsCache[user!.uid].notifications = updated;

      try {
        await updateDoc(doc(db, 'notifications', notification.id), { read: true });
      } catch (e) { console.error(e); }
    }
  };

  const markAllRead = async () => {
    // Optimistic Update
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    if (globalNotificationsCache[user!.uid]) globalNotificationsCache[user!.uid].notifications = updated;

    const batch = writeBatch(db);
    let hasUpdates = false;

    notifications.forEach(n => {
      if (!n.read) {
        batch.update(doc(db, 'notifications', n.id), { read: true });
        hasUpdates = true;
      }
    });

    if (hasUpdates) await batch.commit();
  };

  const clearAll = async () => {
    if (!confirm(t.confirmClear)) return;

    // Optimistic Update
    setNotifications([]);
    if (globalNotificationsCache[user!.uid]) globalNotificationsCache[user!.uid].notifications = [];

    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  // --- ICONS (one tonal tile per notification type) ---
  const getIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <Tile tone="secondary"><FileText size={20} strokeWidth={2.5}/></Tile>;
      case 'request': return <Tile tone="primary"><UserPlus size={20} strokeWidth={2.5}/></Tile>;
      case 'levelup': return <Tile tone="gold"><Trophy size={20} strokeWidth={2.5}/></Tile>;
      default: return <Tile tone="neutral"><Bell size={20} strokeWidth={2.5}/></Tile>;
    }
  };

  const getTimeString = (timestamp: any) => {
    if (!timestamp) return t.time.now;
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <Page>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <LoadingState rows={4} />
    </Page>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Page>
      <PageHeader
        title={t.title}
        subtitle={
          <>
            {t.subtitle} {unreadCount > 0 && <span className="text-primary">• {unreadCount} New</span>}
          </>
        }
        actions={
          <>
            <Button
              variant="outlined"
              size="sm"
              icon={<Check size={16} strokeWidth={3} />}
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              {t.dismiss}
            </Button>
            <Button
              variant="tonal"
              tone="error"
              size="sm"
              icon={<Trash2 size={16} strokeWidth={3} />}
              onClick={clearAll}
              disabled={notifications.length === 0}
            >
              {t.clear}
            </Button>
          </>
        }
      />

      <Stack>
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={30} strokeWidth={2.5} />}
            title={t.emptyTitle}
            description={t.emptyDesc}
          />
        ) : (
          <ListGroup>
            {notifications.map((n) => (
              <ListRow
                key={n.id}
                clickable
                onClick={() => handleRead(n)}
                leading={
                  // Unread is marked on the tile rather than as a row background:
                  // the kit's translucent hover layer replaces a row's own
                  // background, so a tinted row would flash back to plain surface.
                  <div className="relative shrink-0">
                    {getIcon(n.type)}
                    {!n.read && (
                      <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                    )}
                  </div>
                }
                title={
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('truncate', !n.read && 'text-primary')}>{n.title}</span>
                    {!n.read && <Chip status="primary">{t.newBadge}</Chip>}
                  </span>
                }
                subtitle={<span className="line-clamp-2 whitespace-normal">{n.message}</span>}
                trailing={
                  <div className="flex shrink-0 flex-col items-end gap-1 pl-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-on-surface-variant">
                      <Clock size={12} strokeWidth={2.5} />
                      <span className="s-num">{getTimeString(n.createdAt)}</span>
                    </span>
                    {n.link && (
                      <span className="hidden items-center gap-1 text-[11px] font-black text-primary sm:inline-flex">
                        {t.time.view} <Eye size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                }
              />
            ))}
          </ListGroup>
        )}
      </Stack>
    </Page>
  );
}
