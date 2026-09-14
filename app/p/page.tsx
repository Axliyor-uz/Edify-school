"use client";

// app/p/page.tsx
//
// **"Farzandlarim" — the parent's own index of the QR codes they have scanned**
// (docs/PARENTS.md).
//
// ⚠️ This page reads NOTHING from the server. The list lives in localStorage
// (app/p/_lib/store.ts) because a parent has no account to hang it on; every row
// is just a token this browser has successfully opened before. Tapping one goes
// to `/p/[token]`, which is where the actual fetch happens.
//
// It exists for the "they can add their students" half of the feature: a parent
// with two children at the center scans both QR codes and switches between them
// here, without either center or parent creating a single credential.

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, QrCode, Trash2, UserRound } from "lucide-react";

import { normalizeParentToken } from "@/lib/parentLinks";
import { PARENT_TEXTS, type ParentLangKey, type ParentT } from "./_lib/i18n";
import {
  childrenServerSnapshot, childrenSnapshot, forgetChild, langServerSnapshot, langSnapshot,
  subscribeChildren, subscribeLang, writeParentLang,
} from "./_lib/store";

export default function ParentHomePage() {
  const router = useRouter();
  // See app/p/_lib/store.ts for why this is a store subscription and not a
  // useEffect that reads localStorage into state.
  const lang = useSyncExternalStore(subscribeLang, langSnapshot, langServerSnapshot) as ParentLangKey;
  const children = useSyncExternalStore(subscribeChildren, childrenSnapshot, childrenServerSnapshot);
  const [code, setCode] = useState("");
  const [badCode, setBadCode] = useState(false);
  const [adding, setAdding] = useState(false);

  const t: ParentT = PARENT_TEXTS[lang];

  /**
   * ⚠️ Accepts a pasted URL as readily as a typed code (`normalizeParentToken`) —
   * a parent forwarded the link in a chat app as often as they read it off the
   * printed card, and pasting `https://…/p/ABCD…` must simply work.
   */
  const open = () => {
    const token = normalizeParentToken(code);
    if (!token) {
      setBadCode(true);
      return;
    }
    router.push(`/p/${token}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
            <QrCode size={16} />
          </span>
          <p className="text-[15px] font-black">{t.appName}</p>

          <div className="ml-auto flex items-center gap-1 rounded-full bg-slate-100 p-1">
            {(["uz", "ru", "en"] as ParentLangKey[]).map((l) => (
              <button
                key={l}
                onClick={() => writeParentLang(l)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase transition-colors ${
                  lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4">
        <h1 className="px-1 text-[20px] font-black">{t.myChildren}</h1>

        {children.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <QrCode size={22} />
            </span>
            <h2 className="mt-3 text-[15px] font-black">{t.noChildren}</h2>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-slate-600">{t.noChildrenBody}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {children.map((child) => (
              <li key={child.token} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                <Link href={`/p/${child.token}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-slate-900 text-white">
                    <UserRound size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-black">{child.name || "—"}</span>
                  </span>
                  <ChevronRight size={18} className="flex-none text-slate-400" />
                </Link>
                <button
                  onClick={() => forgetChild(child.token)}
                  title={t.remove}
                  aria-label={t.remove}
                  className="grid h-9 w-9 flex-none place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[14px] font-black">{t.addChildTitle}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{t.addChildBody}</p>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setBadCode(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") open(); }}
                placeholder={t.codePlaceholder}
                autoCapitalize="characters"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] tracking-wider outline-none focus:border-slate-900"
              />
              <button onClick={open} className="rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white">
                {t.open}
              </button>
            </div>
            {badCode && <p className="mt-2 text-[12px] font-semibold text-rose-600">{t.badCode}</p>}
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-3.5 text-[13.5px] font-bold text-slate-600 hover:border-slate-400"
          >
            <Plus size={17} /> {t.addChild}
          </button>
        )}

        <p className="px-2 pt-2 text-center text-[11.5px] leading-relaxed text-slate-400">{t.footer}</p>
      </div>
    </main>
  );
}
