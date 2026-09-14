"use client";

// app/manager/parents/page.tsx
//
// **Ota-onalar — every parent QR the center has issued, in one place**
// (docs/PARENTS.md). The student info dialog can issue one link for one child;
// this page is the overview: who has access, when they last opened it, and the
// one button that takes it away.
//
// ⚠️ The roster comes from `center_students` (the membership anchor, see
// docs/MANAGER.md) — NOT from class rosters, or a student in a center with no
// group ("Guruhsiz") would have no way to get a parent link.

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Eye, Loader2, QrCode, ShieldCheck, ShieldOff, Smartphone, UserRound, Users } from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { fetchParentLinks } from "@/services/parentLinkService";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import { Card, EmptyState, SearchBar, StatTile, cn } from "@/components/manager-ui";
import type { ParentLink } from "@/types/Parent";
import ParentQrDialog from "./_components/ParentQrDialog";

const TRANSLATIONS = {
  uz: {
    title: "Ota-onalar",
    subtitle: "Ota-ona QR havolalari — kim ko'ra oladi va qachon ochgan.",
    statStudents: "O'quvchilar",
    statWithAccess: "Havolasi bor",
    statLinks: "Faol havolalar",
    statRevoked: "Bekor qilingan",
    search: "O'quvchi ismi bo'yicha qidirish...",
    all: "Hammasi",
    withAccess: "Havolasi bor",
    without: "Havolasi yo'q",
    newQr: "QR yaratish",
    noLinks: "Havola berilmagan",
    active: "Faol",
    revoked: "Bekor qilingan",
    neverOpened: "Hali ochilmagan",
    waiting: "kutilmoqda",
    connectedShort: "ulangan",
    statConnected: "Ulangan qurilma",
    opened: (n: number) => `${n} marta ochilgan`,
    lastOpened: "oxirgi:",
    emptyTitle: "O'quvchilar yo'q",
    emptyDesc: "Markazda hali o'quvchi yo'q. Avval o'quvchi qo'shing.",
    noResults: "Topilmadi",
    noResultsDesc: "Qidiruv yoki filtrga mos o'quvchi yo'q.",
    loadError: "Havolalarni yuklab bo'lmadi.",
    hint: "Ota-ona ro'yxatdan o'tmaydi — QR ni skanerlaydi va faqat o'z farzandining ma'lumotlarini ko'radi.",
  },
  ru: {
    title: "Родители",
    subtitle: "QR-ссылки для родителей — кто имеет доступ и когда открывал.",
    statStudents: "Ученики",
    statWithAccess: "Со ссылкой",
    statLinks: "Активные ссылки",
    statRevoked: "Отозванные",
    search: "Поиск по имени ученика...",
    all: "Все",
    withAccess: "Со ссылкой",
    without: "Без ссылки",
    newQr: "Создать QR",
    noLinks: "Ссылка не выдана",
    active: "Активна",
    revoked: "Отозвана",
    neverOpened: "Ещё не открывали",
    waiting: "ожидает",
    connectedShort: "подключено",
    statConnected: "Подключено устройств",
    opened: (n: number) => `Открыто ${n} раз`,
    lastOpened: "последний:",
    emptyTitle: "Учеников нет",
    emptyDesc: "В центре пока нет учеников. Сначала добавьте ученика.",
    noResults: "Не найдено",
    noResultsDesc: "Нет учеников по этому поиску или фильтру.",
    loadError: "Не удалось загрузить ссылки.",
    hint: "Родитель не регистрируется — сканирует QR и видит только данные своего ребёнка.",
  },
  en: {
    title: "Parents",
    subtitle: "Parent QR links — who has access and when they last opened it.",
    statStudents: "Students",
    statWithAccess: "With a link",
    statLinks: "Active links",
    statRevoked: "Revoked",
    search: "Search by student name...",
    all: "All",
    withAccess: "With a link",
    without: "No link",
    newQr: "Create QR",
    noLinks: "No link issued",
    active: "Active",
    revoked: "Revoked",
    neverOpened: "Never opened",
    waiting: "waiting",
    connectedShort: "connected",
    statConnected: "Connected devices",
    opened: (n: number) => `Opened ${n}×`,
    lastOpened: "last:",
    emptyTitle: "No students",
    emptyDesc: "This center has no students yet. Add a student first.",
    noResults: "Nothing found",
    noResultsDesc: "No student matches the search or filter.",
    loadError: "Could not load the links.",
    hint: "A parent never signs up — they scan the QR and see only their own child's data.",
  },
};
type PageT = typeof TRANSLATIONS.uz;

interface RosterStudent {
  id: string;
  name: string;
}

type Filter = "all" | "with" | "without";

export default function ManagerParentsPage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];

  const [centerId, setCenterId] = useState<string | null>(null);
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [issueFor, setIssueFor] = useState<RosterStudent | null>(null);
  const [showLink, setShowLink] = useState<ParentLink | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const load = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const [rosterSnap, issued] = await Promise.all([
        getDocs(query(collection(db, "center_students"), where("centerId", "==", centerId))),
        fetchParentLinks(),
      ]);
      setStudents(
        rosterSnap.docs
          .map((d) => ({ id: String(d.data().studentId), name: String(d.data().studentName || "") }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setLinks(issued);
    } catch (err) {
      console.error(err);
      toast.error(t.loadError);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [centerId, t.loadError]);

  useEffect(() => { load(); }, [load]);

  /** One link list per student — the page's whole join, done once. */
  const byStudent = useMemo(() => {
    const map = new Map<string, ParentLink[]>();
    for (const link of links) {
      const list = map.get(link.studentId) || [];
      list.push(link);
      map.set(link.studentId, list);
    }
    return map;
  }, [links]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students || []).filter((s) => {
      if (term && !s.name.toLowerCase().includes(term)) return false;
      const active = (byStudent.get(s.id) || []).some((l) => l.status === "active");
      if (filter === "with") return active;
      if (filter === "without") return !active;
      return true;
    });
  }, [students, search, filter, byStudent]);

  const stats = useMemo(() => {
    const active = links.filter((l) => l.status === "active");
    return {
      students: students?.length ?? 0,
      withAccess: new Set(active.map((l) => l.studentId)).size,
      // ⚠️ CONNECTED, not "issued": a QR nobody has opened yet is not access.
      links: active.filter((l) => l.deviceHash).length,
      revoked: links.length - active.length,
    };
  }, [links, students]);

  /**
   * Any dialog change (issue, revoke, restore, scope, unbind) updates the list.
   *
   * ⚠️ An ACTIVE link also revokes the student's others locally — the server did
   * exactly that in the same batch (one child ⇒ one connected person), and a list
   * still showing two live links for one child would be a lie.
   */
  const onChanged = (link: ParentLink) => {
    setLinks((prev) => [
      link,
      ...prev
        .filter((l) => l.token !== link.token)
        .map((l) =>
          link.status === "active" && l.studentId === link.studentId && l.status === "active"
            ? { ...l, status: "revoked" as const, revokedAt: Date.now() }
            : l,
        ),
    ]);
    setShowLink((prev) => (prev && prev.token === link.token ? link : prev));
  };

  const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString(lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "uz-UZ") : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-on-surface md:text-2xl">
            <Users className="text-primary" size={24} /> {t.title}
          </h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<UserRound size={18} />} label={t.statStudents} value={stats.students} tone="secondary" />
        <StatTile icon={<ShieldCheck size={18} />} label={t.statWithAccess} value={stats.withAccess} tone="success" />
        <StatTile icon={<Smartphone size={18} />} label={t.statConnected} value={stats.links} tone="primary" />
        <StatTile icon={<ShieldOff size={18} />} label={t.statRevoked} value={stats.revoked} tone="tertiary" />
      </div>

      <p className="rounded-m3-lg bg-surface-container-low px-4 py-3 text-[12.5px] font-medium leading-relaxed text-on-surface-variant">
        {t.hint}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} />
        </div>
        {([["all", t.all], ["with", t.withAccess], ["without", t.without]] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              filter === key
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant text-on-surface hover:bg-state-hover",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-on-surface-variant" size={30} />
        </div>
      ) : (students?.length ?? 0) === 0 ? (
        <EmptyState icon={<Users size={26} />} title={t.emptyTitle} description={t.emptyDesc} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={26} />} title={t.noResults} description={t.noResultsDesc} />
      ) : (
        <div className="space-y-2">
          {rows.map((student) => {
            const studentLinks = (byStudent.get(student.id) || []).sort((a, b) => b.createdAt - a.createdAt);
            return (
              <Card key={student.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary-container text-on-primary-container">
                  <UserRound size={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-on-surface">{student.name}</p>
                  {studentLinks.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant">{t.noLinks}</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {studentLinks.map((link) => (
                        <button
                          key={link.token}
                          onClick={() => setShowLink(link)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors",
                            link.status === "active"
                              ? "border-success/40 bg-success-container text-on-success-container hover:brightness-95"
                              : "border-outline-variant text-on-surface-variant line-through hover:bg-state-hover",
                          )}
                          title={link.lastViewedAt ? `${t.lastOpened} ${fmtDate(link.lastViewedAt)}` : t.neverOpened}
                        >
                          <QrCode size={12} />
                          {link.label || (link.status === "active" ? t.active : t.revoked)}
                          {/* Connected ⇒ a device has claimed it; otherwise the
                              QR is still waiting for its one parent. */}
                          {link.status === "active" && (
                            <span className="inline-flex items-center gap-0.5 opacity-80" title={link.claimedDevice || t.waiting}>
                              <Smartphone size={11} />
                              {link.deviceHash ? (link.claimedDevice || t.connectedShort) : t.waiting}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5 opacity-70">
                            <Eye size={11} />
                            {link.viewCount || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIssueFor(student)}
                  className="m3-interactive inline-flex flex-none items-center gap-2 rounded-full bg-primary py-2 pl-3.5 pr-4 text-[12.5px] font-bold text-on-primary"
                >
                  <QrCode size={15} /> {t.newQr}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <ParentQrDialog
        open={!!issueFor}
        onClose={() => setIssueFor(null)}
        student={issueFor ? { id: issueFor.id, name: issueFor.name } : undefined}
        // ⚠️ Issuing revokes the child's existing link — the dialog says so.
        hasActive={!!issueFor && (byStudent.get(issueFor.id) || []).some((l) => l.status === "active")}
        onChanged={onChanged}
      />
      <ParentQrDialog
        open={!!showLink}
        onClose={() => setShowLink(null)}
        link={showLink}
        onChanged={onChanged}
      />
    </div>
  );
}
