"use client";

// app/manager/parents/_components/ParentQrDialog.tsx
//
// **The QR the parent scans** — issued, shown, printed and revoked here
// (docs/PARENTS.md). Used from two places: the Parents page and the student info
// dialog, which is why it owns the whole flow (issue → show → print) rather than
// receiving a finished link.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy, Link2, Loader2, MessageSquare, Printer, QrCode, RotateCcw, Send, Share2, ShieldOff, Smartphone,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button, Dialog, Switch, cn } from "@/components/manager-ui";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";
import { createParentLink, patchParentLink } from "@/services/parentLinkService";
import {
  DEFAULT_PARENT_SCOPE, formatParentToken, parentLinkUrl, smsShareUrl, telegramShareUrl,
} from "@/lib/parentLinks";
import type { ParentLink, ParentScope } from "@/types/Parent";

const TR = {
  uz: {
    titleNew: "Ota-onaga QR",
    titleShow: "Ota-ona havolasi",
    descNew: (name: string) => `${name} uchun yangi havola. Ota-ona QR ni skanerlaydi — ro'yxatdan o'tish shart emas.`,
    descShow: "Ota-ona shu QR ni skanerlaydi va faqat shu farzandining natijalarini ko'radi.",
    label: "Kimga beriladi",
    labelPlaceholder: "Onasi / Otasi / Buvisi",
    scope: "Nimalarni ko'rsatamiz",
    scopeResults: "Natijalar va o'sish",
    scopeLevels: "Daraja va imtihonlar",
    scopeAttendance: "Davomat",
    scopeFinance: "To'lovlar va qarz",
    financeHint: "Havola boshqa odamga yuborilsa, oiladagi qarz ham ko'rinadi.",
    create: "QR yaratish",
    creating: "Yaratilmoqda...",
    copy: "Havolani nusxalash",
    copied: "Havola nusxalandi.",
    print: "Chop etish",
    telegram: "Telegram",
    sms: "SMS",
    share: "Ulashish",
    shareText: (name: string) => `${name}ning natijalari — Edify`,
    oneDevice: "Bitta havola — bitta qurilma. Uni birinchi ochgan odam ulanadi.",
    replaceWarn: "Diqqat: bu o'quvchining eski havolasi bekor qilinadi.",
    replaced: (n: number) => `Eski havola bekor qilindi (${n} ta).`,
    connected: "Ulangan",
    notConnected: "Hali hech kim ochmagan",
    connectedOn: "ulangan",
    unbind: "Qurilmani almashtirish",
    unbindHint: "Ota-ona telefonini almashtirgan bo'lsa bosing — shu QR yana ishlaydi.",
    unbound: "Havola bo'shatildi. Endi uni yangi qurilma ochishi mumkin.",
    revoke: "Bekor qilish",
    restore: "Qayta faollashtirish",
    revoked: "Havola bekor qilindi.",
    restored: "Havola qayta faollashtirildi.",
    revokedBadge: "Bekor qilingan",
    error: "Xatolik yuz berdi.",
    scanTitle: "Farzandingiz natijalari",
    scanHelp: "Telefon kamerasi bilan skanerlang",
    codeHint: "Kamera ishlamasa, saytga kirib shu kodni kiriting:",
    saveNote: "Havolani saqlab qo'ying — u faqat siz uchun.",
    close: "Yopish",
  },
  ru: {
    titleNew: "QR для родителя",
    titleShow: "Родительская ссылка",
    descNew: (name: string) => `Новая ссылка для ${name}. Родитель сканирует QR — регистрация не нужна.`,
    descShow: "Родитель сканирует этот QR и видит результаты только своего ребёнка.",
    label: "Кому выдаётся",
    labelPlaceholder: "Мама / Папа / Бабушка",
    scope: "Что показываем",
    scopeResults: "Результаты и прогресс",
    scopeLevels: "Уровень и экзамены",
    scopeAttendance: "Посещаемость",
    scopeFinance: "Платежи и долг",
    financeHint: "Если ссылку перешлют, долг семьи увидит и посторонний.",
    create: "Создать QR",
    creating: "Создаётся...",
    copy: "Копировать ссылку",
    copied: "Ссылка скопирована.",
    print: "Печать",
    telegram: "Telegram",
    sms: "SMS",
    share: "Поделиться",
    shareText: (name: string) => `Результаты ${name} — Edify`,
    oneDevice: "Одна ссылка — одно устройство. Подключается тот, кто откроет её первым.",
    replaceWarn: "Внимание: старая ссылка этого ученика будет отозвана.",
    replaced: (n: number) => `Старая ссылка отозвана (${n}).`,
    connected: "Подключено",
    notConnected: "Ещё никто не открывал",
    connectedOn: "подключено",
    unbind: "Сменить устройство",
    unbindHint: "Нажмите, если родитель сменил телефон — тот же QR снова заработает.",
    unbound: "Ссылка освобождена. Теперь её может открыть новое устройство.",
    revoke: "Отозвать",
    restore: "Восстановить",
    revoked: "Ссылка отозвана.",
    restored: "Ссылка восстановлена.",
    revokedBadge: "Отозвана",
    error: "Произошла ошибка.",
    scanTitle: "Результаты вашего ребёнка",
    scanHelp: "Отсканируйте камерой телефона",
    codeHint: "Если камера не работает, откройте сайт и введите код:",
    saveNote: "Сохраните ссылку — она только для вас.",
    close: "Закрыть",
  },
  en: {
    titleNew: "Parent QR",
    titleShow: "Parent link",
    descNew: (name: string) => `A new link for ${name}. The parent scans the QR — no signup needed.`,
    descShow: "The parent scans this QR and sees only this child's results.",
    label: "Given to",
    labelPlaceholder: "Mother / Father / Grandparent",
    scope: "What to show",
    scopeResults: "Results and progress",
    scopeLevels: "Level and exams",
    scopeAttendance: "Attendance",
    scopeFinance: "Payments and balance",
    financeHint: "If the link is forwarded, the family's balance goes with it.",
    create: "Create QR",
    creating: "Creating...",
    copy: "Copy link",
    copied: "Link copied.",
    print: "Print",
    telegram: "Telegram",
    sms: "SMS",
    share: "Share",
    shareText: (name: string) => `${name}'s results — Edify`,
    oneDevice: "One link, one device. Whoever opens it first becomes the connected parent.",
    replaceWarn: "Careful: this student's existing link will be revoked.",
    replaced: (n: number) => `The previous link was revoked (${n}).`,
    connected: "Connected",
    notConnected: "Nobody has opened it yet",
    connectedOn: "connected",
    unbind: "Change device",
    unbindHint: "Press this if the parent changed phone — the same QR works again.",
    unbound: "The link is free again. A new device can now open it.",
    revoke: "Revoke",
    restore: "Restore",
    revoked: "Link revoked.",
    restored: "Link restored.",
    revokedBadge: "Revoked",
    error: "Something went wrong.",
    scanTitle: "Your child's results",
    scanHelp: "Scan with your phone camera",
    codeHint: "If the camera fails, open the site and enter this code:",
    saveNote: "Keep the link — it is meant for you only.",
    close: "Close",
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Issue mode: the student a new link is for. */
  student?: { id: string; name: string };
  /** Show mode: an existing link. Wins over `student` when both are given. */
  link?: ParentLink | null;
  /** Called after an issue/revoke/restore so the caller can refresh its list. */
  onChanged?: (link: ParentLink) => void;
  /**
   * True when this student already has a live link. ⚠️ Issuing another one
   * REVOKES it (one child ⇒ one connected person), so the dialog warns first.
   */
  hasActive?: boolean;
}

export default function ParentQrDialog({ open, onClose, student, link, onChanged, hasActive }: Props) {
  const { lang } = useManagerLanguage();
  const t = TR[lang] || TR.uz;

  const [current, setCurrent] = useState<ParentLink | null>(link ?? null);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<ParentScope>(DEFAULT_PARENT_SCOPE);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent(link ?? null);
    setLabel(link?.label ?? "");
    setScope(link?.scope ?? DEFAULT_PARENT_SCOPE);
    setQr("");
  }, [open, link]);

  // ⚠️ Guarded: this client component is still PRE-RENDERED on the server, where
  // `window` does not exist. The origin comes from the browser rather than an env
  // var so a link made on staging points at staging (see `parentLinkUrl`).
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = current ? parentLinkUrl(origin, current.token) : "";

  // ⚠️ The QR encoder is loaded ONLY when a dialog actually has a link to draw.
  // A static import would put it in the manager panel's shared chunk for every
  // page, and the overwhelming majority of manager sessions never issue a QR.
  useEffect(() => {
    if (!open || !current) return;
    let alive = true;
    import("qrcode")
      .then((mod) =>
        mod.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 512 }),
      )
      .then((data) => { if (alive) setQr(data); })
      .catch(() => { if (alive) setQr(""); });
    return () => { alive = false; };
  }, [open, current, url]);

  const issue = useCallback(async () => {
    if (!student) return;
    setBusy(true);
    try {
      const { link: created, replaced } = await createParentLink({ studentId: student.id, label, scope });
      setCurrent(created);
      onChanged?.(created);
      if (replaced > 0) toast.success(t.replaced(replaced));
    } catch (err) {
      toast.error((err as Error).message || t.error);
    } finally {
      setBusy(false);
    }
  }, [student, label, scope, onChanged, t]);

  /**
   * A scope toggle on an ALREADY-ISSUED link saves immediately.
   *
   * ⚠️ That is the point: a manager who realizes a printed QR should not have
   * been showing money must be able to close that off without reprinting the
   * card and chasing the parent for the old one. The next report the parent
   * loads simply has no finance block (the route stops fetching it).
   */
  const updateScope = useCallback(async (next: ParentScope) => {
    const previous = scope;
    setScope(next);
    if (!current) return;
    try {
      const updated = await patchParentLink(current.token, { scope: next });
      setCurrent(updated);
      onChanged?.(updated);
    } catch (err) {
      setScope(previous);
      toast.error((err as Error).message || t.error);
    }
  }, [current, onChanged, scope, t]);

  const toggleStatus = useCallback(async () => {
    if (!current) return;
    const next = current.status === "active" ? "revoked" : "active";
    setBusy(true);
    try {
      const updated = await patchParentLink(current.token, { status: next });
      setCurrent(updated);
      onChanged?.(updated);
      toast.success(next === "revoked" ? t.revoked : t.restored);
    } catch (err) {
      toast.error((err as Error).message || t.error);
    } finally {
      setBusy(false);
    }
  }, [current, onChanged, t]);

  /** Free the link so a NEW phone can claim the same QR (docs/PARENTS.md). */
  const unbind = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    try {
      const updated = await patchParentLink(current.token, { unbind: true });
      setCurrent(updated);
      onChanged?.(updated);
      toast.success(t.unbound);
    } catch (err) {
      toast.error((err as Error).message || t.error);
    } finally {
      setBusy(false);
    }
  }, [current, onChanged, t]);

  const shareText = t.shareText(current?.studentName || student?.name || "");

  /**
   * The phone's own share sheet, when the browser has one.
   *
   * ⚠️ Best on a phone (the manager is often standing at the desk with one), and
   * absent on most desktops — which is why Telegram and SMS are their own
   * buttons rather than hidden behind this.
   */
  const nativeShare = () => {
    navigator.share?.({ title: shareText, text: shareText, url }).catch(() => {});
  };

  const copy = () => {
    navigator.clipboard.writeText(url).then(
      () => toast.success(t.copied),
      () => toast.error(t.error),
    );
  };

  /**
   * Print just the card.
   *
   * ⚠️ A new window with inlined markup, NOT `window.print()` on the panel: the
   * manager panel is a fixed-height app shell with a sidebar, and printing it
   * yields a page of chrome with the QR cropped off the bottom.
   */
  const print = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const win = window.open("", "_blank", "width=520,height=720");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>${t.scanTitle}</title>` +
        `<style>body{font-family:system-ui,sans-serif;margin:0;padding:28px;text-align:center;color:#0f172a}` +
        `img{width:260px;height:260px}h1{font-size:19px;margin:14px 0 4px}p{font-size:13px;margin:4px 0;color:#475569}` +
        `code{font-size:15px;letter-spacing:1px;font-weight:700}</style></head><body>${html}</body></html>`,
    );
    win.document.close();
    win.focus();
    // The image is a data: URI, so it is already decoded — but give the new
    // document one frame to lay out before the print dialog freezes it.
    setTimeout(() => win.print(), 250);
  };

  const scopeRow = (key: keyof ParentScope, text: string, hint?: string) => (
    <label key={key} className="flex items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-on-surface">{text}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] leading-snug text-on-surface-variant">{hint}</span>}
      </span>
      <Switch
        checked={scope[key]}
        onChange={(e) => updateScope({ ...scope, [key]: e.target.checked })}
      />
    </label>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={current ? t.titleShow : t.titleNew}
      description={current ? t.descShow : student ? t.descNew(student.name) : ""}
      icon={<QrCode size={20} />}
      actions={
        current ? (
          <>
            <Button variant="text" onClick={onClose}>{t.close}</Button>
            <Button
              variant="tonal"
              onClick={toggleStatus}
              disabled={busy}
              icon={current.status === "active" ? <ShieldOff size={16} /> : <RotateCcw size={16} />}
            >
              {current.status === "active" ? t.revoke : t.restore}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={onClose}>{t.close}</Button>
            <Button onClick={issue} loading={busy} disabled={!student} icon={<QrCode size={16} />}>
              {busy ? t.creating : t.create}
            </Button>
          </>
        )
      }
    >
      {!current ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-m3-md bg-surface-container-low px-3 py-2 text-[12px] font-medium leading-relaxed text-on-surface-variant">
            <Smartphone size={14} className="mt-0.5 flex-none" /> {t.oneDevice}
          </p>

          {hasActive && (
            <p className="rounded-m3-md bg-error-container px-3 py-2 text-[12.5px] font-bold leading-relaxed text-on-error-container">
              {t.replaceWarn}
            </p>
          )}

          <div>
            <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">
              {t.label}
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t.labelPlaceholder}
              maxLength={40}
              className="w-full rounded-m3-md border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="rounded-m3-lg border border-outline-variant p-3">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">{t.scope}</p>
            <div className="divide-y divide-outline-variant">
              {scopeRow("results", t.scopeResults)}
              {scopeRow("levels", t.scopeLevels)}
              {scopeRow("attendance", t.scopeAttendance)}
              {scopeRow("finance", t.scopeFinance, t.financeHint)}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {current.status !== "active" && (
            <p className="rounded-m3-md bg-error-container px-3 py-2 text-center text-[12.5px] font-bold text-on-error-container">
              {t.revokedBadge}
            </p>
          )}

          {/* The printable card — everything inside is what lands on paper. */}
          <div ref={printRef} className="rounded-m3-lg border border-outline-variant bg-surface-container-lowest p-4 text-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR" className={cn("mx-auto h-52 w-52", current.status !== "active" && "opacity-40")} />
            ) : (
              <div className="mx-auto flex h-52 w-52 items-center justify-center">
                <Loader2 className="animate-spin text-on-surface-variant" size={26} />
              </div>
            )}
            <h1 className="mt-3 text-[15px] font-bold text-on-surface">{current.studentName}</h1>
            <p className="text-[12.5px] text-on-surface-variant">{t.scanHelp}</p>
            <p className="mt-2 text-[11.5px] text-on-surface-variant">{t.codeHint}</p>
            <code className="text-[13px] font-black tracking-wider text-on-surface">
              {formatParentToken(current.token)}
            </code>
            <p className="mt-2 text-[11px] text-on-surface-variant">{t.saveNote}</p>
          </div>

          {/* Who is connected — the whole point of the one-device rule. */}
          <div className="flex flex-wrap items-center gap-2 rounded-m3-lg border border-outline-variant px-3 py-2.5">
            <Smartphone size={15} className="flex-none text-on-surface-variant" />
            {current.deviceHash ? (
              <span className="min-w-0 flex-1 text-[12.5px] font-bold text-on-surface">
                {t.connected}
                <span className="ml-1 font-medium text-on-surface-variant">
                  · {current.claimedDevice || ""}
                  {current.claimedAt ? ` · ${new Date(current.claimedAt).toLocaleDateString()} ${t.connectedOn}` : ""}
                </span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-on-surface-variant">{t.notConnected}</span>
            )}
            {current.deviceHash && (
              <Button variant="text" size="sm" onClick={unbind} disabled={busy} icon={<RotateCcw size={14} />}>
                {t.unbind}
              </Button>
            )}
          </div>
          {current.deviceHash && (
            <p className="-mt-1 px-1 text-[11.5px] leading-relaxed text-on-surface-variant">{t.unbindHint}</p>
          )}

          {/* Delivery: hand the phone over, or send the link to the ONE parent. */}
          <div className="flex flex-wrap gap-2">
            <a
              href={telegramShareUrl(url, shareText)}
              target="_blank"
              rel="noreferrer"
              className="m3-interactive inline-flex items-center gap-1.5 rounded-full bg-primary py-2 pl-3.5 pr-4 text-[12.5px] font-bold text-on-primary"
            >
              <Send size={15} /> {t.telegram}
            </a>
            <a
              href={smsShareUrl(url, shareText)}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3.5 py-2 text-[12.5px] font-bold text-on-secondary-container hover:brightness-95"
            >
              <MessageSquare size={15} /> {t.sms}
            </a>
            {typeof navigator !== "undefined" && !!navigator.share && (
              <Button variant="tonal" size="sm" onClick={nativeShare} icon={<Share2 size={15} />}>{t.share}</Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="tonal" size="sm" onClick={copy} icon={<Copy size={15} />}>{t.copy}</Button>
            <Button variant="tonal" size="sm" onClick={print} icon={<Printer size={15} />}>{t.print}</Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3.5 py-2 text-[12.5px] font-bold text-on-surface hover:bg-state-hover"
            >
              <Link2 size={15} /> /p
            </a>
          </div>

          {/* Still editable after issuing — see `updateScope`. */}
          <div className="rounded-m3-lg border border-outline-variant p-3">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">{t.scope}</p>
            <div className="divide-y divide-outline-variant">
              {scopeRow("results", t.scopeResults)}
              {scopeRow("levels", t.scopeLevels)}
              {scopeRow("attendance", t.scopeAttendance)}
              {scopeRow("finance", t.scopeFinance, t.financeHint)}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
