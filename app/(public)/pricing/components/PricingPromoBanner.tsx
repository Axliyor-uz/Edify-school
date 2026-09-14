'use client';

import React, { useContext } from 'react';
import Link from 'next/link';
import { Sparkles, ChevronRight } from 'lucide-react';
// Uses the same language context as your navbar. Keep this file next to layout.tsx
// (e.g. app/(public)/PricingPromoBanner.tsx). Adjust the path if it lives elsewhere.
import { LanguageContext } from '../../layout';

/* =========================================================================
   EDIFY — Slim promo banner that links to the pricing builder page.
   Drop it in at the very top of your landing <main>:

       import PricingPromoBanner from './PricingPromoBanner';
       ...
       <main className="flex-1 pt-24 lg:pt-16 relative z-10">
         <PricingPromoBanner />          {/* <- add this line */
//        ...rest of the page

//  Optional prop: <PricingPromoBanner href="/pricing" />
//  ========================================================================= */

type Lang = 'uz' | 'en' | 'ru';

const COPY: Record<Lang, { badge: string; text: string; cta: string }> = {
  uz: { badge: "YANGI", text: "Modullardan o'zingizga mos tarifni yig'ing — narx real vaqtda hisoblanadi.", cta: "Narxlarni ko'rish" },
  ru: { badge: "НОВОЕ", text: "Соберите свой тариф из модулей — цена считается в реальном времени.", cta: "Смотреть цены" },
  en: { badge: "NEW", text: "Build your own plan from modules — the price updates in real time.", cta: "See pricing" },
};

export default function PricingPromoBanner({ href = '/pricing' }: { href?: string }) {
  const ctx = useContext(LanguageContext);
  const lang: Lang = (ctx?.lang ?? 'uz') as Lang;
  const t = COPY[lang];

  return (
    <div className="w-full px-4 lg:px-8 pt-6 lg:pt-8 relative z-30">
      <div className="max-w-7xl mx-auto">
        <Link
          href={href}
          className="promo-shine group relative flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-4 sm:px-6 py-3 shadow-[0_8px_30px_rgba(37,99,235,0.06)] hover:shadow-[0_12px_40px_rgba(37,99,235,0.14)] hover:-translate-y-0.5 transition-all"
        >
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-1 rounded-full shadow-sm">
            <Sparkles size={12} /> {t.badge}
          </span>

          {/* Message */}
          <span className="text-slate-700 font-semibold text-sm md:text-[15px] text-center">
            {t.text}
          </span>

          {/* CTA button */}
          <span className="inline-flex items-center gap-1.5 shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-blue-600/25 transition-all group-hover:bg-blue-700 group-hover:gap-2.5 whitespace-nowrap">
            {t.cta} <ChevronRight size={16} />
          </span>

          <style>{`
            .promo-shine::before{
              content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;
              background:linear-gradient(120deg,transparent,rgba(255,255,255,.65),transparent);
              transform:skewX(-20deg);transition:left .6s ease;pointer-events:none;
            }
            .promo-shine:hover::before{left:120%}
            @media (prefers-reduced-motion: reduce){ .promo-shine::before{display:none} }
          `}</style>
        </Link>
      </div>
    </div>
  );
}